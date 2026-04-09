# Script → Replay Pipeline for ACP Bridge

## TL;DR

> **Quick Summary**: Build a CLI subcommand `convert-script` in the Rust bridge that converts human-authored script files (XML format with events like thoughts, messages, tool calls) into standard ACP replay events (JSONL with token-based chunking). Thoughts/messages are tokenized into single-token chunks using `tiktoken-rs`, while tool calls/responses are emitted whole. This enables creating replay fixtures from declarative scripts.
>
> **Deliverables**:
> - `convert-script` CLI subcommand in `acp-bridge`
> - XML script parser with validation
> - Token-based chunking using `tiktoken-rs` (cl100k_base encoding)
> - ACP event generator producing standard BridgeEnvelope JSONL
> - Session data generator (session-data.json, manifest.json)
> - Roundtrip verification script
> - Example scripts demonstrating the format
>
> **Estimated Effort**: Medium (8-10 tasks, ~2-3 days)
> **Parallel Execution**: YES - Multiple independent tasks (parsing, tokenization, event generation)
> **Critical Path**: T1 (CLI args) → T2 (script parser) → T3 (tokenizer) → T4 (event gen) → T5 (writer) → T6 (integration)

---

## Context

### Original Request
Build a script → replay pipeline in the Rust bridge that:
1. Takes a file with large chunks of text (thoughts, messages) and tool calls and results
2. Splits them into token-based chunks using a Rust tokenizer library
3. Creates chunk events, tool call events, and tool result events in ACP format
4. Accessible via `{executable} convert-script --script=path/to/script.xml --output=path/to/replay`
5. Create scripts for each replay that coalesce events, then regenerate replays using convert-script

### Key Requirements from User
1. **Thoughts and messages**: Tokenized into MANY chunks, each 1 token wide
2. **Tool calls and responses**: Sent WHOLE (1 event each, no chunks)
3. **Scripts**: 1 "event" per thought/message/tool call/response (not tokenized)
4. **Scripts are NOT standard ACP, REPLAYS MUST BE STANDARD ACP EVENTS**
5. **Scripts contain**: All replay sessions and all session/replay parameters

### Research Findings

**Bridge Structure** (`crates/acp-bridge/`):
- Main entry: `main.rs` with clap CLI
- Replay mode: `modes/replay_v2.rs` with TPS timing at 65 tokens/second
- BridgeEnvelope wraps ACP payloads
- Replay events stored in JSONL (flat or wrapped format)
- Existing word-splitting fallback for events without tokenCount

**Tokenizer Library** (researched by librarian):
- **Recommended**: `tiktoken-rs` v0.9.1 (stable, OpenAI-focused, cl100k_base support)
- Alternative: `tiktoken` v3.1.2 (faster but newer, higher MSRV)
- Encoding: `cl100k_base` for GPT-4/Claude-compatible tokenization

**ACP Event Types** (from protocol):
- `user_message` - User input (not chunked, sent whole)
- `agent_message_chunk` - Streaming agent response (tokenized)
- `agent_thought_chunk` - Agent internal reasoning (tokenized)
- `tool_call` - Tool invocation request (sent whole)
- `tool_call_update` - Tool result/response (sent whole)

### Metis Review

**Critical Gaps Addressed**:
- **Tokenizer encoding**: Use `cl100k_base` (consistent with OpenAI/Claude)
- **Output format**: Flat BridgeEnvelope JSONL (not wrapped with tokenCount)
- **Backward compatibility**: Keep existing word-splitting as fallback
- **CLI scope**: Add subcommand to existing `acp-bridge` binary (server + CLI hybrid)
- **Multi-session**: One script → one output directory with session subdirectories
- **ID generation**: Script provides IDs; validator ensures uniqueness

**Guardrails Applied**:
- Deterministic tokenization (tiktoken-rs is deterministic)
- Strict XML parsing (fail on unknown elements)
- Status field enforcement (intermediate="in_progress", final=original)
- No overwrite without --force flag
- Tool events get tokenCount: 0 (15ms delay)

---

## Work Objectives

### Core Objective
Create a `convert-script` subcommand that transforms human-readable XML script files into production-ready ACP replay fixtures with proper token-level chunking.

### Concrete Deliverables
- CLI subcommand: `acp-bridge convert-script --script=<path> --output=<path> [--force]`
- XML script schema and parser
- Tokenization module using tiktoken-rs (cl100k_base)
- Event generator producing standard ACP events
- Session data generator (session-data.json + manifest.json)
- Integration with existing replay infrastructure
- Test scripts and verification

### Definition of Done
- [ ] Script can be converted to replay JSONL
- [ ] Replay JSONL loads correctly in existing replay_v2 mode
- [ ] Token count matches tiktoken-rs encoding
- [ ] Tool events are emitted whole (not chunked)
- [ ] Roundtrip verification passes
- [ ] Example scripts demonstrate all event types

### Must Have
- XML script parsing with validation
- tiktoken-rs integration (cl100k_base)
- Token-based chunking for thoughts/messages (1 token per chunk)
- Tool call/response events emitted whole
- BridgeEnvelope JSONL output
- session-data.json generation
- manifest.json generation
- CLI integration with acp-bridge

### Must NOT Have (Guardrails)
- NO reverse converter (replay → script)
- NO script editor or validation tooling beyond parsing
- NO modifications to runtime replay streaming logic
- NO pre-chunked script format
- NO template/variable substitution in scripts
- NO streaming conversion (one-shot only)
- NO changes to existing word-splitting fallback

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (Rust test framework, tokio-test)
- **Automated tests**: TDD-style (tests first, then implementation)
- **Framework**: Built-in Rust testing with tokio for async

### QA Policy
Every task MUST include agent-executed QA scenarios:
- **Rust module tests**: Unit tests verifying tokenization, parsing, event generation
- **Integration tests**: End-to-end script → replay → verification
- **CLI tests**: Command-line invocation and output verification

Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - Independent):
├── Task 1: CLI argument parsing for convert-script subcommand
├── Task 2: Define XML script schema and types
├── Task 3: Add tiktoken-rs dependency and basic tokenizer module
└── Task 4: Design session/manifest data structures

Wave 2 (Core Implementation - Depends on Wave 1):
├── Task 5: Implement XML script parser with validation
├── Task 6: Implement token-based chunking for text events
├── Task 7: Implement ACP event generator
└── Task 8: Implement JSONL writer and file output

Wave 3 (Integration - Depends on Wave 2):
├── Task 9: Integrate convert-script into main.rs CLI
├── Task 10: Implement session-data.json and manifest.json generation
└── Task 11: Create example scripts and test fixtures

Wave 4 (Verification - Depends on Wave 3):
├── Task 12: Build roundtrip verification script
├── Task 13: Run integration tests and verify replays load correctly
└── Task 14: Documentation and final review
```

### Dependency Matrix
- **T1, T2, T3, T4**: Independent, can start immediately
- **T5**: Depends on T2 (schema defined)
- **T6**: Depends on T3 (tokenizer ready)
- **T7**: Depends on T2, T6 (schema + chunking)
- **T8**: Depends on T7 (events ready)
- **T9**: Depends on T1, T5, T6, T7, T8 (all core components)
- **T10**: Depends on T8 (output ready)
- **T11**: Depends on T9 (CLI working)
- **T12**: Depends on T11 (examples ready)
- **T13**: Depends on T9, T10, T11 (full pipeline)
- **T14**: Depends on T13 (verification complete)

### Agent Dispatch Summary
- **Wave 1**: T1-T4 → `quick` (independent setup tasks)
- **Wave 2**: T5-T8 → `unspecified-high` (core logic implementation)
- **Wave 3**: T9-T11 → `unspecified-high` (integration and examples)
- **Wave 4**: T12-T14 → `quick` (verification and docs)

---

## TODOs

### Wave 1: Foundation

- [x] **Task 1: CLI argument parsing for convert-script**

  **What to do**:
  Add `ConvertScript` variant to CLI enum in `main.rs` with `--script` and `--output` arguments, plus optional `--force` flag. Use clap derive macros.

  **Must NOT do**:
  - Don't implement the actual conversion logic yet
  - Don't modify existing live/replay flags

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - **Reason**: Simple CLI argument addition using existing clap setup

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Blocks**: Task 9 (integration)

  **References**:
  - `crates/acp-bridge/src/main.rs:10-38` - Existing Cli struct
  - `crates/acp-bridge/src/main.rs:40-67` - main() function pattern
  - clap derive documentation for subcommands

  **Acceptance Criteria**:
  - [ ] `acp-bridge convert-script --help` shows usage
  - [ ] `--script <PATH>` and `--output <PATH>` are required
  - [ ] `--force` is optional boolean flag
  - [ ] Compilation succeeds

  **QA Scenarios**:
  ```
  Scenario: CLI help displays correctly
    Tool: Bash
    Steps:
      1. cargo build --release -p acp-bridge
      2. ./target/release/acp-bridge convert-script --help
    Expected Result: Shows "Convert script file to replay JSONL" with all options
    Evidence: .sisyphus/evidence/task-1-cli-help.txt
  ```

  **Commit**: YES
  - Message: `feat(bridge): add convert-script CLI subcommand`

---

- [x] **Task 2: Define XML script schema and types**

  **What to do**:
  Create Rust types representing the script format in `src/script/` module:
  - `Script` struct with sessions, parameters
  - `ScriptEvent` enum (Thought, Message, ToolCall, ToolResponse)
  - `ScriptSession` struct with session ID, parameters
  - Derive serde::Deserialize for XML parsing with serde-xml-rs or quick-xml

  **Must NOT do**:
  - Don't implement the parser yet (just types)
  - Don't add XML parsing dependencies yet

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - **Reason**: Type definitions only, no complex logic

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Blocks**: Task 5 (parser implementation)

  **References**:
  - XML format from user requirements:
    ```xml
    <script>
      <session id="session-1" cwd="/path">
        <thought id="thought-1">Large text content...</thought>
        <message id="msg-1" role="user">User message...</message>
        <tool-call id="tc-1" kind="read" title="...">...</tool-call>
        <tool-response id="tc-1">...</tool-response>
      </session>
    </script>
    ```

  **Acceptance Criteria**:
  - [ ] Types compile without errors
  - [ ] All event types represented
  - [ ] Serde derive macros in place

  **QA Scenarios**:
  ```
  Scenario: Types compile successfully
    Tool: Bash
    Steps:
      1. cargo check -p acp-bridge
    Expected Result: No compilation errors
    Evidence: .sisyphus/evidence/task-2-types-compile.txt
  ```

  **Commit**: YES
  - Message: `feat(bridge): define script format types`

---

- [x] **Task 3: Add tiktoken-rs dependency and tokenizer module**

  **What to do**:
  1. Add `tiktoken-rs = "0.9"` to Cargo.toml dependencies
  2. Create `src/tokenizer.rs` module with:
     - `Tokenizer` struct wrapping tiktoken-rs
     - `encode_to_tokens(text: &str) -> Vec<String>` method
     - Use `cl100k_base()` encoding
     - Error handling for encoding failures

  **Must NOT do**:
  - Don't integrate with event generation yet
  - Don't use parallel feature (not needed for this use case)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - **Reason**: Simple dependency addition and wrapper module

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Blocks**: Task 6 (token-based chunking)

  **References**:
  - `crates/acp-bridge/Cargo.toml:8-19` - Current dependencies
  - tiktoken-rs documentation: https://docs.rs/tiktoken-rs
  - Usage example from research:
    ```rust
    use tiktoken_rs::cl100k_base;
    let bpe = cl100k_base().unwrap();
    let tokens = bpe.encode_with_special_tokens("text");
    ```

  **Acceptance Criteria**:
  - [ ] tiktoken-rs builds successfully
  - [ ] Tokenizer module compiles
  - [ ] Unit test: "hello world" tokenizes correctly (expected ~2-3 tokens)

  **QA Scenarios**:
  ```
  Scenario: Tokenizer produces correct token count
    Tool: Bash (cargo test)
    Steps:
      1. Write test: tokenizer.encode_to_tokens("hello world")
      2. cargo test -p acp-bridge tokenizer
    Expected Result: Returns Vec with token strings, length > 0
    Evidence: .sisyphus/evidence/task-3-tokenizer-test.txt
  ```

  **Commit**: YES
  - Message: `feat(bridge): add tiktoken-rs tokenizer module`

---

- [x] **Task 4: Design session/manifest data structures**

  **What to do**:
  Define structs for output files:
  - `SessionData` for session-data.json (messages, thoughts, toolCalls arrays)
  - `Manifest` for manifest.json (description, sessions list)
  - Derive serde::Serialize for JSON output

  **Must NOT do**:
  - Don't write the JSON files yet
  - Don't integrate with conversion logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - **Reason**: Type definitions only

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Blocks**: Task 10 (session data generation)

  **References**:
  - `fixtures/replay-data/tool-calling-thinking/session-1/session-data.json` - Example
  - `fixtures/replay-data/tool-calling-thinking/manifest.json` - Example

  **Acceptance Criteria**:
  - [ ] SessionData struct matches existing format
  - [ ] Manifest struct matches existing format
  - [ ] Both derive Serialize

  **QA Scenarios**:
  ```
  Scenario: Types match existing format
    Tool: Rust unit test
    Steps:
      1. Parse existing session-data.json into SessionData
      2. Serialize back and compare
    Expected Result: Roundtrip preserves data
    Evidence: .sisyphus/evidence/task-4-session-types.txt
  ```

  **Commit**: YES
  - Message: `feat(bridge): define session and manifest types`

---

### Wave 2: Core Implementation

- [x] **Task 5: Implement XML script parser with validation**

  **What to do**:
  1. Add `quick-xml = { version = "0.36", features = ["serialize"] }` to Cargo.toml
  2. Create `src/script/parser.rs` module
  3. Implement `parse_script(xml: &str) -> Result<Script, ParseError>`
  4. Validation:
     - Required attributes present (id, role, kind, etc.)
     - Tool call IDs unique within session
     - No unknown XML elements (strict parsing)
     - CDATA support for code content

  **Must NOT do**:
  - Don't use best-effort parsing (fail on errors)
  - Don't allow unknown elements

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - **Reason**: Complex parsing with strict validation

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 2)
  - **Blocked By**: Task 2 (types defined)

  **References**:
  - quick-xml serde documentation
  - Existing Script types from Task 2
  - Error handling patterns in existing code

  **Acceptance Criteria**:
  - [ ] Parses valid XML scripts
  - [ ] Fails with clear error on invalid XML
  - [ ] Validates required fields
  - [ ] Supports CDATA sections
  - [ ] Unit tests for each event type

  **QA Scenarios**:
  ```
  Scenario: Parse valid script with all event types
    Tool: Rust unit test
    Steps:
      1. Create XML with thought, message, tool-call, tool-response
      2. Call parse_script()
    Expected Result: Returns Script with all events
    Evidence: .sisyphus/evidence/task-5-parse-valid.txt

  Scenario: Reject invalid XML
    Tool: Rust unit test
    Steps:
      1. Create XML with unknown element
      2. Call parse_script()
    Expected Result: Returns ParseError
    Evidence: .sisyphus/evidence/task-5-parse-invalid.txt
  ```

  **Commit**: YES
  - Message: `feat(bridge): implement XML script parser`

---

- [x] **Task 6: Implement token-based chunking for text events**

  **What to do**:
  Create `src/script/chunker.rs` module:
  1. `chunk_text(text: &str) -> Vec<TextChunk>` function
  2. Each chunk contains:
     - Single token (as string)
     - Index in sequence
     - Is_last flag
  3. For thoughts/messages: 1 token per chunk
  4. Return chunks for event generator to use

  **Must NOT do**:
  - Don't create the ACP events yet (just chunking)
  - Don't chunk tool calls/responses

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - **Reason**: Core tokenization logic

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 3)
  - **Blocked By**: Task 3 (tokenizer ready)

  **References**:
  - Task 3 Tokenizer module
  - tiktoken-rs encoding methods
  - ACP protocol agent_message_chunk format (lines 510-527 in ACP-Protocol.md)

  **Acceptance Criteria**:
  - [ ] Text splits into 1-token chunks
  - [ ] Each chunk preserves token content
  - [ ] Empty text returns empty Vec (no chunks)
  - [ ] Unicode/emoji handled correctly

  **QA Scenarios**:
  ```
  Scenario: Tokenize simple sentence
    Tool: Rust unit test
    Steps:
      1. chunk_text("hello world")
      2. Check token count
    Expected Result: Returns ~2-3 chunks (one per token)
    Evidence: .sisyphus/evidence/task-6-chunk-simple.txt

  Scenario: Tokenize empty string
    Tool: Rust unit test
    Steps:
      1. chunk_text("")
    Expected Result: Returns empty Vec
    Evidence: .sisyphus/evidence/task-6-chunk-empty.txt

  Scenario: Tokenize with emoji
    Tool: Rust unit test
    Steps:
      1. chunk_text("Hello 👋 world")
    Expected Result: Each token is separate chunk
    Evidence: .sisyphus/evidence/task-6-chunk-emoji.txt
  ```

  **Commit**: YES
  - Message: `feat(bridge): implement token-based text chunking`

---

- [x] **Task 7: Implement ACP event generator**

  **What to do**:
  Create `src/script/event_gen.rs` module:
  1. `generate_events(script: &Script) -> Vec<ReplayEvent>` function
  2. For each script event:
     - Thoughts → Vec<agent_thought_chunk> (one per token)
     - Messages → Vec<agent_message_chunk> (one per token)
     - Tool calls → single tool_call event
     - Tool responses → single tool_call_update event
  3. Assign sequential seq numbers
  4. Set status: intermediate="in_progress", final=original
  5. Build BridgeEnvelope for each event

  **Must NOT do**:
  - Don't write to files yet (just generate events)
  - Don't handle session initialization/mode events

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - **Reason**: Complex event generation logic

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 5, T6)
  - **Blocked By**: Task 5 (parser), Task 6 (chunker)

  **References**:
  - `src/modes/replay_v2.rs:113-139` - ReplayEvent structure
  - `src/contract/envelope.rs` - BridgeEnvelope structure
  - `src/contract/message.rs` - BridgeMessage types
  - ACP Protocol session/update events (lines 508-632 in ACP-Protocol.md)

  **Acceptance Criteria**:
  - [ ] Thoughts generate tokenized chunks
  - [ ] Messages generate tokenized chunks
  - [ ] Tool calls generate single event
  - [ ] Tool responses generate single event
  - [ ] Seq numbers monotonically increasing from 0
  - [ ] Status fields correct per chunk position

  **QA Scenarios**:
  ```
  Scenario: Generate events from thought
    Tool: Rust unit test
    Steps:
      1. Create Script with one thought containing "hello world"
      2. Call generate_events()
    Expected Result: Returns ~2-3 agent_thought_chunk events
    Evidence: .sisyphus/evidence/task-7-gen-thought.txt

  Scenario: Generate events from tool call
    Tool: Rust unit test
    Steps:
      1. Create Script with tool-call event
      2. Call generate_events()
    Expected Result: Returns 1 tool_call event (not tokenized)
    Evidence: .sisyphus/evidence/task-7-gen-tool.txt
  ```

  **Commit**: YES
  - Message: `feat(bridge): implement ACP event generator`

---

- [x] **Task 8: Implement JSONL writer and file output**

  **What to do**:
  Create `src/script/writer.rs` module:
  1. `write_replay_events(events: &[ReplayEvent], path: &Path) -> Result<()>`
  2. JSONL format: one JSON object per line
  3. Flat BridgeEnvelope format (not wrapped)
  4. Include replay_metadata event at start
  5. Include bridge_status events (starting, connected, disconnected)

  **Must NOT do**:
  - Don't generate session-data.json yet (Task 10)
  - Don't handle directory creation here

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - **Reason**: File I/O with proper formatting

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 7)
  - **Blocked By**: Task 7 (events generated)

  **References**:
  - `fixtures/replay-data/tool-calling-thinking/session-1/replay-events.jsonl` - Example format
  - `src/modes/replay_v2.rs:234-252` - load_replay_events function (reverse of what we need)
  - Serde JSON serialization

  **Acceptance Criteria**:
  - [ ] Writes valid JSONL (one JSON per line)
  - [ ] Includes metadata and status events
  - [ ] Events in correct order
  - [ ] File readable by existing replay_v2 mode

  **QA Scenarios**:
  ```
  Scenario: Write events to JSONL
    Tool: Rust unit test
    Steps:
      1. Create sample events
      2. Write to temp file
      3. Read and verify each line is valid JSON
    Expected Result: Valid JSONL file
    Evidence: .sisyphus/evidence/task-8-write-jsonl.txt
  ```

  **Commit**: YES
  - Message: `feat(bridge): implement JSONL writer`

---

### Wave 3: Integration

- [x] **Task 9: Integrate convert-script into main.rs CLI**

  **What to do**:
  1. Wire up ConvertScript command handling in main.rs
  2. Create `run_convert_script(args: ConvertScriptArgs)` async function
  3. Orchestrate: parse → generate → write
  4. Handle errors with proper exit codes
  5. Check --force flag before overwriting
  6. Create output directory if needed

  **Must NOT do**:
  - Don't modify existing server/replay logic
  - Don't change default behavior of bridge

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - **Reason**: Integration orchestration

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Wave 2)
  - **Blocked By**: Task 1 (CLI args), Task 5, T6, T7, T8 (core logic)

  **References**:
  - Task 1 CLI argument definitions
  - All Wave 2 modules (parser, chunker, generator, writer)
  - `main.rs:40-67` - Existing main function pattern

  **Acceptance Criteria**:
  - [ ] `acp-bridge convert-script --script=test.xml --output=out` runs
  - [ ] Creates output directory structure
  - [ ] Fails gracefully on parse errors
  - [ ] Respects --force flag

  **QA Scenarios**:
  ```
  Scenario: Convert script end-to-end
    Tool: Bash
    Steps:
      1. Create test.xml with simple thought
      2. ./acp-bridge convert-script --script=test.xml --output=./test-output
      3. Check ./test-output/replay-events.jsonl exists
    Expected Result: File created with tokenized events
    Evidence: .sisyphus/evidence/task-9-e2e.txt

  Scenario: Fail on missing file
    Tool: Bash
    Steps:
      1. ./acp-bridge convert-script --script=nonexistent.xml --output=./out
    Expected Result: Exit code non-zero, error message
    Evidence: .sisyphus/evidence/task-9-missing-file.txt
  ```

  **Commit**: YES
  - Message: `feat(bridge): integrate convert-script CLI command`

---

- [x] **Task 10: Implement session-data.json and manifest.json generation**

  **What to do**:
  1. Create `src/script/session_gen.rs` module
  2. `generate_session_data(script: &Script) -> SessionData`
  3. `generate_manifest(script: &Script) -> Manifest`
  4. Write session-data.json in each session subdirectory
  5. Write manifest.json in output root
  6. Support multi-session scripts

  **Must NOT do**:
  - Don't generate replay events here (Task 8 handles that)
  - Don't create empty sessions

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - **Reason**: JSON generation with proper structure

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 4, T9)
  - **Blocked By**: Task 4 (types), Task 9 (output infrastructure)

  **References**:
  - Task 4 SessionData and Manifest types
  - Example session-data.json from fixtures
  - Example manifest.json from fixtures

  **Acceptance Criteria**:
  - [ ] session-data.json written per session
  - [ ] manifest.json written to output root
  - [ ] Multi-session scripts create subdirectories
  - [ ] JSON matches existing format

  **QA Scenarios**:
  ```
  Scenario: Generate session files
    Tool: Bash
    Steps:
      1. Create script with one session
      2. Run convert-script
      3. Check session-data.json and manifest.json
    Expected Result: Both files exist and are valid JSON
    Evidence: .sisyphus/evidence/task-10-session-files.txt
  ```

  **Commit**: YES (grouped with Task 9)
  - Message: `feat(bridge): generate session-data.json and manifest.json`

---

- [x] **Task 11: Create example scripts and test fixtures**

  **What to do**:
  1. Create `fixtures/scripts/` directory
  2. `simple-thought.xml` - Single thought example
  3. `tool-calling.xml` - Tool call and response example
  4. `multi-session.xml` - Multiple sessions example
  5. `complex-content.xml` - Code snippets, markdown, CDATA
  6. Document each example with comments

  **Must NOT do**:
  - Don't create too many examples (4-5 is enough)
  - Don't include binary data

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - **Reason**: Creating example files

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 9)
  - **Blocked By**: Task 9 (CLI working)

  **References**:
  - Existing fixtures in `fixtures/replay-data/`
  - User requirements for event types

  **Acceptance Criteria**:
  - [ ] 4-5 example scripts created
  - [ ] Each converts successfully
  - [ ] Examples cover all event types
  - [ ] XML is well-formatted with comments

  **QA Scenarios**:
  ```
  Scenario: Convert all examples
    Tool: Bash
    Steps:
      1. For each example.xml in fixtures/scripts/
      2. Run convert-script
    Expected Result: All succeed, produce valid replays
    Evidence: .sisyphus/evidence/task-11-examples.txt
  ```

  **Commit**: YES
  - Message: `feat(bridge): add example script fixtures`

---

### Wave 4: Verification

- [x] **Task 12: Build roundtrip verification script**

  **What to do**:
  Create `scripts/verify-convert.sh`:
  1. Takes script path and expected output path
  2. Runs convert-script
  3. Validates output JSONL:
     - Each line is valid JSON
     - Events are in order
     - Token counts match tiktoken-rs
     - Tool events are whole
  4. Returns exit code 0 on success

  **Must NOT do**:
  - Don't modify the converter logic
  - Don't test runtime replay behavior

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - **Reason**: Shell script for verification

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 11)
  - **Blocked By**: Task 11 (examples ready)

  **References**:
  - Task 11 example scripts
  - JSONL format from Task 8

  **Acceptance Criteria**:
  - [ ] Script runs and validates
  - [ ] Catches malformed JSONL
  - [ ] Verifies token counts
  - [ ] Clear pass/fail output

  **QA Scenarios**:
  ```
  Scenario: Verify valid conversion
    Tool: Bash
    Steps:
      1. ./scripts/verify-convert.sh fixtures/scripts/simple-thought.xml
    Expected Result: Exit 0, "Verification passed"
    Evidence: .sisyphus/evidence/task-12-verify-pass.txt
  ```

  **Commit**: YES
  - Message: `test(bridge): add roundtrip verification script`

---

- [x] **Task 13: Run integration tests and verify replays load correctly**

  **What to do**:
  1. Convert all example scripts
  2. Start replay server with converted replays
  3. Connect WebSocket client
  4. Verify events stream correctly
  5. Check that replay_v2 mode can load the JSONL
  6. Document any issues

  **Must NOT do**:
  - Don't modify replay_v2.rs (if bugs found, file separate issues)
  - Don't test with actual ACP agents

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: ["playwright"]
  - **Reason**: End-to-end testing with WebSocket

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 12)
  - **Blocked By**: Task 12 (verification script)

  **References**:
  - `src/modes/replay_v2.rs` - Replay loading code
  - Existing test patterns in codebase

  **Acceptance Criteria**:
  - [ ] All example replays load in replay_v2 mode
  - [ ] Events stream via WebSocket
  - [ ] Token timing works correctly
  - [ ] No panics or errors

  **QA Scenarios**:
  ```
  Scenario: Load replay in replay_v2 mode
    Tool: interactive_bash (tmux)
    Steps:
      1. Start bridge: ./acp-bridge --file ./test-output
      2. Connect WebSocket client
      3. Send initialize + session/new
    Expected Result: Replay events stream correctly
    Evidence: .sisyphus/evidence/task-13-replay-load.txt
  ```

  **Commit**: N/A (testing only)

---

- [x] **Task 14: Documentation and final review**

  **What to do**:
  1. Update crate-level documentation in `src/lib.rs`
  2. Add module documentation for script/, tokenizer/
  3. Create `docs/SCRIPT_FORMAT.md` documenting XML schema
  4. Update README with convert-script usage
  5. Add inline code comments for complex logic
  6. Run clippy and fix warnings
  7. Final cargo test run

  **Must NOT do**:
  - Don't modify ACP protocol docs (out of scope)
  - Don't create external documentation sites

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: []
  - **Reason**: Documentation writing

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 13)
  - **Blocked By**: Task 13 (verification complete)

  **References**:
  - Existing documentation patterns
  - User requirements

  **Acceptance Criteria**:
  - [ ] All modules documented
  - [ ] XML schema documented
  - [ ] README updated
  - [ ] Clippy clean
  - [ ] All tests pass

  **QA Scenarios**:
  ```
  Scenario: Documentation is complete
    Tool: Bash
    Steps:
      1. cargo doc -p acp-bridge --no-deps
      2. cargo clippy -p acp-bridge
      3. cargo test -p acp-bridge
    Expected Result: Docs build, clippy clean, tests pass
    Evidence: .sisyphus/evidence/task-14-final.txt
  ```

  **Commit**: YES
  - Message: `docs(bridge): add documentation for script pipeline`

---

## Final Verification Wave

- [ ] **F1. Plan Compliance Audit** - `oracle`

  Read the plan end-to-end. For each "Must Have": verify implementation exists. Check:
  - `convert-script` CLI implemented
  - XML parser with validation
  - tiktoken-rs integration
  - Token-based chunking working
  - Tool events emitted whole
  - BridgeEnvelope JSONL output
  - Session data and manifest generation
  - Example scripts created

  Output: `Must Have [8/8] | Tasks [14/14] | VERDICT: APPROVE/REJECT`

- [ ] **F2. Code Quality Review** - `unspecified-high`

  Run `cargo clippy` + `cargo test`. Review for:
  - Unsafe code (should be none)
  - unwrap() calls (should be minimal, handled)
  - Error propagation (proper ? usage)
  - AI slop patterns (excessive comments, generic names)

  Output: `Clippy [PASS/FAIL] | Tests [N pass/N fail] | VERDICT`

- [ ] **F3. Real Manual QA** - `unspecified-high`

  Execute verification script on all examples:
  - Each script converts successfully
  - JSONL validates
  - Replay loads in replay_v2 mode
  - Save evidence to `.sisyphus/evidence/final-qa/`

  Output: `Scripts [N/N pass] | VERDICT`

- [ ] **F4. Scope Fidelity Check** - `deep`

  Verify:
  - No reverse converter added (scope: one-way only)
  - No runtime replay changes (scope: file conversion only)
  - Tool events not tokenized (per requirements)
  - Scripts are XML (per requirements)
  - Replays are standard ACP (per requirements)

  Output: `Scope Compliant [YES/NO] | VERDICT`

---

## Commit Strategy

### Grouped Commits
1. **Tasks 1-4** (Wave 1): `feat(bridge): add script pipeline foundation`
2. **Tasks 5-8** (Wave 2): `feat(bridge): implement script parsing and event generation`
3. **Tasks 9-11** (Wave 3): `feat(bridge): integrate convert-script CLI and examples`
4. **Task 14** (Wave 4): `docs(bridge): add documentation for script pipeline`

### Individual Commits (alternative)
Each task can be committed separately with message: `type(scope): description`

---

## Success Criteria

### Verification Commands
```bash
# Build
cargo build --release -p acp-bridge

# CLI help shows convert-script
./target/release/acp-bridge convert-script --help

# Convert example script
./target/release/acp-bridge convert-script \
  --script=fixtures/scripts/simple-thought.xml \
  --output=./test-output

# Verify output
ls ./test-output/replay-events.jsonl
ls ./test-output/session-data.json
ls ./test-output/manifest.json

# Run tests
cargo test -p acp-bridge

# Clippy clean
cargo clippy -p acp-bridge -- -D warnings
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
- [ ] Examples convert successfully
- [ ] Replays load in replay_v2 mode
- [ ] Documentation complete
- [ ] Clippy clean

---

## Appendix: XML Script Schema

```xml
<?xml version="1.0" encoding="UTF-8"?>
<script>
  <!-- Optional: Global script metadata -->
  <metadata>
    <description>Script description here</description>
    <author>Optional author</author>
  </metadata>
  
  <!-- Session: Each replay session -->
  <session id="session-1" cwd="/home/user/project">
    <!-- Thought: Agent internal reasoning (will be tokenized) -->
    <thought id="thought-1">
      Large text content that will be tokenized into chunks...
    </thought>
    
    <!-- Message: Agent response (will be tokenized) -->
    <message id="msg-1" role="assistant">
      Agent message content that will be tokenized...
    </message>
    
    <!-- ToolCall: Tool invocation (sent whole, not tokenized) -->
    <tool-call 
      id="tc-1" 
      kind="read" 
      title="Read file"
      status="pending">
      <input>{"filePath": "src/main.rs"}</input>
    </tool-call>
    
    <!-- ToolResponse: Tool result (sent whole, not tokenized) -->
    <tool-response id="tc-1" status="completed">
      <output>fn main() { println!("Hello"); }</output>
    </tool-response>
  </session>
</script>
```

### Event Attributes

**thought:**
- `id` (required): Unique identifier within session
- Content: CDATA or text (will be tokenized)

**message:**
- `id` (required): Unique identifier within session
- `role` (required): "assistant" or "user"
- Content: CDATA or text (will be tokenized)

**tool-call:**
- `id` (required): Unique identifier within session
- `kind` (required): "read", "edit", "execute", etc.
- `title` (required): Display title
- `status` (optional): "pending", defaults to pending
- `input` (child element): JSON input for tool

**tool-response:**
- `id` (required): Must match corresponding tool-call id
- `status` (required): "completed" or "failed"
- `output` (child element): Tool output content

---

**Last Updated**: April 2026
**Maintained By**: ACP Chat Core Team
