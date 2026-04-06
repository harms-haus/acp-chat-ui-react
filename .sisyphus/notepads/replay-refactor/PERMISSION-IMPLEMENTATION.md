# Interactive Permission Handling Implementation

## Summary

Implemented interactive permission handling during replay mode. The system now pauses when encountering `permission_request` events with `status: "pending"` and waits for user response before continuing.

## Changes Made

### Server-Side (Rust)

#### 1. `crates/acp-bridge/src/modes/replay_v2.rs`
- Added `PermissionResponse` struct to handle client responses
- Modified `stream_events()` function to:
  - Detect `permission_request` events with `status: "pending"`
  - Pause streaming and send the permission request to client
  - Wait for permission response via mpsc channel
  - On "approve": skip the pending event and continue replay
  - On "deny": halt replay entirely
- Updated `stream_replay_after_init()` to accept permission response channel
- Updated JSON-RPC handler to create dummy channel for backward compatibility

#### 2. `crates/acp-bridge/src/server/mod.rs`
- Added `PermissionResponseMessage` struct for deserializing client messages
- Modified `run_client_session()` to create permission response channel for replay sessions
- Updated `wait_for_messages()` to:
  - Detect `permission_response` messages from client
  - Forward responses to replay stream via channel
- Imported `PermissionResponse` from replay_v2 module

#### 3. `crates/acp-bridge/src/modes/mod.rs`
- Exported `PermissionResponse` struct for use in server module

### Client-Side (TypeScript)

#### 1. `packages/acp-chat-core/src/session/replay-controller.ts`
- Imported `PermissionOption` type from controller
- Enhanced `handleAcpPayload()` to detect permission requests from replay stream:
  - Checks for `sessionUpdate: "permission_request"` with `status: "pending"`
  - Emits `permissionRequest` event with proper structure
- Updated `respondToPermission()` to send wire format:
  ```json
  {
    "type": "permission_response",
    "requestId": 1,
    "action": "approve",
    "optionId": "opt_allow_once"
  }
  ```
- Updated `cancelPermission()` to send deny action

#### 2. `apps/harness/src/components/ReplayPanel.tsx`
- Added `PermissionRequest` interface for local state
- Added `pendingPermission` state to track active permission requests
- Wired `permissionRequest` event handler to update state
- Added `handlePermissionResponse()` callback to send user selection
- Implemented permission dialog UI with:
  - Display of tool call ID
  - Buttons for each permission option
  - Visual distinction between approve (green) and deny (red) options
  - Data attribute `data-acp-permission-dialog` for testing

## Protocol Flow

### Permission Approve Flow
1. Replay streams events 1-6 normally
2. Event 7 (`permission_request` with `status: "pending"`) arrives at server
3. Server detects pending permission and:
   - Sends event to client
   - Pauses streaming
   - Waits on permission response channel
4. Client receives permission request and:
   - Emits `permissionRequest` event
   - Shows permission dialog UI
5. User clicks "Allow once" (or any approve option)
6. Client sends `permission_response` message:
   ```json
   {
     "type": "permission_response",
     "requestId": 1,
     "action": "approve",
     "optionId": "opt_allow_once"
   }
   ```
7. Server receives response and:
   - Forwards to replay stream
   - Skips the pending permission event (Event 7)
   - Continues with Event 8+
8. Replay completes normally

### Permission Deny Flow
1. Steps 1-5 same as approve flow
2. User clicks "Deny" (or any deny option)
3. Client sends `permission_response` with `action: "deny"`
4. Server receives response and:
   - Logs permission denied
   - Returns from `stream_events()`, halting replay
5. Session remains open but no more events are streamed

## Testing

### Manual Test Steps
1. Build the project: `pnpm run build`
2. Start the bridge: `cargo run --package acp-bridge`
3. Open harness app: `pnpm --filter @acp/harness dev`
4. In ReplayPanel:
   - Select "Permission Request" demo type
   - Click "Start Replay"
5. When permission dialog appears:
   - **Test Approve**: Click any green option → replay should continue
   - **Test Deny**: Click any red option → replay should stop

### QA Scenarios

**Scenario 1: Permission Approve**
- ✅ Replay pauses on permission_request
- ✅ User sees dialog with options
- ✅ Approving continues replay
- ✅ Events after permission are streamed

**Scenario 2: Permission Deny**
- ✅ Replay pauses on permission_request
- ✅ User sees dialog with options
- ✅ Denying stops replay
- ✅ No more events after denial

## Files Modified

### Rust
- `crates/acp-bridge/src/modes/replay_v2.rs`
- `crates/acp-bridge/src/server/mod.rs`
- `crates/acp-bridge/src/modes/mod.rs`

### TypeScript
- `packages/acp-chat-core/src/session/replay-controller.ts`
- `apps/harness/src/components/ReplayPanel.tsx`

## Notes

- The implementation mirrors the real ACP agent permission flow
- Permission events from replay data are detected by `sessionUpdate: "permission_request"` and `status: "pending"`
- The pending permission event from the replay data is skipped (not shown to user) since the actual approval happens interactively
- The server uses an mpsc channel to communicate permission responses from the message loop to the streaming task
- LSP errors in Rust files are false positives from tracing macros and do not affect compilation
