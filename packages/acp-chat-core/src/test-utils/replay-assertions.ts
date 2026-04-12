/**
 * Assertion helpers for replay test outcomes.
 *
 * This module provides helper functions for asserting on replay test results,
 * including session updates, permission requests, and replay statistics.
 *
 * ## Usage
 *
 * ```ts
 * import { assertReplaySuccess, assertHasSessionUpdates } from './replay-assertions';
 * import { ReplayRunner } from './replay-runner';
 *
 * const runner = new ReplayRunner(config);
 * const outcome = await runner.execute();
 *
 * // Assert replay completed successfully
 * assertReplaySuccess(outcome);
 *
 * // Assert specific session updates occurred
 * assertHasSessionUpdates(outcome, { type: 'agent_thought_chunk' });
 *
 * // Assert permission requests were handled
 * assertPermissionRequestsHandled(outcome);
 * ```
 */

import type { ReplayOutcome, RecordedSessionUpdate } from './replay-runner.js';
import type {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  RecordedPermissionRequest,
} from './replay-runner.js';
import type { PermissionOption } from '../session/controller.js';

/**
 * Assert that the replay completed successfully.
 *
 * @param outcome - The replay outcome to check
 * @throws Error if replay was not successful
 */
export function assertReplaySuccess(outcome: ReplayOutcome): void {
  if (!outcome.success) {
    throw new Error(
      `Replay failed: ${outcome.error ?? 'Unknown error'}`
    );
  }
}

/**
 * Assert that the replay failed with a specific error message pattern.
 *
 * @param outcome - The replay outcome to check
 * @param errorPattern - The error message pattern to match (string or RegExp)
 * @throws Error if replay was successful or error doesn't match
 */
export function assertReplayFailed(
  outcome: ReplayOutcome,
  errorPattern?: string | RegExp
): void {
  if (outcome.success) {
    throw new Error('Expected replay to fail, but it succeeded');
  }

  if (errorPattern) {
    const errorMessage = outcome.error ?? '';
    const matches = typeof errorPattern === 'string'
      ? errorMessage.includes(errorPattern)
      : errorPattern.test(errorMessage);

    if (!matches) {
      throw new Error(
        `Expected error to match ${errorPattern}, but got: ${errorMessage}`
      );
    }
  }
}

/**
 * Assert that the replay has session updates matching a filter.
 *
 * @param outcome - The replay outcome to check
 * @param filter - Filter criteria for session updates
 * @param minCount - Minimum number of matching updates required (default: 1)
 * @throws Error if no matching updates found
 *
 * @example
 * ```ts
 * // Assert at least one thought chunk
 * assertHasSessionUpdates(outcome, { update: { type: 'agent_thought_chunk' } });
 *
 * // Assert at least 3 tool calls
 * assertHasSessionUpdates(outcome, { update: { type: 'tool_call' } }, 3);
 * ```
 */
export function assertHasSessionUpdates(
  outcome: ReplayOutcome,
  filter: Partial<RecordedSessionUpdate> & {
    update?: Partial<Record<string, unknown>>;
  },
  minCount: number = 1
): void {
  const matching = filterSessionUpdates(outcome.sessionUpdates, filter);

  if (matching.length < minCount) {
    throw new Error(
      `Expected at least ${minCount} session update(s) matching filter, ` +
      `but found ${matching.length}. ` +
      `Total updates: ${outcome.sessionUpdates.length}`
    );
  }
}

/**
 * Assert that the replay has exactly N session updates matching a filter.
 *
 * @param outcome - The replay outcome to check
 * @param filter - Filter criteria for session updates
 * @param count - Exact number of matching updates required
 * @throws Error if count doesn't match
 */
export function assertSessionUpdateCount(
  outcome: ReplayOutcome,
  filter: Partial<RecordedSessionUpdate> & {
    update?: Partial<Record<string, unknown>>;
  },
  count: number
): void {
  const matching = filterSessionUpdates(outcome.sessionUpdates, filter);

  if (matching.length !== count) {
    throw new Error(
      `Expected exactly ${count} session update(s) matching filter, ` +
      `but found ${matching.length}`
    );
  }
}

/**
 * Assert that the replay has no session updates matching a filter.
 *
 * @param outcome - The replay outcome to check
 * @param filter - Filter criteria for session updates
 * @throws Error if any matching updates found
 */
export function assertNoSessionUpdates(
  outcome: ReplayOutcome,
  filter: Partial<RecordedSessionUpdate> & {
    update?: Partial<Record<string, unknown>>;
  }
): void {
  const matching = filterSessionUpdates(outcome.sessionUpdates, filter);

  if (matching.length > 0) {
    throw new Error(
      `Expected no session updates matching filter, but found ${matching.length}`
    );
  }
}

/**
 * Assert that permission requests were handled (all responded to).
 *
 * @param outcome - The replay outcome to check
 * @param minCount - Minimum number of permission requests required (default: 1)
 * @throws Error if no permission requests or not all handled
 */
export function assertPermissionRequestsHandled(
  outcome: ReplayOutcome,
  minCount: number = 1
): void {
  const { permissionRequests } = outcome;

  if (permissionRequests.length < minCount) {
    throw new Error(
      `Expected at least ${minCount} permission request(s), ` +
      `but found ${permissionRequests.length}`
    );
  }

  const unhandled = permissionRequests.filter((r) => !r.responded);
  if (unhandled.length > 0) {
    throw new Error(
      `Expected all permission requests to be handled, ` +
      `but ${unhandled.length} request(s) were not responded to`
    );
  }
}

/**
 * Assert that permission requests were NOT handled (none responded to).
 *
 * @param outcome - The replay outcome to check
 * @throws Error if any requests were handled
 */
export function assertPermissionRequestsUnhandled(outcome: ReplayOutcome): void {
  const { permissionRequests } = outcome;

  const handled = permissionRequests.filter((r) => r.responded);
  if (handled.length > 0) {
    throw new Error(
      `Expected no permission requests to be handled, ` +
      `but ${handled.length} request(s) were responded to`
    );
  }
}

/**
 * Assert that permission requests exist with specific options.
 *
 * @param outcome - The replay outcome to check
 * @param optionId - The option ID to look for
 * @throws Error if no permission requests with that option
 */
export function assertPermissionRequestHasOption(
  outcome: ReplayOutcome,
  optionId: string
): void {
  const { permissionRequests } = outcome;

  const hasOption = permissionRequests.some((r) =>
    r.options.some((opt: PermissionOption) => opt.optionId === optionId)
  );

  if (!hasOption) {
    throw new Error(
      `Expected permission request with option '${optionId}', ` +
      `but none found. Available options: ${permissionRequests.map((r) =>
        r.options.map((o: PermissionOption) => o.optionId).join(', ')
      ).join('; ')}`
    );
  }
}

/**
 * Assert replay statistics meet certain criteria.
 *
 * @param outcome - The replay outcome to check
 * @param criteria - Statistics criteria to check
 * @throws Error if criteria not met
 *
 * @example
 * ```ts
 * assertReplayStatistics(outcome, {
 *   minEvents: 10,
 *   minTokens: 100,
 *   maxDurationMs: 5000,
 * });
 * ```
 */
export function assertReplayStatistics(
  outcome: ReplayOutcome,
  criteria: {
    minEvents?: number;
    maxEvents?: number;
    minTokens?: number;
    maxTokens?: number;
    maxDurationMs?: number;
    maxErrors?: number;
  }
): void {
  const { statistics } = outcome;

  if (criteria.minEvents !== undefined && statistics.totalEvents < criteria.minEvents) {
    throw new Error(
      `Expected at least ${criteria.minEvents} events, ` +
      `but got ${statistics.totalEvents}`
    );
  }

  if (criteria.maxEvents !== undefined && statistics.totalEvents > criteria.maxEvents) {
    throw new Error(
      `Expected at most ${criteria.maxEvents} events, ` +
      `but got ${statistics.totalEvents}`
    );
  }

  if (criteria.minTokens !== undefined && statistics.totalTokens < criteria.minTokens) {
    throw new Error(
      `Expected at least ${criteria.minTokens} tokens, ` +
      `but got ${statistics.totalTokens}`
    );
  }

  if (criteria.maxTokens !== undefined && statistics.totalTokens > criteria.maxTokens) {
    throw new Error(
      `Expected at most ${criteria.maxTokens} tokens, ` +
      `but got ${statistics.totalTokens}`
    );
  }

  if (criteria.maxDurationMs !== undefined && statistics.durationMs > criteria.maxDurationMs) {
    throw new Error(
      `Expected duration <= ${criteria.maxDurationMs}ms, ` +
      `but got ${statistics.durationMs}ms`
    );
  }

  if (criteria.maxErrors !== undefined && statistics.errorCount > criteria.maxErrors) {
    throw new Error(
      `Expected at most ${criteria.maxErrors} errors, ` +
      `but got ${statistics.errorCount}`
    );
  }
}

/**
 * Assert that session updates occur in a specific order.
 *
 * @param outcome - The replay outcome to check
 * @param sequence - Array of update types that should appear in order
 * @throws Error if sequence not found
 *
 * @example
 * ```ts
 * // Assert thought comes before tool call
 * assertSessionUpdateSequence(outcome, [
 *   'agent_thought_chunk',
 *   'tool_call',
 * ]);
 * ```
 */
export function assertSessionUpdateSequence(
  outcome: ReplayOutcome,
  sequence: string[]
): void {
  const { sessionUpdates } = outcome;

  let sequenceIndex = 0;
  for (const update of sessionUpdates) {
    const updateType = (update.update?.type as string) || '';
    if (updateType === sequence[sequenceIndex]) {
      sequenceIndex++;
      if (sequenceIndex === sequence.length) {
        return; // Found the complete sequence
      }
    }
  }

  throw new Error(
    `Expected sequence [${sequence.join(', ')}] not found. ` +
    `Got to position ${sequenceIndex} in sequence.`
  );
}

/**
 * Get session updates matching a filter.
 *
 * @param updates - Array of session updates to filter
 * @param filter - Filter criteria
 * @returns Array of matching updates
 */
export function filterSessionUpdates(
  updates: RecordedSessionUpdate[],
  filter: Partial<RecordedSessionUpdate> & {
    update?: Partial<Record<string, unknown>>;
  }
): RecordedSessionUpdate[] {
  return updates.filter((update) => {
    // Check top-level fields
    for (const key of Object.keys(filter)) {
      if (key === 'update') continue;

      const filterValue = filter[key as keyof typeof filter];
      const updateValue = update[key as keyof RecordedSessionUpdate];

      if (filterValue !== undefined && updateValue !== filterValue) {
        return false;
      }
    }

    // Check nested update fields
    if (filter.update) {
      for (const key of Object.keys(filter.update)) {
        const filterValue = filter.update[key];
        const updateValue = update.update?.[key];

        if (filterValue !== undefined && updateValue !== filterValue) {
          return false;
        }
      }
    }

    return true;
  });
}

/**
 * Get the first session update matching a filter.
 *
 * @param outcome - The replay outcome to search
 * @param filter - Filter criteria
 * @returns The first matching update, or undefined if none found
 */
export function findFirstSessionUpdate(
  outcome: ReplayOutcome,
  filter: Partial<RecordedSessionUpdate> & {
    update?: Partial<Record<string, unknown>>;
  }
): RecordedSessionUpdate | undefined {
  const matching = filterSessionUpdates(outcome.sessionUpdates, filter);
  return matching[0];
}

/**
 * Get all unique update types from session updates.
 *
 * @param outcome - The replay outcome to analyze
 * @returns Array of unique update types
 */
export function getUpdateTypes(outcome: ReplayOutcome): string[] {
  const types = new Set<string>();
  for (const update of outcome.sessionUpdates) {
    const type = (update.update?.type as string) || 'unknown';
    types.add(type);
  }
  return Array.from(types);
}

/**
 * Create a summary of the replay outcome.
 *
 * @param outcome - The replay outcome to summarize
 * @returns Human-readable summary string
 */
export function summarizeReplay(outcome: ReplayOutcome): string {
  const { statistics, sessionUpdates, permissionRequests } = outcome;

  const lines = [
    `Replay ${outcome.success ? 'SUCCESS' : 'FAILED'}${outcome.error ? `: ${outcome.error}` : ''}`,
    `Events: ${statistics.totalEvents} (${statistics.inboundEvents} in, ${statistics.outboundEvents} out)`,
    `Tokens: ${statistics.totalTokens}`,
    `Duration: ${statistics.durationMs}ms`,
    `Session Updates: ${sessionUpdates.length}`,
    `Permission Requests: ${permissionRequests.length} (${
      permissionRequests.filter((r) => r.responded).length
    } handled)`,
    `Update Types: ${getUpdateTypes(outcome).join(', ')}`,
  ];

  return lines.join('\n');
}
