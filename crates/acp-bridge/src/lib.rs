//! ACP Bridge - WebSocket bridge for ACP stdio sessions
//!
//! This crate provides a WebSocket server that proxies ACP stdio sessions
//! and exposes them to browser clients.

pub mod contract;
pub mod modes;
pub mod server;

pub use contract::{
    BridgeEnvelope, BridgeMessage, BridgeStatus, UnsupportedVersionError, ENVELOPE_VERSION,
    SUPPORTED_VERSIONS,
};
pub use modes::{BridgeModeHandle, DynamicConfig, ProxyConfig, ReplayConfig, ReplayV2Config};
pub use server::{BridgeMode, ServerConfig, run_server};

pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg(test)]
mod bridge_proxy;