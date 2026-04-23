/**
 * Session Controller Factory
 * 
 * Provides factory functions for creating SessionController instances.
 * This is the recommended way to create SessionController instances.
 */

import { SessionController } from './controller.js';
import type { Transport } from '../transport/transport-interface.js';
import { DefaultTransport } from '../transport/default-transport.js';

/**
 * Create a SessionController with default WebSocket transport.
 * 
 * This is the simplest way to create a SessionController for WebSocket usage.
 * It uses the default transport configuration with automatic reconnection.
 * 
 * @param url - WebSocket URL (e.g., 'ws://localhost:8765')
 * @returns Configured SessionController
 * 
 * @example
 * ```typescript
 * const controller = createSessionController('ws://localhost:8765');
 * await controller.connect();
 * ```
 * 
 * @deprecated For WebSocket usage, import from @harms-haus/acp-ws-bridge instead:
 * ```typescript
 * import { createSessionController } from '@harms-haus/acp-ws-bridge';
 * ```
 */
export function createSessionController(url: string): SessionController {
  const transport = new DefaultTransport(url);
  return new SessionController(transport);
}

/**
 * Create a SessionController with custom transport.
 * 
 * Use this when you need to:
 * - Use a custom transport implementation
 * - Configure transport with non-default options
 * - Mock the transport for testing
 * 
 * @param transport - Transport implementation
 * @returns Configured SessionController
 * 
 * @example
 * ```typescript
 * // Custom transport
 * const transport = new MyCustomTransport(config);
 * const controller = new SessionController(transport);
 * 
 * // Mock transport for testing
 * const controller = new SessionController(createMockTransport());
 * ```
 */
export function createSessionControllerWithTransport(
  transport: Transport
): SessionController {
  return new SessionController(transport);
}
