/**
 * Comprehensive tests for replay assertion helpers.
 *
 * This test file covers all assertion helpers in replay-assertions.ts
 * to ensure they correctly validate replay outcomes.
 */

import { describe, it, expect } from "vitest";
import {
  assertReplaySuccess,
  assertReplayFailed,
  assertHasSessionUpdates,
  assertSessionUpdateCount,
  assertNoSessionUpdates,
  assertPermissionRequestsHandled,
  assertPermissionRequestsUnhandled,
  assertPermissionRequestHasOption,
  assertReplayStatistics,
  assertSessionUpdateSequence,
  filterSessionUpdates,
  findFirstSessionUpdate,
  getUpdateTypes,
  summarizeReplay,
} from '../replay-assertions.js';
import type { ReplayOutcome } from '../replay-runner.js';
import type { PermissionOption } from '../../session/controller.js';

/**
 * Helper to create a minimal mock ReplayOutcome
 */
function createMockOutcome(overrides?: Partial<ReplayOutcome>): ReplayOutcome {
  return {
    success: true,
    sessionUpdates: [],
    permissionRequests: [],
    statistics: {
      totalEvents: 0,
      inboundEvents: 0,
      outboundEvents: 0,
      totalTokens: 0,
      durationMs: 0,
      errorCount: 0,
    },
    fixture: {
      demoType: 'test',
      sessionId: 'test-session',
      events: [],
      metadata: {
        demoType: 'test',
        eventCount: 0,
        createdAt: new Date().toISOString(),
      },
    },
    ...overrides,
  };
}

/**
 * Helper to create a session update
 */
function createSessionUpdate(
  sessionId: string,
  updateType: string,
  additionalData?: Record<string, unknown>
) {
  return {
    sessionId,
    update: { type: updateType, ...additionalData },
    timestamp: Date.now(),
  };
}

/**
 * Helper to create a permission request
 */
function createPermissionRequest(
  requestId: number,
  sessionId: string,
  options: PermissionOption[] = [],
  responded = false,
  responseAction?: 'approve' | 'deny'
) {
  return {
    requestId,
    sessionId,
    toolCallId: 'call-123',
    options,
    timestamp: Date.now(),
    responded,
    responseAction,
  };
}

describe("replay-assertions", () => {
  describe("assertReplaySuccess", () => {
    it("does not throw when replay succeeded", () => {
      const outcome = createMockOutcome({ success: true });
      expect(() => assertReplaySuccess(outcome)).not.toThrow();
    });

    it("throws error when replay failed", () => {
      const outcome = createMockOutcome({
        success: false,
        error: 'Connection lost',
      });
      expect(() => assertReplaySuccess(outcome)).toThrow('Replay failed: Connection lost');
    });

    it("throws generic error when replay failed without error message", () => {
      const outcome = createMockOutcome({
        success: false,
      });
      expect(() => assertReplaySuccess(outcome)).toThrow('Replay failed: Unknown error');
    });
  });

  describe("assertReplayFailed", () => {
    it("throws when replay succeeded", () => {
      const outcome = createMockOutcome({ success: true });
      expect(() => assertReplayFailed(outcome)).toThrow('Expected replay to fail, but it succeeded');
    });

    it("does not throw when replay failed without pattern", () => {
      const outcome = createMockOutcome({
        success: false,
        error: 'Some error',
      });
      expect(() => assertReplayFailed(outcome)).not.toThrow();
    });

    it("does not throw when error message matches string pattern", () => {
      const outcome = createMockOutcome({
        success: false,
        error: 'Connection timeout occurred',
      });
      expect(() => assertReplayFailed(outcome, 'timeout')).not.toThrow();
    });

    it("throws when error message does not match string pattern", () => {
      const outcome = createMockOutcome({
        success: false,
        error: 'Connection timeout occurred',
      });
      expect(() => assertReplayFailed(outcome, 'different error')).toThrow('Expected error to match different error');
    });

    it("does not throw when error message matches RegExp pattern", () => {
      const outcome = createMockOutcome({
        success: false,
        error: 'Connection timeout after 5000ms',
      });
      expect(() => assertReplayFailed(outcome, /timeout.*\d+ms/)).not.toThrow();
    });

    it("throws when error message does not match RegExp pattern", () => {
      const outcome = createMockOutcome({
        success: false,
        error: 'Connection closed',
      });
      expect(() => assertReplayFailed(outcome, /timeout/)).toThrow('Expected error to match');
    });

    it("handles empty error message with string pattern", () => {
      const outcome = createMockOutcome({
        success: false,
        error: '',
      });
      expect(() => assertReplayFailed(outcome, 'error')).toThrow('Expected error to match');
    });
  });

  describe("assertHasSessionUpdates", () => {
    it("does not throw when matching update exists", () => {
      const outcome = createMockOutcome({
        sessionUpdates: [
          createSessionUpdate('session-1', 'agent_thought_chunk'),
        ],
      });
      expect(() =>
        assertHasSessionUpdates(outcome, { update: { type: 'agent_thought_chunk' } })
      ).not.toThrow();
    });

    it("does not throw when multiple matching updates exist", () => {
      const outcome = createMockOutcome({
        sessionUpdates: [
          createSessionUpdate('session-1', 'agent_thought_chunk'),
          createSessionUpdate('session-1', 'tool_call'),
          createSessionUpdate('session-1', 'agent_thought_chunk'),
        ],
      });
      expect(() =>
        assertHasSessionUpdates(outcome, { update: { type: 'agent_thought_chunk' } })
      ).not.toThrow();
    });

    it("throws when no matching updates found", () => {
      const outcome = createMockOutcome({
        sessionUpdates: [
          createSessionUpdate('session-1', 'tool_call'),
        ],
      });
      expect(() =>
        assertHasSessionUpdates(outcome, { update: { type: 'agent_thought_chunk' } })
      ).toThrow('Expected at least 1 session update(s) matching filter, but found 0');
    });

    it("throws when not enough matching updates for minCount", () => {
      const outcome = createMockOutcome({
        sessionUpdates: [
          createSessionUpdate('session-1', 'agent_thought_chunk'),
          createSessionUpdate('session-1', 'agent_thought_chunk'),
        ],
      });
      expect(() =>
        assertHasSessionUpdates(
          outcome,
          { update: { type: 'agent_thought_chunk' } },
          5
        )
      ).toThrow('Expected at least 5 session update(s) matching filter, but found 2');
    });

    it("does not throw when minCount is satisfied", () => {
      const outcome = createMockOutcome({
        sessionUpdates: [
          createSessionUpdate('session-1', 'agent_thought_chunk'),
          createSessionUpdate('session-1', 'agent_thought_chunk'),
          createSessionUpdate('session-1', 'agent_thought_chunk'),
        ],
      });
      expect(() =>
        assertHasSessionUpdates(
          outcome,
          { update: { type: 'agent_thought_chunk' } },
          3
        )
      ).not.toThrow();
    });

    it("filters by sessionId", () => {
      const outcome = createMockOutcome({
        sessionUpdates: [
          createSessionUpdate('session-1', 'tool_call'),
          createSessionUpdate('session-2', 'tool_call'),
        ],
      });
      expect(() =>
        assertHasSessionUpdates(outcome, { sessionId: 'session-1', update: { type: 'tool_call' } })
      ).not.toThrow();
    });

    it("throws when sessionId does not match", () => {
      const outcome = createMockOutcome({
        sessionUpdates: [
          createSessionUpdate('session-1', 'tool_call'),
        ],
      });
      expect(() =>
        assertHasSessionUpdates(outcome, { sessionId: 'session-2', update: { type: 'tool_call' } })
      ).toThrow();
    });
  });

  describe("assertSessionUpdateCount", () => {
    it("does not throw when count matches exactly", () => {
      const outcome = createMockOutcome({
        sessionUpdates: [
          createSessionUpdate('session-1', 'tool_call'),
          createSessionUpdate('session-1', 'tool_call'),
          createSessionUpdate('session-1', 'tool_call'),
        ],
      });
      expect(() =>
        assertSessionUpdateCount(
          outcome,
          { update: { type: 'tool_call' } },
          3
        )
      ).not.toThrow();
    });

    it("throws when count is less than expected", () => {
      const outcome = createMockOutcome({
        sessionUpdates: [
          createSessionUpdate('session-1', 'tool_call'),
          createSessionUpdate('session-1', 'tool_call'),
        ],
      });
      expect(() =>
        assertSessionUpdateCount(
          outcome,
          { update: { type: 'tool_call' } },
          5
        )
      ).toThrow('Expected exactly 5 session update(s) matching filter, but found 2');
    });

    it("throws when count is more than expected", () => {
      const outcome = createMockOutcome({
        sessionUpdates: [
          createSessionUpdate('session-1', 'tool_call'),
          createSessionUpdate('session-1', 'tool_call'),
          createSessionUpdate('session-1', 'tool_call'),
        ],
      });
      expect(() =>
        assertSessionUpdateCount(
          outcome,
          { update: { type: 'tool_call' } },
          1
        )
      ).toThrow('Expected exactly 1 session update(s) matching filter, but found 3');
    });

    it("works with count of 0", () => {
      const outcome = createMockOutcome({
        sessionUpdates: [
          createSessionUpdate('session-1', 'agent_thought_chunk'),
        ],
      });
      expect(() =>
        assertSessionUpdateCount(
          outcome,
          { update: { type: 'tool_call' } },
          0
        )
      ).not.toThrow();
    });
  });

  describe("assertNoSessionUpdates", () => {
    it("does not throw when no matching updates exist", () => {
      const outcome = createMockOutcome({
        sessionUpdates: [
          createSessionUpdate('session-1', 'agent_thought_chunk'),
        ],
      });
      expect(() =>
        assertNoSessionUpdates(outcome, { update: { type: 'tool_call' } })
      ).not.toThrow();
    });

    it("throws when matching updates exist", () => {
      const outcome = createMockOutcome({
        sessionUpdates: [
          createSessionUpdate('session-1', 'tool_call'),
          createSessionUpdate('session-1', 'agent_thought_chunk'),
        ],
      });
      expect(() =>
        assertNoSessionUpdates(outcome, { update: { type: 'tool_call' } })
      ).toThrow('Expected no session updates matching filter, but found 1');
    });

    it("throws when multiple matching updates exist", () => {
      const outcome = createMockOutcome({
        sessionUpdates: [
          createSessionUpdate('session-1', 'tool_call'),
          createSessionUpdate('session-1', 'tool_call'),
          createSessionUpdate('session-1', 'tool_call'),
        ],
      });
      expect(() =>
        assertNoSessionUpdates(outcome, { update: { type: 'tool_call' } })
      ).toThrow('Expected no session updates matching filter, but found 3');
    });
  });

  describe("assertPermissionRequestsHandled", () => {
    it("does not throw when permission requests are handled", () => {
      const outcome = createMockOutcome({
        permissionRequests: [
          createPermissionRequest(1, 'session-1', [{ optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' }], true, 'approve'),
          createPermissionRequest(2, 'session-1', [{ optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' }], true, 'deny'),
        ],
      });
      expect(() => assertPermissionRequestsHandled(outcome)).not.toThrow();
    });

    it("throws when no permission requests exist", () => {
      const outcome = createMockOutcome({
        permissionRequests: [],
      });
      expect(() => assertPermissionRequestsHandled(outcome)).toThrow('Expected at least 1 permission request(s), but found 0');
    });

    it("throws when not all permission requests are handled", () => {
      const outcome = createMockOutcome({
        permissionRequests: [
          createPermissionRequest(1, 'session-1', [{ optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' }], true, 'approve'),
          createPermissionRequest(2, 'session-1', [{ optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' }], false),
        ],
      });
      expect(() => assertPermissionRequestsHandled(outcome)).toThrow('but 1 request(s) were not responded to');
    });

    it("does not throw with custom minCount when satisfied", () => {
      const outcome = createMockOutcome({
        permissionRequests: [
          createPermissionRequest(1, 'session-1', [{ optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' }], true, 'approve'),
          createPermissionRequest(2, 'session-1', [{ optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' }], true, 'approve'),
          createPermissionRequest(3, 'session-1', [{ optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' }], true, 'approve'),
        ],
      });
      expect(() => assertPermissionRequestsHandled(outcome, 3)).not.toThrow();
    });

    it("throws when minCount is not satisfied", () => {
      const outcome = createMockOutcome({
        permissionRequests: [
          createPermissionRequest(1, 'session-1', [{ optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' }], true, 'approve'),
        ],
      });
      expect(() => assertPermissionRequestsHandled(outcome, 5)).toThrow('Expected at least 5 permission request(s), but found 1');
    });
  });

  describe("assertPermissionRequestsUnhandled", () => {
    it("does not throw when no permission requests are handled", () => {
      const outcome = createMockOutcome({
        permissionRequests: [
          createPermissionRequest(1, 'session-1', [{ optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' }], false),
          createPermissionRequest(2, 'session-1', [{ optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' }], false),
        ],
      });
      expect(() => assertPermissionRequestsUnhandled(outcome)).not.toThrow();
    });

    it("throws when all permission requests are handled", () => {
      const outcome = createMockOutcome({
        permissionRequests: [
          createPermissionRequest(1, 'session-1', [{ optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' }], true, 'approve'),
          createPermissionRequest(2, 'session-1', [{ optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' }], true, 'approve'),
        ],
      });
      expect(() => assertPermissionRequestsUnhandled(outcome)).toThrow('Expected no permission requests to be handled, but 2 request(s) were responded to');
    });

    it("throws when some permission requests are handled", () => {
      const outcome = createMockOutcome({
        permissionRequests: [
          createPermissionRequest(1, 'session-1', [{ optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' }], true, 'approve'),
          createPermissionRequest(2, 'session-1', [{ optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' }], false),
        ],
      });
      expect(() => assertPermissionRequestsUnhandled(outcome)).toThrow('Expected no permission requests to be handled, but 1 request(s) were responded to');
    });
  });

  describe("assertPermissionRequestHasOption", () => {
    it("does not throw when option exists", () => {
      const options: PermissionOption[] = [
        { optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' },
        { optionId: 'allow_always', name: 'Allow Always', kind: 'allow_always' },
      ];
      const outcome = createMockOutcome({
        permissionRequests: [
          createPermissionRequest(1, 'session-1', options, false),
        ],
      });
      expect(() => assertPermissionRequestHasOption(outcome, 'allow_once')).not.toThrow();
    });

    it("throws when option does not exist", () => {
      const options: PermissionOption[] = [
        { optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' },
      ];
      const outcome = createMockOutcome({
        permissionRequests: [
          createPermissionRequest(1, 'session-1', options, false),
        ],
      });
      expect(() => assertPermissionRequestHasOption(outcome, 'deny_always')).toThrow('Expected permission request with option \'deny_always\', but none found');
    });

    it("throws with available options when option not found", () => {
      const options: PermissionOption[] = [
        { optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' },
        { optionId: 'deny_once', name: 'Deny Once', kind: 'deny_once' },
      ];
      const outcome = createMockOutcome({
        permissionRequests: [
          createPermissionRequest(1, 'session-1', options, false),
        ],
      });
      expect(() => assertPermissionRequestHasOption(outcome, 'nonexistent')).toThrow('Available options: allow_once, deny_once');
    });

    it("does not throw when option exists in multiple requests", () => {
      const options1: PermissionOption[] = [
        { optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' },
      ];
      const options2: PermissionOption[] = [
        { optionId: 'deny_once', name: 'Deny Once', kind: 'deny_once' },
      ];
      const outcome = createMockOutcome({
        permissionRequests: [
          createPermissionRequest(1, 'session-1', options1, false),
          createPermissionRequest(2, 'session-1', options2, false),
        ],
      });
      expect(() => assertPermissionRequestHasOption(outcome, 'deny_once')).not.toThrow();
    });
  });

  describe("assertReplayStatistics", () => {
    it("does not throw when all criteria are met", () => {
      const outcome = createMockOutcome({
        statistics: {
          totalEvents: 10,
          inboundEvents: 5,
          outboundEvents: 5,
          totalTokens: 500,
          durationMs: 1000,
          errorCount: 0,
        },
      });
      expect(() =>
        assertReplayStatistics(outcome, {
          minEvents: 5,
          maxEvents: 15,
          minTokens: 100,
          maxTokens: 1000,
          maxDurationMs: 2000,
          maxErrors: 1,
        })
      ).not.toThrow();
    });

    it("throws when totalEvents is below minEvents", () => {
      const outcome = createMockOutcome({
        statistics: {
          totalEvents: 5,
          inboundEvents: 2,
          outboundEvents: 3,
          totalTokens: 100,
          durationMs: 500,
          errorCount: 0,
        },
      });
      expect(() =>
        assertReplayStatistics(outcome, { minEvents: 10 })
      ).toThrow('Expected at least 10 events, but got 5');
    });

    it("throws when totalEvents is above maxEvents", () => {
      const outcome = createMockOutcome({
        statistics: {
          totalEvents: 20,
          inboundEvents: 10,
          outboundEvents: 10,
          totalTokens: 200,
          durationMs: 500,
          errorCount: 0,
        },
      });
      expect(() =>
        assertReplayStatistics(outcome, { maxEvents: 15 })
      ).toThrow('Expected at most 15 events, but got 20');
    });

    it("throws when totalTokens is below minTokens", () => {
      const outcome = createMockOutcome({
        statistics: {
          totalEvents: 10,
          inboundEvents: 5,
          outboundEvents: 5,
          totalTokens: 50,
          durationMs: 500,
          errorCount: 0,
        },
      });
      expect(() =>
        assertReplayStatistics(outcome, { minTokens: 100 })
      ).toThrow('Expected at least 100 tokens, but got 50');
    });

    it("throws when totalTokens is above maxTokens", () => {
      const outcome = createMockOutcome({
        statistics: {
          totalEvents: 10,
          inboundEvents: 5,
          outboundEvents: 5,
          totalTokens: 500,
          durationMs: 500,
          errorCount: 0,
        },
      });
      expect(() =>
        assertReplayStatistics(outcome, { maxTokens: 200 })
      ).toThrow('Expected at most 200 tokens, but got 500');
    });

    it("throws when durationMs is above maxDurationMs", () => {
      const outcome = createMockOutcome({
        statistics: {
          totalEvents: 10,
          inboundEvents: 5,
          outboundEvents: 5,
          totalTokens: 100,
          durationMs: 5000,
          errorCount: 0,
        },
      });
      expect(() =>
        assertReplayStatistics(outcome, { maxDurationMs: 2000 })
      ).toThrow('Expected duration <= 2000ms, but got 5000ms');
    });

    it("throws when errorCount is above maxErrors", () => {
      const outcome = createMockOutcome({
        statistics: {
          totalEvents: 10,
          inboundEvents: 5,
          outboundEvents: 5,
          totalTokens: 100,
          durationMs: 1000,
          errorCount: 5,
        },
      });
      expect(() =>
        assertReplayStatistics(outcome, { maxErrors: 2 })
      ).toThrow('Expected at most 2 errors, but got 5');
    });

    it("does not throw when only some criteria specified", () => {
      const outcome = createMockOutcome({
        statistics: {
          totalEvents: 10,
          inboundEvents: 5,
          outboundEvents: 5,
          totalTokens: 500,
          durationMs: 1000,
          errorCount: 0,
        },
      });
      expect(() =>
        assertReplayStatistics(outcome, { minEvents: 5 })
      ).not.toThrow();
    });
  });

  describe("assertSessionUpdateSequence", () => {
    it("does not throw when sequence is found in order", () => {
      const outcome = createMockOutcome({
        sessionUpdates: [
          createSessionUpdate('session-1', 'agent_thought_chunk'),
          createSessionUpdate('session-1', 'tool_call'),
          createSessionUpdate('session-1', 'agent_message_chunk'),
        ],
      });
      expect(() =>
        assertSessionUpdateSequence(outcome, ['agent_thought_chunk', 'tool_call'])
      ).not.toThrow();
    });

    it("does not throw when sequence has gaps", () => {
      const outcome = createMockOutcome({
        sessionUpdates: [
          createSessionUpdate('session-1', 'agent_thought_chunk'),
          createSessionUpdate('session-1', 'other_type'),
          createSessionUpdate('session-1', 'tool_call'),
        ],
      });
      expect(() =>
        assertSessionUpdateSequence(outcome, ['agent_thought_chunk', 'tool_call'])
      ).not.toThrow();
    });

    it("throws when sequence is not found", () => {
      const outcome = createMockOutcome({
        sessionUpdates: [
          createSessionUpdate('session-1', 'tool_call'),
          createSessionUpdate('session-1', 'agent_thought_chunk'),
        ],
      });
      expect(() =>
        assertSessionUpdateSequence(outcome, ['agent_thought_chunk', 'tool_call'])
      ).toThrow('Expected sequence [agent_thought_chunk, tool_call] not found. Got to position 1 in sequence.');
    });

    it("throws when sequence is partially found", () => {
      const outcome = createMockOutcome({
        sessionUpdates: [
          createSessionUpdate('session-1', 'agent_thought_chunk'),
          createSessionUpdate('session-1', 'agent_message_chunk'),
        ],
      });
      expect(() =>
        assertSessionUpdateSequence(outcome, ['agent_thought_chunk', 'tool_call', 'agent_message_chunk'])
      ).toThrow('Got to position 1 in sequence');
    });

    it("does not throw with single item sequence", () => {
      const outcome = createMockOutcome({
        sessionUpdates: [
          createSessionUpdate('session-1', 'tool_call'),
        ],
      });
      expect(() =>
        assertSessionUpdateSequence(outcome, ['tool_call'])
      ).not.toThrow();
    });

    it("throws when sequence is longer than updates", () => {
      const outcome = createMockOutcome({
        sessionUpdates: [
          createSessionUpdate('session-1', 'tool_call'),
        ],
      });
      expect(() =>
        assertSessionUpdateSequence(outcome, ['tool_call', 'agent_thought_chunk', 'other'])
      ).toThrow();
    });
  });

  describe("filterSessionUpdates", () => {
    it("returns empty array when no matches", () => {
      const updates = [
        createSessionUpdate('session-1', 'tool_call'),
        createSessionUpdate('session-1', 'agent_message_chunk'),
      ];
      const result = filterSessionUpdates(updates, { update: { type: 'other' } });
      expect(result).toHaveLength(0);
    });

    it("returns matching updates", () => {
      const updates = [
        createSessionUpdate('session-1', 'tool_call'),
        createSessionUpdate('session-1', 'agent_thought_chunk'),
        createSessionUpdate('session-1', 'tool_call'),
      ];
      const result = filterSessionUpdates(updates, { update: { type: 'tool_call' } });
      expect(result).toHaveLength(2);
    });

    it("filters by sessionId", () => {
      const updates = [
        createSessionUpdate('session-1', 'tool_call'),
        createSessionUpdate('session-2', 'tool_call'),
        createSessionUpdate('session-1', 'agent_thought_chunk'),
      ];
      const result = filterSessionUpdates(updates, { sessionId: 'session-1' });
      expect(result).toHaveLength(2);
    });

    it("filters by multiple criteria", () => {
      const updates = [
        createSessionUpdate('session-1', 'tool_call', { extra: 'data1' }),
        createSessionUpdate('session-1', 'tool_call', { extra: 'data2' }),
        createSessionUpdate('session-2', 'tool_call', { extra: 'data1' }),
      ];
      const result = filterSessionUpdates(updates, {
        sessionId: 'session-1',
        update: { extra: 'data1' },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe("findFirstSessionUpdate", () => {
    it("returns undefined when no matches", () => {
      const outcome = createMockOutcome({
        sessionUpdates: [
          createSessionUpdate('session-1', 'tool_call'),
        ],
      });
      const result = findFirstSessionUpdate(outcome, { update: { type: 'other' } });
      expect(result).toBeUndefined();
    });

    it("returns first matching update", () => {
      const outcome = createMockOutcome({
        sessionUpdates: [
          createSessionUpdate('session-1', 'tool_call'),
          createSessionUpdate('session-1', 'agent_thought_chunk'),
          createSessionUpdate('session-1', 'tool_call'),
        ],
      });
      const result = findFirstSessionUpdate(outcome, { update: { type: 'tool_call' } });
      expect(result).toBeDefined();
      expect(result?.update.type).toBe('tool_call');
    });

    it("returns first match with complex filter", () => {
      const outcome = createMockOutcome({
        sessionUpdates: [
          createSessionUpdate('session-1', 'tool_call'),
          createSessionUpdate('session-2', 'tool_call'),
        ],
      });
      const result = findFirstSessionUpdate(outcome, { sessionId: 'session-2' });
      expect(result).toBeDefined();
      expect(result?.sessionId).toBe('session-2');
    });
  });

  describe("getUpdateTypes", () => {
    it("returns empty array for no updates", () => {
      const outcome = createMockOutcome({ sessionUpdates: [] });
      const result = getUpdateTypes(outcome);
      expect(result).toEqual([]);
    });

    it("returns unique update types", () => {
      const outcome = createMockOutcome({
        sessionUpdates: [
          createSessionUpdate('session-1', 'tool_call'),
          createSessionUpdate('session-1', 'agent_thought_chunk'),
          createSessionUpdate('session-1', 'tool_call'),
          createSessionUpdate('session-1', 'agent_thought_chunk'),
        ],
      });
      const result = getUpdateTypes(outcome);
      expect(result).toEqual(expect.arrayContaining(['tool_call', 'agent_thought_chunk']));
      expect(result.length).toBe(2);
    });

    it("returns 'unknown' for updates without type", () => {
      const outcome = createMockOutcome({
        sessionUpdates: [
          { sessionId: 'session-1', update: {}, timestamp: Date.now() },
        ],
      });
      const result = getUpdateTypes(outcome);
      expect(result).toContain('unknown');
    });
  });

  describe("summarizeReplay", () => {
    it("returns success summary", () => {
      const outcome = createMockOutcome({
        success: true,
        statistics: {
          totalEvents: 10,
          inboundEvents: 6,
          outboundEvents: 4,
          totalTokens: 500,
          durationMs: 1000,
          errorCount: 0,
        },
        sessionUpdates: [
          createSessionUpdate('session-1', 'tool_call'),
        ],
        permissionRequests: [
          createPermissionRequest(1, 'session-1', [{ optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' }], true, 'approve'),
        ],
      });
      const summary = summarizeReplay(outcome);
      expect(summary).toContain('Replay SUCCESS');
      expect(summary).toContain('Events: 10 (6 in, 4 out)');
      expect(summary).toContain('Tokens: 500');
      expect(summary).toContain('Duration: 1000ms');
      expect(summary).toContain('Session Updates: 1');
      expect(summary).toContain('Permission Requests: 1 (1 handled)');
    });

    it("returns failure summary with error", () => {
      const outcome = createMockOutcome({
        success: false,
        error: 'Connection timeout',
        statistics: {
          totalEvents: 5,
          inboundEvents: 3,
          outboundEvents: 2,
          totalTokens: 200,
          durationMs: 500,
          errorCount: 1,
        },
        sessionUpdates: [],
        permissionRequests: [],
      });
      const summary = summarizeReplay(outcome);
      expect(summary).toContain('Replay FAILED: Connection timeout');
      expect(summary).toContain('Events: 5 (3 in, 2 out)');
    });

    it("returns failure summary without error", () => {
      const outcome = createMockOutcome({
        success: false,
        statistics: {
          totalEvents: 0,
          inboundEvents: 0,
          outboundEvents: 0,
          totalTokens: 0,
          durationMs: 0,
          errorCount: 1,
        },
        sessionUpdates: [],
        permissionRequests: [],
      });
      const summary = summarizeReplay(outcome);
      expect(summary).toContain('Replay FAILED');
    });

    it("shows 0 handled when no permission requests responded", () => {
      const outcome = createMockOutcome({
        success: true,
        permissionRequests: [
          createPermissionRequest(1, 'session-1', [{ optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' }], false),
          createPermissionRequest(2, 'session-1', [{ optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' }], false),
        ],
      });
      const summary = summarizeReplay(outcome);
      expect(summary).toContain('Permission Requests: 2 (0 handled)');
    });

    it("lists all unique update types", () => {
      const outcome = createMockOutcome({
        success: true,
        sessionUpdates: [
          createSessionUpdate('session-1', 'tool_call'),
          createSessionUpdate('session-1', 'agent_thought_chunk'),
          createSessionUpdate('session-1', 'tool_call'),
          createSessionUpdate('session-1', 'user_message'),
        ],
      });
      const summary = summarizeReplay(outcome);
      expect(summary).toContain('Update Types:');
      expect(summary).toContain('tool_call');
      expect(summary).toContain('agent_thought_chunk');
      expect(summary).toContain('user_message');
    });
  });
});
