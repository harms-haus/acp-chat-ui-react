use std::time::Duration;
use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use tokio_tungstenite::tungstenite::Message;
use crate::modes::replay_v2::{ReplayEvent, delay_for_tokens, BURST_THRESHOLD, CHUNK_TOKENS, to_text};

pub async fn stream_events_with_text_streaming(
    ws_tx: &mut futures_util::stream::SplitSink<
        WebSocketStream<tokio::net::TcpStream>,
        Message,
    >,
    ws_rx: &mut futures_util::stream::SplitStream<WebSocketStream<tokio::net::TcpStream>>,
    events: &[ReplayEvent],
    shutdown_rx: &mut broadcast::Receiver<()>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    for event in events {
        let token_count = event.token_count.unwrap_or(0);
        let envelope_value = event.extract_envelope()?;

        if let Some(text_content) = extract_text_content(&envelope_value) {
            if !text_content.is_empty() && text_content.len() > 1 {
                stream_text_chunk(ws_tx, ws_rx, envelope_value, &text_content, token_count, shutdown_rx).await?;
                continue;
            }
        }

        // Non-text events use normal timing
        if token_count > BURST_THRESHOLD {
            let num_chunks = (token_count + CHUNK_TOKENS - 1) / CHUNK_TOKENS;
            let chunk_delay = Duration::from_millis(delay_for_tokens(CHUNK_TOKENS));

            for chunk_idx in 0..num_chunks {
                tokio::select! {
                    msg = ws_rx.next() => {
                        match msg {
                            Some(Ok(Message::Close(_))) | None => {
                                return Ok(());
                            }
                            _ => continue,
                        }
                    }
                    _ = shutdown_rx.recv() => {
                        return Ok(());
                    }
                    _ = tokio::time::sleep(chunk_delay) => {
                        if chunk_idx == 0 {
                            let envelope_str = serde_json::to_string(&envelope_value)?;
                            ws_tx.send(to_text(envelope_str)).await?;
                        }
                    }
                }
            }
        } else {
            let delay = Duration::from_millis(delay_for_tokens(token_count));
            tokio::select! {
                msg = ws_rx.next() => {
                    match msg {
                        Some(Ok(Message::Close(_))) | None => {
                            return Ok(());
                        }
                        _ => continue,
                    }
                }
                _ = shutdown_rx.recv() => {
                    return Ok(());
                }
                _ = tokio::time::sleep(delay) => {
                    let envelope_str = serde_json::to_string(&envelope_value)?;
                    ws_tx.send(to_text(envelope_str)).await?;
                }
            }
        }
    }
    Ok(())
}

fn extract_text_content(envelope: &Value) -> Option<String> {
    let payload = envelope.get("payload")?.as_object()?;
    let params = payload.get("params")?.as_object()?;
    let update = params.get("update")?.as_object()?;
    let update_type = update.get("type")?.as_str()?;
    
    if !update_type.contains("chunk") {
        return None;
    }
    
    let content = update.get("content")?.as_array()?;
    let mut texts = Vec::new();
    
    for item in content {
        if let Some(obj) = item.as_object() {
            if obj.get("type").and_then(|t| t.as_str()) == Some("text") {
                if let Some(text) = obj.get("text").and_then(|t| t.as_str()) {
                    texts.push(text);
                }
            }
        }
    }
    
    if texts.is_empty() {
        None
    } else {
        Some(texts.join(" "))
    }
}

async fn stream_text_chunk(
    ws_tx: &mut futures_util::stream::SplitSink<WebSocketStream<tokio::net::TcpStream>, Message>,
    ws_rx: &mut futures_util::stream::SplitStream<WebSocketStream<tokio::net::TcpStream>>,
    mut envelope_template: Value,
    full_text: &str,
    token_count: usize,
    shutdown_rx: &mut broadcast::Receiver<()>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let chars: Vec<char> = full_text.chars().collect();
    let total_chars = chars.len();
    
    if total_chars == 0 {
        return Ok(());
    }
    
    let total_delay_ms = delay_for_tokens(token_count);
    let delay_per_char = Duration::from_millis(total_delay_ms / total_chars as u64);
    
    for i in 0..total_chars {
        let partial_text: String = chars[0..=i].iter().collect();
        update_envelope_text(&mut envelope_template, &partial_text);
        
        let envelope_str = serde_json::to_string(&envelope_template)?;
        
        tokio::select! {
            msg = ws_rx.next() => {
                match msg {
                    Some(Ok(Message::Close(_))) | None => {
                        return Ok(());
                    }
                    _ => {}
                }
            }
            _ = shutdown_rx.recv() => {
                return Ok(());
            }
            _ = tokio::time::sleep(delay_per_char) => {
                ws_tx.send(to_text(envelope_str)).await?;
            }
        }
    }
    
    Ok(())
}

fn update_envelope_text(envelope: &mut Value, new_text: &str) {
    if let Some(payload) = envelope.get_mut("payload").and_then(|p| p.as_object_mut()) {
        if let Some(params) = payload.get_mut("params").and_then(|p| p.as_object_mut()) {
            if let Some(update) = params.get_mut("update").and_then(|p| p.as_object_mut()) {
                if let Some(content) = update.get_mut("content").and_then(|c| c.as_array_mut()) {
                    for item in content.iter_mut() {
                        if let Some(obj) = item.as_object_mut() {
                            if obj.get("type").and_then(|t| t.as_str()) == Some("text") {
                                obj.insert("text".to_string(), Value::String(new_text.to_string()));
                            }
                        }
                    }
                }
            }
        }
    }
}
