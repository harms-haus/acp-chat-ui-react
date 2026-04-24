/**
 * BridgeAdapter - Adapters for connecting acp-harness-ui to ACP bridges.
 * 
 * This module provides adapter classes that wrap WsTransport to provide
 * a controller-like interface for the harness UI. The actual replay logic
 * lives in the Rust controller - this is just a TypeScript adapter for
 * UI integration.
 * 
 * Architecture:
 * - Rust Controller (owns replay logic, session management)
 *   └── acp-ws-bridge (Rust) - WebSocket bridge
 *       └── WsTransport (TypeScript) - WebSocket client
 *           └── BridgeAdapter - Adapts transport for UI
 */

export { BridgeAdapter } from './bridge-adapter';
export type { BridgeAdapterEvents, BridgeAdapterState } from './bridge-adapter';
