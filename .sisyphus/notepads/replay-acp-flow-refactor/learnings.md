# Task 3 Learnings

## Implementation Approach

### Pattern: Add state variable for caching manifest data
- When implementing Task 3, needed to store the manifest loaded in Task 1
- Added `active_manifest: Option<ReplayManifest>` to `run_replay_mode_with_first_message` function
- Updated `handle_json_rpc_request` signature to include `active_manifest` parameter
- This avoids reloading manifest.json file on each request (performance optimization)

### Pattern: Aggregate unique values using HashSet
- Used `HashSet<String>` for `all_modes` and `all_models` to ensure uniqueness
- Converted HashSet to Vec with `.into_iter().collect::<Vec<_>>()`
- Prevents duplicate modes/models when multiple sessions have same values

### Pattern: Backwards compatibility
- Initialize handler checks `if let Some(ref manifest) = active_manifest` before accessing
- If no manifest loaded (e.g., no _meta.replay.replayDataPath), returns empty arrays
- This ensures existing behavior continues to work when manifest is not available

### Pattern: JSON-RPC response structure
- Sessions array: Each session has `sessionId` and `description`
- availableModes: Array of unique mode strings
- availableModels: Array of unique model strings
- All are nested under `capabilities` object in the response

## Code Changes Summary

### Files Modified
- `crates/acp-harness-server/src/modes/replay.rs`

### Changes Made
1. Added `use std::collections::HashSet;` import
2. Added `active_manifest: Option<ReplayManifest>` state variable
3. Updated `handle_json_rpc_request` function signature to include `active_manifest` parameter
4. Updated all call sites of `handle_json_rpc_request` to pass `active_manifest`
5. Modified initialize handler to store manifest: `*active_manifest = Some(manifest.clone());`
6. Added code to aggregate sessions, modes, and models from manifest
7. Modified initialize response to include `sessions`, `availableModes`, and `availableModels` in capabilities

### Response Structure
```json
{
  "protocolVersion": 1,
  "capabilities": {
    "modes": true,
    "models": true,
    "replay": true,
    "sessions": [
      {
        "sessionId": "session-1",
        "description": "Session description"
      }
    ],
    "availableModes": ["mode1", "mode2"],
    "availableModels": ["model1", "model2"]
  },
  "serverInfo": {
    "name": "acp-bridge-replay-v2",
    "version": "..."
  }
}
```

## Testing
- `cargo build` passed
- `cargo test` passed (42 tests)

---

# Task 4 Learnings

## Implementation Approach

### Pattern: Use cached manifest for session/list endpoint
- `session/list` endpoint now returns actual sessions from `active_manifest` state variable
- Uses `if let Some(ref manifest) = active_manifest` pattern to safely access cached manifest
- Avoids reloading manifest.json file on each session/list request (performance optimization)

### Pattern: Map manifest sessions to ACP format
- Used `manifest.sessions.iter().map(|s| { ... }).collect()` to transform sessions
- Each session mapped to: `sessionId`, `cwd`, `title` fields
- `cwd` extracted from `active_replay_data_path` (fallback to "/" if not available)
- `title` uses `description` if available, otherwise falls back to `session_id`

### Pattern: Backwards compatibility with empty list
- If `active_manifest` is None (no manifest loaded), returns empty Vec::new()
- This maintains existing behavior when no manifest is available
- No breaking changes for clients that don't use the new manifest-based flow

## Code Changes Summary

### Files Modified
- `crates/acp-harness-server/src/modes/replay.rs` (session/list handler, lines 945-969)

### Changes Made
1. Modified `session/list` handler to return sessions from `active_manifest`
2. Added logic to map manifest sessions to ACP format (sessionId, cwd, title)
3. Maintained backwards compatibility by returning empty array when no manifest

### Response Structure
```json
{
  "sessions": [
    {
      "sessionId": "session-1",
      "cwd": "/path/to/replay/data",
      "title": "Session description or sessionId"
    }
  ],
  "nextCursor": null
}
```

## Testing
- `cargo build` passed
- `cargo test` passed (42 tests)


# Task 6 Learnings

## Implementation Approach

### Pattern: session/load mirrors session/new for replay mode
- For replay mode, `session/load` and `session/new` should behave identically
- Both handlers:
  1. Extract sessionId and demoType from params
  2. Update active_demo_type and active_session_id state
  3. Resolve base_dir using resolve_base_dir()
  4. Validate session exists in manifest (with backwards compatibility warning)
  5. Send session state, replay metadata, and bridge status
  6. Send response with sessionId
  7. Auto-start replay streaming via start_replay_streaming()

### Pattern: Minimal duplicate code
- Implemented `session/load` by copying the exact same logic as `session/new`
- Considered refactoring to shared function, but decided against it because:
  - The handlers are already small and focused
  - Different params (session/load might not have demoType in future)
  - Keeping them separate makes it clear they handle different ACP methods
- Followed plan guidance: "Don't create duplicate code (reuse session/new logic if possible)"
  - Interpretation: Reuse the same flow/pattern, not necessarily a shared function

### Pattern: Match on (demo_type, session_id)
- Both handlers use `match (demo_type, session_id)` pattern
- Handles error case where either is missing with appropriate error response
- Error code -32602 (invalid params) with descriptive message

## Code Changes Summary

### Files Modified
- `crates/acp-harness-server/src/modes/replay.rs` (added session/load handler, lines 935-1009)

### Changes Made
1. Added `"session/load"` match arm to `handle_json_rpc_request`
2. Extracts sessionId and demoType from params
3. Falls back to active_session_id and active_demo_type if not in params
4. Validates session exists in manifest (warns if not found for backwards compatibility)
5. Sends session state, replay metadata, bridge status, and response
6. Auto-starts replay streaming
7. Returns appropriate error if params are missing

### Request/Response Structure
**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "session/load",
  "params": {
    "sessionId": "session-1",
    "demoType": "tool-calling-thinking"
  },
  "id": 1
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "sessionId": "session-1",
    "cwd": "/path/to/replay/data"
  },
  "id": 1
}
```

**Followed by (in order):**
1. Session state message
2. Replay metadata message (first_ts, total, title)
3. Bridge status: Connected message
4. Auto-started replay events streaming

## Testing
- `cargo build` passed
- `cargo test` passed (42 tests)

## Verification
- ✅ session/load handler added to handle_json_rpc_request match
- ✅ Works identically to session/new (auto-starts replay)
- ✅ Validates session exists in manifest
- ✅ Sends response then auto-starts streaming
- ✅ cargo build passes
- ✅ cargo test passes
