# Replay System Refactor - Draft

## Current Architecture
```
[Rust acp-harness-server] -> ws -> acp-chat-core -> acp-chat-react
```

**Current Flow:**
1. Select demo type from hardcoded list
2. Connect to bridge
3. Initialize
4. Create session with demoType + sessionId
5. Send prompt to start replay

## Refactored Architecture (Target)
Same architecture, but flow matches live mode:
```
[Rust acp-harness-server] -> ws -> acp-chat-core -> acp-chat-react
```

**Target Flow:**
1. Enter replay data path (or select config)
2. Connect button
3. Initialize (sends replay config in `_meta`)
4. Server responds with available sessions, modes, models
5. Select session from list
6. Call `session/new` or `session/load`
7. Replay starts automatically (no prompt needed)

## Clarified Requirements

### Rust Server Changes (`acp-harness-server`)
1. **Modify `initialize` handler** (`replay.rs`):
   - Accept `replayDataPath` in `_meta` field
   - Read `manifest.json` from that path
   - Store sessions, modes, models from manifest
   - Return them in `initialize` response capabilities

2. **Implement proper `session/list`**:
   - Return actual sessions from manifest (currently returns empty)

3. **Modify `session/new`**:
   - When called with valid sessionId from manifest
   - Load session data AND immediately start replay streaming
   - No need for separate `session/prompt` call

### UI Changes (`acp-harness-ui`)
1. **Modify `ReplayPanel.tsx`**:
   - Replace demo type dropdown with path input for replay data directory
   - Connect button (like LivePanel)
   - After initialize, show:
     - Session selection dropdown (from server response)
     - Mode selection (from capabilities)
     - Model selection (from capabilities)
   - "Load Session" button → calls `session/new` → replay starts automatically

### Key Files
- `crates/acp-harness-server/src/modes/replay.rs` - Rust replay logic
- `packages/acp-harness-ui/src/components/ReplayPanel.tsx` - UI component
- `packages/acp-chat-core/src/session/replay-controller.ts` - Core controller (minor changes if any)

### Manifest.json Structure (already exists)
```json
{
  "demoType": "tool-calling-thinking",
  "sessions": [
    {
      "sessionId": "code-review-session-001",
      "modes": ["code-review", "debug", "explain"],
      "models": ["claude-sonnet-4", "gpt-4o"],
      "description": "..."
    }
  ]
}
```

### Scope
- ONLY modify replay code in harness core server + harness UI code
- Keep all existing replay logic in Rust
- No changes to acp-chat-core or acp-chat-react needed
- No changes to acp-ws-bridge needed
- Use standard ACP payloads throughout
