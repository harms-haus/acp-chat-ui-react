//! Message types for bridge envelopes.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Bridge message variants for all browser-facing communications.
///
/// The bridge passes ACP payloads through unchanged. It does not normalize
/// or interpret ACP semantics.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(tag = "type", rename_all = "snake_case")]
#[ts(export)]
pub enum BridgeMessage {
    /// Raw ACP JSON-RPC payload from the agent's stdout.
    /// The bridge does not parse or modify the payload.
    AcpPayload {
        /// The raw JSON-RPC message as received from the ACP agent.
        /// This is an opaque value — the bridge does not interpret it.
        payload: serde_json::Value,
    },

    /// Bridge lifecycle state change.
    BridgeStatus {
        /// The new bridge state.
        status: BridgeStatus,
    },

    /// A line of stderr output from the ACP process.
    Stderr {
        /// The stderr line content.
        line: String,
    },

    /// Notification that the ACP process has exited.
    ProcessExit {
        /// The exit code, if available.
        code: Option<i32>,
        /// Signal that terminated the process, if any.
        signal: Option<String>,
    },

    /// Replay metadata at the start of a replay session.
    ReplayMetadata {
        /// Original capture timestamp in milliseconds.
        #[ts(type = "number")]
        captured_at_ms: u64,
        /// Total number of envelopes in the replay file.
        #[ts(type = "number")]
        total_envelopes: u64,
        /// Optional description of the captured session.
        description: Option<String>,
    },
}

/// Bridge lifecycle states.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum BridgeStatus {
    /// Bridge is starting up.
    Starting,
    /// Bridge is connected and proxying ACP traffic.
    Connected,
    /// Bridge is reconnecting after a disconnect.
    Reconnecting,
    /// Bridge has disconnected.
    Disconnected,
    /// Bridge encountered an error.
    Error,
}

impl BridgeMessage {
    /// Creates a new ACP payload message.
    pub fn acp_payload(payload: serde_json::Value) -> Self {
        Self::AcpPayload { payload }
    }

    /// Creates a new bridge status message.
    pub fn bridge_status(status: BridgeStatus) -> Self {
        Self::BridgeStatus { status }
    }

    /// Creates a new stderr message.
    pub fn stderr(line: String) -> Self {
        Self::Stderr { line }
    }

    /// Creates a new process exit message.
    pub fn process_exit(code: Option<i32>, signal: Option<String>) -> Self {
        Self::ProcessExit { code, signal }
    }

    /// Creates a new replay metadata message.
    pub fn replay_metadata(
        captured_at_ms: u64,
        total_envelopes: u64,
        description: Option<String>,
    ) -> Self {
        Self::ReplayMetadata {
            captured_at_ms,
            total_envelopes,
            description,
        }
    }
}
