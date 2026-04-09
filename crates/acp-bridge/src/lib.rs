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
pub use script::{MessageRole, Script, ScriptEvent, ScriptSession, Thought, ToolCall, ToolResponse};
pub use server::{ServerConfig, run_server};
pub use tokenizer::encode_to_tokens;

pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg(test)]
mod bridge_proxy;