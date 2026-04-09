//! Script types for replay functionality.
//!
//! This module defines the XML script format used for replaying ACP sessions.
//! The script format captures all events (thoughts, messages, tool calls, etc.)
//! that occurred during a live session, allowing for deterministic replay.

mod chunker;
mod event_gen;
mod parser;
mod session_gen;
mod writer;

pub use chunker::{chunk_text, TextChunk};
pub use event_gen::generate_events;
pub use parser::{parse_script, ParseError, ParseResult};
pub use session_gen::{generate_manifest, generate_session_data, generate_session_data_all};
pub use writer::{write_json, write_replay_events};

use serde::{Deserialize, Serialize};

/// A complete script representing a captured ACP session.
///
/// Scripts contain metadata about the session and one or more sessions,
/// each with a sequence of events.
#[derive(Debug, Clone, Deserialize)]
pub struct Script {
    /// Optional metadata about the script.
    pub metadata: Option<ScriptMetadata>,
    /// All sessions in this script.
    #[serde(rename = "session")]
    pub sessions: Vec<ScriptSession>,
}

/// Metadata associated with a script.
#[derive(Debug, Clone, Deserialize)]
pub struct ScriptMetadata {
    /// Description of what the script demonstrates.
    pub description: Option<String>,
    /// Author of the script.
    pub author: Option<String>,
    /// When the script was created.
    pub created: Option<String>,
    /// Tags for categorizing scripts.
    #[serde(default)]
    pub tags: Vec<String>,
}

/// A single session within a script.
///
/// Each session has a unique ID, working directory, and a sequence
/// of events that occurred during that session.
#[derive(Debug, Clone, Deserialize)]
pub struct ScriptSession {
    /// Unique identifier for this session.
    #[serde(rename = "@id")]
    pub id: String,
    /// Working directory where the session ran.
    #[serde(rename = "@cwd")]
    pub cwd: String,
    /// Events that occurred in this session.
    #[serde(rename = "$value")]
    pub events: Vec<ScriptEvent>,
}

/// An event that occurred during a session.
///
/// Events represent discrete actions or states during a session, such as
/// the agent's thoughts, messages exchanged, or tool calls made.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ScriptEvent {
    /// An internal thought/reasoning step by agent.
    #[serde(rename = "thought")]
    Thought(Thought),
    /// A message exchanged between user and agent.
    #[serde(rename = "message")]
    Message(Message),
    /// A tool invocation by agent.
    #[serde(rename = "tool-call")]
    ToolCall(ToolCall),
    /// The response from a tool invocation.
    #[serde(rename = "tool-response")]
    ToolResponse(ToolResponse),
    /// A filesystem read request.
    #[serde(rename = "fs-read-request")]
    FsReadRequest(FsReadRequest),
    /// A filesystem read response.
    #[serde(rename = "fs-read-response")]
    FsReadResponse(FsReadResponse),
    /// A filesystem write request.
    #[serde(rename = "fs-write-request")]
    FsWriteRequest(FsWriteRequest),
    /// A filesystem write response.
    #[serde(rename = "fs-write-response")]
    FsWriteResponse(FsWriteResponse),
}

/// An internal thought/reasoning step by the agent.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Thought {
    /// Unique identifier for this thought.
    #[serde(rename = "@id")]
    pub id: String,
    /// The content of the thought.
    #[serde(rename = "$text")]
    pub content: String,
}

/// A message exchanged between user and agent.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Message {
    /// Unique identifier for this message.
    #[serde(rename = "@id")]
    pub id: String,
    /// The role of the message sender (user or assistant).
    #[serde(rename = "@role")]
    pub role: MessageRole,
    /// The content of the message.
    #[serde(rename = "$text")]
    pub content: String,
}

/// The role of a message sender.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub enum MessageRole {
    /// Message from the user.
    #[serde(rename = "user")]
    User,
    /// Message from the assistant/agent.
    #[serde(rename = "assistant")]
    Assistant,
}

/// A tool invocation by the agent.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ToolCall {
    /// Unique identifier for this tool call.
    #[serde(rename = "@id")]
    pub id: String,
    /// The kind/name of tool being called.
    #[serde(rename = "@kind")]
    pub kind: String,
    /// Optional title for the tool call.
    #[serde(rename = "@title")]
    pub title: Option<String>,
    /// The arguments/parameters for the tool call.
    #[serde(rename = "$text")]
    pub arguments: String,
}

/// The response from a tool invocation.
#[derive(Debug, Clone, Deserialize)]
pub struct ToolResponse {
    /// The ID of the tool call this response is for.
    #[serde(rename = "@id")]
    pub id: String,
    /// Whether the tool call was successful.
    #[serde(rename = "@success")]
    pub success: bool,
    /// The response content.
    #[serde(rename = "$text")]
    pub content: String,
}

/// A filesystem read request.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct FsReadRequest {
    /// Unique identifier for this request.
    #[serde(rename = "@id")]
    pub id: String,
    /// Path to file to read.
    #[serde(rename = "@path")]
    pub path: String,
    /// Optional line number to read from.
    #[serde(rename = "@line", default)]
    pub line: Option<u32>,
    /// Optional limit on number of lines to read.
    #[serde(rename = "@limit", default)]
    pub limit: Option<u32>,
}

/// A filesystem read response.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct FsReadResponse {
    /// The ID of the read request this response is for.
    #[serde(rename = "@request-id")]
    pub request_id: String,
    /// The file content that was read.
    #[serde(rename = "@content")]
    pub content: String,
}

/// A filesystem write request.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct FsWriteRequest {
    /// Unique identifier for this request.
    #[serde(rename = "@id")]
    pub id: String,
    /// Path to file to write.
    #[serde(rename = "@path")]
    pub path: String,
    /// Content to write to file.
    #[serde(rename = "@content")]
    pub content: String,
}

/// A filesystem write response.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct FsWriteResponse {
    /// The ID of the write request this response is for.
    #[serde(rename = "@request-id")]
    pub request_id: String,
    /// Whether the write was successful.
    #[serde(rename = "@success")]
    pub success: bool,
}

/// Session data for replay, matching session-data.json format.
///
/// This structure captures all session events (messages, thoughts, tool calls)
/// along with session metadata.
#[derive(Debug, Clone, Serialize)]
pub struct SessionData {
    /// All messages exchanged during the session.
    pub messages: Vec<Message>,
    /// All internal thoughts/reasoning steps during the session.
    pub thoughts: Vec<Thought>,
    /// All tool invocations made during the session.
    #[serde(rename = "toolCalls")]
    pub tool_calls: Vec<ToolCall>,
    /// Unique identifier for this session.
    #[serde(rename = "sessionId")]
    pub session_id: String,
    /// Working directory where the session ran.
    pub cwd: String,
}

/// Manifest for replay data, matching manifest.json format.
///
/// This structure provides metadata about a collection of replay sessions,
/// including descriptions and session references.
#[derive(Debug, Clone, Serialize)]
pub struct Manifest {
    /// Type of demo/replay (e.g., "tool-calling-thinking").
    #[serde(rename = "demoType")]
    pub demo_type: String,
    /// List of sessions included in this replay data.
    pub sessions: Vec<ManifestSession>,
}

/// Session metadata in the manifest.
#[derive(Debug, Clone, Serialize)]
pub struct ManifestSession {
    /// Type of demo/replay for this session.
    #[serde(rename = "demoType")]
    pub demo_type: String,
    /// Unique identifier for this session.
    #[serde(rename = "sessionId")]
    pub session_id: String,
    /// Modes used during the session (e.g., "code-review", "debug").
    pub modes: Vec<String>,
    /// Models used during the session (e.g., "claude-sonnet-4").
    pub models: Vec<String>,
    /// Timestamp when the session was captured (milliseconds since epoch).
    #[serde(rename = "capturedAt")]
    pub captured_at: i64,
    /// Total token count for the session.
    #[serde(rename = "tokenCount")]
    pub token_count: i64,
    /// Total event count for the session.
    #[serde(rename = "eventCount")]
    pub event_count: i64,
    /// Description of what the session demonstrates.
    pub description: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_script_types_compile() {
        // Verify types compile and can be constructed
        // XML parsing is tested in parser::tests
        let _ = Script {
            metadata: Some(ScriptMetadata {
                description: Some("Test".to_string()),
                author: None,
                created: None,
                tags: vec![],
            }),
            sessions: vec![],
        };
    }
}
