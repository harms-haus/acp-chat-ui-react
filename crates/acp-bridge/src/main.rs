//! ACP Bridge binary entry point

use std::net::SocketAddr;

use clap::Parser;
use tracing_subscriber::EnvFilter;

use acp_bridge::{ReplayV2Config, ServerConfig, run_server};

#[derive(Parser)]
#[command(name = "acp-bridge")]
#[command(about = "WebSocket bridge for ACP stdio sessions")]
#[command(version)]
struct Cli {
    /// Enable live mode capability (server will wait for WebSocket init to determine mode)
    #[arg(long)]
    live: bool,

    /// Address to listen on
    #[arg(short, long, default_value = "127.0.0.1:8765")]
    addr: SocketAddr,

    /// Demo type for replay mode (used when not in live mode)
    #[arg(short = 't', long)]
    demo_type: Option<String>,

    /// Session ID for replay mode (used when not in live mode)
    #[arg(short = 's', long)]
    session_id: Option<String>,

  /// File path for replay mode (used when not in live mode)
  #[arg(short = 'f', long)]
  file: Option<String>,

  /// Base directory for replay data files (default: fixtures/replay-data)
  #[arg(long, default_value = "fixtures/replay-data")]
  replay_data_dir: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive(tracing::Level::INFO.into()))
        .init();

    let cli = Cli::parse();

let server_config = ServerConfig {
    addr: cli.addr,
    live_enabled: cli.live,
    replay_config: ReplayV2Config {
      demo_type: cli.demo_type,
      session_id: cli.session_id,
      file_path: cli.file,
      replay_data_dir: Some(cli.replay_data_dir),
      tps: 65.0,
    },
  };

    if cli.live {
        tracing::info!("Starting unified server with live mode enabled");
    } else {
        tracing::info!("Starting unified server (replay mode only)");
    }

    run_server(server_config).await
}