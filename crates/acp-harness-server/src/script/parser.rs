//! XML script parser with strict validation.
//!
//! This module provides parsing functionality for XML script files,
//! converting them into Script structures with full validation.

use quick_xml::de::from_str;
use thiserror::Error;

use crate::script::{Script, ScriptEvent, ScriptSession};

/// Errors that can occur during script parsing.
#[derive(Debug, Error)]
pub enum ParseError {
    /// XML syntax error.
    #[error("XML syntax error: {0}")]
    XmlSyntax(#[from] quick_xml::DeError),

    /// Missing required attribute.
    #[error("Missing required attribute: {0} in {1}")]
    MissingAttribute(String, String),

    /// Duplicate ID found.
    #[error("Duplicate ID '{0}' found in session {1}")]
    DuplicateId(String, String),

    /// Unknown XML element.
    #[error("Unknown XML element: {0}")]
    UnknownElement(String),

    /// Invalid tool response reference.
    #[error("Tool response '{0}' references non-existent tool call")]
    InvalidToolReference(String),

    /// Invalid event order.
    #[error("Tool response '{0}' appears before its tool call")]
    InvalidEventOrder(String),
}

/// Parse result alias.
pub type ParseResult<T> = Result<T, ParseError>;

/// Parses an XML script string into a Script structure.
///
/// This function performs strict validation:
/// - All required attributes must be present
/// - Tool call IDs must be unique within a session
/// - Tool responses must reference valid tool calls
/// - Unknown XML elements cause parsing to fail
///
/// # Arguments
///
/// * `xml` - The XML string to parse
///
/// # Returns
///
/// * `Ok(Script)` - Successfully parsed script
/// * `Err(ParseError)` - Parsing failed with validation error
///
/// # Example
///
/// ```rust
/// use harms_haus_acp_harness_server::script::parse_script;
///
/// let xml = r#"
///     <script>
///         <session id="s1" cwd="/test">
///             <thought id="t1">Thinking...</thought>
///         </session>
///     </script>
/// "#;
///
/// let script = parse_script(xml).expect("Failed to parse script");
/// ```
pub fn parse_script(xml: &str) -> ParseResult<Script> {
    // Parse XML into Script structure
    let script: Script = from_str(xml)?;

    // Validate all sessions
    for session in &script.sessions {
        validate_session(session)?;
    }

    Ok(script)
}

/// Validates a single script session.
///
/// Checks:
/// - All events have required attributes
/// - Tool call IDs are unique
/// - Tool responses reference valid tool calls
/// - Tool responses appear after their tool calls

// Note: FsReadResponse and FsWriteResponse don't validate request_id uniqueness
// because the harness generates both requests and responses from the same
// script for replay purposes. The request_id in these responses links
// to the request event in the script, not to a separate request ID registry.

fn validate_session(session: &ScriptSession) -> ParseResult<()> {
    let mut tool_call_ids = std::collections::HashSet::new();
    let mut seen_tool_responses = std::collections::HashSet::new();

    for event in &session.events {
        match event {
            ScriptEvent::Thought(thought) => {
                if thought.id.is_empty() {
                    return Err(ParseError::MissingAttribute(
                        "id".to_string(),
                        "thought".to_string(),
                    ));
                }
            }

            ScriptEvent::Message(message) => {
                if message.id.is_empty() {
                    return Err(ParseError::MissingAttribute(
                        "id".to_string(),
                        "message".to_string(),
                    ));
                }
            }

            ScriptEvent::ToolCall(tool_call) => {
                if tool_call.id.is_empty() {
                    return Err(ParseError::MissingAttribute(
                        "id".to_string(),
                        "tool-call".to_string(),
                    ));
                }

                // Check for duplicate ID
                if tool_call_ids.contains(&tool_call.id) {
                    return Err(ParseError::DuplicateId(
                        tool_call.id.clone(),
                        session.id.clone(),
                    ));
                }
                tool_call_ids.insert(tool_call.id.clone());
            }

            ScriptEvent::ToolResponse(response) => {
                if response.id.is_empty() {
                    return Err(ParseError::MissingAttribute(
                        "id".to_string(),
                        "tool-response".to_string(),
                    ));
                }

                // Check for duplicate response ID
                if seen_tool_responses.contains(&response.id) {
                    return Err(ParseError::DuplicateId(
                        format!("response-{}", response.id),
                        session.id.clone(),
                    ));
                }

                // Check that the referenced tool call exists
                if !tool_call_ids.contains(&response.id) {
                    return Err(ParseError::InvalidToolReference(response.id.clone()));
                }

                seen_tool_responses.insert(response.id.clone());
            }

            ScriptEvent::FsReadRequest(request) => {
                if request.id.is_empty() {
                    return Err(ParseError::MissingAttribute(
                        "id".to_string(),
                        "fs-read-request".to_string(),
                    ));
                }
                if request.path.is_empty() {
                    return Err(ParseError::MissingAttribute(
                        "path".to_string(),
                        "fs-read-request".to_string(),
                    ));
                }
            }

            ScriptEvent::FsReadResponse(response) => {
                if response.request_id.is_empty() {
                    return Err(ParseError::MissingAttribute(
                        "request-id".to_string(),
                        "fs-read-response".to_string(),
                    ));
                }
            }

            ScriptEvent::FsWriteRequest(request) => {
                if request.id.is_empty() {
                    return Err(ParseError::MissingAttribute(
                        "id".to_string(),
                        "fs-write-request".to_string(),
                    ));
                }
                if request.path.is_empty() {
                    return Err(ParseError::MissingAttribute(
                        "path".to_string(),
                        "fs-write-request".to_string(),
                    ));
                }
                if request.content.is_empty() {
                    return Err(ParseError::MissingAttribute(
                        "content".to_string(),
                        "fs-write-request".to_string(),
                    ));
                }
            }

            ScriptEvent::FsWriteResponse(response) => {
                if response.request_id.is_empty() {
                    return Err(ParseError::MissingAttribute(
                        "request-id".to_string(),
                        "fs-write-response".to_string(),
                    ));
                }
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_valid_script() {
        let xml = r#"
            <script>
                <session id="test-session" cwd="/test">
                    <thought id="t1">Thinking about the problem...</thought>
                    <message id="m1" role="user">Hello</message>
                </session>
            </script>
        "#;

        let result = parse_script(xml);
        assert!(
            result.is_ok(),
            "Valid script should parse: {:?}",
            result.err()
        );

        let script = result.unwrap();
        assert_eq!(script.sessions.len(), 1);
        assert_eq!(script.sessions[0].id, "test-session");
        assert_eq!(script.sessions[0].events.len(), 2);
    }

    #[test]
    fn test_parse_invalid_xml() {
        let xml = r#"
            <script>
                <session id="test" cwd="/test">
                    <unknown-element>Should fail</unknown-element>
                </session>
            </script>
        "#;

        let result = parse_script(xml);
        // Should fail due to unknown element
        assert!(result.is_err(), "Unknown elements should cause parse error");
    }

    #[test]
    fn test_parse_tool_call_and_response() {
        let xml = r#"
            <script>
                <session id="test-session" cwd="/test">
                    <thought id="t1">Need to call a tool</thought>
                    <tool-call id="tc1" kind="read" title="Read file">
                        {"filePath": "src/main.rs"}
                    </tool-call>
                    <tool-response id="tc1" success="true">
                        File contents here
                    </tool-response>
                </session>
            </script>
        "#;

        let result = parse_script(xml);
        assert!(
            result.is_ok(),
            "Valid tool call/response should parse: {:?}",
            result.err()
        );

        let script = result.unwrap();
        assert_eq!(script.sessions[0].events.len(), 3);
    }

    #[test]
    fn test_parse_duplicate_tool_call_id() {
        let xml = r#"
            <script>
                <session id="test-session" cwd="/test">
                    <tool-call id="tc1" kind="read" title="First">
                        args1
                    </tool-call>
                    <tool-call id="tc1" kind="write" title="Second">
                        args2
                    </tool-call>
                </session>
            </script>
        "#;

        let result = parse_script(xml);
        assert!(
            result.is_err(),
            "Duplicate tool call IDs should cause parse error"
        );

        if let Err(ParseError::DuplicateId(id, session_id)) = result {
            assert_eq!(id, "tc1");
            assert_eq!(session_id, "test-session");
        } else {
            panic!("Expected DuplicateId error");
        }
    }

    #[test]
    fn test_parse_invalid_tool_response_reference() {
        let xml = r#"
            <script>
                <session id="test-session" cwd="/test">
                    <tool-call id="tc1" kind="read" title="Read">
                        args
                    </tool-call>
                    <tool-response id="tc2" success="true">
                        Response for non-existent tool
                    </tool-response>
                </session>
            </script>
        "#;

        let result = parse_script(xml);
        assert!(
            result.is_err(),
            "Invalid tool response reference should cause parse error"
        );

        if let Err(ParseError::InvalidToolReference(id)) = result {
            assert_eq!(id, "tc2");
        } else {
            panic!("Expected InvalidToolReference error");
        }
    }

    #[test]
    fn test_parse_with_metadata() {
        let xml = r#"
            <script>
                <metadata>
                    <description>Test script with metadata</description>
                    <author>Test Author</author>
                </metadata>
                <session id="test-session" cwd="/test">
                    <thought id="t1">Thinking...</thought>
                </session>
            </script>
        "#;

        let result = parse_script(xml);
        assert!(
            result.is_ok(),
            "Script with metadata should parse: {:?}",
            result.err()
        );

        let script = result.unwrap();
        assert!(script.metadata.is_some());
        assert_eq!(
            script.metadata.as_ref().unwrap().description,
            Some("Test script with metadata".to_string())
        );
    }

    #[test]
    fn test_parse_multi_session() {
        let xml = r#"
            <script>
                <session id="session-1" cwd="/workspace1">
                    <thought id="t1">First session thought</thought>
                </session>
                <session id="session-2" cwd="/workspace2">
                    <thought id="t2">Second session thought</thought>
                </session>
            </script>
        "#;

        let result = parse_script(xml);
        assert!(
            result.is_ok(),
            "Multi-session script should parse: {:?}",
            result.err()
        );

        let script = result.unwrap();
        assert_eq!(script.sessions.len(), 2);
        assert_eq!(script.sessions[0].id, "session-1");
        assert_eq!(script.sessions[1].id, "session-2");
    }

    #[test]
    fn test_parse_fs_read_request() {
        let xml = r#"
            <script>
                <session id="test-session" cwd="/test">
                    <fs-read-request id="fr1" path="src/main.rs" line="10" limit="20"/>
                </session>
            </script>
        "#;

        let result = parse_script(xml);
        assert!(
            result.is_ok(),
            "Valid fs-read-request should parse: {:?}",
            result.err()
        );

        let script = result.unwrap();
        assert_eq!(script.sessions.len(), 1);
        assert_eq!(script.sessions[0].events.len(), 1);

        match &script.sessions[0].events[0] {
            ScriptEvent::FsReadRequest(req) => {
                assert_eq!(req.id, "fr1");
                assert_eq!(req.path, "src/main.rs");
                assert_eq!(req.line, Some(10));
                assert_eq!(req.limit, Some(20));
            }
            _ => panic!("Expected FsReadRequest event"),
        }
    }

    #[test]
    fn test_parse_fs_read_response() {
        let xml = r#"
            <script>
                <session id="test-session" cwd="/test">
                    <fs-read-response request-id="fr1" content="file content here"/>
                </session>
            </script>
        "#;

        let result = parse_script(xml);
        assert!(
            result.is_ok(),
            "Valid fs-read-response should parse: {:?}",
            result.err()
        );

        let script = result.unwrap();
        assert_eq!(script.sessions[0].events.len(), 1);

        match &script.sessions[0].events[0] {
            ScriptEvent::FsReadResponse(resp) => {
                assert_eq!(resp.request_id, "fr1");
                assert_eq!(resp.content, "file content here");
            }
            _ => panic!("Expected FsReadResponse event"),
        }
    }

    #[test]
    fn test_parse_fs_write_request() {
        let xml = r#"
            <script>
                <session id="test-session" cwd="/test">
                    <fs-write-request id="fw1" path="src/main.rs" content="new content"/>
                </session>
            </script>
        "#;

        let result = parse_script(xml);
        assert!(
            result.is_ok(),
            "Valid fs-write-request should parse: {:?}",
            result.err()
        );

        let script = result.unwrap();
        assert_eq!(script.sessions[0].events.len(), 1);

        match &script.sessions[0].events[0] {
            ScriptEvent::FsWriteRequest(req) => {
                assert_eq!(req.id, "fw1");
                assert_eq!(req.path, "src/main.rs");
                assert_eq!(req.content, "new content");
            }
            _ => panic!("Expected FsWriteRequest event"),
        }
    }

    #[test]
    fn test_parse_fs_write_response() {
        let xml = r#"
            <script>
                <session id="test-session" cwd="/test">
                    <fs-write-response request-id="fw1" success="true"/>
                </session>
            </script>
        "#;

        let result = parse_script(xml);
        assert!(
            result.is_ok(),
            "Valid fs-write-response should parse: {:?}",
            result.err()
        );

        let script = result.unwrap();
        assert_eq!(script.sessions[0].events.len(), 1);

        match &script.sessions[0].events[0] {
            ScriptEvent::FsWriteResponse(resp) => {
                assert_eq!(resp.request_id, "fw1");
                assert_eq!(resp.success, true);
            }
            _ => panic!("Expected FsWriteResponse event"),
        }
    }

    #[test]
    fn test_parse_fs_read_request_missing_path() {
        let xml = r#"
            <script>
                <session id="test-session" cwd="/test">
                    <fs-read-request id="fr1" line="10" limit="20"/>
                </session>
            </script>
        "#;

        let result = parse_script(xml);
        assert!(
            result.is_err(),
            "Missing path should cause parse error: {:?}",
            result
        );
    }

    #[test]
    fn test_parse_fs_write_request_missing_content() {
        let xml = r#"
            <script>
                <session id="test-session" cwd="/test">
                    <fs-write-request id="fw1" path="src/main.rs"/>
                </session>
            </script>
        "#;

        let result = parse_script(xml);
        assert!(
            result.is_err(),
            "Missing content should cause parse error: {:?}",
            result
        );
    }

    #[test]
    fn test_parse_fs_read_request_missing_id() {
        let xml = r#"
            <script>
                <session id="test-session" cwd="/test">
                    <fs-read-request path="src/main.rs" line="10" limit="20"/>
                </session>
            </script>
        "#;

        let result = parse_script(xml);
        assert!(
            result.is_err(),
            "Missing id should cause parse error: {:?}",
            result
        );
    }
}
