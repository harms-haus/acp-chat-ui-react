
## Bridge Helper Patterns (Task 2)

### Key Implementation Details

1. **CWD Must Be Repo Root**: Bridge resolves fixture paths relative to working directory
   - Resolved via `resolve(__dirname, '../../../..')` from helpers/bridge.ts
   - Passed to spawn as `cwd: REPO_ROOT`

2. **Ready Detection**: Wait for stdout pattern "Bridge listening on 127.0.0.1:${port}"
   - Uses regex pattern matching on stdout data
   - 30 second timeout to prevent hanging tests
   - Cleans up listeners after ready or failure

3. **Process Cleanup**: SIGKILL required (no graceful shutdown)
   - `process.kill('SIGKILL')` for immediate termination
   - Waits for 'exit' event before resolving killBridge()

4. **Port Availability Check**: WebSocket connection attempt
   - 2 second timeout per port
   - Sequential probing: startPort, startPort+1, startPort+2...
   - Max 10 attempts before throwing

5. **Error Handling**: All functions reject promises on failure
   - Spawn failures include captured stdout/stderr output
   - Timeout errors show buffer for debugging

## long-context-replay.test.ts creation (Task 4)

- ReplayController must be dynamically imported AFTER `setupWebSocketPolyfill()` — static `import type` is safe (erased at compile) but value imports must be deferred
- Bridge spawns on `127.0.0.1:{port}` via `cargo run --manifest-path crates/acp-bridge/Cargo.toml -- replay-v2 --addr`
- `findAvailablePort(19876)` checks ports 19876-19885 — uses `isBridgeReady()` which attempts WS connection (port is "available" if connection fails)
- Event flow from JSONL: replay_metadata → bridge_status(starting) → bridge_status(connected) → acp_payload[*] → bridge_status(disconnected)
- Bridge auto-split may produce more events than JSONL line count, so never assert exact event counts
- The `traffic` handler captures ALL envelopes (both directions), while `sessionUpdate` only captures processed payload updates
- `controller.initReplay("long-context", "session-1")` tells bridge which fixture to load from `fixtures/replay-data/long-context/session-1/`
- Vitest config already has `testTimeout: 120000` globally, plus `singleFork: true` to prevent port conflicts
- `tsc --noEmit` passes clean for integration-tests package
