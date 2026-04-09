//! Tokenizer for ACP script content.
//!
//! This module provides tokenization functionality using tiktoken's cl100k_base encoding,
//! which is the same encoding used by GPT-4 and other OpenAI models.

use tiktoken_rs::cl100k_base;

/// Tokenizes text into string tokens using cl100k_base encoding.
///
/// This function converts input text into a vector of string tokens using the
/// cl100k_base tokenizer (the same encoding used by GPT-4).
///
/// # Arguments
///
/// * `text` - The text to tokenize
///
/// # Returns
///
/// A vector of string tokens representing the tokenized input.
///
/// # Example
///
/// ```rust
/// use harms_haus_acp_harness_server::tokenizer::encode_to_tokens;
///
/// let tokens = encode_to_tokens("hello world");
/// assert!(!tokens.is_empty());
/// ```
pub fn encode_to_tokens(text: &str) -> Vec<String> {
    let bpe = cl100k_base().expect("Failed to initialize cl100k_base tokenizer");

    let token_ids = bpe.encode_with_special_tokens(text);

    // Decode each token ID back to its string representation
    token_ids
        .iter()
        .filter_map(|id| {
            bpe.decode(vec![*id])
                .ok()
                .and_then(|s| if s.is_empty() { None } else { Some(s) })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tokenize_hello_world() {
        let tokens = encode_to_tokens("hello world");
        assert!(!tokens.is_empty());
        assert!(
            tokens.len() >= 2,
            "Should have at least 2 tokens for 'hello world'"
        );
    }

    #[test]
    fn test_tokenize_empty_string() {
        let tokens = encode_to_tokens("");
        assert!(tokens.is_empty(), "Empty string should produce no tokens");
    }

    #[test]
    fn test_tokenize_simple_text() {
        let tokens = encode_to_tokens("test");
        assert!(!tokens.is_empty(), "Simple text should produce tokens");
        assert_eq!(tokens.len(), 1, "Single word 'test' should produce 1 token");
    }

    #[test]
    fn test_tokenize_unicode() {
        let tokens = encode_to_tokens("你好世界");
        assert!(!tokens.is_empty(), "Unicode text should produce tokens");
    }

    #[test]
    fn test_tokenize_with_special_chars() {
        let tokens = encode_to_tokens("Hello, <world>!");
        assert!(!tokens.is_empty());
    }
}
