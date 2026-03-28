//! Tests for bridge proxy mode functionality.

use crate::contract::{BridgeEnvelope, BridgeMessage, BridgeStatus};

#[test]
fn test_bridge_proxy_envelope_creation() {
    let message = BridgeMessage::bridge_status(BridgeStatus::Starting);
    let envelope = BridgeEnvelope::new(message, 1000);

    assert_eq!(envelope.version, 1);
    assert_eq!(envelope.seq, 0);
    assert_eq!(envelope.timestamp_ms, 1000);
}

#[test]
fn test_bridge_proxy_status_sequence() {
    let statuses = vec![
        BridgeStatus::Starting,
        BridgeStatus::Connected,
        BridgeStatus::Disconnected,
    ];

    for (i, status) in statuses.into_iter().enumerate() {
        let message = BridgeMessage::bridge_status(status);
        let envelope = BridgeEnvelope::new(message, 1000 + i as u64);
        assert!(envelope.is_supported_version());
    }
}

#[test]
fn test_bridge_proxy_payload_passthrough() {
    let payload = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "session/update",
        "params": {}
    });

    let message = BridgeMessage::acp_payload(payload.clone());
    let envelope = BridgeEnvelope::new(message, 0);

    match &envelope.message {
        BridgeMessage::AcpPayload { payload: p } => assert_eq!(p, &payload),
        _ => panic!("Expected AcpPayload variant"),
    }
}
