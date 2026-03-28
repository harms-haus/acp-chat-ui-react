//! ACP Bridge binary entry point

use std::net::SocketAddr;

use clap::{Parser, Subcommand};
use tracing_subscriber::EnvFilter;

use acp_bridge::{BridgeMode, ProxyConfig, ReplayConfig, ServerConfig, run_server};

#[derive(Parser)]
#[command(name = "acp-bridge")]
#[command(about = "WebSocket bridge for ACP stdio sessions")]
#[command(version)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    Proxy {
        #[arg(short, long, default_value = "127.0.0.1:8765")]
        addr: SocketAddr,
        #[arg(short = 'c', long)]
        command: String,
        #[arg(long)]
        args: Vec<String>,
        #[arg(short = 'w', long)]
        cwd: Option<String>,
    },
    Replay {
        #[arg(short, long, default_value = "127.0.0.1:8765")]
        addr: SocketAddr,
        #[arg(short = 'f', long)]
        file: String,
        #[arg(short = 'd', long, default_value = "50")]
        delay_ms: u64,
    },
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive(tracing::Level::INFO.into()))
        .init();

    let cli = Cli::parse();

    let server_config = match cli.command {
        Commands::Proxy { addr, command, args, cwd } => {
            tracing::info!("Starting proxy mode: {} {:?}", command, args);
            ServerConfig {
                addr,
                mode: BridgeMode::Proxy(ProxyConfig {
                    command,
                    args,
                    cwd,
                    env: Vec::new(),
                }),
            }
        }
        Commands::Replay { addr, file, delay_ms } => {
            tracing::info!("Starting replay mode: {} (delay: {}ms)", file, delay_ms);
            ServerConfig {
                addr,
                mode: BridgeMode::Replay(ReplayConfig {
                    file_path: file,
                    delay_ms: Some(delay_ms),
                }),
            }
        }
    };

    run_server(server_config).await
}