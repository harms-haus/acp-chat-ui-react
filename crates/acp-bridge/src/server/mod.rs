//! WebSocket server for bridge connections with init protocol.

use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::broadcast;

use tokio::net::TcpListener;
use serde::Deserialize;
use futures_util::{SinkExt, StreamExt};

use crate::modes::{ReplayV2Config, PermissionResponse, stream_replay_after_init};

/// Session state tracks initialization progress
#[derive(Debug, Clone, PartialEq)]
pub enum SessionState {
    Uninitialized,
    ReplayLoaded { config: ReplayV2Config },
    LiveLoaded,
}

/// Init message structure from client
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename = "init")]
pub struct InitMessage {
    pub mode: String,
    #[serde(default, rename = "initId")]
    pub init_id: Option<String>,
    #[serde(default)]
    pub script: Option<String>,
    #[serde(default, rename = "sessionId")]
    pub session_id: Option<String>,
    #[serde(default)]
    pub command: Option<String>,
    #[serde(default)]
    pub args: Option<Vec<String>>,
    #[serde(default)]
    pub cwd: Option<String>,
    #[serde(default, rename = "replaySpeed")]
    pub replay_speed: Option<f64>,
}

/// Disconnect message structure from client
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename = "disconnect")]
pub struct DisconnectMessage {
    // No additional fields - just type: "disconnect"
}

/// Permission response message structure from client
#[derive(Debug, Deserialize, Clone)]
pub struct PermissionResponseMessage {
    #[serde(rename = "type")]
    pub message_type: String, // "permission_response"
    #[serde(rename = "requestId")]
    pub request_id: u32,
    pub action: String, // "approve" or "deny"
    #[serde(rename = "optionId", default)]
    pub option_id: Option<String>,
}

/// Server configuration with shared state for init protocol
pub struct ServerConfig {
    pub addr: SocketAddr,
    pub live_enabled: bool,
    pub replay_config: ReplayV2Config,
}

pub async fn run_server(config: ServerConfig) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let listener = TcpListener::bind(&config.addr).await?;
    tracing::info!("Bridge listening on {}", config.addr);

    let (shutdown_tx, _) = broadcast::channel::<()>(1);
    let config = Arc::new(config);

    loop {
        let (stream, addr) = listener.accept().await?;
        tracing::info!("Client connected from {}", addr);

        let ws_stream = tokio_tungstenite::accept_async(stream).await?;
        tracing::info!("WebSocket handshake completed for {}", addr);

        let shutdown_rx = shutdown_tx.subscribe();
        let config = Arc::clone(&config);
        let shutdown_tx = shutdown_tx.clone();

        tokio::spawn(async move {
            let result = run_client_session(ws_stream, shutdown_rx, shutdown_tx, config).await;

            if let Err(e) = result {
                tracing::error!("Bridge error for {}: {}", addr, e);
            }

            tracing::info!("Client {} disconnected", addr);
        });
    }
}

async fn run_client_session(
    ws_stream: tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>,
    mut shutdown_rx: broadcast::Receiver<()>,
    shutdown_tx: broadcast::Sender<()>,
    config: Arc<ServerConfig>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use futures_util::StreamExt;
    
    let (mut ws_tx, mut ws_rx) = ws_stream.split();
    
    loop {
        let state = wait_for_init_and_handle(&mut ws_tx, &mut ws_rx, &config, &mut shutdown_rx).await?;

        match state {
            SessionState::ReplayLoaded { config: replay_config } => {
                use tokio::sync::mpsc;
                use tokio_tungstenite::tungstenite::Message;
                use crate::modes::replay_v2::PermissionResponseMessage;
                use crate::modes::replay_v2::PermissionResponse;
                use std::sync::atomic::{AtomicU64, Ordering};

                let (perm_tx, perm_rx) = mpsc::channel::<PermissionResponse>(1);
                let (disconnect_tx, disconnect_rx) = broadcast::channel::<()>(1);

                let tps = std::sync::Arc::new(AtomicU64::new((replay_config.tps * 100.0) as u64));

                let reunited_stream = match ws_tx.reunite(ws_rx) {
                    Ok(stream) => stream,
                    Err(_) => {
                        tracing::error!("Failed to reunite ws stream for replay");
                        return Ok(());
                    }
                };

                let (stream_tx, mut stream_rx) = reunited_stream.split();

                let disconnect_tx_clone = disconnect_tx.clone();
                let tps_clone = tps.clone();
                let msg_reader_handle = tokio::spawn(async move {
                    use futures_util::StreamExt;
                    tracing::info!("Message reader task started");
                    while let Some(msg) = stream_rx.next().await {
                        match msg {
                            Ok(Message::Text(text)) => {
                                tracing::debug!("Received WebSocket message: {}", text);
                                if let Ok(perm_resp_msg) = serde_json::from_str::<PermissionResponseMessage>(&text) {
                                    tracing::info!("Parsed permission response: request_id={}, action={}, option_id={:?}", 
                                        perm_resp_msg.request_id, perm_resp_msg.action, perm_resp_msg.option_id);
                                    if perm_resp_msg.msg_type == "permission_response" {
                                        match perm_tx.send(PermissionResponse {
                                            request_id: perm_resp_msg.request_id,
                                            action: perm_resp_msg.action,
                                            option_id: perm_resp_msg.option_id,
                                        }).await {
                                            Ok(_) => tracing::info!("Permission response forwarded to replay stream"),
                                            Err(e) => tracing::error!("Failed to forward permission response: {}", e),
                                        }
                                    }
                                } else if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                                    if val.get("method").and_then(|v| v.as_str()) == Some("set_replay_speed") {
                                        if let Some(speed) = val.get("params").and_then(|p| p.get("replaySpeed")).and_then(|v| v.as_f64()) {
                                            if speed > 0.0 {
                                                let stored_tps = (speed * 100.0) as u64;
                                                tps_clone.store(stored_tps, Ordering::Relaxed);
                                                tracing::info!("Mid-replay speed changed to {} TPS (internally stored as {})", speed, stored_tps);
                                            }
                                        }
                                    } else {
                                        tracing::debug!("Message is not a permission_response or set_replay_speed: {}", text);
                                    }
                                }
                            }
                            Ok(Message::Close(_)) | Err(_) => {
                                tracing::info!("Client disconnected in message reader");
                                let _ = disconnect_tx_clone.send(());
                                break;
                            }
                            _ => {}
                        }
                    }
                    tracing::info!("Message reader task ended");
                });

                let replay_shutdown = shutdown_tx.subscribe();
                let result = stream_replay_after_init(replay_config, stream_tx, replay_shutdown, perm_rx, disconnect_rx, tps).await;

                msg_reader_handle.abort();

                result?;

                break;
            }
            _ => {
                match wait_for_messages(&mut ws_tx, &mut ws_rx, &mut shutdown_rx, None).await {
            Ok(reason) => {
                tracing::info!("Session ended: {:?}, waiting for new init", reason);
                // Reunite stream - if it fails, just return (connection is broken anyway)
                match ws_tx.reunite(ws_rx) {
                    Ok(stream) => {
                        let (new_tx, new_rx) = stream.split();
                        ws_tx = new_tx;
                        ws_rx = new_rx;
                    }
                    Err(_e) => {
                        tracing::error!("Failed to reunite ws stream: stream lost");
                        return Ok(());
                    }
                }
                continue;
            }
            Err(e) => return Err(e),
        }
            }
        }
    }

    Ok(())
}

async fn wait_for_init_and_handle(
    ws_tx: &mut futures_util::stream::SplitSink<
        tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>,
        tokio_tungstenite::tungstenite::Message,
    >,
    ws_rx: &mut futures_util::stream::SplitStream<tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>>,
    config: &ServerConfig,
    shutdown_rx: &mut broadcast::Receiver<()>,
) -> Result<SessionState, Box<dyn std::error::Error + Send + Sync>> {
    loop {
        tokio::select! {
            msg = ws_rx.next() => {
                match msg {
                    Some(Ok(tokio_tungstenite::tungstenite::Message::Text(text))) => {
                        match serde_json::from_str::<InitMessage>(&text) {
                            Ok(init_msg) => {
                                match handle_init_message(ws_tx, init_msg, config).await {
                                    Ok(state) => return Ok(state),
                                    Err(e) => {
                                        let error_response = serde_json::json!({
                                            "error": e.to_string()
                                        });
                                        let _ = ws_tx.send(tokio_tungstenite::tungstenite::Message::Text(serde_json::to_string(&error_response)?.into())).await;
                                        let _ = ws_tx.flush().await;
                                        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
                                        return Ok(SessionState::Uninitialized);
                                    }
                                }
                            }
                    Err(e) => {
                                let error_response = serde_json::json!({
                                    "error": e.to_string()
                                });
                                ws_tx.send(tokio_tungstenite::tungstenite::Message::Text(serde_json::to_string(&error_response)?.into())).await?;
                                ws_tx.flush().await?;
                                tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
                                return Ok(SessionState::Uninitialized);
                            }
                        }
                    }
                    Some(Ok(tokio_tungstenite::tungstenite::Message::Close(_))) | None => {
                        tracing::info!("Client disconnected before initialization");
                        return Ok(SessionState::Uninitialized);
                    }
                    Some(Ok(tokio_tungstenite::tungstenite::Message::Ping(data))) => {
                        let _ = ws_tx.send(tokio_tungstenite::tungstenite::Message::Pong(data)).await;
                    }
                    _ => {}
                }
            }
            _ = shutdown_rx.recv() => {
                tracing::info!("Shutdown signal received before initialization");
                return Ok(SessionState::Uninitialized);
            }
        }
    }
}

async fn handle_init_message(
    ws_tx: &mut futures_util::stream::SplitSink<
        tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>,
        tokio_tungstenite::tungstenite::Message,
    >,
    init_msg: InitMessage,
    config: &ServerConfig,
) -> Result<SessionState, Box<dyn std::error::Error + Send + Sync>> {
    match init_msg.mode.as_str() {
        "replay" => {
            let script = init_msg.script.ok_or("invalid init payload: missing field 'script'")?;
            let session_id = init_msg.session_id.ok_or("invalid init payload: missing field 'sessionId'")?;

    // Resolve path relative to current working directory using config
    let base_dir = config.replay_config.replay_data_dir.as_deref().unwrap_or("fixtures/replay-data");
    let script_path_buf = std::path::PathBuf::from(base_dir).join(&script).join(&session_id);
            
            // Log the absolute path for debugging
            let abs_script_path = std::env::current_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."))
                .join(&script_path_buf);
            tracing::debug!("Looking for replay script at: {}", abs_script_path.display());
            
    if !script_path_buf.exists() {
      tracing::error!("Script not found at: {}", abs_script_path.display());
      return Err(format!("script not found: {}/{}/{}", base_dir, script, session_id).into());
    }

    // Validate replay speed before sending success response
    let tps_value = init_msg.replay_speed.unwrap_or(65.0);
    if tps_value <= 0.0 {
        return Err(format!("replay_speed must be > 0.0, got {}", tps_value).into());
    }

    let replay_config = ReplayV2Config {
      demo_type: Some(script.clone()),
      session_id: Some(session_id.clone()),
      file_path: Some(format!("{}/{}/{}", base_dir, script, session_id)),
      replay_data_dir: Some(base_dir.to_string()),
      tps: tps_value,
    };

            let success_response = serde_json::json!({
                "type": "init",
                "initId": init_msg.init_id,
                "status": "success",
                "mode": "replay"
            });
            ws_tx.send(tokio_tungstenite::tungstenite::Message::Text(
                serde_json::to_string(&success_response)?.into()
            )).await?;

            tracing::info!("Replay mode initialized: {}/{}", script, session_id);
            
            Ok(SessionState::ReplayLoaded { config: replay_config })
        }
        "live" => {
            if !config.live_enabled {
                return Err("live mode not enabled".into());
            }

            let _command = init_msg.command.ok_or("invalid init payload: missing field 'command'")?;
            let _args = init_msg.args.ok_or("invalid init payload: missing field 'args'")?;
            let _cwd = init_msg.cwd.ok_or("invalid init payload: missing field 'cwd'")?;

            let success_response = serde_json::json!({
                "type": "init",
                "initId": init_msg.init_id,
                "status": "success",
                "mode": "live"
            });
            ws_tx.send(tokio_tungstenite::tungstenite::Message::Text(
                serde_json::to_string(&success_response)?.into()
            )).await?;

            tracing::info!("Live mode initialized");
            Ok(SessionState::LiveLoaded)
        }
        _ => {
            Err(format!("invalid mode: {}", init_msg.mode).into())
        }
    }
}

async fn wait_for_messages(
    ws_tx: &mut futures_util::stream::SplitSink<tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>, tokio_tungstenite::tungstenite::Message>,
    ws_rx: &mut futures_util::stream::SplitStream<tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>>,
    shutdown_rx: &mut broadcast::Receiver<()>,
    _permission_tx: Option<&tokio::sync::mpsc::Sender<PermissionResponse>>,
) -> Result<DisconnectReason, Box<dyn std::error::Error + Send + Sync>> {
    loop {
        tokio::select! {
            msg = ws_rx.next() => {
                match msg {
                    Some(Ok(tokio_tungstenite::tungstenite::Message::Text(text))) => {
                        // Check for permission_response message
                        if let Ok(perm_resp) = serde_json::from_str::<PermissionResponseMessage>(&text) {
                            tracing::info!("Permission response received: request_id={}, action={}", perm_resp.request_id, perm_resp.action);
                            // Forward to replay stream if channel exists
                            if let Some(tx) = _permission_tx {
                                let response = PermissionResponse {
                                    request_id: perm_resp.request_id,
                                    action: perm_resp.action,
                                    option_id: perm_resp.option_id,
                                };
                                if let Err(e) = tx.send(response).await {
                                    tracing::error!("Failed to send permission response: {}", e);
                                }
                            }
                            continue;
                        }
                        
                        // Check for disconnect message
                        if let Ok(_disconnect) = serde_json::from_str::<DisconnectMessage>(&text) {
                            tracing::info!("Disconnect request received");
                            let success_response = serde_json::json!({
                                "status": "success"
                            });
                            ws_tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                serde_json::to_string(&success_response)?.into()
                            )).await?;
                            ws_tx.flush().await?;
                            return Ok(DisconnectReason::ClientRequested);
                        }
                    }
                    Some(Ok(tokio_tungstenite::tungstenite::Message::Close(_))) | None => {
                        tracing::info!("Client disconnected");
                        return Ok(DisconnectReason::ClientClosed);
                    }
                    Some(Ok(tokio_tungstenite::tungstenite::Message::Ping(data))) => {
                        let _ = ws_tx.send(tokio_tungstenite::tungstenite::Message::Pong(data)).await;
                    }
                    _ => {}
                }
            }
            _ = shutdown_rx.recv() => {
                tracing::info!("Shutdown signal received");
                return Ok(DisconnectReason::ServerShutdown);
            }
        }
    }
}

/// Reason for disconnect/session end
#[derive(Debug, Clone, PartialEq)]
enum DisconnectReason {
    ClientRequested,
    ClientClosed,
    ServerShutdown,
}