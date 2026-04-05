//! Replay v2 mode: token-count based 65 TPS timing with burst splitting.
//!
//! Streams replay events at a rate derived from each event's `tokenCount` field:
//!   delay_ms = (token_count / 65) * 1000
//!
//! Zero-token events use a fixed 15ms delay. Large bursts (>100 tokens) are
//! split into ~10-token sub-chunks to keep the inter-chunk delay perceptible.
//!
//! The bridge acts as a JSON-RPC server, handling:
//! - `initialize` → responds with capabilities
//! - `session/new` → loads session data for given demoType/sessionId, sends initial state
//! - `session/prompt` → starts streaming replay events at 65 TPS
//!
//! Events may be stored in either flat BridgeEnvelope format or wrapped format
//! (`{"envelope":{...},"tokenCount":N,...}`). The bridge extracts the envelope
//! correctly for both formats.

use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use tokio_tungstenite::{WebSocketStream, tungstenite::Message};

use crate::contract::{BridgeEnvelope, BridgeMessage, BridgeStatus};

/// Tokens per second target for replay streaming.
const TPS: f64 = 65.0;

/// Sub-chunk size when splitting large bursts.
const CHUNK_TOKENS: usize = 10;

/// Fixed delay (ms) for events with zero token count.
const ZERO_TOKEN_DELAY_MS: u64 = 15;

/// Token threshold above which events are split into sub-chunks.
const BURST_THRESHOLD: usize = 100;

/// Bridge package version used for client version validation.
const PACKAGE_VERSION: &str = env!("CARGO_PKG_VERSION");

/// Configuration for the v2 replay mode.
pub struct ReplayV2Config {
    /// Demo type subdirectory under fixtures/replay-data/.
    pub demo_type: Option<String>,
    /// Session subdirectory (e.g. "session-1").
    pub session_id: Option<String>,
    /// Optional override for the replay data base path.
    pub file_path: Option<String>,
}

/// A replay event as stored in replay-events.jsonl.
/// Supports two formats:
/// 1. Flat: `{"version":1,"seq":N,...,"tokenCount":T}` — tokenCount extracted, rest is envelope
/// 2. Wrapped: `{"envelope":{...},"tokenCount":T,...}` — envelope field contains the actual envelope
#[derive(Debug, Deserialize)]
struct ReplayEvent {
    /// Optional pre-computed token count for timing.
    #[serde(rename = "tokenCount", default)]
    token_count: Option<usize>,
    /// The rest of the event is stored as the raw JSON.
    #[serde(flatten)]
    raw: serde_json::Value,
}

impl ReplayEvent {
    /// Extract the actual BridgeEnvelope to send over the wire.
    ///
    /// For flat format, `raw` IS the envelope (minus extracted tokenCount).
    /// For wrapped format, `raw` contains an `envelope` field with the actual envelope.
    fn extract_envelope(&self) -> Result<serde_json::Value, serde_json::Error> {
        if let Some(envelope_value) = self.raw.get("envelope") {
            Ok(envelope_value.clone())
        } else {
            Ok(self.raw.clone())
        }
    }
}

/// JSON-RPC request structure for parsing client messages.
#[derive(Debug, Deserialize)]
struct JsonRpcRequest {
    jsonrpc: String,
    id: Option<u64>,
    method: String,
    #[serde(default)]
    params: serde_json::Value,
}

/// JSON-RPC response builder.
fn json_rpc_response(id: u64, result: serde_json::Value) -> serde_json::Value {
    serde_json::json!({
        "jsonrpc": "2.0",
        "id": id,
        "result": result
    })
}

/// JSON-RPC error response builder.
fn json_rpc_error(id: u64, code: i32, message: &str) -> serde_json::Value {
    serde_json::json!({
        "jsonrpc": "2.0",
        "id": id,
        "error": {
            "code": code,
            "message": message
        }
    })
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

/// Compute the delay in milliseconds for a given token count at 65 TPS.
fn delay_for_tokens(token_count: usize) -> u64 {
    if token_count == 0 {
        return ZERO_TOKEN_DELAY_MS;
    }
    ((token_count as f64 / TPS) * 1000.0) as u64
}

/// Resolve the base directory for replay data.
fn resolve_base_dir(demo_type: &str, session_id: &str, file_path: Option<&String>) -> PathBuf {
    if let Some(fp) = file_path {
        PathBuf::from(fp)
    } else {
        PathBuf::from(format!(
            "fixtures/replay-data/{}/{}",
            demo_type, session_id
        ))
    }
}

/// Send initial session state to the client wrapped in a BridgeEnvelope.
async fn send_session_state(
    ws_tx: &mut futures_util::stream::SplitSink<
        WebSocketStream<tokio::net::TcpStream>,
        Message,
    >,
    base_dir: &PathBuf,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let session_data_path = base_dir.join("session-data.json");
    if session_data_path.exists() {
        let data = fs::read_to_string(&session_data_path)?;
        let session_value: serde_json::Value = serde_json::from_str(&data)?;
        let envelope = BridgeEnvelope::new(
            BridgeMessage::acp_payload(serde_json::json!({
                "type": "session_state",
                "data": session_value,
            })),
            now_ms(),
        );
        ws_tx.send(to_text(serde_json::to_string(&envelope)?)).await?;
        tracing::info!("Sent session state from {:?}", session_data_path);
    } else {
        tracing::warn!("No session-data.json found at {:?}", session_data_path);
    }
    Ok(())
}

/// Load replay events from the JSONL file.
fn load_replay_events(base_dir: &PathBuf) -> Result<Vec<ReplayEvent>, Box<dyn std::error::Error + Send + Sync>> {
    let events_path = base_dir.join("replay-events.jsonl");
    if !events_path.exists() {
        tracing::warn!("No replay-events.jsonl found at {:?}", events_path);
        return Ok(Vec::new());
    }

    let file = fs::File::open(&events_path)?;
    let reader = BufReader::new(file);
    let events: Vec<ReplayEvent> = reader
        .lines()
        .filter_map(|line| line.ok())
        .filter(|line| !line.trim().is_empty())
        .filter_map(|line| serde_json::from_str::<ReplayEvent>(&line).ok())
        .collect();

    tracing::info!("Loaded {} replay events from {:?}", events.len(), events_path);
    Ok(events)
}

/// Stream replay events at 65 TPS.
async fn stream_events(
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

        if token_count > BURST_THRESHOLD {
            let num_chunks = (token_count + CHUNK_TOKENS - 1) / CHUNK_TOKENS;
            let chunk_delay = Duration::from_millis(delay_for_tokens(CHUNK_TOKENS));

            for chunk_idx in 0..num_chunks {
                tokio::select! {
                    msg = ws_rx.next() => {
                        match msg {
                            Some(Ok(Message::Close(_))) | None => {
                                tracing::info!("Client disconnected during replay burst");
                                return Ok(());
                            }
                            _ => continue,
                        }
                    }
                    _ = shutdown_rx.recv() => {
                        tracing::info!("Shutdown signal received");
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
                            tracing::info!("Client disconnected during replay");
                            return Ok(());
                        }
                        _ => continue,
                    }
                }
                _ = shutdown_rx.recv() => {
                    tracing::info!("Shutdown signal received");
                    return Ok(());
                }
                _ = tokio::time::sleep(delay) => {
                    let envelope_str = serde_json::to_string(&envelope_value)?;
                    ws_tx.send(to_text(envelope_str)).await?;
                }
            }
        }
    }

    tracing::info!("Replay v2 streaming complete ({} events)", events.len());
    Ok(())
}

/// Wrap a value in a BridgeEnvelope and send as acp_payload.
async fn send_envelope(
    ws_tx: &mut futures_util::stream::SplitSink<
        WebSocketStream<tokio::net::TcpStream>,
        Message,
    >,
    message: BridgeMessage,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let envelope = BridgeEnvelope::new(message, now_ms());
    ws_tx.send(to_text(serde_json::to_string(&envelope)?)).await?;
    Ok(())
}

/// Run the v2 replay mode with JSON-RPC handling and token-count based 65 TPS timing.
///
/// Protocol flow:
/// 1. Client sends `initialize` → bridge responds with capabilities
/// 2. Client sends `session/new` with demoType + sessionId → bridge loads data, responds
/// 3. Client sends `session/prompt` → bridge streams events at 65 TPS
/// 4. Bridge keeps connection open after streaming completes
pub async fn run_replay_v2_mode(
    config: ReplayV2Config,
    ws_stream: WebSocketStream<tokio::net::TcpStream>,
    mut shutdown_rx: broadcast::Receiver<()>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let (mut ws_tx, mut ws_rx) = ws_stream.split();

    // Send initial bridge status: starting
    send_envelope(&mut ws_tx, BridgeMessage::bridge_status(BridgeStatus::Starting)).await?;
    tracing::info!("Replay v2 mode ready, waiting for JSON-RPC commands");

    // Active session state
    let mut active_demo_type: Option<String> = config.demo_type.clone();
    let mut active_session_id: Option<String> = config.session_id.clone();
    let mut active_file_path: Option<String> = config.file_path.clone();
    let mut is_initialized = false;

    // Main JSON-RPC message loop
    loop {
        tokio::select! {
            msg = ws_rx.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        let text_str = text.as_ref();

                        // Try to parse as JSON-RPC request
                        match serde_json::from_str::<JsonRpcRequest>(text_str) {
                            Ok(request) => {
                                if let Err(e) = handle_json_rpc_request(
                                    &mut ws_tx,
                                    &mut ws_rx,
                                    &mut shutdown_rx,
                                    request,
                                    &mut active_demo_type,
                                    &mut active_session_id,
                                    &mut active_file_path,
                                    &mut is_initialized,
                                    &config,
                                ).await {
                                    tracing::error!("Error handling JSON-RPC request: {}", e);
                                }
                            }
                            Err(_) => {
                                // Not valid JSON-RPC — could be a version handshake or other message
                                // Check for version field (compatibility with older clients)
                                if let Ok(obj) = serde_json::from_str::<serde_json::Value>(text_str) {
                                    if let Some(client_ver) = obj.get("version").and_then(|v| v.as_str()) {
                                        if client_ver != PACKAGE_VERSION {
                                            tracing::warn!(
                                                "Version mismatch: client={} bridge={}",
                                                client_ver,
                                                PACKAGE_VERSION
                                            );
                                        } else {
                                            tracing::info!("Client version check passed: {}", client_ver);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => {
                        tracing::info!("Client disconnected");
                        break;
                    }
                    Some(Ok(Message::Ping(data))) => {
                        let _ = ws_tx.send(Message::Pong(data)).await;
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

/// Handle a single JSON-RPC request.
#[allow(clippy::too_many_arguments)]
async fn handle_json_rpc_request(
    ws_tx: &mut futures_util::stream::SplitSink<
        WebSocketStream<tokio::net::TcpStream>,
        Message,
    >,
    ws_rx: &mut futures_util::stream::SplitStream<WebSocketStream<tokio::net::TcpStream>>,
    shutdown_rx: &mut broadcast::Receiver<()>,
    request: JsonRpcRequest,
    active_demo_type: &mut Option<String>,
    active_session_id: &mut Option<String>,
    active_file_path: &mut Option<String>,
    is_initialized: &mut bool,
    config: &ReplayV2Config,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    match request.method.as_str() {
        "initialize" => {
            let request_id = request.id.unwrap_or(0);

            // Wrap the response in a BridgeEnvelope as acp_payload
            let response = json_rpc_response(request_id, serde_json::json!({
                "protocolVersion": 1,
                "capabilities": {
                    "modes": true,
                    "models": true,
                    "replay": true,
                },
                "serverInfo": {
                    "name": "acp-bridge-replay-v2",
                    "version": PACKAGE_VERSION,
                }
            }));

            let envelope = BridgeEnvelope::new(
                BridgeMessage::acp_payload(response),
                now_ms(),
            );
            ws_tx.send(to_text(serde_json::to_string(&envelope)?)).await?;
            *is_initialized = true;
            tracing::info!("Client initialized");
        }

        "session/new" => {
            let request_id = request.id.unwrap_or(0);

            // Extract demoType and sessionId from params
            let params = &request.params;
            let demo_type = params.get("demoType")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .or_else(|| active_demo_type.clone());

            let session_id = params.get("sessionId")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .or_else(|| active_session_id.clone());

            match (demo_type, session_id) {
                (Some(dt), Some(sid)) => {
                    *active_demo_type = Some(dt.clone());
                    *active_session_id = Some(sid.clone());

                    let base_dir = resolve_base_dir(&dt, &sid, active_file_path.as_ref());

                    // Send session state
                    send_session_state(ws_tx, &base_dir).await?;

                    // Send replay metadata
                    let events = load_replay_events(&base_dir)?;
                    let total = events.len() as u64;
                    let first_ts = events
                        .first()
                        .and_then(|e| e.raw.get("timestamp_ms"))
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0);

                    send_envelope(
                        ws_tx,
                        BridgeMessage::replay_metadata(
                            first_ts,
                            total,
                            Some(format!("{} / {}", dt, sid)),
                        ),
                    ).await?;

                    // Send bridge status connected
                    send_envelope(ws_tx, BridgeMessage::bridge_status(BridgeStatus::Connected)).await?;

                    // Store events for later streaming (we'll reload when prompt comes)
                    // Respond with session ID
                    let response = json_rpc_response(request_id, serde_json::json!({
                        "sessionId": sid,
                        "cwd": params.get("cwd").and_then(|v| v.as_str()).unwrap_or("/"),
                    }));

                    let envelope = BridgeEnvelope::new(
                        BridgeMessage::acp_payload(response),
                        now_ms(),
                    );
                    ws_tx.send(to_text(serde_json::to_string(&envelope)?)).await?;

                    tracing::info!("Session created: {}/{} ({} events loaded)", dt, sid, total);
                }
                _ => {
                    let error = json_rpc_error(
                        request_id,
                        -32602,
                        "Missing demoType or sessionId in session/new params",
                    );
                    let envelope = BridgeEnvelope::new(
                        BridgeMessage::acp_payload(error),
                        now_ms(),
                    );
                    ws_tx.send(to_text(serde_json::to_string(&envelope)?)).await?;
                }
            }
        }

        "session/prompt" => {
            let request_id = request.id.unwrap_or(0);

            // Acknowledge the prompt
            let response = json_rpc_response(request_id, serde_json::json!({
                "status": "streaming"
            }));
            let envelope = BridgeEnvelope::new(
                BridgeMessage::acp_payload(response),
                now_ms(),
            );
            ws_tx.send(to_text(serde_json::to_string(&envelope)?)).await?;

            // Load and stream events
            match (active_demo_type.as_ref(), active_session_id.as_ref()) {
                (Some(dt), Some(sid)) => {
                    let base_dir = resolve_base_dir(dt, sid, active_file_path.as_ref());
                    let events = load_replay_events(&base_dir)?;

                    tracing::info!("Starting replay stream: {}/{} ({} events)", dt, sid, events.len());

                    // Stream events at 65 TPS
                    stream_events(ws_tx, ws_rx, &events, shutdown_rx).await?;

                    // Send bridge status disconnected when replay is complete
                    send_envelope(ws_tx, BridgeMessage::bridge_status(BridgeStatus::Disconnected)).await?;
                    tracing::info!("Replay complete, connection kept alive");
                }
                _ => {
                    tracing::error!("No active session to replay — create session first");
                }
            }
        }

        "session/list" => {
            let request_id = request.id.unwrap_or(0);

            // For replay mode, return a placeholder session list
            let response = json_rpc_response(request_id, serde_json::json!({
                "sessions": [],
                "nextCursor": null
            }));
            let envelope = BridgeEnvelope::new(
                BridgeMessage::acp_payload(response),
                now_ms(),
            );
            ws_tx.send(to_text(serde_json::to_string(&envelope)?)).await?;
        }

        _ => {
            // Unknown method — respond with error
            if let Some(id) = request.id {
                let error = json_rpc_error(id, -32601, &format!("Method not found: {}", request.method));
                let envelope = BridgeEnvelope::new(
                    BridgeMessage::acp_payload(error),
                    now_ms(),
                );
                ws_tx.send(to_text(serde_json::to_string(&envelope)?)).await?;
            }
        }
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_delay_for_zero_tokens() {
        assert_eq!(delay_for_tokens(0), ZERO_TOKEN_DELAY_MS);
    }

    #[test]
    fn test_delay_for_single_token() {
        // 1/65 * 1000 ≈ 15.38ms
        let d = delay_for_tokens(1);
        assert_eq!(d, 15);
    }

    #[test]
    fn test_delay_for_ten_tokens() {
        // 10/65 * 1000 ≈ 153.8ms
        let d = delay_for_tokens(10);
        assert_eq!(d, 153);
    }

    #[test]
    fn test_delay_for_sixty_five_tokens() {
        // 65/65 * 1000 = 1000ms
        let d = delay_for_tokens(65);
        assert_eq!(d, 1000);
    }

    #[test]
    fn test_delay_for_large_burst() {
        // 150/65 * 1000 ≈ 2307ms (total burst delay)
        let d = delay_for_tokens(150);
        assert_eq!(d, 2307);
    }

    #[test]
    fn test_resolve_base_dir_default() {
        let config = ReplayV2Config {
            demo_type: Some("tool-calling-thinking".into()),
            session_id: Some("session-1".into()),
            file_path: None,
        };
        let path = resolve_base_dir(
            config.demo_type.as_ref().unwrap(),
            config.session_id.as_ref().unwrap(),
            config.file_path.as_ref(),
        );
        assert_eq!(
            path.to_str().unwrap(),
            "fixtures/replay-data/tool-calling-thinking/session-1"
        );
    }

    #[test]
    fn test_resolve_base_dir_override() {
        let config = ReplayV2Config {
            demo_type: Some("demo".into()),
            session_id: Some("session-1".into()),
            file_path: Some("/custom/path".into()),
        };
        let path = resolve_base_dir(
            config.demo_type.as_ref().unwrap(),
            config.session_id.as_ref().unwrap(),
            config.file_path.as_ref(),
        );
        assert_eq!(path.to_str().unwrap(), "/custom/path");
    }

    #[test]
    fn test_extract_envelope_flat_format() {
        // Flat format: raw IS the envelope
        let event: ReplayEvent = serde_json::from_str(
            r#"{"version":1,"seq":3,"timestamp_ms":1000,"type":"acp_payload","payload":{"jsonrpc":"2.0","method":"session/update","params":{}}}"#
        ).unwrap();
        let envelope = event.extract_envelope().unwrap();
        assert!(envelope.get("version").is_some());
        assert!(envelope.get("type").is_some());
        assert!(envelope.get("envelope").is_none());
    }

    #[test]
    fn test_extract_envelope_wrapped_format() {
        // Wrapped format: has "envelope" field
        let event: ReplayEvent = serde_json::from_str(
            r#"{"envelope":{"version":1,"seq":1,"timestamp_ms":1000,"type":"acp_payload","payload":{}},"tokenCount":95,"timestamp":1000,"direction":"in"}"#
        ).unwrap();
        assert_eq!(event.token_count, Some(95));
        let envelope = event.extract_envelope().unwrap();
        assert!(envelope.get("version").is_some());
        assert!(envelope.get("type").is_some());
        // The extracted envelope should NOT have the wrapper fields
        assert!(envelope.get("envelope").is_none());
        assert!(envelope.get("direction").is_none());
    }
}
