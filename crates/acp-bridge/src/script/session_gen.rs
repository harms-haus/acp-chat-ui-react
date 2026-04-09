//! Session data and manifest generator.

use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

use crate::script::{Message, Script, ScriptEvent, ScriptSession, Thought, ToolCall};

/// Session data matching the session-data.json format.
#[derive(Debug, Clone, Serialize)]
pub struct SessionData {
    pub messages: Vec<Message>,
    pub thoughts: Vec<Thought>,
    #[serde(rename = "toolCalls")]
    pub tool_calls: Vec<ToolCall>,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub cwd: String,
}

/// Manifest matching the manifest.json format.
#[derive(Debug, Clone, Serialize)]
pub struct Manifest {
    #[serde(rename = "demoType")]
    pub demo_type: String,
    pub sessions: Vec<ManifestSession>,
}

/// Session metadata in the manifest.
#[derive(Debug, Clone, Serialize)]
pub struct ManifestSession {
    #[serde(rename = "demoType")]
    pub demo_type: String,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub modes: Vec<String>,
    pub models: Vec<String>,
    #[serde(rename = "capturedAt")]
    pub captured_at: i64,
    #[serde(rename = "tokenCount")]
    pub token_count: i64,
    #[serde(rename = "eventCount")]
    pub event_count: i64,
    pub description: String,
}

/// Generate session data for all sessions in a script.
pub fn generate_session_data_all(script: &Script) -> Vec<SessionData> {
    script.sessions.iter().map(generate_session_data).collect()
}

/// Generate session data for a single session.
pub fn generate_session_data(session: &ScriptSession) -> SessionData {
    let mut messages = Vec::new();
    let mut thoughts = Vec::new();
    let mut tool_calls = Vec::new();

    for event in &session.events {
        match event {
            ScriptEvent::Message(msg) => messages.push(msg.clone()),
            ScriptEvent::Thought(thought) => thoughts.push(thought.clone()),
            ScriptEvent::ToolCall(tool_call) => tool_calls.push(tool_call.clone()),
            ScriptEvent::ToolResponse(_) => {}
        }
    }

    SessionData {
        messages,
        thoughts,
        tool_calls,
        session_id: session.id.clone(),
        cwd: session.cwd.clone(),
    }
}

/// Generate manifest for a script.
pub fn generate_manifest(script: &Script) -> Manifest {
    let sessions = script
        .sessions
        .iter()
        .map(|session| {
            let event_count = session.events.len() as i64;

            let token_count = session
                .events
                .iter()
                .map(|event| match event {
                    ScriptEvent::Thought(t) => {
                        crate::tokenizer::encode_to_tokens(&t.content).len() as i64
                    }
                    ScriptEvent::Message(m) => {
                        crate::tokenizer::encode_to_tokens(&m.content).len() as i64
                    }
                    ScriptEvent::ToolCall(_) | ScriptEvent::ToolResponse(_) => 0,
                })
                .sum::<i64>();

            let description = session
                .events
                .iter()
                .find_map(|event| match event {
                    ScriptEvent::Thought(t) => Some(format!(
                        "Thought: {}",
                        t.content.chars().take(50).collect::<String>()
                    )),
                    ScriptEvent::Message(m) => Some(format!(
                        "Message: {}",
                        m.content.chars().take(50).collect::<String>()
                    )),
                    ScriptEvent::ToolCall(t) => Some(format!("Tool: {}", t.kind)),
                    ScriptEvent::ToolResponse(_) => None,
                })
                .unwrap_or_else(|| format!("Session {}", session.id));

            ManifestSession {
                demo_type: "script-replay".to_string(),
                session_id: session.id.clone(),
                modes: vec!["script-replay".to_string()],
                models: vec![],
                captured_at: now_ms() as i64,
                token_count,
                event_count,
                description,
            }
        })
        .collect();

    Manifest {
        demo_type: "script-replay".to_string(),
        sessions,
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::script::{Script, ScriptSession};

    #[test]
    fn test_generate_session_data() {
        let session = ScriptSession {
            id: "s1".to_string(),
            cwd: "/test".to_string(),
            events: vec![
                ScriptEvent::Thought(Thought {
                    id: "t1".to_string(),
                    content: "thinking".to_string(),
                }),
                ScriptEvent::Message(Message {
                    id: "m1".to_string(),
                    role: crate::script::MessageRole::Assistant,
                    content: "hello".to_string(),
                }),
                ScriptEvent::ToolCall(ToolCall {
                    id: "tc1".to_string(),
                    kind: "read".to_string(),
                    title: Some("Read".to_string()),
                    arguments: "{}".to_string(),
                }),
            ],
        };

        let data = generate_session_data(&session);
        assert_eq!(data.session_id, "s1");
        assert_eq!(data.thoughts.len(), 1);
        assert_eq!(data.messages.len(), 1);
        assert_eq!(data.tool_calls.len(), 1);
    }

    #[test]
    fn test_generate_manifest() {
        let script = Script {
            metadata: None,
            sessions: vec![ScriptSession {
                id: "s1".to_string(),
                cwd: "/test".to_string(),
                events: vec![ScriptEvent::Thought(Thought {
                    id: "t1".to_string(),
                    content: "test".to_string(),
                })],
            }],
        };

        let manifest = generate_manifest(&script);
        assert_eq!(manifest.demo_type, "script-replay");
        assert_eq!(manifest.sessions.len(), 1);
        assert!(manifest.sessions[0].event_count > 0);
    }
}
