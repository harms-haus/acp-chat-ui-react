//! ACP Bridge - WebSocket bridge for ACP stdio sessions
//!
//! This crate provides a WebSocket server that proxies ACP stdio sessions
//! and exposes them to browser clients.

pub mod contract;
pub mod modes;
pub mod script;
pub mod server;
pub mod tokenizer;

pub use contract::{
    BridgeEnvelope, BridgeMessage, BridgeStatus, UnsupportedVersionError, ENVELOPE_VERSION,
    SUPPORTED_VERSIONS,
};
pub use modes::{BridgeModeHandle, ReplayV2Config};
pub use script::{chunk_text, generate_events, generate_manifest, generate_session_data, generate_session_data_all, parse_script, write_json, write_replay_events, Manifest, ManifestSession, MessageRole, ParseError, Script, ScriptEvent, ScriptSession, SessionData, TextChunk, Thought, ToolCall, ToolResponse};
pub use server::{ServerConfig, run_server};
pub use tokenizer::encode_to_tokens;

pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg(test)]
mod bridge_proxy;