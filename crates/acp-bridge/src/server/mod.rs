//! WebSocket server for bridge connections.

use std::net::SocketAddr;

use tokio::net::TcpListener;
use tokio::sync::broadcast;

use crate::modes::{DynamicConfig, ProxyConfig, ReplayConfig, ReplayV2Config, BridgeModeHandle};

pub struct ServerConfig {
    pub addr: SocketAddr,
    pub mode: BridgeMode,
}

pub enum BridgeMode {
    Dynamic(DynamicConfig),
    Proxy(ProxyConfig),
    Replay(ReplayConfig),
    ReplayV2(ReplayV2Config),
}

pub async fn run_server(config: ServerConfig) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let listener = TcpListener::bind(&config.addr).await?;
    tracing::info!("Bridge listening on {}", config.addr);

    let (shutdown_tx, _) = broadcast::channel::<()>(1);

    loop {
        let (stream, addr) = listener.accept().await?;
        tracing::info!("Client connected from {}", addr);

        let ws_stream = tokio_tungstenite::accept_async(stream).await?;
        tracing::info!("WebSocket handshake completed for {}", addr);

    let shutdown_rx = shutdown_tx.subscribe();
    let mode = match &config.mode {
        BridgeMode::Dynamic(d) => {
            let cfg = DynamicConfig {
                default_cwd: d.default_cwd.clone(),
                default_env: d.default_env.clone(),
            };
            BridgeModeHandle::Dynamic(cfg)
        }
        BridgeMode::Proxy(p) => {
            let cfg = ProxyConfig {
                command: p.command.clone(),
                args: p.args.clone(),
                cwd: p.cwd.clone(),
                env: p.env.clone(),
            };
            BridgeModeHandle::Proxy(cfg)
        }
        BridgeMode::Replay(r) => {
            let cfg = ReplayConfig {
                file_path: r.file_path.clone(),
                delay_ms: r.delay_ms,
            };
            BridgeModeHandle::Replay(cfg)
        }
        BridgeMode::ReplayV2(r) => {
            let cfg = ReplayV2Config {
                demo_type: r.demo_type.clone(),
                session_id: r.session_id.clone(),
                file_path: r.file_path.clone(),
            };
            BridgeModeHandle::ReplayV2(cfg)
        }
    };

    tokio::spawn(async move {
        let result = match mode {
            BridgeModeHandle::Dynamic(cfg) => {
                crate::modes::run_dynamic_mode(cfg, ws_stream, shutdown_rx).await
            }
            BridgeModeHandle::Proxy(cfg) => {
                crate::modes::run_proxy_mode(cfg, ws_stream, shutdown_rx).await
            }
            BridgeModeHandle::Replay(cfg) => {
                crate::modes::run_replay_mode(cfg, ws_stream, shutdown_rx).await
            }
            BridgeModeHandle::ReplayV2(cfg) => {
                crate::modes::run_replay_v2_mode(cfg, ws_stream, shutdown_rx).await
            }
        };

            if let Err(e) = result {
                tracing::error!("Bridge error for {}: {}", addr, e);
            }

            tracing::info!("Client {} disconnected", addr);
        });
    }
}