/**
 * @harms-haus/acp-ws-bridge
 *
 * WebSocket bridge implementation for ACP communication.
 * This package provides:
 * - WebSocket transport (WsTransport)
 * - Session controller factories
 * - Bridge protocol types and utilities
 * - Replay controller for testing
 *
 * The bridge protocol wraps ACP JSON-RPC messages for transport over WebSocket.
 * All bridge-specific logic lives here - core package sees only pure ACP events.
 */

// Re-export ACP types from core (single source of truth)
export type {
  Transport,
  ConnectionStatus,
  ACPMethod,
  ACPUpdateType,
  SessionNotification,
  ACPRequest,
  ACPResponse,
  ACPNotification,
  SessionId,
  ContentBlock,
  ToolCall,
  StopReason,
} from "@harms-haus/acp-chat-core";

export type {
  SessionControllerState,
  PermissionRequestParams,
  PermissionOption,
  ConfigOption,
} from "@harms-haus/acp-chat-core";

// WebSocket transport implementation
export { WsTransport } from "./ws-transport.js";

// Low-level WebSocket client (advanced usage)
export {
  TransportClient,
  type TransportConfig,
  type TransportEvents,
  type InitSuccess,
  type InitError,
  type DisconnectSuccess,
} from "./client.js";

// Factory functions
export {
  createSessionController,
  createSessionControllerWithTransport,
} from "./factory.js";

// Replay controller (bridge-specific feature for testing)
export { ReplayController } from "./replay-controller.js";
export type {
  ReplayControllerOptions,
  ReplayControllerState,
  ReplayMode,
  ReplayModel,
} from "./replay-controller.js";

// Bridge protocol types (NOT ACP - transport layer concerns)
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
