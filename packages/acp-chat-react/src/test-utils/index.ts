/**
 * Test utilities for ACP Chat React.
 *
 * This module provides testing utilities for React components including:
 * - Custom render with providers
 * - Mock implementations for ACP store and session controller
 * - Helper functions for common testing scenarios
 */

// Render utilities
export { customRender } from './render.js';
export type { CustomRenderOptions } from './render.js';

// Mock utilities
export { mockStore, mockChatCore, createMockAcpStore } from './mocks.js';
export type { MockStoreConfig } from './mocks.js';

// Test data helpers
export {
  createMockMessage,
  createMockThought,
  createMockToolCall,
  createMockPermissionRequest,
} from './factories.js';
export type {
  MockMessageOptions,
  MockThoughtOptions,
  MockToolCallOptions,
  MockPermissionRequestOptions,
} from './factories.js';
