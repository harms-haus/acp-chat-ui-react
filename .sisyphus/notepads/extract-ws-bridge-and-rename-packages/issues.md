
# Wave 9 Final Verification - Issues Encountered

## Integration Test Timeout
**Issue**: Integration test (long-context-replay) times out after 30 seconds
**Status**: ⚠️ OPEN
**Details**:
- Server successfully compiles and starts
- Server logs show: "Harness server listening on 127.0.0.1:29876"
- Server loads correct demo_type (long-context) and session_id (session-1)
- Test expects "Bridge listening on" pattern, updated to "(Bridge|Harness server) listening on"
- Test still times out waiting for ready message
- Fixture data exists at fixtures/replay-data/long-context/session-1/
- Possible causes:
  1. Test timeout value (30s) may be insufficient for fixture loading
  2. WebSocket connection handshake timing issue
  3. Fixture data loading may take longer than expected
**Impact**: Integration test cannot verify end-to-end replay functionality
**Recommendation**: Investigate fixture data loading time and test synchronization

## TypeScript Test Failures
**Issue**: 25 of 362 TypeScript tests failing (93% pass rate)
**Status**: ⚠️ OPEN
**Categories**:
1. **Canvas API not implemented** (8 failures):
   - Tests attempting to use HTMLCanvasElement.getContext() in test environment
   - Expected limitation in headless test environment
   - Not a code issue

2. **Font measurement null pointer** (6 failures):
   - \`Cannot set properties of null (setting 'font')\`
   - Related to canvas/font measurement in test environment
   - Expected limitation in headless environment

3. **Test selector failures** (4 failures):
   - \`Unable to find an element with text: Load\`
   - Tests looking for specific UI elements that may not render in test environment
   - May need different selectors or test environment fixes

4. **React act() warnings** (multiple):
   - \`An update to X inside a test was not wrapped in act(...)\`
   - Test quality warnings, not functional failures
   - Tests still pass despite warnings

5. **Other test logic failures** (7 failures):
   - Various assertion failures in specific test scenarios
   - May require investigation of test logic vs actual component behavior

**Impact**: Test coverage and confidence in code quality
**Recommendation**: 
1. Fix test environment to support canvas API
2. Update test selectors to use data attributes instead of text
3. Wrap state updates in act() where needed
4. Investigate failing test logic

## Rust Unused Import Warning
**Issue**: Warning about unused imports \`BridgeMessage\` and \`BridgeStatus\`
**Status**: ℹ️ LOW PRIORITY
**Location**: crates/acp-harness-server/src/script/writer.rs:9
**Details**:
- Imports \`BridgeMessage\` and \`BridgeStatus\` from \`harms_haus_acp_ws_bridge\`
- These types are imported but not used in the module
- Cargo suggests: \`cargo fix --lib -p harms_haus_acp_harness_server\`
**Impact**: Minor code cleanliness issue, doesn't affect functionality
**Recommendation**: Remove unused imports or use \`cargo fix\` to auto-fix

## LSP Errors in Old Directory
**Issue**: LSP showing errors in old \`crates/acp-bridge/\` directory
**Status**: ℹ️ IGNORED
**Explanation**:
- Old \`crates/acp-bridge/\` directory no longer exists
- Active code is in \`crates/acp-harness-server/\` and \`crates/acp-ws-bridge/\`
- LSP is showing stale errors from deleted/moved code
- Active crates compile and test successfully
**Impact**: None - old directory errors can be ignored

