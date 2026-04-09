# Work Plan: Filesystem ACP Events Implementation

## TL;DR

> **Quick Summary**: Implement filesystem event handling in acp-chat-core to support ACP `fs/read_text_file` and `fs/write_text_file` methods. Add Promise-based hook system with subscription pattern, extend harness server script support for filesystem operations, and create integration test using script-generated replay fixtures.
> 
> **Deliverables**:
> - Filesystem hook types and subscription API in acp-chat-core
> - SessionController extension to detect and route fs requests
> - JSON-RPC response generation matching request IDs
> - Harness server script XML extensions for fs operations
> - Integration test with replay fixture verification
> 
> **Estimated Effort**: Large (8-10 tasks across 2 packages)
> **Parallel Execution**: YES - 3 waves (core types → controller → harness + tests)
> **Critical Path**: Types → Controller Detection → Response Routing → Integration Test

---

## Context

### Original Request
Handle ACP filesystem events (https://agentclientprotocol.com/protocol/file-system) in @harms-haus/acp-chat-core. Create Promise-based hooks for:
- Requesting file data (unsaved changes) - returns content
- Editing file data (applying changes) - returns success/failure

Create integration test using script feature: script sends fs requests/writes, generates replay, uses replay fixture in test to verify events pass through bridge and hooks fire correctly.

### Interview Summary
**Key Discussions**:
- Hook Design: Promise-based - SessionController awaits handler Promise and sends JSON-RPC response automatically
- Error Handling: Return empty result `{"jsonrpc":"2.0","id":{{id}},"result":null}` if no handler or error
- Script Format: Dedicated XML elements (`<fs-read-request>`, `<fs-read-response>`, etc.)
- Handler Scope: Per-SessionController instance (not global)
- Handler Lifecycle: Multiple handlers per operation, subscription pattern with unsubscribe
- Timeout: None - let handlers take as long as needed

**Research Findings**:
- ACP protocol: Two JSON-RPC methods `fs/read_text_file` and `fs/write_text_file`
- Current architecture: 3-layer event system (Transport → SessionController → Store)
- Scripts: XML converted to JSONL replay via harness server
- Integration tests: Spawn bridge subprocess, use ReplayController

### Metis Review
**Identified Gaps** (addressed in plan):
- Handler registration: Subscription pattern with unsubscribe capability
- Request correlation: Must match JSON-RPC `id` field exactly
- Path validation: Reject path traversal attempts before handler invocation
- Concurrent requests: Each request gets unique response with matching id
- Security: No path normalization - pass raw path to handlers (they decide)

**Guardrails Applied**:
- OUT OF SCOPE: File system implementation, permission policies, caching, batch operations, binary files, watch events
- IN SCOPE: Hook registration (2 methods), request detection (2 types), response correlation, error handling, harness script parsing, integration test

---

## Work Objectives

### Core Objective
Enable acp-chat-core consumers to handle ACP filesystem requests by registering Promise-based handlers that receive file read/write requests and return responses that are automatically sent back to the ACP bridge as JSON-RPC responses.

### Concrete Deliverables
1. TypeScript types for filesystem handlers (`FileReadHandler`, `FileWriteHandler`)
2. Subscription API (`subscribeToFileReads`, `subscribeToFileWrites`) returning unsubscribe functions
3. SessionController extension to detect `fs/read_text_file` and `fs/write_text_file` JSON-RPC requests
4. JSON-RPC response generation with matching `id` fields
5. Error handling for missing handlers, handler errors, invalid params
6. Harness server XML schema extensions for `<fs-read-request>`, `<fs-read-response>`, `<fs-write-request>`, `<fs-write-response>`
7. Script-to-replay conversion for filesystem events
8. Integration test script with filesystem operations
9. Integration test using replay fixture to verify hook firing and response routing
10. Wiki documentation updates for new API

### Definition of Done
- [ ] All "Must Have" features implemented and tested
- [ ] Integration test passes: script → replay → test verifies hooks fire and responses sent
- [ ] No TypeScript errors
- [ ] All existing tests pass
- [ ] Wiki documentation updated

### Must Have
- Promise-based handler subscription API with unsubscribe
- Per-SessionController handler registration
- Detection of `fs/read_text_file` JSON-RPC requests
- Detection of `fs/write_text_file` JSON-RPC requests
- Automatic JSON-RPC response generation with matching id
- Error responses for missing handlers
- Error responses for handler exceptions
- Path validation (reject path traversal)
- Harness server XML support for fs operations
- Integration test with replay fixture
- Wiki documentation

### Must NOT Have (Guardrails)
- ❌ File system implementation (handlers provided by consumer)
- ❌ Permission policies beyond path traversal rejection
- ❌ Built-in caching layer
- ❌ Batch file operations
- ❌ Binary file support (text only per ACP spec)
- ❌ File watch/subscription events
- ❌ Changes to acp-chat-react package
- ❌ Custom ACP event types or properties
- ❌ Global static handlers (must be per-SessionController)
- ❌ Timeout on handlers

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (bun test, existing test patterns)
- **Automated tests**: YES (Tests for core features)
- **Framework**: bun test
- **Test approach**: Unit tests for handlers, integration test with replay fixture

### QA Policy
Every task MUST include agent-executed QA scenarios. Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Core Library**: Bun tests with assertions on handler invocation, response generation
- **Harness Server**: Rust tests for script parsing, event generation
- **Integration Test**: Full flow - spawn bridge, connect controller, verify hooks fire

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - Types and Interfaces):
├── Task 1: Create filesystem types and interfaces
├── Task 2: Create subscription manager for handlers
└── Task 3: Add unit tests for subscription manager

Wave 2 (Core Logic - SessionController Extension):
├── Task 4: Extend SessionController with fs request detection
├── Task 5: Implement JSON-RPC response generation
├── Task 6: Add error handling and validation
└── Task 7: Add unit tests for fs request handling

Wave 3 (Harness + Integration):
├── Task 8: Extend harness server script XML schema
├── Task 9: Implement fs event generation in harness
├── Task 10: Create integration test script
├── Task 11: Generate replay fixture
└── Task 12: Write integration test

Wave 4 (Documentation + Final Review):
├── Task 13: Update wiki documentation
└── Task 14: Run final verification

Critical Path: Task 1 → Task 2 → Task 4 → Task 5 → Task 8 → Task 12
```

### Agent Dispatch Summary

- **Wave 1 (3 tasks)**: `quick` - Type definitions, subscription manager, tests
- **Wave 2 (4 tasks)**: `deep` - SessionController extension (complex state management)
- **Wave 3 (5 tasks)**: `unspecified-high` - Rust harness work, integration tests
- **Wave 4 (2 tasks)**: `writing` - Documentation

---

## TODOs

- [ ] 1. Create filesystem types and interfaces

  **What to do**:
  Create TypeScript types for filesystem handlers in `packages/acp-chat-core/src/filesystem/types.ts`:
  - `FileReadRequest` interface: `{ path: string; line?: number; limit?: number }`
  - `FileReadResponse` interface: `{ content: string }`
  - `FileWriteRequest` interface: `{ path: string; content: string }`
  - `FileWriteResponse` interface: `{ success: boolean }` (or just void)
  - `FileReadHandler` type: `(request: FileReadRequest) => Promise<FileReadResponse | null>`
  - `FileWriteHandler` type: `(request: FileWriteRequest) => Promise<FileWriteResponse | null>`
  - `FileSystemSubscription` interface with `unsubscribe(): void` method
  
  **Must NOT do**:
  - Do NOT create custom ACP event types (use standard JSON-RPC)
  - Do NOT add properties beyond ACP spec (path, line, limit for read; path, content for write)
  
  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  
  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 1)
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Task 2, Task 4
  - **Blocked By**: None
  
  **References**:
  - ACP spec: `fs/read_text_file` and `fs/write_text_file` methods from https://agentclientprotocol.com/protocol/file-system
  - Existing types pattern: `packages/acp-chat-core/src/types/index.ts` or similar
  
  **Acceptance Criteria**:
  - [ ] Type file created with all 7 type definitions
  - [ ] Types exported from main index.ts
  - [ ] TypeScript compilation passes (`tsc --noEmit`)
  
  **QA Scenarios**:
  ```
  Scenario: Types compile correctly
    Tool: Bash
    Preconditions: None
    Steps:
      1. cd packages/acp-chat-core && tsc --noEmit
    Expected Result: No TypeScript errors
    Evidence: .sisyphus/evidence/task-1-types-compile.log
  ```
  
  **Commit**: YES
  - Message: `feat(core): add filesystem handler types and interfaces`
  - Files: `packages/acp-chat-core/src/filesystem/types.ts`, `packages/acp-chat-core/src/index.ts`

- [ ] 2. Create subscription manager for handlers

  **What to do**:
  Create a subscription manager class in `packages/acp-chat-core/src/filesystem/subscription-manager.ts`:
  - `FileSystemSubscriptionManager` class
  - Methods: `subscribeToFileReads(handler): FileSystemSubscription`, `subscribeToFileWrites(handler): FileSystemSubscription`
  - Subscription object returned with `unsubscribe(): void` method
  - Store handlers in arrays (multiple handlers per operation supported)
  - Method to get all read handlers: `getReadHandlers(): FileReadHandler[]`
  - Method to get all write handlers: `getWriteHandlers(): FileWriteHandler[]`
  - Internal ID generation for subscriptions (e.g., using counter or uuid)
  
  **Must NOT do**:
  - Do NOT make this global/singleton - must be instantiated per SessionController
  - Do NOT limit to single handler (support multiple)
  
  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  
  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 1)
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 4
  - **Blocked By**: Task 1
  
  **References**:
  - Subscription pattern similar to: `packages/acp-chat-core/src/transport/client.ts` lines 52-68 (on/off methods)
  
  **Acceptance Criteria**:
  - [ ] Manager class created with subscribe methods
  - [ ] Subscription objects have working unsubscribe
  - [ ] Multiple handlers can be registered
  - [ ] Unsubscribe removes specific handler only
  
  **QA Scenarios**:
  ```
  Scenario: Subscribe and unsubscribe works
    Tool: Bash (bun test)
    Preconditions: None
    Steps:
      1. Create subscription manager
      2. Subscribe two handlers to file reads
      3. Verify both in getReadHandlers()
      4. Unsubscribe first handler
      5. Verify only second remains
    Expected Result: Only second handler in list
    Evidence: .sisyphus/evidence/task-2-subscription.test.ts
  ```
  
  **Commit**: YES (group with Task 1)

- [ ] 3. Add unit tests for subscription manager

  **What to do**:
  Create unit tests in `packages/acp-chat-core/src/__tests__/filesystem-subscription.test.ts`:
  - Test subscribing single handler
  - Test subscribing multiple handlers
  - Test unsubscribe removes correct handler
  - Test unsubscribe with invalid ID is no-op
  - Test getHandlers returns copy (not reference)
  
  **Must NOT do**:
  - Do NOT test SessionController integration here (separate task)
  
  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  
  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 1)
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: None
  - **Blocked By**: Task 2
  
  **References**:
  - Test patterns: `packages/acp-chat-core/src/__tests__/replay-controller.test.ts`
  
  **Acceptance Criteria**:
  - [ ] Test file created with 5+ test cases
  - [ ] All tests pass (`bun test`)
  - [ ] 100% line coverage for subscription manager
  
  **QA Scenarios**:
  ```
  Scenario: All unit tests pass
    Tool: Bash
    Preconditions: Tasks 1-2 complete
    Steps:
      1. cd packages/acp-chat-core && bun test src/__tests__/filesystem-subscription.test.ts
    Expected Result: All tests pass (5/5)
    Evidence: .sisyphus/evidence/task-3-unit-tests.log
  ```
  
  **Commit**: YES (group with Task 1-2)

- [ ] 4. Extend SessionController with fs request detection

  **What to do**:
  Extend `SessionController` in `packages/acp-chat-core/src/session/controller.ts`:
  - Add `private fileSystemManager: FileSystemSubscriptionManager` property
  - Add public methods: `subscribeToFileReads(handler)`, `subscribeToFileWrites(handler)` that delegate to manager
  - Modify `handleAcpPayload()` to detect `fs/read_text_file` and `fs/write_text_file` methods
  - When fs request detected:
    1. Extract params (path, line, limit for read; path, content for write)
    2. Validate params (path must be string, reject path traversal `../`)
    3. Get all registered handlers from manager
    4. Call all handlers with Promise.allSettled()
    5. Use first successful (non-null) response, or null if all fail
  - Store subscription manager in constructor or lazy-init
  
  **Must NOT do**:
  - Do NOT modify the bridge crate - handle at SessionController level
  - Do NOT make handlers global - must be per-SessionController instance
  - Do NOT send response here - just detect and collect handler results (Task 5 sends response)
  
  **Recommended Agent Profile**:
  - **Category**: `deep` (complex state management, integration with existing code)
  - **Skills**: []
  
  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 2)
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 7)
  - **Blocks**: Task 5, Task 7
  - **Blocked By**: Task 2
  
  **References**:
  - SessionController: `packages/acp-chat-core/src/session/controller.ts` lines 285-374 (handleAcpPayload)
  - Permission request pattern: lines 320-350 (emitPermissionRequest and respond)
  
  **Acceptance Criteria**:
  - [ ] SessionController has subscribeToFileReads/Writes methods
  - [ ] handleAcpPayload detects fs/read_text_file method
  - [ ] handleAcpPayload detects fs/write_text_file method
  - [ ] Path traversal (`../`) rejected before calling handlers
  - [ ] All handlers called with Promise.allSettled()
  - [ ] First successful response used (or null)
  
  **QA Scenarios**:
  ```
  Scenario: Fs read request detected and handlers called
    Tool: Bun test
    Preconditions: Tasks 1-3 complete
    Steps:
      1. Create SessionController
      2. Subscribe handler returning { content: "test" }
      3. Simulate fs/read_text_file request via handleAcpPayload
      4. Verify handler was called with correct params
    Expected Result: Handler invoked with { path: "/test.txt" }
    Evidence: .sisyphus/evidence/task-4-detection.test.ts
  
  Scenario: Path traversal rejected
    Tool: Bun test
    Preconditions: None
    Steps:
      1. Create SessionController with handler
      2. Simulate request with path "../../etc/passwd"
      3. Verify handler NOT called
    Expected Result: Handler not invoked, returns null
    Evidence: .sisyphus/evidence/task-4-path-traversal.test.ts
  ```
  
  **Commit**: YES
  - Message: `feat(core): implement fs request detection in SessionController`
  - Files: `packages/acp-chat-core/src/session/controller.ts`

- [ ] 5. Implement JSON-RPC response generation

  **What to do**:
  In `SessionController`, implement response sending after handler execution:
  - After collecting handler results (Task 4), send JSON-RPC response via transport
  - Response format for read: `{"jsonrpc":"2.0","id":{{requestId}},"result":{"content":"..."}}`
  - Response format for write: `{"jsonrpc":"2.0","id":{{requestId}},"result":null}`
  - If no handlers registered or all returned null: send `{"jsonrpc":"2.0","id":{{requestId}},"result":null}`
  - Extract `id` from original request and include in response
  - Use transportClient.send() or similar to send response envelope
  - Handle async - await handler results before sending
  
  **Must NOT do**:
  - Do NOT send responses for non-fs requests
  - Do NOT modify the id field - must match request exactly
  
  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []
  
  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 2)
  - **Parallel Group**: Wave 2 (with Tasks 4, 6, 7)
  - **Blocks**: Task 7
  - **Blocked By**: Task 4
  
  **References**:
  - Transport send: `packages/acp-chat-core/src/transport/client.ts` (send method)
  - JSON-RPC format: ACP spec at https://agentclientprotocol.com/protocol/file-system
  
  **Acceptance Criteria**:
  - [ ] Response sent with correct JSON-RPC format
  - [ ] id field matches original request
  - [ ] Read response includes content in result
  - [ ] Write response has null result
  - [ ] Response sent via transport
  
  **QA Scenarios**:
  ```
  Scenario: Read response sent correctly
    Tool: Bun test with mock transport
    Preconditions: Task 4 complete
    Steps:
      1. Mock transport.send method
      2. Create controller and subscribe handler returning "content"
      3. Send fs/read_text_file request with id=5
      4. Verify transport.send called with correct response
    Expected Result: Response has id=5, result.content="content"
    Evidence: .sisyphus/evidence/task-5-read-response.test.ts
  
  Scenario: Write response sent correctly
    Tool: Bun test
    Steps:
      1. Mock transport.send
      2. Send fs/write_text_file with id=6
      3. Verify response
    Expected Result: Response has id=6, result=null
    Evidence: .sisyphus/evidence/task-5-write-response.test.ts
  ```
  
  **Commit**: YES (group with Task 4)

- [ ] 6. Add error handling and validation

  **What to do**:
  Implement comprehensive error handling in fs request processing:
  - Validate request params before calling handlers:
    - `path` must be string and non-empty
    - `line` and `limit` (for read) must be numbers if provided
    - `content` (for write) must be string
  - If validation fails: send error response (don't call handlers)
  - If handler throws exception: catch it, send error response
  - Error response format: `{"jsonrpc":"2.0","id":{{id}},"error":{"code":-32602,"message":"..."}}`
  - Error codes: -32602 (Invalid params), custom code for handler errors
  - Log errors for debugging but don't expose internal details in response
  - Path traversal detection: reject paths containing `..` or starting with `/` (absolute)
  
  **Must NOT do**:
  - Do NOT expose internal error details (stack traces) in JSON-RPC response
  - Do NOT call handlers if params invalid
  
  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []
  
  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 2)
  - **Parallel Group**: Wave 2 (with Tasks 4, 5, 7)
  - **Blocks**: None
  - **Blocked By**: Task 4
  
  **References**:
  - JSON-RPC error codes: https://www.jsonrpc.org/specification#error_object
  
  **Acceptance Criteria**:
  - [ ] Param validation rejects invalid requests
  - [ ] Error response sent for invalid params
  - [ ] Handler exceptions caught and error response sent
  - [ ] Path traversal detected and rejected
  - [ ] No internal details exposed in error responses
  
  **QA Scenarios**:
  ```
  Scenario: Invalid params return error
    Tool: Bun test
    Steps:
      1. Send fs/read_text_file with path=123 (not string)
      2. Verify error response with code -32602
    Expected Result: Error response, handler not called
    Evidence: .sisyphus/evidence/task-6-validation.test.ts
  
  Scenario: Handler exception caught
    Tool: Bun test
    Steps:
      1. Subscribe handler that throws Error("fail")
      2. Send fs request
      3. Verify error response sent (not thrown)
    Expected Result: Error response with message, no uncaught exception
    Evidence: .sisyphus/evidence/task-6-error-handling.test.ts
  ```
  
  **Commit**: YES (group with Task 4-5)

- [ ] 7. Add unit tests for fs request handling

  **What to do**:
  Create comprehensive unit tests in `packages/acp-chat-core/src/__tests__/filesystem-handlers.test.ts`:
  - Test fs/read_text_file triggers handlers
  - Test fs/write_text_file triggers handlers
  - Test multiple handlers - first successful response used
  - Test no handlers - null result returned
  - Test handler exception - error response
  - Test invalid params - error response
  - Test path traversal - rejected
  - Test id matching in responses
  - Test concurrent requests - correct responses for each
  
  **Must NOT do**:
  - Do NOT test actual file system operations (mock handlers)
  
  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  
  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 2)
  - **Parallel Group**: Wave 2 (with Tasks 4, 5, 6)
  - **Blocks**: None
  - **Blocked By**: Tasks 4, 5, 6
  
  **References**:
  - Test patterns: `packages/acp-chat-core/src/__tests__/replay-controller.test.ts`
  - Mock patterns: Use mock transport and mock handlers
  
  **Acceptance Criteria**:
  - [ ] 8+ test cases covering all scenarios
  - [ ] All tests pass
  - [ ] Tests verify JSON-RPC response format
  
  **QA Scenarios**:
  ```
  Scenario: Full test suite passes
    Tool: Bash
    Steps:
      1. bun test src/__tests__/filesystem-handlers.test.ts
    Expected Result: 8/8 tests pass
    Evidence: .sisyphus/evidence/task-7-full-tests.log
  ```
  
  **Commit**: YES (group with Task 4-6)

- [ ] 8. Extend harness server script XML schema

  **What to do**:
  Extend the script XML format in `crates/acp-harness-server/src/script/mod.rs` and parser:
  - Add `FsReadRequest` struct with fields: `path: String`, `line: Option<u32>`, `limit: Option<u32>`
  - Add `FsReadResponse` struct with fields: `request_id: String`, `content: String`
  - Add `FsWriteRequest` struct with fields: `path: String`, `content: String`
  - Add `FsWriteResponse` struct with fields: `request_id: String`, `success: bool`
  - Extend `ScriptEvent` enum to include these new types
  - Update XML parser (`parser.rs`) to parse:
    - `<fs-read-request id="req1" path="test.txt" line="0" limit="50"/>`
    - `<fs-read-response request-id="req1" content="file content"/>`
    - `<fs-write-request id="req2" path="out.txt" content="data"/>`
    - `<fs-write-response request-id="req2" success="true"/>`
  - All attributes optional except `id` (request) and `request-id` (response)
  
  **Must NOT do**:
  - Do NOT change existing event types (thought, message, tool-call)
  - Do NOT add custom properties beyond ACP spec
  
  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` (Rust work)
  - **Skills**: []
  
  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 3)
  - **Parallel Group**: Wave 3 (with Tasks 9-12)
  - **Blocks**: Task 9
  - **Blocked By**: None
  
  **References**:
  - Script types: `crates/acp-harness-server/src/script/mod.rs`
  - XML parser: `crates/acp-harness-server/src/script/parser.rs`
  - Existing patterns: `Thought`, `Message`, `ToolCall` structs
  
  **Acceptance Criteria**:
  - [ ] New structs added to mod.rs
  - [ ] ScriptEvent enum extended
  - [ ] Parser handles fs XML elements
  - [ ] Parser tests pass
  
  **QA Scenarios**:
  ```
  Scenario: XML elements parsed correctly
    Tool: Bash (cargo test)
    Steps:
      1. cd crates/acp-harness-server && cargo test script::parser::tests
    Expected Result: Parser tests pass
    Evidence: .sisyphus/evidence/task-8-parser-tests.log
  ```
  
  **Commit**: YES
  - Message: `feat(harness): add filesystem XML elements to script schema`
  - Files: `crates/acp-harness-server/src/script/mod.rs`, `parser.rs`

- [ ] 9. Implement fs event generation in harness

  **What to do**:
  Extend event generation in `crates/acp-harness-server/src/script/event_gen.rs`:
  - When processing `FsReadRequest` script event:
    1. Generate JSON-RPC request envelope: `{"jsonrpc":"2.0","id":N,"method":"fs/read_text_file","params":{...}}`
    2. Wrap in BridgeEnvelope with type "acp_payload"
    3. Add to replay events list
  - When processing `FsReadResponse` script event:
    1. Generate JSON-RPC response envelope: `{"jsonrpc":"2.0","id":N,"result":{"content":"..."}}`
    2. Match request-id to original request id
    3. Add to replay events
  - Same for FsWriteRequest/Response
  - Maintain request id counter for auto-generating ids
  - Ensure response comes after request in event sequence
  - Support optional tokenCount for timing (maybe 0 for fs events)
  
  **Must NOT do**:
  - Do NOT create new envelope types - use "acp_payload"
  - Do NOT modify Bridge structure - use existing JSON-RPC format
  
  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` (Rust)
  - **Skills**: []
  
  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 3)
  - **Parallel Group**: Wave 3 (with Tasks 8, 10-12)
  - **Blocks**: Task 11
  - **Blocked By**: Task 8
  
  **References**:
  - Event gen: `crates/acp-harness-server/src/script/event_gen.rs`
  - BridgeEnvelope format: `packages/acp-chat-core/src/generated/BridgeEnvelope.ts`
  - ACP JSON-RPC format: ACP filesystem spec
  
  **Acceptance Criteria**:
  - [ ] FsReadRequest generates correct JSON-RPC request
  - [ ] FsReadResponse generates correct JSON-RPC response
  - [ ] Request/response ids match
  - [ ] Events in correct order (request before response)
  
  **QA Scenarios**:
  ```
  Scenario: Script generates correct replay events
    Tool: Bash
    Steps:
      1. Create test script with fs elements
      2. cargo run -- convert-script --script=test.xml --output=/tmp/test
      3. cat /tmp/test/replay-events.jsonl | head -20
    Expected Result: Contains fs/read_text_file and response
    Evidence: .sisyphus/evidence/task-9-event-gen.jsonl
  ```
  
  **Commit**: YES (group with Task 8)

- [ ] 10. Create integration test script

  **What to do**:
  Create XML script in `fixtures/scripts/filesystem-test.xml`:
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <script>
    <metadata>
      <description>Filesystem events integration test</description>
    </metadata>
    <session id="fs-test-session" cwd="/workspace">
      <message id="m1" role="user">Read the config file</message>
      <fs-read-request id="req1" path="config.json"/>
      <fs-read-response request-id="req1" content='{"debug": true}'/>
      <message id="m2" role="assistant">I'll update the config</message>
      <fs-write-request id="req2" path="config.json" content='{"debug": false}'/>
      <fs-write-response request-id="req2" success="true"/>
    </session>
  </script>
  ```
  - Include both read and write operations
  - Include response elements
  - Test realistic file paths
  - Keep simple for verification
  
  **Must NOT do**:
  - Do NOT add custom properties to XML
  
  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  
  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 3)
  - **Parallel Group**: Wave 3 (with Tasks 8, 9, 11, 12)
  - **Blocks**: Task 11
  - **Blocked By**: None
  
  **References**:
  - Existing scripts: `fixtures/scripts/simple-thought.xml`, `tool-calling.xml`
  
  **Acceptance Criteria**:
  - [ ] Script file created with fs elements
  - [ ] Valid XML syntax
  - [ ] Includes both read and write operations
  
  **QA Scenarios**:
  ```
  Scenario: Script is valid XML
    Tool: Bash
    Steps:
      1. xmllint fixtures/scripts/filesystem-test.xml
    Expected Result: No errors
    Evidence: .sisyphus/evidence/task-10-xml-valid.log
  ```
  
  **Commit**: YES
  - Message: `test(integration): add filesystem test script`
  - Files: `fixtures/scripts/filesystem-test.xml`

- [ ] 11. Generate replay fixture

  **What to do**:
  Convert script to replay fixture:
  - Run harness CLI: `cargo run -- convert-script --script=fixtures/scripts/filesystem-test.xml --output=fixtures/replay-data/filesystem-test --force`
  - Verify generated files:
    - `fixtures/replay-data/filesystem-test/manifest.json`
    - `fixtures/replay-data/filesystem-test/session-fs-test-session/replay-events.jsonl`
    - `fixtures/replay-data/filesystem-test/session-fs-test-session/session-data.json`
  - Check replay-events.jsonl contains:
    - fs/read_text_file request
    - fs/read_text_file response
    - fs/write_text_file request
    - fs/write_text_file response
  - Check JSON-RPC format is correct
  - Check ids match between request and response
  
  **Must NOT do**:
  - Do NOT manually edit generated files
  
  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  
  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 3)
  - **Parallel Group**: Wave 3 (with Tasks 8-10, 12)
  - **Blocks**: Task 12
  - **Blocked By**: Tasks 9, 10
  
  **References**:
  - CLI usage: Run `cargo run --manifest-path crates/acp-harness-server/Cargo.toml -- convert-script --help`
  - Existing replay: `fixtures/replay-data/long-context/session-1/`
  
  **Acceptance Criteria**:
  - [ ] Replay fixture generated
  - [ ] JSONL file contains fs events
  - [ ] Request/response ids match
  - [ ] Valid JSON-RPC format
  
  **QA Scenarios**:
  ```
  Scenario: Replay generated and valid
    Tool: Bash
    Steps:
      1. head fixtures/replay-data/filesystem-test/session-*/replay-events.jsonl
      2. Validate JSON format
    Expected Result: Contains fs/read_text_file and fs/write_text_file events
    Evidence: .sisyphus/evidence/task-11-replay.jsonl
  ```
  
  **Commit**: YES (group with Task 10)

- [ ] 12. Write integration test

  **What to do**:
  Create integration test in `packages/integration-tests/src/filesystem-events.test.ts`:
  ```typescript
  import { ReplayController } from "@harms-haus/acp-chat-core";
  import { spawnBridge, killBridge } from "./helpers/bridge";
  import { findAvailablePort, waitForConnection, waitForDisconnect } from "./helpers/websocket-polyfill";

  describe("filesystem events", () => {
    let controller: ReplayController;
    let bridgeProcess: any;
    let port: number;
    const readHandler = jest.fn();
    const writeHandler = jest.fn();

    beforeAll(async () => {
      port = await findAvailablePort(29876);
      bridgeProcess = await spawnBridge(port, "filesystem-test", "fs-test-session");
      controller = new ReplayController({ bridgeUrl: `ws://127.0.0.1:${port}` });
      
      // Register handlers
      controller.subscribeToFileReads(async (req) => {
        readHandler(req);
        return { content: `Content of ${req.path}` };
      });
      
      controller.subscribeToFileWrites(async (req) => {
        writeHandler(req);
        return { success: true };
      });
    });

    it("should trigger file read handler and receive response", async () => {
      controller.connect();
      await waitForConnection(controller);
      
      // Init replay
      await controller.initReplay("filesystem-test", "fs-test-session");
      
      // Wait for replay to complete
      await waitForDisconnect(controller);
      
      // Assert handler was called
      expect(readHandler).toHaveBeenCalled();
      expect(readHandler).toHaveBeenCalledWith({ path: "config.json" });
      
      // Assert write handler was called
      expect(writeHandler).toHaveBeenCalled();
      expect(writeHandler).toHaveBeenCalledWith({ path: "config.json", content: '{"debug": false}' });
    });

    afterAll(async () => {
      await killBridge(bridgeProcess);
    });
  });
  ```
  - Spawn bridge with filesystem-test demo-type
  - Create ReplayController with handlers
  - Connect and init replay
  - Verify handlers called with correct params
  - Verify responses sent (check traffic log or mock responses)
  - Clean up bridge
  
  **Must NOT do**:
  - Do NOT mock the bridge (use actual replay fixture)
  - Do NOT test acp-chat-react
  
  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` (complex integration)
  - **Skills**: []
  
  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 3)
  - **Parallel Group**: Wave 3 (with Tasks 8-11)
  - **Blocks**: None
  - **Blocked By**: Tasks 4-7, 11
  
  **References**:
  - Existing test: `packages/integration-tests/src/long-context-replay.test.ts`
  - Helpers: `packages/integration-tests/src/helpers/bridge.ts`
  
  **Acceptance Criteria**:
  - [ ] Test file created
  - [ ] Test spawns bridge and creates controller
  - [ ] Test registers handlers
  - [ ] Test verifies handlers called with correct params
  - [ ] Test passes (bun test)
  
  **QA Scenarios**:
  ```
  Scenario: Integration test passes
    Tool: Bash
    Steps:
      1. cd packages/integration-tests && bun test src/filesystem-events.test.ts
    Expected Result: Test passes, handlers verified
    Evidence: .sisyphus/evidence/task-12-integration-test.log
  ```
  
  **Commit**: YES (group with Task 10-11)

- [ ] 13. Update wiki documentation

  **What to do**:
  Update wiki documentation in `docs/wiki/`:
  - Update `acp-chat-core-Types-Reference.md`:
    - Add `FileReadRequest`, `FileReadResponse`, `FileWriteRequest`, `FileWriteResponse` types
    - Add `FileReadHandler`, `FileWriteHandler` type aliases
    - Add `FileSystemSubscription` interface
  - Update `acp-chat-core-Session-Management.md`:
    - Document `subscribeToFileReads()` method with example
    - Document `subscribeToFileWrites()` method with example
    - Show how to unsubscribe
    - Show error handling
  - Update `acp-chat-core-Events.md`:
    - Document fs/read_text_file and fs/write_text_file handling
    - Show event flow diagram
    - Document JSON-RPC response format
  - Update `acp-chat-core-Implementation-Guide.md`:
    - Add section on filesystem hooks
    - Show complete example: register handler, handle request, send response
  
  **Must NOT do**:
  - Do NOT document acp-chat-react (out of scope)
  - Do NOT create new wiki pages (update existing)
  
  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: []
  
  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 4)
  - **Parallel Group**: Wave 4 (with Task 14)
  - **Blocks**: None
  - **Blocked By**: Tasks 1-7
  
  **References**:
  - Wiki files: `docs/wiki/acp-chat-core-*.md`
  - Existing patterns: See how other types/methods documented
  
  **Acceptance Criteria**:
  - [ ] All 4 wiki files updated
  - [ ] Types documented with full interfaces
  - [ ] Methods have examples
  - [ ] Links between pages work
  
  **QA Scenarios**:
  ```
  Scenario: Documentation updated
    Tool: Bash
    Steps:
      1. Check all 4 wiki files have fs content
      2. Verify no broken links: grep -r "\[.*\](" docs/wiki/ | grep -v "acp-chat"
    Expected Result: All files updated, no broken links
    Evidence: .sisyphus/evidence/task-13-wiki-updated.log
  ```
  
  **Commit**: YES
  - Message: `docs(wiki): document filesystem hook API`
  - Files: `docs/wiki/acp-chat-core-*.md`

- [ ] 14. Run final verification

  **What to do**:
  Run complete verification suite:
  1. TypeScript compilation: `cd packages/acp-chat-core && tsc --noEmit`
  2. Core unit tests: `bun test src/__tests__/filesystem-*.test.ts`
  3. All core tests: `bun test`
  4. Harness tests: `cd crates/acp-harness-server && cargo test`
  5. Integration test: `cd packages/integration-tests && bun test src/filesystem-events.test.ts`
  6. Check no acp-chat-react changes: `git diff packages/acp-chat-react/`
  7. Check no custom ACP types: grep for custom event types in code
  
  **Must NOT do**:
  - Do NOT commit if any test fails
  
  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  
  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 4)
  - **Parallel Group**: Wave 4 (with Task 13)
  - **Blocks**: None
  - **Blocked By**: Tasks 1-13
  
  **Acceptance Criteria**:
  - [ ] All TypeScript compilation passes
  - [ ] All unit tests pass
  - [ ] Integration test passes
  - [ ] No acp-chat-react changes
  - [ ] Wiki updated
  
  **QA Scenarios**:
  ```
  Scenario: Full verification passes
    Tool: Bash
    Steps:
      1. Run all verification commands above
    Expected Result: All pass, no errors
    Evidence: .sisyphus/evidence/task-14-final-verification.log
  ```
  
  **Commit**: NO (verification only)

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read plan end-to-end. Verify all "Must Have" implemented, "Must NOT Have" absent. Check evidence files exist.
  Output: `Must Have [14/14] | Must NOT Have [0/10] | VERDICT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit`, linter, `bun test`. Review for AI slop patterns.
  Output: `Build [PASS] | Tests [N/N] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Execute integration test, verify hooks fire, responses sent correctly.
  Output: `Integration [PASS] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  Verify no custom ACP properties, no new event types, no acp-chat-react changes.
  Output: `Scope [PASS] | VERDICT`

---

## Commit Strategy

- Task 1-3: `feat(core): add filesystem handler types and subscription manager`
- Task 4-7: `feat(core): implement fs request detection and response routing`
- Task 8-9: `feat(harness): add filesystem support to script system`
- Task 10-12: `test(integration): add filesystem events integration test`
- Task 13: `docs(wiki): document filesystem hook API`

---

## Success Criteria

### Verification Commands
```bash
# TypeScript compilation
cd packages/acp-chat-core && tsc --noEmit

# Unit tests
bun test src/__tests__/filesystem-handlers.test.ts

# Harness tests  
cd crates/acp-harness-server && cargo test

# Integration test
cd packages/integration-tests && bun test src/filesystem-events.test.ts
```

### Final Checklist
- [ ] All 14 tasks complete
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] No TypeScript errors
- [ ] All tests pass
- [ ] Wiki documentation updated
- [ ] Integration test passes with replay fixture
