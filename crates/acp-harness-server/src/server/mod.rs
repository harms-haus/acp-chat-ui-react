//! WebSocket server for harness connections.
//!
//! This module provides server functionality that:
//! - Accepts WebSocket connections
//! - Waits for client initialization to determine mode
//! - Dispatches to appropriate mode handler (dynamic, replay_v2, proxy)

use std::net::SocketAddr;

use tokio::net::TcpListener;
use tokio::sync::broadcast;
use tokio_tungstenite::accept_async;

use crate::modes::{DynamicConfig, ReplayV2Config, run_dynamic_mode, run_replay_v2_mode};

/// Server configuration
pub struct ServerConfig {
    pub addr: SocketAddr,
    pub live_enabled: bool,
    pub replay_config: ReplayV2Config,
}

/// Start the WebSocket server
pub async fn run_server(config: ServerConfig) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let listener = TcpListener::bind(&config.addr).await?;
    tracing::info!("Harness server listening on {}", config.addr);

    if config.live_enabled {
        tracing::info!("Live mode enabled - clients can spawn dynamic sessions");
    } else {
        tracing::info!("Replay mode only - demo_type: {:?}, session_id: {:?}",
            config.replay_config.demo_type, config.replay_config.session_id);
    }

    let (shutdown_tx, _) = broadcast::channel::<()>(1);

    loop {
        let (stream, addr) = listener.accept().await?;
        tracing::info!("Client connected from {}", addr);

        let ws_stream = accept_async(stream).await?;
        tracing::info!("WebSocket handshake completed for {}", addr);

        let shutdown_rx = shutdown_tx.subscribe();

        let dynamic_config = DynamicConfig::default();
        let replay_config = config.replay_config.clone();

        tokio::spawn(async move {
            let result = if config.live_enabled {
                run_dynamic_mode(dynamic_config, ws_stream, shutdown_rx).await
            } else {
                run_replay_v2_mode(replay_config, ws_stream, shutdown_rx).await
            };

            if let Err(e) = result {
                tracing::error!("Harness error for {}: {}", addr, e);
            }

            tracing::info!("Client {} disconnected", addr);
        });
    }
}
