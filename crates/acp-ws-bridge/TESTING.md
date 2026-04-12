# Rust Testing Guide - acp-ws-bridge

This guide documents the Rust testing approach for the `harms_haus_acp_ws_bridge` crate.

## Quick Start

### Run All Tests

```bash
cd crates/acp-ws-bridge
cargo test
```

### Run Tests with Output

```bash
# Show test output (including println! macros)
cargo test -- --nocapture

# Run specific test by name
cargo test test_name_pattern

# Run tests in a specific module
cargo test --lib contract::envelope::tests
```

### Run with Coverage

```bash
# Install cargo-tarpaulin if not already installed
cargo install cargo-tarpaulin

# Generate HTML coverage report
cargo tarpaulin --out Html

# Generate coverage with specific thresholds
cargo tarpaulin --out Html --fail-under 80
```

Coverage reports are generated in `target/tarpaulin/`.

## Test Organization

### Inline Test Modules

Tests live inline with the code they test, using `#[cfg(test)]` modules:

```rust
// In src/contract/envelope.rs
#[cfg(test)]
mod tests {
    use super::*;
    use crate::contract::{BridgeStatus, ENVELOPE_VERSION};
    use serde_json::json;

    #[test]
    fn test_feature_scenario() {
        // Test implementation
    }
}
```

**Benefits:**
- Tests stay close to the code they verify
- Easy to spot missing test coverage
- No separate test files to maintain

### Test File Structure

```
crates/acp-wsbridge/
├── src/
│   ├── lib.rs
│   ├── contract/
│   │   ├── mod.rs
│   │   ├── envelope.rs      # Tests in #[cfg(test)] mod tests
│   │   └── message.rs       # Tests in #[cfg(test)] mod tests
│   ├── server/
│   │   └── mod.rs
│   └── test_utils.rs        # Test utilities (only compiled for tests)
└── Cargo.toml
```

### Test Naming Convention

```rust
// Pattern: test_<method>_<scenario>_<expected>
#[test]
fn test_new_extra_data_is_none() { }

#[test]
fn test_parse_invalid_envelope_missing_version() { }

#[test]
fn test_serialization_roundtrip_with_extra_data() { }
```

## Test Utilities

The crate provides comprehensive test utilities in `test_utils.rs`.

### EnvelopeBuilder

Builder pattern for creating `BridgeEnvelope` instances:

```rust
use acp_ws_bridge::test_utils::{EnvelopeBuilder, MessageBuilder};

// Basic usage with defaults
let envelope = EnvelopeBuilder::new()
    .message(MessageBuilder::acp_payload(json!({"test": "value"})))
    .build();

// Custom values
let envelope = EnvelopeBuilder::new()
    .version(1)
    .seq(42)
    .timestamp_ms(1234567890)
    .extra_data(json!({"replaySpeed": 2.0}))
    .message(MessageBuilder::bridge_status(BridgeStatus::Connected))
    .build();
```

**Builder Methods:**
- `version(u32)` - Set envelope version
- `seq(u64)` - Set sequence number
- `timestamp_ms(u64)` - Set timestamp
- `extra_data(serde_json::Value)` - Set metadata
- `message(BridgeMessage)` - Set message payload (required)
- `build()` - Build the envelope (panics if message not set)

### MessageBuilder

Static helper methods for creating `BridgeMessage` variants:

```rust
use acp_ws_bridge::test_utils::MessageBuilder;
use serde_json::json;

// ACP payload
let msg = MessageBuilder::acp_payload(json!({"method": "test"}));

// JSON-RPC request
let msg = MessageBuilder::acp_request("initialize", json!({"params": []}));

// Bridge status
let msg = MessageBuilder::bridge_status(BridgeStatus::Connected);

// Stderr message
let msg = MessageBuilder::stderr("Error: something went wrong");

// Process exit
let msg = MessageBuilder::process_exit(Some(1), Some("SIGTERM"));

// Replay metadata
let msg = MessageBuilder::replay_metadata(1234567890, 100, Some("Test session"));

// Start agent
let msg = MessageBuilder::start_agent(
    "node",
    vec!["script.js"],
    Some("/workspace"),
    vec![("NODE_ENV", "test")],
);
```

### Constants Module

Common test data:

```rust
use acp_ws_bridge::test_utils::constants;

let timestamp = constants::DEFAULT_TIMESTAMP_MS;  // 1234567890
let seq = constants::DEFAULT_SEQ;                  // 0
let payload = constants::sample_acp_payload();     // Sample JSON-RPC
let stderr = constants::sample_stderr_line();      // "Error: Something went wrong"
```

## Writing Tests

### Basic Test Structure

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_method_success_case() {
        // Arrange
        let input = create_test_input();

        // Act
        let result = method_under_test(input);

        // Assert
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), expected_value);
    }
}
```

### Testing Serialization

```rust
#[test]
fn test_serialization_roundtrip() {
    let original = BridgeEnvelope::new(message, 1234567890);

    // Serialize to JSON
    let json = serde_json::to_string(&original).unwrap();

    // Deserialize back
    let deserialized: BridgeEnvelope = serde_json::from_str(&json).unwrap();

    // Verify equality
    assert_eq!(original.version, deserialized.version);
    assert_eq!(original.seq, deserialized.seq);
    assert_eq!(original.message, deserialized.message);
}
```

### Testing Edge Cases

```rust
#[test]
fn test_edge_case_empty_extra_data() {
    let envelope = BridgeEnvelope::new_replay(
        message,
        1234567890,
        1,
        Some(json!({})),
    );
    assert_eq!(envelope.extra_data, Some(json!({})));
}

#[test]
fn test_edge_case_null_extra_data() {
    let envelope = BridgeEnvelope::new_replay(
        message,
        1234567890,
        1,
        Some(json!(null)),
    );
    assert_eq!(envelope.extra_data, Some(json!(null)));
}
```

### Testing Error Cases

```rust
#[test]
fn test_parse_invalid_envelope_missing_version() {
    let json = json!({
        "seq": 0,
        "timestamp_ms": 1234567890,
        "type": "acp_payload",
        "payload": {"method": "test"}
    });

    let result: Result<BridgeEnvelope, _> = serde_json::from_value(json);
    assert!(result.is_err(), "Should fail without version field");
}
```

### Testing All Variants

```rust
#[test]
fn test_all_message_variants() {
    // Test each BridgeMessage variant
    let variants = vec![
        BridgeMessage::AcpPayload { payload: json!({}) },
        BridgeMessage::BridgeStatus { status: BridgeStatus::Connected },
        BridgeMessage::Stderr { line: "test".to_string() },
        BridgeMessage::ProcessExit { code: Some(1), signal: Some("SIGTERM".to_string()) },
        BridgeMessage::ReplayMetadata { captured_at_ms: 1, total_envelopes: 1, description: None },
        BridgeMessage::StartAgent { command: "node".to_string(), args: vec![], cwd: None, env: vec![] },
    ];

    for msg in variants {
        let envelope = BridgeEnvelope::new(msg, 1234567890);
        let json = serde_json::to_string(&envelope).unwrap();
        let deserialized: BridgeEnvelope = serde_json::from_str(&json).unwrap();
        assert_eq!(envelope.message, deserialized.message);
    }
}
```

### Test Organization with Sections

Use section comments to organize large test modules:

```rust
// ========================================================================
// Tests for BridgeEnvelope::new()
// ========================================================================

#[test]
fn test_new_basic() { /* ... */ }

#[test]
fn test_new_seq_is_zero() { /* ... */ }

// ========================================================================
// Tests for serialization/deserialization
// ========================================================================

#[test]
fn test_serialization_roundtrip() { /* ... */ }

// ========================================================================
// Tests for error handling
// ========================================================================

#[test]
fn test_unsupported_version_error() { /* ... */ }
```

## Coverage

### Coverage Targets

- **Lines:** >= 80%
- **Branches:** >= 75%

### Generate Coverage Report

```bash
# HTML report
cargo tarpaulin --out Html

# LCOV report (for CI integration)
cargo tarpaulin --out Lcov

# Multiple formats
cargo tarpaulin --out Html --out Lcov
```

### Check Coverage for Specific Module

```bash
# Filter by module
cargo tarpaulin --out Html --files envelope.rs

# Exclude test code from coverage calculation
cargo tarpaulin --out Html --ignore-tests
```

### Coverage Report Location

After running `cargo tarpaulin --out Html`, open:

```bash
open target/tarpaulin/index.html
```

## Example Tests

### Constructor Tests

```rust
#[test]
fn test_new_basic() {
    let timestamp_ms = 1234567890;
    let message = BridgeMessage::AcpPayload { payload: json!({"test": "value"}) };
    let envelope = BridgeEnvelope::new(message, timestamp_ms);

    assert_eq!(envelope.version, ENVELOPE_VERSION);
    assert_eq!(envelope.seq, 0);  // Live mode uses seq=0
    assert_eq!(envelope.timestamp_ms, timestamp_ms);
    assert!(envelope.extra_data.is_none());
}

#[test]
fn test_new_replay_with_metadata() {
    let timestamp_ms = 1234567890;
    let seq = 42;
    let extra_data = Some(json!({"replaySpeed": 2.0}));
    let message = BridgeMessage::AcpPayload { payload: json!({}) };

    let envelope = BridgeEnvelope::new_replay(message, timestamp_ms, seq, extra_data.clone());

    assert_eq!(envelope.version, ENVELOPE_VERSION);
    assert_eq!(envelope.seq, seq);
    assert_eq!(envelope.timestamp_ms, timestamp_ms);
    assert_eq!(envelope.extra_data, extra_data);
}
```

### Parsing Tests

```rust
#[test]
fn test_parse_valid_envelope() {
    let json = json!({
        "version": 1,
        "seq": 0,
        "timestamp_ms": 1234567890,
        "type": "acp_payload",
        "payload": {"jsonrpc": "2.0", "method": "test"}
    });

    let envelope: BridgeEnvelope = serde_json::from_value(json)
        .expect("Should parse valid envelope");

    assert_eq!(envelope.version, 1);
    assert_eq!(envelope.seq, 0);
    assert!(matches!(envelope.message, BridgeMessage::AcpPayload { .. }));
}

#[test]
fn test_parse_invalid_envelope_wrong_type() {
    let json = json!({
        "version": "1",  // String instead of number
        "seq": 0,
        "timestamp_ms": 1234567890,
        "type": "acp_payload",
        "payload": {}
    });

    let result: Result<BridgeEnvelope, _> = serde_json::from_value(json);
    assert!(result.is_err(), "Should fail with wrong type");
}
```

### Helper Function Pattern

```rust
// Helper to reduce duplication
fn test_message() -> BridgeMessage {
    BridgeMessage::AcpPayload {
        payload: json!({"test": "value"}),
    }
}

#[test]
fn test_feature_one() {
    let envelope = BridgeEnvelope::new(test_message(), 1234567890);
    // ...
}

#[test]
fn test_feature_two() {
    let envelope = BridgeEnvelope::new(test_message(), 9999999999);
    // ...
}
```

## Current Test Suite

The crate has **147 tests** covering:

- **BridgeEnvelope** (29 tests)
  - Constructor methods (`new()`, `new_replay()`)
  - Version validation
  - Serialization/deserialization
  - Edge cases

- **BridgeMessage** (85 tests)
  - All 6 variants
  - Factory methods
  - Serialization for each variant
  - Round-trip verification

- **Parsing/Validation** (33 tests)
  - Valid envelope parsing
  - Invalid envelope rejection
  - Malformed JSON handling
  - Edge cases

### Run Specific Test Categories

```bash
# Envelope tests
cargo test envelope

# Message tests
cargo test message

# Serialization tests
cargo test serialize

# Version tests
cargo test version

# Parsing tests
cargo test parse
```

## Best Practices

1. **Use builder pattern** - Reduces boilerplate and improves readability
2. **Test all variants** - Enum variants need explicit coverage
3. **Test edge cases** - Empty strings, null values, large numbers
4. **Verify round-trips** - Serialize then deserialize, verify equality
5. **Name tests descriptively** - Test name should describe the scenario
6. **Keep tests independent** - Each test should pass/fail on its own
7. **Use section comments** - Organize large test modules for navigation

## Troubleshooting

### Test Won't Compile

```bash
# Check for compilation errors
cargo test --no-run

# Fix type mismatches in assertions
assert_eq!(expected_type, actual_type);
```

### Integer Literal Errors

Large integer literals can cause compilation errors:

```rust
// Wrong - exceeds i32 range
"timestamp_ms": 9876543210

// Right - use serde_json::Number
"timestamp_ms": serde_json::Number::from(9876543210u64)
```

### Coverage Not Meeting Threshold

```bash
# See which lines are uncovered
cargo tarpaulin --out Html
open target/tarpaulin/index.html

# Add tests for uncovered code paths
```

## Resources

- **Test utilities:** `src/test_utils.rs`
- **Example tests:** `src/contract/envelope.rs`, `src/contract/message.rs`
- **Cargo test docs:** https://doc.rust-lang.org/cargo/commands/cargo-test.html
- **Rust book - Testing:** https://doc.rust-lang.org/book/ch11-00-testing.html
