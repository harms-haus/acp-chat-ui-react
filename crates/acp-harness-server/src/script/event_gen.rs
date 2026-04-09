//! ACP event generator for script-to-replay conversion.

use serde_json::json;

use crate::script::chunker::chunk_text;
use crate::script::{Script, ScriptEvent, ScriptSession};
use harms_haus_acp_ws_bridge::{BridgeEnvelope, BridgeMessage, BridgeStatus};

pub fn generate_events(script: &Script) -> Vec<BridgeEnvelope> {
    let mut all_events = Vec::new();
    let timestamp_ms = now_ms();

    for session in &script.sessions {
        let session_events = generate_session_events(session, timestamp_ms);
        all_events.extend(session_events);
    }

    all_events
}

fn generate_session_events(session: &ScriptSession, base_timestamp: u64) -> Vec<BridgeEnvelope> {
    let mut events = Vec::new();
    let mut seq = 0u64;

    let metadata = BridgeEnvelope::new_replay(
        BridgeMessage::replay_metadata(base_timestamp, 0, Some(format!("Session {}", session.id))),
        base_timestamp,
        seq,
        None,
    );
    events.push(metadata);
    seq += 1;

    let starting = BridgeEnvelope::new_replay(
        BridgeMessage::bridge_status(BridgeStatus::Starting),
        base_timestamp + 100,
        seq,
        None,
    );
    events.push(starting);
    seq += 1;

    let connected = BridgeEnvelope::new_replay(
        BridgeMessage::bridge_status(BridgeStatus::Connected),
        base_timestamp + 200,
        seq,
        None,
    );
    events.push(connected);
    seq += 1;

    for event in &session.events {
        let event_timestamp = base_timestamp + 1000 + (seq * 1000);

        match event {
            ScriptEvent::Thought(thought) => {
                let chunks = generate_thought_chunks(&thought, event_timestamp, seq);
                let chunk_count = chunks.len();
                events.extend(chunks);
                seq += chunk_count as u64;
            }

            ScriptEvent::Message(message) => {
                let chunks = generate_message_chunks(&message, event_timestamp, seq);
                let chunk_count = chunks.len();
                events.extend(chunks);
                seq += chunk_count as u64;
            }

            ScriptEvent::ToolCall(tool_call) => {
                let tool_event = generate_tool_call_event(&tool_call, event_timestamp, seq);
                events.push(tool_event);
                seq += 1;
            }

            ScriptEvent::ToolResponse(response) => {
                let response_event = generate_tool_response_event(&response, event_timestamp, seq);
                events.push(response_event);
                seq += 1;
            }
        }
    }

    let disconnected = BridgeEnvelope::new_replay(
        BridgeMessage::bridge_status(BridgeStatus::Disconnected),
        base_timestamp + seq * 1000 + 100,
        seq,
        None,
    );
    events.push(disconnected);

    events
}

fn generate_thought_chunks(
    thought: &crate::script::Thought,
    timestamp: u64,
    start_seq: u64,
) -> Vec<BridgeEnvelope> {
    let chunks = chunk_text(&thought.content);

    if chunks.is_empty() {
        return vec![];
    }

    chunks
        .into_iter()
        .map(|chunk| {
            let payload = json!({
                "jsonrpc": "2.0",
                "method": "session/update",
                "params": {
                    "update": {
                        "type": "agent_thought_chunk",
                        "turnId": thought.id,
                        "role": "assistant",
                        "content": [{
                            "type": "text",
                            "text": chunk.token
                        }],
                        "status": if chunk.is_last { "done" } else { "in_progress" }
                    }
                }
            });

            BridgeEnvelope::new_replay(
                BridgeMessage::acp_payload(payload),
                timestamp + chunk.index as u64 * 15,
                start_seq + chunk.index as u64,
                None,
            )
        })
        .collect()
}

fn generate_message_chunks(
    message: &crate::script::Message,
    timestamp: u64,
    start_seq: u64,
) -> Vec<BridgeEnvelope> {
    let chunks = chunk_text(&message.content);

    if chunks.is_empty() {
        return vec![];
    }

    let role_str = match message.role {
        crate::script::MessageRole::User => "user",
        crate::script::MessageRole::Assistant => "assistant",
    };

    chunks
        .into_iter()
        .map(|chunk| {
            let payload = json!({
                "jsonrpc": "2.0",
                "method": "session/update",
                "params": {
                    "update": {
                        "type": "agent_message_chunk",
                        "turnId": message.id,
                        "role": role_str,
                        "content": [{
                            "type": "text",
                            "text": chunk.token
                        }],
                        "status": if chunk.is_last { "done" } else { "in_progress" }
                    }
                }
            });

            BridgeEnvelope::new_replay(
                BridgeMessage::acp_payload(payload),
                timestamp + chunk.index as u64 * 15,
                start_seq + chunk.index as u64,
                None,
            )
        })
        .collect()
}

fn generate_tool_call_event(
    tool_call: &crate::script::ToolCall,
    timestamp: u64,
    seq: u64,
) -> BridgeEnvelope {
    let raw_input: serde_json::Value = serde_json::from_str(&tool_call.arguments)
        .unwrap_or_else(|_| json!({"raw": tool_call.arguments}));

    let payload = json!({
        "jsonrpc": "2.0",
        "method": "session/update",
        "params": {
            "update": {
                "type": "tool_call",
                "turnId": tool_call.id,
                "role": "assistant",
                "toolCallId": tool_call.id,
                "kind": tool_call.kind,
                "title": tool_call.title,
                "rawInput": raw_input,
                "status": "pending"
            }
        }
    });

    BridgeEnvelope::new_replay(BridgeMessage::acp_payload(payload), timestamp, seq, None)
}

fn generate_tool_response_event(
    response: &crate::script::ToolResponse,
    timestamp: u64,
    seq: u64,
) -> BridgeEnvelope {
    let raw_output: serde_json::Value = if response.success {
        serde_json::from_str(&response.content)
            .unwrap_or_else(|_| json!({"output": response.content}))
    } else {
        json!({"error": response.content})
    };

    let payload = json!({
        "jsonrpc": "2.0",
        "method": "session/update",
        "params": {
            "update": {
                "type": "tool_call_update",
                "turnId": response.id,
                "role": "assistant",
                "toolCallId": response.id,
                "rawOutput": raw_output,
                "status": if response.success { "completed" } else { "failed" }
            }
        }
    });

    BridgeEnvelope::new_replay(BridgeMessage::acp_payload(payload), timestamp, seq, None)
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}
