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

use std::collections::HashSet;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio::sync::{broadcast, mpsc};
use tokio_tungstenite::{WebSocketStream, tungstenite::Message};

use harms_haus_acp_ws_bridge::{BridgeEnvelope, BridgeMessage, BridgeStatus};

/// Sub-chunk size when splitting large bursts.
pub const CHUNK_TOKENS: usize = 10;

/// Fixed delay (ms) for events with zero token count.
const ZERO_TOKEN_DELAY_MS: u64 = 15;

/// Token threshold above which events are split into sub-chunks.
pub const BURST_THRESHOLD: usize = 100;

/// Bridge package version used for client version validation.
const PACKAGE_VERSION: &str = env!("CARGO_PKG_VERSION");

/// Permission response from client
#[derive(Debug, Clone, Deserialize)]
pub struct PermissionResponse {
    #[serde(rename = "requestId")]
    pub request_id: u32,
    pub action: String, // "approve" or "deny"
    #[serde(rename = "optionId", default)]
    pub option_id: Option<String>,
}

/// Permission response message from client (includes type field)
#[derive(Debug, Deserialize)]
pub struct PermissionResponseMessage {
    #[serde(rename = "type")]
    pub msg_type: String,
    #[serde(rename = "requestId")]
    pub request_id: u32,
    pub action: String, // "approve" or "deny"
    #[serde(rename = "optionId", default)]
    pub option_id: Option<String>,
}

impl From<PermissionResponseMessage> for PermissionResponse {
    fn from(msg: PermissionResponseMessage) -> Self {
        Self {
            request_id: msg.request_id,
            action: msg.action,
            option_id: msg.option_id,
        }
    }
}

/// Configuration for the v2 replay mode.
#[derive(Debug, Clone, PartialEq)]
pub struct ReplayConfig {
	/// Demo type subdirectory under fixtures/replay-data/.
	pub demo_type: Option<String>,
	/// Session subdirectory (e.g. "session-1").
	pub session_id: Option<String>,
	/// Optional override for the replay data base path.
	pub file_path: Option<String>,
	/// Base directory for replay data.
	pub replay_data_dir: Option<String>,
	/// Tokens per second for replay timing. Defaults to 65.0. Must be >= 0.01.
	pub tps: f64,
}

/// Represents a single session within a replay manifest.
#[derive(Debug, Deserialize, Clone)]
pub struct ManifestSession {
	/// Type of demo/replay for this session.
	#[serde(rename = "demoType")]
	pub demo_type: String,
	/// Unique identifier for the session.
	#[serde(rename = "sessionId")]
	pub session_id: String,
	/// List of modes available for this session.
	pub modes: Vec<String>,
	/// List of models used or available for this session.
	pub models: Vec<String>,
	/// Timestamp when the session was captured (milliseconds since epoch).
	#[serde(rename = "capturedAt")]
	pub captured_at: i64,
	/// Total token count for the session.
	#[serde(rename = "tokenCount")]
	pub token_count: i64,
	/// Total event count for the session.
	#[serde(rename = "eventCount")]
	pub event_count: i64,
	/// Optional description of the session.
	pub description: Option<String>,
}

/// Top-level manifest structure for replay data.
#[derive(Debug, Deserialize, Clone)]
pub struct ReplayManifest {
	/// Type of demo (e.g., "tool-calling-thinking").
	#[serde(rename = "demoType")]
	pub demo_type: String,
	/// List of sessions in this manifest.
	pub sessions: Vec<ManifestSession>,
}

impl ReplayConfig {
    /// Create a new config with TPS validation. Returns error if tps < 0.01.
    pub fn new(
        demo_type: Option<String>,
        session_id: Option<String>,
        file_path: Option<String>,
        replay_data_dir: Option<String>,
        tps: f64,
    ) -> Result<Self, String> {
        if tps < 0.01 {
            return Err(format!("tps must be >= 0.01, got {}", tps));
        }
        Ok(Self {
            demo_type,
            session_id,
            file_path,
            replay_data_dir,
            tps,
        })
    }
}

/// A replay event as stored in replay-events.jsonl.
/// Supports two formats:
/// 1. Flat: `{"version":1,"seq":N,...,"tokenCount":T}` — tokenCount extracted, rest is envelope
/// 2. Wrapped: `{"envelope":{...},"tokenCount":T,...}` — envelope field contains the actual envelope
#[derive(Debug, Deserialize)]
pub struct ReplayEvent {
    /// Optional pre-computed token count for timing.
    #[serde(rename = "tokenCount", default)]
    pub token_count: Option<usize>,
    /// The rest of the event is stored as the raw JSON.
    #[serde(flatten)]
    raw: serde_json::Value,
}

impl ReplayEvent {
    /// Extract the actual BridgeEnvelope to send over the wire.
    ///
    /// For flat format, `raw` IS the envelope (minus extracted tokenCount).
    /// For wrapped format, `raw` contains an `envelope` field with the actual envelope.
    pub fn extract_envelope(&self) -> Result<serde_json::Value, serde_json::Error> {
        if let Some(envelope_value) = self.raw.get("envelope") {
            Ok(envelope_value.clone())
        } else {
            Ok(self.raw.clone())
        }
    }
}

/// JSON-RPC request structure for parsing client messages.
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
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

pub fn to_text(s: String) -> Message {
    Message::Text(s.into())
}

pub fn delay_for_tokens(token_count: usize, tps: f64) -> u64 {
    if token_count == 0 {
        return ZERO_TOKEN_DELAY_MS;
    }
    if tps <= 0.0 {
        return u64::MAX;
    }
    ((token_count as f64 / tps) * 1000.0) as u64
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

/// Stream replay events at the configured TPS.
async fn stream_events(
    ws_tx: &mut futures_util::stream::SplitSink<
        WebSocketStream<tokio::net::TcpStream>,
        Message,
    >,
    events: &[ReplayEvent],
    shutdown_rx: &mut broadcast::Receiver<()>,
    permission_response_rx: &mut mpsc::Receiver<PermissionResponse>,
    client_disconnect_rx: &mut broadcast::Receiver<()>,
    tps: Arc<AtomicU64>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    for event in events {
        let token_count = event.token_count.unwrap_or(0);
        let envelope_value = event.extract_envelope()?;
        
        let delay_ms = if token_count > 0 {
            let current_tps = tps.load(Ordering::Relaxed) as f64;
            delay_for_tokens(token_count, current_tps)
        } else {
            let current_tps = tps.load(Ordering::Relaxed) as f64;
            delay_for_tokens(1, current_tps)
        };

        // Check if this is a permission_request with status: "pending"
        if let Some(payload) = envelope_value.get("payload") {
            if let Some(params) = payload.get("params") {
                if let Some(update) = params.get("update") {
                    if let Some(session_update) = update.get("sessionUpdate") {
                        if session_update.as_str() == Some("permission_request") {
                            if let Some(status) = update.get("status") {
                                if status.as_str() == Some("pending") {
                                    tracing::info!("Permission request encountered, waiting for response...");
                                    
                                    let envelope_str = serde_json::to_string(&envelope_value)?;
                                    ws_tx.send(to_text(envelope_str)).await?;
                                    
                                    tokio::select! {
                                        response = permission_response_rx.recv() => {
                                            match response {
                                                Some(resp) => {
                                                    if resp.action == "approve" {
                                                        tracing::info!("Permission approved, continuing replay");
                                                        continue;
                                                    } else if resp.action == "deny" {
                                                        tracing::info!("Permission denied, stopping replay");
                                                        return Ok(());
                                                    }
                                                }
                                                None => {
                                                    tracing::warn!("Permission response channel closed");
                                                    return Ok(());
                                                }
                                            }
                                        }
                                        _ = client_disconnect_rx.recv() => {
                                            tracing::info!("Client disconnected during permission wait");
                                            return Ok(());
                                        }
                                        _ = shutdown_rx.recv() => {
                                            tracing::info!("Shutdown signal received");
                                            return Ok(());
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Auto-split: events without tokenCount that have multi-word text content
        if token_count == 0 {
            let event_type = envelope_value
                .get("payload").and_then(|p| p.get("params"))
                .and_then(|p| p.get("update"))
                .and_then(|u| u.get("type"))
                .and_then(|t| t.as_str());

            let is_chunk_type = matches!(
                event_type,
                Some("agent_message_chunk") | Some("agent_thought_chunk")
            );

            let text_content = envelope_value
                .get("payload").and_then(|p| p.get("params"))
                .and_then(|p| p.get("update"))
                .and_then(|u| u.get("content"))
                .and_then(|c| c.as_array())
                .and_then(|arr| arr.first())
                .and_then(|item| item.get("text"))
                .and_then(|t| t.as_str())
                .map(|s| s.to_string());

            if is_chunk_type {
                if let Some(ref text) = text_content {
                    let words: Vec<&str> = text.split_whitespace().collect();
                    if words.len() > 1 {
                        let original_status = envelope_value
                            .get("payload").and_then(|p| p.get("params"))
                            .and_then(|p| p.get("update"))
                            .and_then(|u| u.get("status"))
                            .and_then(|s| s.as_str())
                            .map(|s| s.to_string());

                        for (i, word) in words.iter().enumerate() {
                            let current_tps = tps.load(Ordering::Relaxed) as f64;
                            let word_delay = if current_tps > 0.0 {
                                ((1.0 / current_tps) * 1000.0) as u64
                            } else {
                                u64::MAX
                            };

                            let mut word_envelope = envelope_value.clone();

                            if let Some(content_arr) = word_envelope
                                .get_mut("payload").and_then(|p| p.get_mut("params"))
                                .and_then(|p| p.get_mut("update"))
                                .and_then(|u| u.get_mut("content"))
                                .and_then(|c| c.as_array_mut())
                            {
                                if let Some(first) = content_arr.first_mut() {
                                    first["text"] = serde_json::Value::String(word.to_string());
                                }
                            }

                            if i < words.len() - 1 {
                                if let Some(update) = word_envelope
                                    .get_mut("payload").and_then(|p| p.get_mut("params"))
                                    .and_then(|p| p.get_mut("update"))
                                {
                                    update["status"] = serde_json::Value::String("in_progress".to_string());
                                }
                            } else if let Some(ref orig_status) = original_status {
                                if let Some(update) = word_envelope
                                    .get_mut("payload").and_then(|p| p.get_mut("params"))
                                    .and_then(|p| p.get_mut("update"))
                                {
                                    update["status"] = serde_json::Value::String(orig_status.clone());
                                }
                            }

                            let deadline = tokio::time::Instant::now() + Duration::from_millis(word_delay);
                            loop {
                                let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
                                if remaining.is_zero() {
                                    let envelope_str = serde_json::to_string(&word_envelope)?;
                                    ws_tx.send(to_text(envelope_str)).await?;
                                    break;
                                }

                                tokio::select! {
                                    _ = client_disconnect_rx.recv() => {
                                        tracing::info!("Client disconnected during replay word split");
                                        return Ok(());
                                    }
                                    _ = shutdown_rx.recv() => {
                                        tracing::info!("Shutdown signal received");
                                        return Ok(());
                                    }
                                    _ = tokio::time::sleep(remaining) => {
                                        let envelope_str = serde_json::to_string(&word_envelope)?;
                                        ws_tx.send(to_text(envelope_str)).await?;
                                        break;
                                    }
                                }
                            }
                        }
                        continue;
                    }
                }
            }
        }

        if token_count > BURST_THRESHOLD {
    let num_chunks = (token_count + CHUNK_TOKENS - 1) / CHUNK_TOKENS;

    let burst_deadline = tokio::time::Instant::now();
    for chunk_idx in 0..num_chunks {
      let current_tps = tps.load(Ordering::Relaxed) as f64;
      let chunk_deadline = burst_deadline + Duration::from_millis(delay_for_tokens(CHUNK_TOKENS, current_tps) * chunk_idx as u64);

      loop {
        let remaining = chunk_deadline.saturating_duration_since(tokio::time::Instant::now());
        if remaining.is_zero() {
          if chunk_idx == 0 {
            let envelope_str = serde_json::to_string(&envelope_value)?;
            ws_tx.send(to_text(envelope_str)).await?;
          }
          break;
        }

        tokio::select! {
          _ = client_disconnect_rx.recv() => {
            tracing::info!("Client disconnected during replay burst");
            return Ok(());
          }
          _ = shutdown_rx.recv() => {
            tracing::info!("Shutdown signal received");
            return Ok(());
          }
          _ = tokio::time::sleep(remaining) => {
            if chunk_idx == 0 {
              let envelope_str = serde_json::to_string(&envelope_value)?;
              ws_tx.send(to_text(envelope_str)).await?;
            }
            break;
          }
        }
      }
    }
  } else {
    let deadline = tokio::time::Instant::now() + Duration::from_millis(delay_ms);

    loop {
      let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
      if remaining.is_zero() {
        let envelope_str = serde_json::to_string(&envelope_value)?;
        ws_tx.send(to_text(envelope_str)).await?;
        break;
      }

      tokio::select! {
        _ = client_disconnect_rx.recv() => {
          tracing::info!("Client disconnected during replay");
          return Ok(());
        }
        _ = shutdown_rx.recv() => {
          tracing::info!("Shutdown signal received");
          return Ok(());
        }
        _ = tokio::time::sleep(remaining) => {
          let envelope_str = serde_json::to_string(&envelope_value)?;
          ws_tx.send(to_text(envelope_str)).await?;
          break;
        }
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

async fn start_replay_streaming(
    ws_tx: &mut futures_util::stream::SplitSink<
        WebSocketStream<tokio::net::TcpStream>,
        Message,
    >,
    demo_type: &str,
    session_id: &str,
    file_path: Option<&String>,
    shutdown_rx: &mut broadcast::Receiver<()>,
    tps: Arc<AtomicU64>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let base_dir = resolve_base_dir(demo_type, session_id, file_path);
    
    let events = load_replay_events(&base_dir)?;
    tracing::info!("Starting replay stream: {}/{} ({} events)", demo_type, session_id, events.len());

    let (_dummy_tx, mut dummy_rx) = tokio::sync::mpsc::channel::<PermissionResponse>(1);
    let (_dummy_disconnect_tx, mut dummy_disconnect_rx) = broadcast::channel::<()>(1);

    stream_events(ws_tx, &events, shutdown_rx, &mut dummy_rx, &mut dummy_disconnect_rx, tps).await?;

    send_envelope(ws_tx, BridgeMessage::bridge_status(BridgeStatus::Disconnected)).await?;
    tracing::info!("Replay complete, connection kept alive");
    
    Ok(())
}

/// Stream replay events after init protocol initialization.
///
/// This function is called by the unified server after successful init,
/// bypassing the JSON-RPC layer and streaming events directly.
/// Mid-replay speed changes are supported via the shared AtomicU64.
pub async fn stream_replay_after_init(
    config: ReplayConfig,
    mut ws_tx: futures_util::stream::SplitSink<
        WebSocketStream<tokio::net::TcpStream>,
        Message,
    >,
    mut shutdown_rx: broadcast::Receiver<()>,
    mut permission_response_rx: mpsc::Receiver<PermissionResponse>,
    mut client_disconnect_rx: broadcast::Receiver<()>,
    tps: Arc<AtomicU64>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {

    send_envelope(&mut ws_tx, BridgeMessage::bridge_status(BridgeStatus::Starting)).await?;

    let demo_type = config.demo_type.ok_or("missing demo_type")?;
    let session_id = config.session_id.ok_or("missing session_id")?;
    let base_dir = resolve_base_dir(&demo_type, &session_id, config.file_path.as_ref());

    tracing::info!("Streaming replay: {}/{}", demo_type, session_id);

    send_session_state(&mut ws_tx, &base_dir).await?;

    let events = load_replay_events(&base_dir)?;

    let total = events.len() as u64;
    let first_ts = events
        .first()
        .and_then(|e| e.raw.get("timestamp_ms"))
        .and_then(|v| v.as_u64())
        .unwrap_or(0);

    send_envelope(
        &mut ws_tx,
        BridgeMessage::replay_metadata(
            first_ts,
            total,
            Some(format!("{} / {}", demo_type, session_id)),
        ),
    ).await?;

    send_envelope(&mut ws_tx, BridgeMessage::bridge_status(BridgeStatus::Connected)).await?;

    stream_events(&mut ws_tx, &events, &mut shutdown_rx, &mut permission_response_rx, &mut client_disconnect_rx, tps).await?;

    send_envelope(&mut ws_tx, BridgeMessage::bridge_status(BridgeStatus::Disconnected)).await?;
    tracing::info!("Replay v2 streaming complete ({} events)", events.len());

    Ok(())
}

/// Run the v2 replay mode with JSON-RPC handling and token-count based 65 TPS timing.
///
/// Protocol flow:
/// 1. Client sends `initialize` → bridge responds with capabilities
/// 2. Client sends `session/new` with demoType + sessionId → bridge loads data, responds
/// 3. Client sends `session/prompt` → bridge streams events at 65 TPS
/// 4. Bridge keeps connection open after streaming completes
///
/// If `first_message` is provided, it will be processed as the first message from the client.
/// This is useful for dynamic mode detection where the first message has already been read.
pub async fn run_replay_mode(
    config: ReplayConfig,
    ws_stream: WebSocketStream<tokio::net::TcpStream>,
    shutdown_rx: broadcast::Receiver<()>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    run_replay_mode_with_first_message(config, ws_stream, shutdown_rx, None).await
}

/// Run replay v2 mode with a pre-read first message (for dynamic mode).
/// This allows dynamic mode to detect client type and delegate to replay handling.
pub async fn run_replay_mode_with_message(
    config: ReplayConfig,
    ws_stream: WebSocketStream<tokio::net::TcpStream>,
    shutdown_rx: broadcast::Receiver<()>,
    first_message: String,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    run_replay_mode_with_first_message(config, ws_stream, shutdown_rx, Some(first_message)).await
}

/// Internal implementation that accepts an optional first message
async fn run_replay_mode_with_first_message(
    config: ReplayConfig,
    ws_stream: WebSocketStream<tokio::net::TcpStream>,
    mut shutdown_rx: broadcast::Receiver<()>,
    first_message: Option<String>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let (mut ws_tx, mut ws_rx) = ws_stream.split();

    send_envelope(&mut ws_tx, BridgeMessage::bridge_status(BridgeStatus::Starting)).await?;
    tracing::info!("Replay v2 mode ready, waiting for JSON-RPC commands");

    let mut active_demo_type: Option<String> = config.demo_type.clone();
    let mut active_session_id: Option<String> = config.session_id.clone();
    let mut active_file_path: Option<String> = config.file_path.clone();
    let mut active_replay_data_path: Option<String> = None;
    let mut active_manifest: Option<ReplayManifest> = None;
    let mut is_initialized = false;
    let tps = Arc::new(AtomicU64::new((config.tps * 100.0) as u64));

    // Process first message if provided (for dynamic mode integration)
        if let Some(first_msg) = first_message {
            tracing::info!("Processing first message from dynamic mode");
            if let Ok(request) = serde_json::from_str::<JsonRpcRequest>(&first_msg) {
                let _ = handle_json_rpc_request(
                    &mut ws_tx,
                    &mut ws_rx,
                    &mut shutdown_rx,
                    request,
                    &mut active_demo_type,
                    &mut active_session_id,
                    &mut active_file_path,
                    &mut active_replay_data_path,
                    &mut active_manifest,
                    &mut is_initialized,
                    &tps,
                ).await;
            }
        }

    loop {
        tokio::select! {
            msg = ws_rx.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        let text_str = text.as_ref();

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
                    &mut active_replay_data_path,
                    &mut active_manifest,
                    &mut is_initialized,
                    &tps,
                ).await {
                    tracing::error!("Error handling JSON-RPC request: {}", e);
                }
                            }
                            Err(_) => {
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
    _ws_rx: &mut futures_util::stream::SplitStream<WebSocketStream<tokio::net::TcpStream>>,
    shutdown_rx: &mut broadcast::Receiver<()>,
    request: JsonRpcRequest,
    active_demo_type: &mut Option<String>,
    active_session_id: &mut Option<String>,
    active_file_path: &mut Option<String>,
    active_replay_data_path: &mut Option<String>,
    active_manifest: &mut Option<ReplayManifest>,
    is_initialized: &mut bool,
    tps: &Arc<AtomicU64>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    match request.method.as_str() {
"initialize" => {
            let request_id = request.id.unwrap_or(0);
            tracing::info!("[Rust replay.rs] initialize request received: request_id={}", request_id);

            // Extract _meta.replay.replayDataPath from initialize params if present
            let replay_data_path = request.params.get("_meta")
                .and_then(|meta| meta.get("replay"))
                .and_then(|replay| replay.get("replayDataPath"))
                .and_then(|path| path.as_str())
                .map(|s| s.to_string());

            // If replayDataPath is provided, validate and load manifest
            if let Some(ref path) = replay_data_path {
                let manifest_path = PathBuf::from(path).join("manifest.json");
                if manifest_path.exists() {
                    match fs::read_to_string(&manifest_path) {
                        Ok(manifest_str) => {
                            match serde_json::from_str::<ReplayManifest>(&manifest_str) {
                                Ok(manifest) => {
                                    tracing::info!("[Rust replay.rs] initialize: manifest loaded from {:?}: {} sessions", manifest_path, manifest.sessions.len());
                                    // Store manifest and replay data path for later use
                                    *active_manifest = Some(manifest.clone());
                                    *active_replay_data_path = replay_data_path.clone();
                                }
                                Err(e) => {
                                    tracing::warn!("Failed to parse manifest.json at {:?}: {}", manifest_path, e);
                                }
                            }
                        }
                        Err(e) => {
                            tracing::warn!("Failed to read manifest.json at {:?}: {}", manifest_path, e);
                        }
                    }
                } else {
                    tracing::warn!("manifest.json not found at {:?}", manifest_path);
                }
            }

            let mut sessions = Vec::new();
            let mut all_modes: HashSet<String> = HashSet::new();
            let mut all_models: HashSet<String> = HashSet::new();

            if let Some(ref manifest) = active_manifest {
                for session in &manifest.sessions {
                    sessions.push(serde_json::json!({
                        "sessionId": session.session_id,
                        "description": session.description,
                    }));
                    all_modes.extend(session.modes.clone());
                    all_models.extend(session.models.clone());
                }
            }

            // Wrap the response in a BridgeEnvelope as acp_payload
            let response = json_rpc_response(request_id, serde_json::json!({
                "protocolVersion": 1,
                "capabilities": {
                    "modes": true,
                    "models": true,
                    "replay": true,
                    "sessions": sessions,
                    "availableModes": all_modes.into_iter().collect::<Vec<_>>(),
                    "availableModels": all_models.into_iter().collect::<Vec<_>>(),
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
            tracing::info!("[Rust replay.rs] initialize: client initialized, sending bridge_status=Connected");

            // Send bridge_status to trigger ReplayController state update
            send_envelope(ws_tx, BridgeMessage::bridge_status(BridgeStatus::Connected)).await?;
        }

"session/new" => {
            let request_id = request.id.unwrap_or(0);

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

                    if let Some(ref manifest) = active_manifest {
                        let session_valid = manifest.sessions.iter().any(|s| s.session_id == sid);
                        if !session_valid {
                            tracing::warn!("Session {} not found in manifest, proceeding for backwards compatibility", sid);
                        }
                    }

                    send_session_state(ws_tx, &base_dir).await?;

                    let events = load_replay_events(&base_dir)?;
                    let total = events.len() as u64;
                    let first_ts = events
                        .first()
                        .and_then(|e| e.raw.get("timestamp_ms"))
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0);

                    send_envelope(
                        ws_tx,
                        BridgeMessage::replay_metadata(first_ts, total, Some(format!("{} / {}", dt, sid))),
                    ).await?;

                    send_envelope(ws_tx, BridgeMessage::bridge_status(BridgeStatus::Connected)).await?;

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

                    let _ = start_replay_streaming(
                        ws_tx,
                        &dt,
                        &sid,
                        active_file_path.as_ref(),
                        shutdown_rx,
                        tps.clone(),
                    ).await;
                }
                _ => {
                    let error = json_rpc_error(request_id, -32602, "Missing demoType or sessionId in session/new params");
                    let envelope = BridgeEnvelope::new(BridgeMessage::acp_payload(error), now_ms());
                    ws_tx.send(to_text(serde_json::to_string(&envelope)?)).await?;
                }
            }
        }

        "session/load" => {
            let request_id = request.id.unwrap_or(0);
            let params = &request.params;
            let session_id = params.get("sessionId")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .or_else(|| active_session_id.clone());

            let demo_type = if let (Some(ref manifest), Some(ref sid)) = (&active_manifest, &session_id) {
                manifest.sessions.iter()
                    .find(|s| s.session_id == *sid)
                    .map(|s| s.demo_type.clone())
            } else {
                active_demo_type.clone()
            };

            match (demo_type, session_id) {
                (Some(dt), Some(sid)) => {
                    *active_demo_type = Some(dt.clone());
                    *active_session_id = Some(sid.clone());

                    let base_dir = resolve_base_dir(&dt, &sid, active_file_path.as_ref());

                    if let Some(ref manifest) = active_manifest {
                        let session_valid = manifest.sessions.iter().any(|s| s.session_id == sid);
                        if !session_valid {
                            tracing::warn!("Session {} not found in manifest, proceeding for backwards compatibility", sid);
                        }
                    }

                    send_session_state(ws_tx, &base_dir).await?;

                    let events = load_replay_events(&base_dir)?;
                    let total = events.len() as u64;
                    let first_ts = events
                        .first()
                        .and_then(|e| e.raw.get("timestamp_ms"))
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0);

                    send_envelope(
                        ws_tx,
                        BridgeMessage::replay_metadata(first_ts, total, Some(format!("{} / {}", dt, sid))),
                    ).await?;

send_envelope(ws_tx, BridgeMessage::bridge_status(BridgeStatus::Connected)).await?;

// Build configOptions from manifest (modes and models for this session)
let mut config_options = Vec::new();
if let Some(ref manifest) = active_manifest {
if let Some(session) = manifest.sessions.iter().find(|s| s.session_id == sid) {
// Add modes from selected session
for mode in &session.modes {
config_options.push(serde_json::json!({
"type": "mode",
"id": mode,
"name": mode,
"description": format!("{} mode", mode)
}));
}
// Add models from selected session
for model in &session.models {
config_options.push(serde_json::json!({
"type": "model",
"id": model,
"name": model,
"provider": "unknown"
}));
}
}
}

let response = json_rpc_response(request_id, serde_json::json!({
"sessionId": sid,
"cwd": params.get("cwd").and_then(|v| v.as_str()).unwrap_or("/"),
"configOptions": config_options,
}));

let envelope = BridgeEnvelope::new(
BridgeMessage::acp_payload(response),
now_ms(),
);
ws_tx.send(to_text(serde_json::to_string(&envelope)?)).await?;

tracing::info!("Session loaded: {}/{} ({} events loaded, {} config options)", dt, sid, total, config_options.len());

                    let _ = start_replay_streaming(
                        ws_tx,
                        &dt,
                        &sid,
                        active_file_path.as_ref(),
                        shutdown_rx,
                        tps.clone(),
                    ).await;
                }
                _ => {
                    let error = json_rpc_error(request_id, -32602, "Missing demoType or sessionId in session/load params");
                    let envelope = BridgeEnvelope::new(BridgeMessage::acp_payload(error), now_ms());
                    ws_tx.send(to_text(serde_json::to_string(&envelope)?)).await?;
                }
            }
        }

        "session/prompt" => {
            let request_id = request.id.unwrap_or(0);

            let response = json_rpc_response(request_id, serde_json::json!({
                "status": "streaming"
            }));
            let envelope = BridgeEnvelope::new(
                BridgeMessage::acp_payload(response),
                now_ms(),
            );
            ws_tx.send(to_text(serde_json::to_string(&envelope)?)).await?;

            match (active_demo_type.as_ref(), active_session_id.as_ref()) {
                (Some(dt), Some(sid)) => {
                    let _ = start_replay_streaming(
                        ws_tx,
                        dt,
                        sid,
                        active_file_path.as_ref(),
                        shutdown_rx,
                        tps.clone(),
                    ).await;
                }
                _ => {
                    tracing::error!("No active session to replay — create session first");
                }
            }
        }

        "session/list" => {
            let request_id = request.id.unwrap_or(0);
            tracing::info!("[Rust replay.rs] session/list request received: request_id={}, manifest_state={}", 
                request_id, 
                if active_manifest.is_some() { "loaded" } else { "not_loaded" }
            );

            let sessions: Vec<serde_json::Value> = if let Some(ref manifest) = active_manifest {
                manifest.sessions.iter().map(|s| {
                    serde_json::json!({
                        "sessionId": s.session_id,
                        "cwd": active_replay_data_path.as_ref().map(|p| p.as_str()).unwrap_or("/"),
                        "title": s.description.as_deref().unwrap_or(&s.session_id),
                    })
                }).collect()
            } else {
                Vec::new()
            };

            tracing::info!("[Rust replay.rs] session/list returning {} sessions", sessions.len());

            let response = json_rpc_response(request_id, serde_json::json!({
                "sessions": sessions,
                "nextCursor": null
            }));
            let envelope = BridgeEnvelope::new(
                BridgeMessage::acp_payload(response),
                now_ms(),
            );
            ws_tx.send(to_text(serde_json::to_string(&envelope)?)).await?;
        }

        "set_replay_speed" => {
            let request_id = request.id.unwrap_or(0);

            let new_speed = request.params.get("replaySpeed")
                .and_then(|v| v.as_f64());

            match new_speed {
                Some(speed) if speed > 0.0 => {
                    // Speed is already in TPS (tokens per second), no conversion needed
                    tps.store(speed as u64, Ordering::Relaxed);
                    tracing::info!("Replay speed set to {} TPS", speed);

                    let response = json_rpc_response(request_id, serde_json::json!({
                        "replaySpeed": speed
                    }));
                    let envelope = BridgeEnvelope::new(
                        BridgeMessage::acp_payload(response),
                        now_ms(),
                    );
                    ws_tx.send(to_text(serde_json::to_string(&envelope)?)).await?;
                }
                _ => {
                    let error = json_rpc_error(
                        request_id,
                        -32602,
                        "Invalid replaySpeed: must be a positive number",
                    );
                    let envelope = BridgeEnvelope::new(
                        BridgeMessage::acp_payload(error),
                        now_ms(),
                    );
                    ws_tx.send(to_text(serde_json::to_string(&envelope)?)).await?;
                }
            }
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
        assert_eq!(delay_for_tokens(0, 65.0), ZERO_TOKEN_DELAY_MS);
    }

    #[test]
    fn test_delay_for_single_token() {
        let d = delay_for_tokens(1, 65.0);
        assert_eq!(d, 15);
    }

    #[test]
    fn test_delay_for_ten_tokens() {
        let d = delay_for_tokens(10, 65.0);
        assert_eq!(d, 153);
    }

    #[test]
    fn test_delay_for_sixty_five_tokens() {
        let d = delay_for_tokens(65, 65.0);
        assert_eq!(d, 1000);
    }

    #[test]
    fn test_delay_for_large_burst() {
        let d = delay_for_tokens(150, 65.0);
        assert_eq!(d, 2307);
    }

    #[test]
    fn test_resolve_base_dir_default() {
    let config = ReplayConfig {
        demo_type: Some("tool-calling-thinking".into()),
        session_id: Some("session-1".into()),
        file_path: None,
        replay_data_dir: None,
        tps: 65.0,
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
    let config = ReplayConfig {
        demo_type: Some("demo".into()),
        session_id: Some("session-1".into()),
        file_path: Some("/custom/path".into()),
        replay_data_dir: None,
        tps: 65.0,
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
