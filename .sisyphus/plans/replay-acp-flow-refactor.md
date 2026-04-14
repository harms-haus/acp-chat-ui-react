# Replay System ACP Flow Refactor

## TL;DR

> **Quick Summary**: Refactor the replay system to use ACP-standard initialization flow, matching the live mode UX. Replay configuration is passed via `_meta` in initialize, server returns available sessions/modes/models, and replay starts automatically when session is loaded.
> 
> **Deliverables**: 
> - Modified Rust replay mode to accept config via `_meta` and return capabilities
> - Proper `session/list` implementation returning sessions from manifest
> - Auto-replay on `session/new` without requiring prompt
> - Refactored UI with connect-first flow and session selection
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: NO - sequential waves
> **Critical Path**: Rust changes → UI changes → Integration testing

---

## Context

### Original Request
Refactor the replay system to mimic a real ACP client. Instead of the current hardcoded demo type selection, the replay configuration should be sent via the initialize packet's `_meta` field. The server then returns available sessions, modes, and models. The UI workflow becomes: select replay path → connect → select session → replay starts automatically (like live mode).

### Current Architecture
```
[Rust acp-harness-server] -> ws -> acp-chat-core -> acp-chat-react
```

**Current Flow:**
1. UI shows hardcoded demo type dropdown
2. Connect to bridge
3. Initialize
4. Create session with demoType + sessionId
5. Send empty prompt to start replay

### Target Architecture
Same architecture, but flow matches live mode:
```
[Rust acp-harness-server] -> ws -> acp-chat-core -> acp-chat-react
```

**Target Flow:**
1. UI shows path input for replay data directory
2. Connect button
3. Initialize (sends `replayDataPath` in `_meta`)
4. Server reads manifest.json, returns sessions/modes/models in capabilities
5. UI shows session/mode/model selectors
6. User selects and clicks "Load Session"
7. `session/new` triggers automatic replay streaming

---

## Work Objectives

### Core Objective
Transform the replay system from a hardcoded demo-type flow to a dynamic, configuration-driven flow that matches the live mode user experience while maintaining all existing replay functionality.

### Concrete Deliverables
1. **Rust replay mode** accepts `replayDataPath` via `_meta` in initialize
2. **Rust replay mode** reads manifest.json and returns sessions/modes/models
3. **Rust replay mode** implements proper `session/list` endpoint
4. **Rust replay mode** auto-starts replay on `session/new` (no prompt needed)
5. **UI ReplayPanel** refactored with connect-first flow
6. **UI** displays session/mode/model selectors from server capabilities
7. **UI** calls `session/new` to trigger replay (no manual prompt)

### Definition of Done
- [ ] User can enter replay data path and connect
- [ ] Server returns actual sessions from manifest.json
- [ ] User can select session/mode/model before loading
- [ ] Replay starts automatically when session is loaded
- [ ] All existing replay features work (speed control, permissions, etc.)
- [ ] Both old and new replay data formats still work

### Must Have
- Replay configuration via `_meta` in initialize
- Session/mode/model discovery from manifest.json
- Auto-replay on session load
- Backwards compatibility with existing replay data

### Must NOT Have (Guardrails)
- No changes to acp-chat-core ReplayController (except maybe session/list call)
- No changes to acp-chat-react components
- No changes to acp-ws-bridge
- No breaking changes to existing replay data format
- No new replay logic in TypeScript

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (Rust has tests, TS uses bun test)
- **Automated tests**: NO - Agent-executed QA only
- **Framework**: N/A
- **QA Method**: Manual verification via UI + Rust unit tests

### QA Policy
Every task MUST include agent-executed QA scenarios. Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Rust code**: Build verification with `cargo build` + unit test execution
- **UI/Frontend**: Use Playwright - Navigate, interact, assert DOM, screenshot
- **Integration**: End-to-end replay flow verification

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - Rust server modifications):
├── Task 1: Modify initialize handler to accept _meta config [medium]
├── Task 2: Add manifest.json parsing and storage [medium]
├── Task 3: Return sessions/modes/models in initialize response [quick]
└── Task 4: Implement proper session/list endpoint [quick]

Wave 2 (Core Logic - Rust replay flow):
├── Task 5: Modify session/new to auto-start replay [deep]
├── Task 6: Handle session/load for replay mode [medium]
└── Task 7: Update server mode dispatch if needed [quick]

Wave 3 (UI - React component refactor):
├── Task 8: Refactor ReplayPanel with connect-first flow [visual-engineering]
├── Task 9: Add session/mode/model selection UI [visual-engineering]
└── Task 10: Integrate with new replay flow [quick]

Wave 4 (Integration & Polish):
├── Task 11: Test end-to-end replay flow [unspecified-high]
├── Task 12: Verify backwards compatibility [unspecified-high]
└── Task 13: Update documentation [writing]

Wave FINAL (Review):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay
```

### Critical Path
Task 1 → Task 2 → Task 3 → Task 5 → Task 8 → Task 11 → F1-F4 → user okay

---

## TODOs

### Wave 1: Rust Server - Foundation

- [x] **1. Modify initialize handler to accept _meta config**

  **What to do**:
  - Modify `handle_json_rpc_request` in `crates/acp-harness-server/src/modes/replay.rs`
  - Extract `_meta.replay.replayDataPath` from initialize request params
  - Store the replay data path in replay state
  - Validate the path exists and contains manifest.json
  
  **File**: `crates/acp-harness-server/src/modes/replay.rs`
  **Lines**: Around line 709-734 (initialize handler)
  
  **Code changes**:
  ```rust
  // In handle_json_rpc_request, "initialize" match arm:
  "initialize" => {
      let request_id = request.id.unwrap_or(0);
      
      // Extract replay config from _meta
      let replay_data_path = request.params
          .get("_meta")
          .and_then(|m| m.get("replay"))
          .and_then(|r| r.get("replayDataPath"))
          .and_then(|p| p.as_str())
          .map(|s| s.to_string());
      
      // Store for later use
      if let Some(path) = replay_data_path {
          *active_replay_data_path = Some(path);
          tracing::info!("Replay data path set to: {}", path);
      }
      
      // Read manifest and return in capabilities...
  }
  ```
  
  **Must NOT do**:
  - Don't break existing initialize without _meta (backwards compatibility)
  - Don't add replay logic outside this handler
  
  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Reason**: Requires understanding of Rust JSON-RPC handling and state management
  
  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: None
  - **Blocks**: Task 2, Task 3, Task 4
  
  **References**:
  - Pattern: Existing initialize handler in `replay.rs:709-734`
  - ACP Protocol: `_meta` field usage per ACP schema
  
  **Acceptance Criteria**:
  - [ ] Initialize accepts `_meta.replay.replayDataPath` parameter
  - [ ] Path is stored for use in subsequent requests
  - [ ] Backwards compatible (works without _meta)
  
  **QA Scenarios**:
  ```
  Scenario: Initialize with replay config
    Tool: Bash (curl via WebSocket)
    Preconditions: Server running on ws://127.0.0.1:8765
    Steps:
      1. Send initialize with _meta.replay.replayDataPath="fixtures/replay-data/tool-calling-thinking"
      2. Verify response contains capabilities with sessions/modes/models
    Expected Result: Initialize succeeds with replay capabilities
    Evidence: .sisyphus/evidence/task-1-initialize-with-config.json
  
  Scenario: Initialize without replay config (backwards compatibility)
    Tool: Bash (curl via WebSocket)
    Preconditions: Server running
    Steps:
      1. Send initialize without _meta.replay
      2. Verify response still succeeds
    Expected Result: Initialize succeeds with default capabilities
    Evidence: .sisyphus/evidence/task-1-initialize-backwards-compat.json
  ```
  
  **Commit**: YES
  - Message: `feat(replay): accept replayDataPath in initialize _meta`
  - Files: `crates/acp-harness-server/src/modes/replay.rs`

- [x] **2. Add manifest.json parsing and storage** (structs added, inline loading in Task 1)

  **What to do**:
  - Add Manifest structure definition
  - Add function to read and parse manifest.json from replay data path
  - Store parsed manifest in replay state
  - Handle missing manifest gracefully
  
  **File**: `crates/acp-harness-server/src/modes/replay.rs`
  
  **Add to existing code**:
  ```rust
  /// Manifest structure for replay configuration
  #[derive(Debug, Deserialize, Clone)]
  pub struct ReplayManifest {
      pub demoType: String,
      pub sessions: Vec<ManifestSession>,
  }
  
  #[derive(Debug, Deserialize, Clone)]
  pub struct ManifestSession {
      pub sessionId: String,
      pub modes: Vec<String>,
      pub models: Vec<String>,
      pub description: Option<String>,
  }
  
  /// Load manifest from replay data directory
  fn load_manifest(base_dir: &PathBuf) -> Result<ReplayManifest, Box<dyn std::error::Error + Send + Sync>> {
      let manifest_path = base_dir.join("manifest.json");
      if !manifest_path.exists() {
          return Err("manifest.json not found".into());
      }
      let data = fs::read_to_string(&manifest_path)?;
      let manifest: ReplayManifest = serde_json::from_str(&data)?;
      Ok(manifest)
  }
  ```
  
  **Must NOT do**:
  - Don't fail if manifest is missing (use fallback to old behavior)
  - Don't parse manifest on every request (cache it)
  
  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Reason**: Rust struct definitions and error handling
  
  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Task 1
  - **Blocks**: Task 3, Task 4
  
  **References**:
  - Example manifest: `fixtures/replay-data/tool-calling-thinking/manifest.json`
  - Pattern: Existing `load_replay_events` function
  
  **Acceptance Criteria**:
  - [ ] Manifest structure matches existing manifest.json format
  - [ ] load_manifest function reads and parses correctly
  - [ ] Graceful error handling for missing/invalid manifest
  
  **QA Scenarios**:
  ```
  Scenario: Load valid manifest
    Tool: Rust unit test
    Preconditions: manifest.json exists in fixtures/replay-data/tool-calling-thinking
    Steps:
      1. Call load_manifest with valid path
      2. Verify sessions, modes, models are parsed
    Expected Result: Returns ReplayManifest with correct data
    Evidence: .sisyphus/evidence/task-2-load-manifest.txt
  
  Scenario: Handle missing manifest
    Tool: Rust unit test
    Preconditions: Directory without manifest.json
    Steps:
      1. Call load_manifest with invalid path
    Expected Result: Returns error gracefully
    Evidence: .sisyphus/evidence/task-2-missing-manifest.txt
  ```
  
  **Commit**: YES
  - Message: `feat(replay): add manifest.json parsing`
  - Files: `crates/acp-harness-server/src/modes/replay.rs`

- [x] **3. Return sessions/modes/models in initialize response**

  **What to do**:
  - Modify initialize response to include sessions/modes/models from manifest
  - Aggregate all unique modes and models across sessions
  - Include session list with IDs and descriptions
  
  **File**: `crates/acp-harness-server/src/modes/replay.rs`
  
  **Code changes in initialize handler**:
  ```rust
  "initialize" => {
      let request_id = request.id.unwrap_or(0);
      
      // Extract and store replay data path
      let replay_data_path = /* ... from Task 1 ... */;
      
      // Load manifest if path provided
      let mut sessions = Vec::new();
      let mut all_modes: HashSet<String> = HashSet::new();
      let mut all_models: HashSet<String> = HashSet::new();
      
      if let Some(ref path) = replay_data_path {
          if let Ok(manifest) = load_manifest(&PathBuf::from(path)) {
              for session in &manifest.sessions {
                  sessions.push(serde_json::json!({
                      "sessionId": session.sessionId,
                      "description": session.description,
                  }));
                  all_modes.extend(session.modes.clone());
                  all_models.extend(session.models.clone());
              }
          }
      }
      
      let response = json_rpc_response(request_id, serde_json::json!({
          "protocolVersion": 1,
          "capabilities": {
              "modes": true,
              "models": true,
              "replay": true,
              "sessions": sessions,
              "availableModes": all_modes.into_iter().collect::<Vec<_>>(),
              "availableModels": all_models.into_iter().collect::<Vec<_>>(),
          },
          "serverInfo": {
              "name": "acp-bridge-replay-v2",
              "version": PACKAGE_VERSION,
          }
      }));
      
      // ... rest of handler
  }
  ```
  
  **Must NOT do**:
  - Don't duplicate sessions if multiple sessions have same modes/models
  - Don't fail if manifest can't be loaded (return empty lists)
  
  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Reason**: Modification to existing initialize handler
  
  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Task 2
  - **Blocks**: Task 5, Task 8
  
  **Acceptance Criteria**:
  - [ ] Initialize response includes sessions list
  - [ ] Initialize response includes availableModes
  - [ ] Initialize response includes availableModels
  - [ ] Works without _meta (empty lists)
  
  **QA Scenarios**:
  ```
  Scenario: Initialize returns replay capabilities
    Tool: Bash (WebSocket client)
    Preconditions: Server running, manifest exists
    Steps:
      1. Send initialize with valid replayDataPath
      2. Parse response capabilities
    Expected Result: Capabilities include sessions, availableModes, availableModels
    Evidence: .sisyphus/evidence/task-3-capabilities-response.json
  ```
  
  **Commit**: YES
  - Message: `feat(replay): return sessions/modes/models in initialize`
  - Files: `crates/acp-harness-server/src/modes/replay.rs`

- [x] **4. Implement proper session/list endpoint**

  **What to do**:
  - Modify existing `session/list` handler in replay.rs
  - Return actual sessions from stored manifest instead of empty list
  - Support pagination if needed (cursor parameter)
  
  **File**: `crates/acp-harness-server/src/modes/replay.rs`
  
  **Current code (line 848-860)**:
  ```rust
  "session/list" => {
      let request_id = request.id.unwrap_or(0);
      
      let response = json_rpc_response(request_id, serde_json::json!({
          "sessions": [],  // <-- Currently empty!
          "nextCursor": null
      }));
      // ...
  }
  ```
  
  **Modified code**:
  ```rust
  "session/list" => {
      let request_id = request.id.unwrap_or(0);
      
      // Get sessions from stored manifest
      let sessions: Vec<serde_json::Value> = if let Some(ref path) = active_replay_data_path {
          if let Ok(manifest) = load_manifest(&PathBuf::from(path)) {
              manifest.sessions.into_iter().map(|s| {
                  serde_json::json!({
                      "sessionId": s.sessionId,
                      "cwd": path,  // Or extract from session data
                      "title": s.description,
                  })
              }).collect()
          } else {
              Vec::new()
          }
      } else {
          Vec::new()
      };
      
      let response = json_rpc_response(request_id, serde_json::json!({
          "sessions": sessions,
          "nextCursor": null
      }));
      // ...
  }
  ```
  
  **Must NOT do**:
  - Don't break existing empty list behavior when no manifest
  - Don't load manifest on every call (use cached data from Task 2)
  
  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Reason**: Modification to existing endpoint
  
  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Task 2, Task 3
  - **Blocks**: Task 8
  
  **Acceptance Criteria**:
  - [ ] session/list returns actual sessions from manifest
  - [ ] Returns empty list if no manifest (backwards compatible)
  - [ ] Uses stored manifest data (doesn't reload file)
  
  **QA Scenarios**:
  ```
  Scenario: List sessions from manifest
    Tool: Bash (WebSocket client)
    Preconditions: Server initialized with replayDataPath
    Steps:
      1. Send session/list request
      2. Verify response contains sessions from manifest
    Expected Result: Returns array of sessions with sessionId, cwd, title
    Evidence: .sisyphus/evidence/task-4-session-list.json
  ```
  
  **Commit**: YES
  - Message: `feat(replay): implement session/list with manifest data`
  - Files: `crates/acp-harness-server/src/modes/replay.rs`

### Wave 2: Rust Server - Core Logic

- [ ] **5. Modify session/new to auto-start replay**

  **What to do**:
  - Modify `session/new` handler to start replay streaming immediately after session creation
  - Use the selected session's data from manifest
  - Call existing `stream_events` function to start replay
  - Remove dependency on `session/prompt` to trigger replay
  
  **File**: `crates/acp-harness-server/src/modes/replay.rs`
  
  **Current flow**: session/new → session/prompt → stream_events
  **New flow**: session/new → stream_events (auto-start)
  
  **Code changes in session/new handler**:
  ```rust
  "session/new" => {
      let request_id = request.id.unwrap_or(0);
      
      // Extract sessionId from params
      let session_id = request.params.get("sessionId")
          .and_then(|v| v.as_str())
          .map(|s| s.to_string())
          .or_else(|| active_session_id.clone());
      
      if let Some(ref sid) = session_id {
          // Validate session exists in manifest
          let session_valid = if let Some(ref path) = active_replay_data_path {
              if let Ok(manifest) = load_manifest(&PathBuf::from(path)) {
                  manifest.sessions.iter().any(|s| s.sessionId == *sid)
              } else { false }
          } else { false };
          
          if !session_valid {
              // Return error or fallback to old behavior
              // ...
          }
          
          *active_session_id = Some(sid.clone());
          
          // Send session/new response first
          let response = json_rpc_response(request_id, serde_json::json!({
              "sessionId": sid,
              "cwd": active_replay_data_path.as_ref().map(|p| p.as_str()).unwrap_or("/"),
          }));
          // Send response envelope...
          
          // AUTO-START: Begin replay streaming immediately
          // This is the key change - no need to wait for session/prompt
          if let Some(ref path) = active_replay_data_path {
              let base_dir = PathBuf::from(path).join(/* session subdir */);
              if let Ok(events) = load_replay_events(&base_dir) {
                  // Start streaming in background task
                  let tps_clone = tps.clone();
                  tokio::spawn(async move {
                      // Create new ws_tx for streaming or use existing...
                      // Call stream_events logic here
                  });
              }
          }
      }
  }
  ```
  
  **Must NOT do**:
  - Don't remove session/prompt handler (keep for backwards compatibility)
  - Don't block the session/new response waiting for replay to complete
  
  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Reason**: Complex async flow modification, needs careful state management
  
  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Task 4
  - **Blocks**: Task 11
  
  **References**:
  - Pattern: Existing `stream_events` function
  - Current: session/new at line 736-810
  
  **Acceptance Criteria**:
  - [ ] session/new triggers automatic replay streaming
  - [ ] Response sent before streaming starts (non-blocking)
  - [ ] Works with session from manifest
  - [ ] Backwards compatible with old demoType/sessionId params
  
  **QA Scenarios**:
  ```
  Scenario: Auto-replay on session/new
    Tool: Bash (WebSocket client)
    Preconditions: Server initialized, session exists
    Steps:
      1. Send session/new with valid sessionId
      2. Verify session/new response received
      3. Verify replay events start streaming immediately
    Expected Result: Replay starts automatically without prompt
    Evidence: .sisyphus/evidence/task-5-auto-replay.jsonl
  ```
  
  **Commit**: YES
  - Message: `feat(replay): auto-start replay on session/new`
  - Files: `crates/acp-harness-server/src/modes/replay.rs`

- [ ] **6. Handle session/load for replay mode**

  **What to do**:
  - Add `session/load` handler if not present
  - Make it work like session/new (auto-start replay)
  - Or delegate session/load to session/new logic
  
  **File**: `crates/acp-harness-server/src/modes/replay.rs`
  
  **Add to handle_json_rpc_request match**:
  ```rust
  "session/load" => {
      // Similar to session/new but for loading existing session
      // Could delegate to same logic or handle slightly differently
      // For replay, session/load and session/new should behave similarly
      // since we're replaying recorded sessions
  }
  ```
  
  **Must NOT do**:
  - Don't create duplicate code (reuse session/new logic if possible)
  
  **Recommended Agent Profile**:
  - **Category**: `medium`
  - **Reason**: Adding new endpoint handler
  
  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Task 5
  - **Blocks**: None
  
  **Acceptance Criteria**:
  - [ ] session/load endpoint exists
  - [ ] Triggers replay like session/new
  
  **Commit**: YES
  - Message: `feat(replay): add session/load handler`
  - Files: `crates/acp-harness-server/src/modes/replay.rs`

- [ ] **7. Update server mode dispatch if needed**

  **What to do**:
  - Check `server/mod.rs` for any changes needed
  - Ensure replay mode is properly wired
  - Update any config structures if needed
  
  **File**: `crates/acp-harness-server/src/server/mod.rs`
  
  **Check if changes needed**:
  - Current server uses `run_replay_mode` which we've been modifying
  - Should work without changes, but verify
  
  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Reason**: Verification and minor wiring
  
  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Task 6
  - **Blocks**: None
  
  **Acceptance Criteria**:
  - [ ] Server mode dispatch works correctly
  - [ ] Replay mode starts properly
  
  **Commit**: NO (part of Task 6 if needed)

### Wave 3: UI - React Component Refactor

- [ ] **8. Refactor ReplayPanel with connect-first flow**

  **What to do**:
  - Transform ReplayPanel from demo-type-selection-first to connect-first
  - Add replay data path input (like LivePanel's command input)
  - Move session selection to after connect
  - Use initialize response to populate selectors
  
  **File**: `packages/acp-harness-ui/src/components/ReplayPanel.tsx`
  
  **UI Changes**:
  ```typescript
  // State changes
  const [replayDataPath, setReplayDataPath] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [availableSessions, setAvailableSessions] = useState([]);
  const [availableModes, setAvailableModes] = useState([]);
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedMode, setSelectedMode] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  
  // New connect flow
  const handleConnect = async () => {
      // 1. Connect WebSocket
      // 2. Send initialize with _meta.replay.replayDataPath
      // 3. Store capabilities (sessions, modes, models)
      // 4. Set isInitialized = true
  };
  
  // New load session flow
  const handleLoadSession = async () => {
      // 1. Call session/new with selectedSession
      // 2. Replay starts automatically (no sendPrompt needed)
  };
  ```
  
  **Must NOT do**:
  - Don't remove ReplayController usage (keep it)
  - Don't break existing event handlers
  
  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: React, TypeScript
  - **Reason**: UI component refactor with state management
  
  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Task 3 (needs initialize response structure)
  - **Blocks**: Task 10, Task 11
  
  **References**:
  - Pattern: LivePanel.tsx connect flow
  - Existing: ReplayPanel.tsx current implementation
  
  **Acceptance Criteria**:
  - [ ] Path input field for replay data directory
  - [ ] Connect button (like LivePanel)
  - [ ] Initialize sends _meta with replayDataPath
  - [ ] Sessions/modes/models stored from response
  
  **QA Scenarios**:
  ```
  Scenario: Connect with replay config
    Tool: Playwright
    Preconditions: Server running on ws://127.0.0.1:8765
    Steps:
      1. Navigate to replay panel
      2. Enter replay data path
      3. Click Connect
      4. Verify initialize sent with _meta
      5. Verify sessions/modes/models populated
    Expected Result: UI shows selectors with server data
    Evidence: .sisyphus/evidence/task-8-connect-flow.png
  ```
  
  **Commit**: YES
  - Message: `feat(ui): refactor ReplayPanel with connect-first flow`
  - Files: `packages/acp-harness-ui/src/components/ReplayPanel.tsx`

- [ ] **9. Add session/mode/model selection UI**

  **What to do**:
  - Add dropdown/select components for sessions, modes, models
  - Use SettingsSelect from @harms-haus/acp-chat-react (like existing code)
  - Show these only after successful initialize
  - Disable until connected and initialized
  
  **File**: `packages/acp-harness-ui/src/components/ReplayPanel.tsx`
  
  **UI Addition**:
  ```tsx
  {/* Session Selector */}
  {isInitialized && availableSessions.length > 0 && (
    <div style={{ flex: "1 1 0", minWidth: 0 }}>
      <label style={{ color: "var(--harness-muted)", fontSize: "11px" }}>
        Session
      </label>
      <SettingsSelect
        value={availableSessions.find(s => s.sessionId === selectedSession) ?? null}
        options={availableSessions.map(s => ({ id: s.sessionId, name: s.description || s.sessionId }))}
        onChange={(session) => setSelectedSession(session.id)}
        placeholder="Select session..."
        disabled={!isInitialized || isReplaying}
      />
    </div>
  )}
  
  {/* Mode Selector */}
  {isInitialized && availableModes.length > 0 && (
    <div style={{ flex: "1 1 0", minWidth: 0 }}>
      <label style={{ color: "var(--harness-muted)", fontSize: "11px" }}>
        Mode
      </label>
      <SettingsSelect
        value={availableModes.find(m => m === selectedMode) ?? null}
        options={availableModes.map(m => ({ id: m, name: m }))}
        onChange={(mode) => setSelectedMode(mode.id)}
        placeholder="Select mode..."
        disabled={!isInitialized || isReplaying}
      />
    </div>
  )}
  
  {/* Model Selector */}
  {isInitialized && availableModels.length > 0 && (
    <div style={{ flex: "1 1 0", minWidth: 0 }}>
      <label style={{ color: "var(--harness-muted)", fontSize: "11px" }}>
        Model
      </label>
      <SettingsSelect
        value={availableModels.find(m => m === selectedModel) ?? null}
        options={availableModels.map(m => ({ id: m, name: m }))}
        onChange={(model) => setSelectedModel(model.id)}
        placeholder="Select model..."
        disabled={!isInitialized || isReplaying}
      />
    </div>
  )}
  
  {/* Load Session Button */}
  <Button
    onClick={handleLoadSession}
    disabled={!selectedSession || isReplaying}
    style={{ /* styles */ }}
  >
    Load Session
  </Button>
  ```
  
  **Must NOT do**:
  - Don't show selectors before initialize completes
  - Don't allow selection while replay is active
  
  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Reason**: UI layout and component integration
  
  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Task 8
  - **Blocks**: Task 10
  
  **Acceptance Criteria**:
  - [ ] Session dropdown populated from initialize response
  - [ ] Mode dropdown populated from initialize response
  - [ ] Model dropdown populated from initialize response
  - [ ] Selectors disabled until initialized
  - [ ] Load Session button disabled until session selected
  
  **QA Scenarios**:
  ```
  Scenario: Select session and load
    Tool: Playwright
    Preconditions: Connected and initialized
    Steps:
      1. Select session from dropdown
      2. Select mode
      3. Select model
      4. Click Load Session
      5. Verify session/new called
      6. Verify replay starts
    Expected Result: Replay begins automatically
    Evidence: .sisyphus/evidence/task-9-load-session.png
  ```
  
  **Commit**: YES (can combine with Task 8)
  - Message: `feat(ui): add session/mode/model selectors to ReplayPanel`
  - Files: `packages/acp-harness-ui/src/components/ReplayPanel.tsx`

- [ ] **10. Integrate with new replay flow**

  **What to do**:
  - Update handleLoadSession to call session/new (not sendPrompt)
  - Remove sendPrompt call since replay auto-starts
  - Ensure existing event handlers still work
  - Keep speed slider functionality
  
  **File**: `packages/acp-harness-ui/src/components/ReplayPanel.tsx`
  
  **Code changes**:
  ```typescript
  const handleLoadSession = async () => {
      if (!selectedSession || !controller) return;
      
      setIsReplaying(true);
      
      try {
          // Call session/new - this triggers auto-replay in new flow
          await controller.createSession(
              replayDataPath,
              [],
              undefined,  // no demoType in new flow
              selectedSession
          );
          
          // NO sendPrompt needed - replay auto-starts!
          
      } catch (err) {
          console.error("Failed to load session:", err);
          setIsReplaying(false);
      }
  };
  ```
  
  **Must NOT do**:
  - Don't call sendPrompt (not needed in new flow)
  - Don't break permission handling
  
  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Reason**: Integration of existing pieces
  
  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Task 9
  - **Blocks**: Task 11
  
  **Acceptance Criteria**:
  - [ ] session/new triggers replay automatically
  - [ ] No sendPrompt call needed
  - [ ] Speed control still works
  
  **QA Scenarios**:
  ```
  Scenario: Complete replay flow
    Tool: Playwright
    Preconditions: Full setup
    Steps:
      1. Enter path
      2. Connect
      3. Select session/mode/model
      4. Load Session
      5. Verify replay streams
      6. Verify can change speed
    Expected Result: Full flow works end-to-end
    Evidence: .sisyphus/evidence/task-10-full-flow.gif
  ```
  
  **Commit**: YES
  - Message: `feat(ui): integrate ReplayPanel with auto-replay flow`
  - Files: `packages/acp-harness-ui/src/components/ReplayPanel.tsx`

### Wave 4: Integration & Documentation

- [ ] **11. Test end-to-end replay flow**

  **What to do**:
  - Test complete flow: path → connect → initialize → select → load → replay
  - Verify backwards compatibility with old replay data
  - Test with multiple different replay datasets
  - Verify all existing features work (permissions, speed, etc.)
  
  **Must NOT do**:
  - Don't skip testing with existing fixtures
  
  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Reason**: Integration testing and verification
  
  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Task 10
  - **Blocks**: Task 12
  
  **Acceptance Criteria**:
  - [ ] Complete flow works end-to-end
  - [ ] All existing replay features work
  - [ ] Speed control works
  - [ ] Permission requests work
  - [ ] Error handling works
  
  **QA Scenarios**:
  ```
  Scenario: Full integration test
    Tool: Manual + Playwright
    Preconditions: All components deployed
    Steps:
      1. Test each demo type from fixtures/replay-data
      2. Verify all sessions load correctly
      3. Verify all features work
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-11-integration-test-report.md
  ```
  
  **Commit**: NO (testing only)

- [ ] **12. Verify backwards compatibility**

  **What to do**:
  - Test with old-style replay data (no manifest.json)
  - Test with new-style replay data (with manifest.json)
  - Verify initialize works without _meta
  - Verify old demoType/sessionId params still work
  
  **Must NOT do**:
  - Don't break existing replay data
  
  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Reason**: Regression testing
  
  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Task 11
  - **Blocks**: Task 13
  
  **Acceptance Criteria**:
  - [ ] Old replay data without manifest.json still works
  - [ ] Initialize without _meta still works
  - [ ] Fallback to hardcoded demo types works
  
  **QA Scenarios**:
  ```
  Scenario: Backwards compatibility
    Tool: Manual testing
    Preconditions: Old replay data available
    Steps:
      1. Test with old replay directory structure
      2. Verify fallback behavior works
    Expected Result: Old data still playable
    Evidence: .sisyphus/evidence/task-12-backwards-compat.md
  ```
  
  **Commit**: NO (testing only)

- [ ] **13. Update documentation**

  **What to do**:
  - Update wiki documentation if needed
  - Update README files
  - Document new manifest.json format
  - Document new replay flow
  
  **Files**:
  - `docs/wiki/acp-chat-core-Implementation-Guide.md` (if replay docs exist)
  - `crates/acp-harness-server/README.md`
  - `packages/acp-harness-ui/README.md`
  
  **Must NOT do**:
  - Don't update protocol documentation (ACP protocol unchanged)
  
  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Reason**: Documentation updates
  
  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 12)
  - **Blocked By**: Task 11
  - **Blocks**: None
  
  **Acceptance Criteria**:
  - [ ] New manifest.json format documented
  - [ ] New replay flow documented
  - [ ] UI changes documented
  
  **Commit**: YES
  - Message: `docs: update replay system documentation`
  - Files: Documentation files

---

## Final Verification Wave

- [ ] **F1. Plan Compliance Audit** - `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] **F2. Code Quality Review** - `unspecified-high`
  Run `cargo build` + `cargo test` + `tsc --noEmit` + linter. Review all changed files for: error handling, edge cases, unused code. Check AI slop: excessive comments, over-abstraction.
  Output: `Build [PASS/FAIL] | Tests [PASS/FAIL] | Lint [PASS/FAIL] | VERDICT`

- [ ] **F3. Real Manual QA** - `unspecified-high` (+ `playwright` skill)
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (features working together). Test edge cases: empty manifest, missing sessions, invalid paths.
  Output: `Scenarios [N/N pass] | Integration [PASS/FAIL] | Edge Cases [N tested] | VERDICT`

- [ ] **F4. Scope Fidelity Check** - `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | VERDICT`

---

## Commit Strategy

- **Task 1**: `feat(replay): accept replayDataPath in initialize _meta`
- **Task 2**: `feat(replay): add manifest.json parsing`
- **Task 3**: `feat(replay): return sessions/modes/models in initialize`
- **Task 4**: `feat(replay): implement session/list with manifest data`
- **Task 5**: `feat(replay): auto-start replay on session/new`
- **Task 6**: `feat(replay): add session/load handler`
- **Task 8**: `feat(ui): refactor ReplayPanel with connect-first flow`
- **Task 9**: `feat(ui): add session/mode/model selectors to ReplayPanel`
- **Task 10**: `feat(ui): integrate ReplayPanel with auto-replay flow`
- **Task 13**: `docs: update replay system documentation`

---

## Success Criteria

### Verification Commands
```bash
# Build Rust
cd crates/acp-harness-server && cargo build --release

# Run Rust tests
cd crates/acp-harness-server && cargo test

# Build TypeScript
cd packages/acp-harness-ui && bun run build

# Type check
cd packages/acp-harness-ui && tsc --noEmit
```

### Final Checklist
- [ ] User can enter replay data path and connect
- [ ] Server returns actual sessions from manifest.json
- [ ] User can select session/mode/model before loading
- [ ] Replay starts automatically when session is loaded
- [ ] All existing replay features work (speed control, permissions)
- [ ] Backwards compatibility with existing replay data
- [ ] No changes to acp-chat-core (except maybe session/list)
- [ ] No changes to acp-chat-react
- [ ] No changes to acp-ws-bridge
- [ ] Rust code builds without errors
- [ ] UI builds without errors
