/**
 * @harms-haus/acp-ws-bridge
 *
 * WebSocket bridge implementation for ACP communication.
 * This package provides:
 * - WebSocket transport (WsTransport, TransportClient)
 * - Bridge protocol types and utilities
 * - Generic custom event support
 *
 * The bridge protocol wraps ACP JSON-RPC messages for transport over WebSocket.
 * This package is transport-only - it has NO knowledge of ACP protocol semantics.
 * ACP types are from @agentclientprotocol/sdk.
 */

// Re-export ACP types from official SDK
export type {
  AgentNotification as ACPNotification,
  AgentRequest as ACPRequest,
  AgentResponse as ACPResponse,
  SessionId,
  TextContent as ContentBlock,
  ToolCall,
  StopReason,
} from "@agentclientprotocol/sdk";

// Transport interface and implementation
export { WsTransport, type Transport, type ConnectionStatus } from "./ws-transport.js";

// ACP method and update type enums
export type { ACPMethod, ACPUpdateType } from "./ws-transport.js";

// Session notification type
export type { SessionNotification } from "./ws-transport.js";

// Low-level WebSocket client (advanced usage)
export {
  TransportClient,
  type TransportConfig,
  type TransportEvents,
  type DisconnectSuccess,
} from "./client.js";

// Factory functions
export {
  createWsTransport,
  createTransportWithConfig,
} from "./factory.js";

// Bridge protocol types (transport layer concerns)
export type {
  BridgeEnvelope,
  BridgeMessage,
  BridgeStatus,
  UnsupportedVersionError,
} from "./generated/index.js";

// Bridge parser utilities (advanced usage)
export {
  BridgeVersionError,
  ENVELOPE_VERSION,
  SUPPORTED_VERSIONS,
  createUnsupportedVersionError,
  isSupportedVersion,
  parseEnvelope,
  parseEnvelopeSafe,
  validateEnvelope,
} from "./bridge/index.js";
