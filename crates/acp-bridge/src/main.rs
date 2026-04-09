//! ACP Bridge binary entry point

use std::fs;
use std::net::SocketAddr;
use std::path::PathBuf;

use clap::{Parser, Subcommand};
use tracing_subscriber::EnvFilter;

use acp_bridge::{ReplayV2Config, ServerConfig, run_server};

#[derive(Subcommand)]
enum Commands {
    /// Convert script file to replay JSONL
    ConvertScript {
        /// Path to input XML script file
        #[arg(long)]
        script: String,

        /// Path to output directory
        #[arg(long)]
        output: String,

        /// Overwrite existing files without asking
        #[arg(long)]
        force: bool,
    },
}

#[derive(Parser)]
#[command(name = "acp-bridge")]
#[command(about = "WebSocket bridge for ACP stdio sessions")]
#[command(version)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,

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

    // Handle convert-script subcommand
    if let Some(Commands::ConvertScript { script, output, force }) = cli.command {
        return run_convert_script(&script, &output, force);
    }

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

/// Run the convert-script command.
///
/// Parses the XML script, generates ACP events, and writes output files.
fn run_convert_script(
    script_path: &str,
    output_dir: &str,
    force: bool,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use acp_bridge::{generate_events, generate_manifest, generate_session_data_all, parse_script, write_json, write_replay_events};

    // Read script file
    let script_xml = fs::read_to_string(script_path)
        .map_err(|e| format!("Failed to read script file '{}': {}", script_path, e))?;

    // Parse script
    let script = parse_script(&script_xml)
        .map_err(|e| format!("Failed to parse script: {}", e))?;

    tracing::info!("Parsed script with {} session(s)", script.sessions.len());

    // Create output directory
    let output_path = PathBuf::from(output_dir);
    if output_path.exists() && !force {
        return Err(format!(
            "Output directory '{}' already exists. Use --force to overwrite.",
            output_dir
        ).into());
    }

    if output_path.exists() {
        fs::remove_dir_all(&output_path)?;
    }
    fs::create_dir_all(&output_path)?;

    // Generate events for all sessions
    let events = generate_events(&script);
    tracing::info!("Generated {} event(s)", events.len());

    // Write replay-events.jsonl
    let replay_events_path = output_path.join("replay-events.jsonl");
    write_replay_events(&events, &replay_events_path)
        .map_err(|e| format!("Failed to write replay events: {}", e))?;
    tracing::info!("Wrote {}", replay_events_path.display());

    // Generate and write session-data.json for each session
    let session_data_list = generate_session_data_all(&script);
    for (i, session_data) in session_data_list.iter().enumerate() {
        let session_dir = output_path.join(&session_data.session_id);
        fs::create_dir_all(&session_dir)?;
        
        let session_data_path = session_dir.join("session-data.json");
        write_json(&session_data, &session_data_path)
            .map_err(|e| format!("Failed to write session data: {}", e))?;
        tracing::info!("Wrote {}", session_data_path.display());
    }

    // Generate and write manifest.json
    let manifest = generate_manifest(&script);
    let manifest_path = output_path.join("manifest.json");
    write_json(&manifest, &manifest_path)
        .map_err(|e| format!("Failed to write manifest: {}", e))?;
    tracing::info!("Wrote {}", manifest_path.display());

    tracing::info!("Conversion complete!");
    Ok(())
}