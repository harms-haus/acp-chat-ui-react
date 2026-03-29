//! Dynamic proxy mode: wait for StartAgent message then spawn and proxy ACP process.

use std::os::unix::process::ExitStatusExt;
use std::process::Stdio;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use futures_util::{SinkExt, StreamExt};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::{broadcast, mpsc};
use tokio_tungstenite::{WebSocketStream, tungstenite::Message};

use crate::contract::{BridgeEnvelope, BridgeMessage, BridgeStatus};

pub struct DynamicConfig {
    pub default_cwd: Option<String>,
    pub default_env: Vec<(String, String)>,
}

impl Default for DynamicConfig {
    fn default() -> Self {
        Self {
            default_cwd: None,
            default_env: Vec::new(),
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

pub async fn run_dynamic_mode(
    config: DynamicConfig,
    ws_stream: WebSocketStream<tokio::net::TcpStream>,
    mut shutdown_rx: broadcast::Receiver<()>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let (ws_tx, mut ws_rx) = ws_stream.split();
    let ws_tx = Arc::new(tokio::sync::Mutex::new(ws_tx));

    let (out_tx, mut out_rx) = mpsc::unbounded_channel::<BridgeEnvelope>();

    send_envelope(&out_tx, BridgeMessage::bridge_status(BridgeStatus::Starting))?;

    // Wait for StartAgent message from client
    let start_agent = loop {
        tokio::select! {
            msg = ws_rx.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        if let Ok(envelope) = serde_json::from_str::<BridgeEnvelope>(&text) {
                            if let BridgeMessage::StartAgent { command, args, cwd, env } = envelope.message {
                                break Some((command, args, cwd, env));
                            }
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => {
                        tracing::info!("Client disconnected before StartAgent");
                        return Ok(());
                    }
                    _ => {}
                }
            }
            _ = shutdown_rx.recv() => {
                tracing::info!("Shutdown signal received while waiting for StartAgent");
                return Ok(());
            }
        }
    };

    let (command, args, cwd, env) = match start_agent {
        Some(cfg) => cfg,
        None => {
            tracing::error!("No StartAgent message received");
            return Ok(());
        }
    };

    let cwd = cwd.or(config.default_cwd.clone()).map(|p| {
        if p.starts_with("~/") {
            if let Ok(home) = std::env::var("HOME") {
                return format!("{}{}", home, &p[1..]);
            }
        }
        p
    });

    let (resolved_command, resolved_args) = if command.contains('/') {
        (command.clone(), args.clone())
    } else {
        match which::which(&command) {
            Ok(path) => {
                tracing::info!("Resolved '{}' to {:?}", command, path);
                (path.to_string_lossy().to_string(), args.clone())
            }
            Err(_) => {
                tracing::info!("Command '{}' not found in PATH, using shell execution", command);
                let shell_args = vec!["-c".to_string(), format!("{} {}", command, args.join(" "))];
                ("/bin/sh".to_string(), shell_args)
            }
        }
    };

    tracing::info!("Spawning agent: command={}, args={:?}, cwd={:?}", resolved_command, resolved_args, cwd);
    let mut cmd = Command::new(&resolved_command);
    cmd.args(&resolved_args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    if let Some(cwd) = &cwd {
        tracing::info!("Setting working directory: {}", cwd);
        cmd.current_dir(cwd);
    }

    if let Ok(path) = std::env::var("PATH") {
        cmd.env("PATH", path);
    }

    let mut merged_env = config.default_env.clone();
    merged_env.extend(env);
    for (key, value) in &merged_env {
        cmd.env(key, value);
    }

    let mut child = cmd.spawn().map_err(|e| {
        tracing::error!("Failed to spawn process '{}': {} (cwd={:?})", resolved_command, e, cwd);
        e
    })?;
    let _pid = child.id().unwrap_or(0);

    let stdout = child.stdout.take().expect("stdout should be piped");
    let stderr = child.stderr.take().expect("stderr should be piped");
    let stdin = child.stdin.take().expect("stdin should be piped");

    let stdin = Arc::new(tokio::sync::Mutex::new(stdin));
    let stdin_clone = stdin.clone();

    send_envelope(&out_tx, BridgeMessage::bridge_status(BridgeStatus::Connected))?;

    // Spawn tasks for stdout, stderr, child process, and websocket handling
    let out_tx_stdout = out_tx.clone();
    let stdout_fut = async move {
        let mut reader = BufReader::new(stdout).lines();
        let mut batch: Vec<serde_json::Value> = Vec::new();

        while let Ok(Some(line)) = reader.next_line().await {
            let payload: serde_json::Value = serde_json::from_str(&line)
                .unwrap_or(serde_json::Value::String(line));

            if is_session_update(&payload) {
                batch.push(payload);

                if batch.len() >= 100 {
                    let batched = create_batched_payload(std::mem::take(&mut batch));
                    let _ = send_envelope(&out_tx_stdout, BridgeMessage::acp_payload(batched));
                }
            } else {
                if !batch.is_empty() {
                    let batched = create_batched_payload(std::mem::take(&mut batch));
                    let _ = send_envelope(&out_tx_stdout, BridgeMessage::acp_payload(batched));
                }
                let _ = send_envelope(&out_tx_stdout, BridgeMessage::acp_payload(payload));
            }
        }

        if !batch.is_empty() {
            let batched = create_batched_payload(batch);
            let _ = send_envelope(&out_tx_stdout, BridgeMessage::acp_payload(batched));
        }
    };

    let out_tx_stderr = out_tx.clone();
    let stderr_fut = async move {
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let _ = send_envelope(&out_tx_stderr, BridgeMessage::stderr(line));
        }
    };

    let out_tx_exit = out_tx.clone();
    let child_fut = async move {
        let status = child.wait().await.ok();
        let code = status.and_then(|s| s.code());
        let signal = status.and_then(|s| s.signal()).map(|s| format!("{:?}", s));
        let _ = send_envelope(&out_tx_exit, BridgeMessage::process_exit(code, signal));
        let _ = send_envelope(&out_tx_exit, BridgeMessage::bridge_status(BridgeStatus::Disconnected));
    };

    let ws_recv_fut = async {
        while let Some(msg) = ws_rx.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    if let Err(e) = write_to_stdin(stdin_clone.clone(), &text).await {
                        tracing::error!("stdin write error: {}", e);
                    }
                }
                Ok(Message::Close(_)) | Err(_) => break,
                _ => {}
            }
        }
    };

    let ws_send_fut = async {
        let tx = ws_tx.clone();
        let mut tx = tx.lock().await;
        while let Some(envelope) = out_rx.recv().await {
            let json = serde_json::to_string(&envelope).unwrap();
            if tx.send(to_text(json)).await.is_err() {
                break;
            }
        }
    };

    tokio::select! {
        _ = stdout_fut => {},
        _ = stderr_fut => {},
        _ = child_fut => {},
        _ = ws_recv_fut => {},
        _ = ws_send_fut => {},
        _ = shutdown_rx.recv() => {},
    }

    Ok(())
}

fn send_envelope(tx: &mpsc::UnboundedSender<BridgeEnvelope>, message: BridgeMessage) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let envelope = BridgeEnvelope::new(message, now_ms());
    tx.send(envelope)?;
    Ok(())
}

async fn write_to_stdin(
    stdin: Arc<tokio::sync::Mutex<tokio::process::ChildStdin>>,
    text: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut stdin = stdin.lock().await;
    stdin.write_all(text.as_bytes()).await?;
    stdin.write_all(b"\n").await?;
    Ok(())
}

fn is_session_update(payload: &serde_json::Value) -> bool {
    if let Some(obj) = payload.as_object() {
        if let Some(method) = obj.get("method") {
            return method.as_str() == Some("session/update");
        }
    }
    false
}

fn create_batched_payload(updates: Vec<serde_json::Value>) -> serde_json::Value {
    serde_json::json!({
        "jsonrpc": "2.0",
        "method": "session/update",
        "params": {
            "batched": true,
            "updates": updates
        }
    })
}
