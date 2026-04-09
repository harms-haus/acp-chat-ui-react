//! Token-based chunking for text events.
//!
//! This module provides functionality to split text content (thoughts and messages)
//! into individual token-sized chunks for ACP replay events.

use crate::tokenizer::encode_to_tokens;

/// A single token chunk from text content.
///
/// Each chunk represents one token from the original text,
/// with metadata about its position in the sequence.
#[derive(Debug, Clone)]
pub struct TextChunk {
    /// The token content as a string.
    pub token: String,
    /// The index of this chunk in the sequence (0-based).
    pub index: usize,
    /// Whether this is the last chunk in the sequence.
    pub is_last: bool,
}

/// Chunks text into individual token-sized pieces.
///
/// This function takes text content (from thoughts or messages) and splits it
/// into chunks where each chunk contains exactly one token. This matches the
/// ACP protocol requirement for streaming agent responses and thoughts.
///
/// # Arguments
///
/// * `text` - The text to chunk
///
/// # Returns
///
/// A vector of TextChunk instances, one per token.
/// Returns empty Vec for empty input.
///
/// # Example
///
/// ```rust
/// use harms_haus_acp_harness_server::script::chunk_text;
///
/// let chunks = chunk_text("hello world");
/// assert!(chunks.len() >= 2); // At least 2 tokens
/// assert_eq!(chunks[0].index, 0);
/// assert!(!chunks[0].is_last); // Not last if multiple chunks
/// ```
pub fn chunk_text(text: &str) -> Vec<TextChunk> {
    let tokens = encode_to_tokens(text);
    let total = tokens.len();

    if total == 0 {
        return vec![];
    }

    tokens
        .into_iter()
        .enumerate()
        .map(|(index, token)| TextChunk {
            is_last: index == total - 1,
            index,
            token,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chunk_simple_sentence() {
        let chunks = chunk_text("hello world");
        assert!(!chunks.is_empty(), "Should produce chunks");
        assert!(chunks.len() >= 2, "Should have at least 2 tokens");

        // Verify indexing
        for (i, chunk) in chunks.iter().enumerate() {
            assert_eq!(chunk.index, i, "Index should match position");
        }

        // Verify last flag
        if chunks.len() > 1 {
            for chunk in chunks.iter().take(chunks.len() - 1) {
                assert!(!chunk.is_last, "Non-final chunks should not be marked last");
            }
            assert!(
                chunks.last().unwrap().is_last,
                "Final chunk should be marked last"
            );
        }
    }

    #[test]
    fn test_chunk_empty_string() {
        let chunks = chunk_text("");
        assert!(chunks.is_empty(), "Empty string should produce no chunks");
    }

    #[test]
    fn test_chunk_single_token() {
        let chunks = chunk_text("test");
        assert!(!chunks.is_empty(), "Single word should produce chunks");
        assert_eq!(chunks.len(), 1, "Should produce exactly 1 chunk");
        assert!(chunks[0].is_last, "Single chunk should be marked last");
        assert_eq!(chunks[0].index, 0, "Single chunk should have index 0");
    }

    #[test]
    fn test_chunk_with_emoji() {
        let chunks = chunk_text("Hello 👋 world");
        assert!(!chunks.is_empty(), "Text with emoji should produce chunks");
        // Emoji handling may vary - just verify we get some chunks
        assert!(chunks.len() >= 1, "Should handle emoji text");

        // Verify all chunks are accounted for
        let total_tokens: usize = chunks.len();
        assert_eq!(
            chunks.last().unwrap().index,
            total_tokens - 1,
            "Last chunk index should be total - 1"
        );
    }

    #[test]
    fn test_chunk_unicode() {
        let chunks = chunk_text("你好世界");
        assert!(!chunks.is_empty(), "Unicode text should produce chunks");
    }

    #[test]
    fn test_chunk_long_text() {
        let text = "This is a longer piece of text that should be tokenized into many individual chunks for streaming purposes.";
        let chunks = chunk_text(text);

        assert!(!chunks.is_empty(), "Long text should produce chunks");
        assert!(chunks.len() > 10, "Long text should produce many chunks");

        // Verify sequence integrity
        for window in chunks.windows(2) {
            assert_eq!(
                window[1].index,
                window[0].index + 1,
                "Indices should be sequential"
            );
            assert!(!window[0].is_last, "Non-final chunk should not be last");
        }
    }

    #[test]
    fn test_chunk_with_code() {
        let text = "fn main() { println!(\"Hello\"); }";
        let chunks = chunk_text(text);

        assert!(!chunks.is_empty(), "Code should produce chunks");
        assert!(chunks.len() > 1, "Code should produce multiple chunks");
    }
}
