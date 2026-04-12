//! JSONL writer for replay events.

use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::Path;

use serde::Serialize;

use harms_haus_acp_ws_bridge::BridgeEnvelope;

/// Write replay events to a JSONL file.
///
/// Each event is serialized to JSON and written as a single line.
/// This format is compatible with the existing replay_v2 mode loader.
///
/// # Arguments
///
/// * `events` - The events to write
/// * `path` - Output file path
///
/// # Returns
///
/// * `Ok(())` - Successfully wrote all events
/// * `Err(std::io::Error)` - I/O error occurred
pub fn write_replay_events(events: &[BridgeEnvelope], path: &Path) -> std::io::Result<()> {
    let file = File::create(path)?;
    let mut writer = BufWriter::new(file);

    for event in events {
        serde_json::to_writer(&mut writer, event)?;
        writer.write_all(b"\n")?;
    }

    writer.flush()?;
    Ok(())
}

/// Write session data to JSON file.
///
/// # Arguments
///
/// * `data` - The session data to write
/// * `path` - Output file path
pub fn write_json<T: Serialize>(data: &T, path: &Path) -> std::io::Result<()> {
    let file = File::create(path)?;
    let writer = BufWriter::new(file);
    serde_json::to_writer_pretty(writer, data)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use harms_haus_acp_ws_bridge::{BridgeMessage, BridgeStatus};
    use std::fs;

    #[test]
    fn test_write_jsonl_roundtrip() {
        let temp_dir = tempfile::tempdir().unwrap();
        let file_path = temp_dir.path().join("test.jsonl");

        let events = vec![BridgeEnvelope::new_replay(
            BridgeMessage::bridge_status(BridgeStatus::Starting),
            1000,
            0,
            None,
        )];

        write_replay_events(&events, &file_path).unwrap();

        let content = fs::read_to_string(&file_path).unwrap();
        assert!(content.contains("bridge_status"));
        assert!(content.contains("starting"));
    }
}
