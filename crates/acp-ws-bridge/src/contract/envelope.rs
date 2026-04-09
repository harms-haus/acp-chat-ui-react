//! Versioned WebSocket envelope for all bridge-to-browser messages.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::{ENVELOPE_VERSION, SUPPORTED_VERSIONS};
use crate::contract::BridgeMessage;

/// Versioned WebSocket envelope for all bridge-to-browser messages.
///
/// This is the single source of truth for the wire format. The bridge never
/// mutates ACP payload contents — it only wraps them in this envelope.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct BridgeEnvelope {
    /// Envelope format version. Must be one of SUPPORTED_VERSIONS.
    pub version: u32,

    /// Sequence number for ordering messages in replay mode.
    /// Zero in live mode; monotonically increasing in replay mode.
    #[ts(type = "number")]
    pub seq: u64,

    /// Unix timestamp in milliseconds when the envelope was created.
    #[ts(type = "number")]
    pub timestamp_ms: u64,

    /// Optional free-form metadata. The ws-bridge treats this as opaque JSON.
    /// Specific interpretations (e.g., replay-speed) happen at the harness-server layer.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extra_data: Option<serde_json::Value>,

    /// The message payload.
    #[serde(flatten)]
    pub message: BridgeMessage,
}

impl BridgeEnvelope {
    /// Creates a new envelope with the current version and a live-mode seq of 0.
    pub fn new(message: BridgeMessage, timestamp_ms: u64) -> Self {
        Self {
            version: ENVELOPE_VERSION,
            seq: 0,
            timestamp_ms,
            extra_data: None,
            message,
        }
    }

    /// Creates a new envelope for replay mode with a specific sequence number.
    pub fn new_replay(
        message: BridgeMessage,
        timestamp_ms: u64,
        seq: u64,
        extra_data: Option<serde_json::Value>,
    ) -> Self {
        Self {
            version: ENVELOPE_VERSION,
            seq,
            timestamp_ms,
            extra_data,
            message,
        }
    }

    /// Checks if the envelope version is supported.
    pub fn is_supported_version(&self) -> bool {
        SUPPORTED_VERSIONS.contains(&self.version)
    }
}

/// Error returned when parsing an envelope with an unsupported version.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct UnsupportedVersionError {
    /// The version that was received.
    pub received: u32,
    /// The versions that are supported.
    pub supported: Vec<u32>,
}

impl std::fmt::Display for UnsupportedVersionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "Unsupported envelope version {}: supported versions are {:?}",
            self.received, self.supported
        )
    }
}

impl std::error::Error for UnsupportedVersionError {}
