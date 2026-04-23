/**
 * Factory functions for creating SessionControllers with WebSocket transport.
 */
import type { Transport as CoreTransport } from "@harms-haus/acp-chat-core";
import { SessionController } from "@harms-haus/acp-chat-core";
import { WsTransport } from "./ws-transport.js";

/**
 * Create SessionController with WebSocket transport.
 *
 * This is the recommended way to create a SessionController for WebSocket usage.
 *
 * @param url WebSocket URL (e.g., 'ws://localhost:8765')
 * @returns Configured SessionController
 */
export function createSessionController(url: string): SessionController {
  const transport = new WsTransport(url);
  return new SessionController(transport);
}

/**
 * Create SessionController with custom transport.
 *
 * @param transport Transport implementation
 * @returns Configured SessionController
 */
export function createSessionControllerWithTransport(
  transport: CoreTransport
): SessionController {
  return new SessionController(transport);
}
