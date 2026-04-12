/**
 * Test utilities for ACP Chat Core.
 *
 * This module exports all test utilities including:
 * - Fixture loaders for replay data
 * - Replay runner for executing fixtures
 * - Assertion helpers for replay outcomes
 * - Mock implementations for testing
 * - Factory functions for creating test data
 */

// Fixture loaders (legacy captured format)
export {
  listFixtures,
  loadReplayFixture,
  loadReplayFixtureMetadata,
} from './fixtures.js';

// Replay fixture loader (supports both captured and structured formats)
export {
  listFixtures as listReplayFixtures,
  loadFixture,
  loadFixtureMetadata,
  loadFixtureManifest,
  getFixtureEventsPath,
  type LoadedFixture,
  type LoadedReplayEvent,
} from './fixture-loader.js';

// Replay runner
export {
  ReplayRunner,
  createReplayRunner,
  type ReplayRunnerConfig,
  type ReplayStatistics,
  type RecordedSessionUpdate,
  type RecordedPermissionRequest,
  type ReplayOutcome,
} from './replay-runner.js';

// Replay assertions
export {
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
} from './replay-assertions.js';

// Mock implementations
export {
  MockTransportClient,
  MockSessionController,
  createMockTransport,
  createMockController,
} from './mocks.js';

// Factory functions
export {
  createACPPayload,
  createACPPayloadResult,
  createACPPayloadError,
  createACPPayloadNotification,
  createBridgeEnvelope,
  createBridgeStatusEnvelope,
  createSessionUpdate,
  createSessionUpdateEnvelope,
  createInitializeResult,
  createCreateSessionResult,
  createPermissionRequestParams,
  createPermissionRequestEnvelope,
  createListSessionsResult,
  createLoadSessionResult,
  createBatchedSessionUpdatesEnvelope,
} from './factories.js';

// Types
export type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError,
  JsonRpcNotification,
  SessionUpdate,
} from './factories.js';
