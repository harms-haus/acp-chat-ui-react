# Task 22 Evidence: Integration Testing Patterns Documentation

**Date:** April 11, 2026  
**Status:** ✅ Complete  
**Deliverable:** `packages/acp-chat-core/docs/integration-testing-patterns.md`

---

## What Was Created

### Documentation File

**Location:** `/home/blake/Documents/software/acp-react-chat-ui/packages/acp-chat-core/docs/integration-testing-patterns.md`

**Content:** Comprehensive guide to replay-based integration testing covering:

1. **Overview** - Replay-based testing approach explanation
2. **Replay Fixture Format** - JSONL structure, directory layout, metadata
3. **Test Infrastructure** - FixtureLoader, ReplayRunner, ReplayAssertions APIs
4. **Writing Integration Tests** - Test structure, mock patterns, examples
5. **Test Data Setup** - Fixture locations, creation methods, listing
6. **Examples from Wave 3** - Real code from all 5 integration test files
7. **Best Practices** - 10 actionable guidelines

---

## Source Materials Used

### Integration Tests Analyzed (Wave 3)

1. **session-lifecycle.test.ts** (286 lines)
   - Basic fixture loading
   - ReplayRunner setup
   - Connection lifecycle testing

2. **acp-protocol.test.ts** (834 lines)
   - JSON-RPC format validation
   - ACP method testing
   - Error code coverage
   - Capability negotiation

3. **error-handling.test.ts** (766 lines)
   - Network error scenarios
   - Parse error handling
   - Timeout errors
   - Recovery mechanisms
   - Permission denied scenarios

4. **connection-lifecycle.test.ts** (943 lines)
   - Connection establishment
   - Reconnection with backoff
   - State transitions
   - Graceful degradation

5. **capture-replay-flow.test.ts** (756 lines)
   - Session capture functionality
   - Export functionality
   - Interceptor integration
   - Various session types

### Test Utilities Documented

1. **fixture-loader.ts** (384 lines)
   - `loadFixture()` - Load fixtures by path
   - `listFixtures()` - Enumerate available fixtures
   - `loadFixtureManifest()` - Load metadata only
   - JSONL parsing logic

2. **replay-runner.ts** (423 lines)
   - `ReplayRunner` class - Execute replay fixtures
   - `ReplayOutcome` - Result structure
   - `autoRespondToPermissions()` - Auto-approve/deny
   - Statistics collection

3. **replay-assertions.ts** (436 lines)
   - `assertReplaySuccess()` / `assertReplayFailed()`
   - `assertHasSessionUpdates()` / `assertNoSessionUpdates()`
   - `assertPermissionRequestsHandled()`
   - `assertReplayStatistics()`
   - `assertSessionUpdateSequence()`
   - `summarizeReplay()` - Human-readable summary

4. **factories.ts** (386 lines)
   - `createACPPayload()` - JSON-RPC requests
   - `createBridgeEnvelope()` - Bridge envelopes
   - `createSessionUpdateEnvelope()` - Session updates
   - Error/response factories

---

## Key Patterns Documented

### 1. Replay Fixture Format

```
fixtures/replay-data/
├── captured/{timestamp}/
│   ├── replay-events.jsonl
│   └── session-data.json
└── {demoType}/session-{n}/
    ├── replay-events.jsonl
    ├── manifest.json
    └── {sessionId}/session-data.json
```

### 2. Test Structure Template

```typescript
// Mock TransportClient
vi.mock('../../transport/client.js', () => { /* ... */ });

describe('Integration test suite', () => {
  let controller: ReplayController;

  beforeEach(() => {
    controller = new ReplayController({ bridgeUrl: 'ws://localhost:8080/replay-v2' });
  });

  it('loads replay fixture successfully', () => {
    const fixture = loadFixture('captured/1775883989494');
    expect(fixture.sessionId).toBeDefined();
  });

  it('replays fixture and verifies outcomes', async () => {
    const fixture = loadFixture('tool-calling/session-1');
    const runner = new ReplayRunner({ controller, fixture });
    const outcome = await runner.execute();
    
    assertReplaySuccess(outcome);
    assertHasSessionUpdates(outcome, { update: { type: 'tool_call' } });
  });
});
```

### 3. Assertion Patterns

```typescript
// Success/failure
assertReplaySuccess(outcome);
assertReplayFailed(outcome, /timeout/);

// Session updates
assertHasSessionUpdates(outcome, { update: { type: 'agent_thought_chunk' } });
assertSessionUpdateCount(outcome, { update: { type: 'tool_call' } }, 3);
assertNoSessionUpdates(outcome, { update: { type: 'error' } });

// Permission handling
assertPermissionRequestsHandled(outcome, 2);

// Statistics
assertReplayStatistics(outcome, {
  minEvents: 10,
  maxEvents: 100,
  minTokens: 500,
  maxDurationMs: 5000,
  maxErrors: 0,
});

// Event ordering
assertSessionUpdateSequence(outcome, [
  'agent_thought_chunk',
  'tool_call',
  'message',
]);
```

---

## Best Practices Extracted

1. **Use Replay Fixtures** - Never make real network calls in integration tests
2. **Mock TransportClient Consistently** - Always mock at top of test files
3. **Use Assertion Helpers** - Prefer helpers over manual field checks
4. **Test Success and Failure** - Cover both happy paths and error scenarios
5. **Auto-Respond to Permissions** - Use `autoRespondToPermissions()` for tool-calling tests
6. **Verify Event Ordering** - Use `assertSessionUpdateSequence()`
7. **Log Summaries** - Use `summarizeReplay()` for debugging
8. **Keep Fixtures Focused** - One scenario per fixture
9. **Use Descriptive Names** - Clear test descriptions
10. **Clean Up Resources** - Disconnect and clear mocks in afterEach

---

## Files Referenced

### Test Files
- `src/__tests__/integration/session-lifecycle.test.ts`
- `src/__tests__/integration/acp-protocol.test.ts`
- `src/__tests__/integration/error-handling.test.ts`
- `src/__tests__/integration/connection-lifecycle.test.ts`
- `src/__tests__/integration/capture-replay-flow.test.ts`

### Utility Files
- `src/test-utils/fixture-loader.ts`
- `src/test-utils/replay-runner.ts`
- `src/test-utils/replay-assertions.ts`
- `src/test-utils/factories.ts`

### Existing Documentation
- `docs/unit-testing-patterns.md` - Style reference

---

## Verification

**Document created:** ✅
- Location: `packages/acp-chat-core/docs/integration-testing-patterns.md`
- Size: ~900 lines
- Sections: 7 major sections + quick reference

**Coverage:** ✅
- Replay fixture format explained
- Test infrastructure documented
- Writing patterns shown
- Test data setup covered
- Real examples from Wave 3 included
- Best practices listed

**Style:** ✅
- Matches unit-testing-patterns.md structure
- Copy-paste ready examples
- Clear table of contents
- Links to related documentation

---

## Related Tasks

- **Task 20:** Unit testing patterns documentation (completed)
- **Task 21:** Architecture documentation (completed)
- **Task 22:** Integration testing patterns (this task)

---

**Next Steps:** None - task complete
