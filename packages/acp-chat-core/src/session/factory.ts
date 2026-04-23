/**
 * Session Controller Factory
 * 
 * Provides factory functions for creating SessionController instances.
 * This is the recommended way to create SessionController instances.
 */

import { SessionController } from './controller.js';
import type { Transport } from '../transport/transport-interface.js';

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
