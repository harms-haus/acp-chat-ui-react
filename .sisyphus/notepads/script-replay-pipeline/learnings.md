# Learnings - Script Replay Pipeline

## Task 1: XML Script Schema and Types Definition

### Date: April 8, 2026

### Patterns and Conventions

1. **Module Structure**:
   - Follow existing module pattern: `mod.rs` file for module organization
   - Module registered in `lib.rs` with `pub mod module_name;`
   - Types exported via `pub use module_name::{Type1, Type2, ...};`

2. **Type Definition Patterns**:
   - All public types derive `Debug`, `Clone`, `Deserialize`
   - Use `#[serde(rename = "...")]` for XML attribute mapping
   - Use `#[serde(rename = "$text")]` for text content
   - Use `#[serde(rename = "$value")]` for mixed content (Vec of enums)
   - Use `#[serde(rename_all = "kebab-case")]` for enum variant naming

3. **XML Mapping**:
   - XML attributes mapped with `#[serde(rename = "attr-name")]`
   - Text content of elements mapped with `#[serde(rename = "$text")]`
   - Mixed content (elements + text) mapped with `#[serde(rename = "$value")]`

4. **Public API Documentation**:
   - Module-level docstring explains purpose and context
   - Type-level docstrings explain intent and usage
   - Field-level docstrings explain field semantics
   - All public types documented for external consumption

### Successful Approaches

1. **Define Types Before Implementation**:
   - Created all type definitions first (Script, ScriptSession, ScriptEvent, etc.)
   - Did not implement XML parsing logic yet (separate task)
   - Added placeholder test that compiles without parsing

2. **Serde Deserialization**:
   - Used existing `serde` dependency (already in Cargo.toml)
   - No need to add new dependencies yet (quick-xml/serde-xml-rs for later)
   - Types compile successfully with just `#[derive(Deserialize)]`

3. **Integration**:
   - Module registered in `lib.rs` following existing patterns
   - Types exported for use by other parts of the codebase
   - Cargo check passes: `cargo check -p acp-bridge`
   - LSP diagnostics clean: no errors or warnings

### Code Structure

```
crates/acp-bridge/src/
├── lib.rs (registers script module, exports types)
└── script/
    └── mod.rs (all type definitions)
```

### Type Hierarchy

- `Script` (root, contains metadata + sessions)
  - `ScriptMetadata` (optional metadata)
  - `ScriptSession` (sessions, each with events)
    - `ScriptEvent` (enum of event types)
      - `Thought`
      - `Message` (with `MessageRole` enum)
      - `ToolCall`
      - `ToolResponse`

### Verification Steps

1. Created type definitions
2. Registered module in `lib.rs`
3. Ran `cargo check -p acp-bridge` → SUCCESS
4. Ran `lsp_diagnostics` → NO ERRORS
5. All compilation checks pass

### Next Steps

- Task 3: Add XML parsing dependencies (quick-xml or serde-xml-rs)
- Task 3: Implement XML parsing logic
- Task 4: Create script replay functionality


## Task: Add tiktoken-rs dependency and create tokenizer module

### Date
April 8, 2026

### Implementation Details

#### 1. Dependency Addition
- Added `tiktoken-rs = "0.9"` to `[dependencies]` in `crates/acp-bridge/Cargo.toml`
- Placed after existing dependencies (which, clap) before dev-dependencies

#### 2. Tokenizer Module Structure
Created `crates/acp-bridge/src/tokenizer.rs` with:
- Module-level docstring explaining purpose (cl100k_base encoding, same as GPT-4)
- Public function `encode_to_tokens(text: &str) -> Vec<String>`
- Uses `cl100k_base()` encoding from tiktoken-rs
- Returns token IDs as string representations (not actual token strings, as tiktoken-rs doesn't provide direct conversion)
- Error handling via `.expect()` for tokenizer initialization failure

#### 3. API Design Decision
- **Returns Vec<String> instead of Result<Vec<String>, String>**
  - Reason: `encode_with_special_tokens()` returns Vec<u32>, not a Result
  - Tokenization rarely fails once tokenizer is initialized
  - Simplifies API for downstream consumers

#### 4. Unit Tests
5 comprehensive tests covering:
- `test_tokenize_hello_world()`: Validates multi-word tokenization (≥2 tokens)
- `test_tokenize_empty_string()`: Edge case handling (empty Vec)
- `test_tokenize_simple_text()`: Single word tokenization
- `test_tokenize_unicode()`: Unicode character support (Chinese characters)
- `test_tokenize_with_special_chars()`: Special character handling

#### 5. Module Export Pattern
Updated `crates/acp-bridge/src/lib.rs`:
- Added `pub mod tokenizer;` to module declarations
- Exported public API: `pub use tokenizer::encode_to_tokens;`
- Followed existing pattern (contract, modes, script, server)

### Key Learnings

#### tiktoken-rs API Behavior
- `cl100k_base()` returns Result, but `encode_with_special_tokens()` returns Vec<u32>
- Token IDs are converted to strings for readability (actual token strings not available)
- No error handling needed for encoding step itself

#### Rust Testing Patterns
- Test functions must be unique (no duplicates in same module)
- If function returns Vec directly (not Result), don't use `.unwrap()` in tests
- Use `assert!()` with custom messages for clear failure descriptions

#### Documentation Best Practices
- Module-level docstrings (`//!`) explain overall purpose
- Function docstrings (`///`) provide usage examples
- Keep comments minimal - let code be self-documenting
- Public API documentation is essential; inline comments mostly unnecessary

### Success Criteria Met
✅ Files modified: `crates/acp-bridge/Cargo.toml`
✅ Files created: `crates/acp-bridge/src/tokenizer.rs`
✅ Functionality: Tokenizer module compiles and tokenizes text
✅ Verification: `cargo check -p acp-bridge` succeeds, all 5 unit tests pass

### Files Changed
1. `crates/acp-bridge/Cargo.toml` - Added tiktoken-rs dependency
2. `crates/acp-bridge/src/tokenizer.rs` - New module with tokenization logic
3. `crates/acp-bridge/src/lib.rs` - Exported tokenizer module and public function


## Task 3: Define Session/Manifest Data Structures

### SessionData Structure
- Matches session-data.json format exactly
- Fields: messages, thoughts, tool_calls, session_id, cwd
- Uses existing Message, Thought, ToolCall types with Serialize derive added
- Uses serde rename annotations for camelCase JSON output (toolCalls, sessionId)

### Manifest Structure
- Matches manifest.json format exactly
- Fields: demo_type, sessions (Vec<ManifestSession>)
- All JSON fields use camelCase (demoType, sessionId, etc.)

### ManifestSession Structure
- Contains session metadata from manifest.json
- Fields: demo_type, session_id, modes, models, captured_at, token_count, event_count, description
- All fields properly typed to match JSON schema

### Key Implementation Details
- Added Serialize derives to existing types: Message, Thought, ToolCall, MessageRole
- Used serde(rename) annotations to maintain camelCase JSON while using snake_case Rust fields
- Compilation verified with cargo check -p acp-bridge (no warnings)
- lsp_diagnostics clean on modified file

### Format Mapping
```rust
SessionData → session-data.json
{
  messages: Vec<Message>,
  thoughts: Vec<Thought>,
  tool_calls: Vec<ToolCall>,  // JSON: "toolCalls"
  session_id: String,         // JSON: "sessionId"
  cwd: String
}

Manifest → manifest.json
{
  demo_type: String,           // JSON: "demoType"
  sessions: Vec<ManifestSession>
}
```
