/**
 * Factory functions for creating WebSocket transports.
 * 
 * Note: SessionController creation moved to acp-harness-ui.
 * Use BridgeAdapter in harness-ui to connect WsTransport to SessionController.
 */

import type { Transport } from "./ws-transport.js";
import { WsTransport } from "./ws-transport.js";

/**
 * Create WebSocket transport.
 *
 * @param url WebSocket URL (e.g., 'ws://localhost:8765')
 * @returns Configured WsTransport
 */
export function createWsTransport(url: string): WsTransport {
  return new WsTransport(url);
}

/**
 * Create transport with custom configuration.
 * 
 * @param transport Transport implementation
 * @returns The transport (passthrough for convenience)
 */
export function createTransportWithConfig(transport: Transport): Transport {
  return transport;
}
