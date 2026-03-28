//! Replay mode: read newline-delimited JSON envelopes and send over WebSocket.

use std::fs::File;
use std::io::{BufRead, BufReader};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use futures_util::{SinkExt, StreamExt};
use tokio::sync::broadcast;
use tokio_tungstenite::{WebSocketStream, tungstenite::Message};

use crate::contract::{BridgeEnvelope, BridgeMessage, BridgeStatus};

pub struct ReplayConfig {
    pub file_path: String,
    pub delay_ms: Option<u64>,
}

impl Default for ReplayConfig {
    fn default() -> Self {
        Self {
            file_path: String::new(),
            delay_ms: Some(50),
        }
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

fn to_text(s: String) -> Message {
    Message::Text(s.into())
}

pub async fn run_replay_mode(
    config: ReplayConfig,
    ws_stream: WebSocketStream<tokio::net::TcpStream>,
    mut shutdown_rx: broadcast::Receiver<()>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let (mut ws_tx, mut ws_rx) = ws_stream.split();

    let status = BridgeEnvelope::new(BridgeMessage::bridge_status(BridgeStatus::Starting), now_ms());
    ws_tx.send(to_text(serde_json::to_string(&status)?)).await?;

    let file = File::open(&config.file_path)?;
    let reader = BufReader::new(file);
    let envelopes: Vec<BridgeEnvelope> = reader
        .lines()
        .filter_map(|line| line.ok())
        .filter_map(|line| serde_json::from_str::<BridgeEnvelope>(&line).ok())
        .collect();

    let total = envelopes.len() as u64;
    let first_ts = envelopes.first().map(|e| e.timestamp_ms).unwrap_or(0);

    let metadata = BridgeEnvelope::new(
        BridgeMessage::replay_metadata(first_ts, total, None),
        now_ms(),
    );
    ws_tx.send(to_text(serde_json::to_string(&metadata)?)).await?;

    let connected = BridgeEnvelope::new(BridgeMessage::bridge_status(BridgeStatus::Connected), now_ms());
    ws_tx.send(to_text(serde_json::to_string(&connected)?)).await?;

    let delay = Duration::from_millis(config.delay_ms.unwrap_or(50));

    for envelope in envelopes {
        tokio::select! {
            _ = ws_rx.next() => {
                tracing::info!("Client disconnected during replay");
                return Ok(());
            }
            _ = shutdown_rx.recv() => {
                tracing::info!("Shutdown signal received");
                return Ok(());
            }
            _ = tokio::time::sleep(delay) => {
                ws_tx.send(to_text(serde_json::to_string(&envelope)?)).await?;
            }
        }
    }

    tracing::info!("Replay complete, keeping connection open");

    loop {
        tokio::select! {
            msg = ws_rx.next() => {
                match msg {
                    Some(Ok(Message::Close(_))) | None => {
                        tracing::info!("Client closed connection");
                        break;
                    }
                    _ => {}
                }
            }
            _ = shutdown_rx.recv() => {
                tracing::info!("Shutdown signal received");
                break;
            }
        }
    }

    Ok(())
}