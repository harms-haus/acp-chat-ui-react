// Re-export bridge types from acp-chat-core (single source of truth)
export type {
  BridgeEnvelope,
  BridgeMessage,
  BridgeStatus,
  UnsupportedVersionError,
} from "@harms-haus/acp-chat-core";

export { TransportClient, type ConnectionStatus } from "./client";
