//! Tests for bridge contract types.

use crate::contract::{BridgeEnvelope, BridgeMessage, BridgeStatus, ENVELOPE_VERSION};

#[test]
fn test_envelope_version_is_one() {
    assert_eq!(ENVELOPE_VERSION, 1);
}

#[test]
fn test_bridge_status_serialization() {
    let status = BridgeStatus::Connected;
    let json = serde_json::to_string(&status).unwrap();
    assert_eq!(json, "\"connected\"");
}

#[test]
fn test_bridge_message_status_serialization() {
    let message = BridgeMessage::bridge_status(BridgeStatus::Starting);
    let json = serde_json::to_string(&message).unwrap();
    assert!(json.contains("\"type\":\"bridge_status\""));
    assert!(json.contains("\"status\":\"starting\""));
}
