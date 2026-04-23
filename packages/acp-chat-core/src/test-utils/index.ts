/**
 * Test utilities for ACP Chat Core.
 *
 * This module exports mock implementations for testing.
 * 
 * Note: Bridge-specific test utilities (fixture loaders, factories, replay runners)
 * have been moved to @harms-haus/acp-ws-bridge since they depend on bridge protocol types.
 */

// Mock implementations
export {
  MockTransport,
  MockSessionController,
  createMockTransport,
  createMockController,
} from './mocks.js';
