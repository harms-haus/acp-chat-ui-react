/**
 * @acp/chat-react/client
 *
 * Browser-only entry point for ACP connection utilities.
 * This module contains WebSocket-dependent code and should NOT be
 * imported in SSR/Node.js environments.
 *
 * Usage:
 *   import { useAcpConnection, createSessionController } from '@harms-haus/acp-chat-react/client';
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { SessionController } from "@harms-haus/acp-chat-core";
import { AcpStore, createAcpStore, type AcpStoreConfig } from "../store/index.js";

export { SessionController } from "@harms-haus/acp-chat-core";

/**
 * Configuration for connecting to an ACP bridge.
 */
export interface AcpConnectionConfig {
  /** WebSocket URL for the ACP bridge (e.g., "ws://localhost:8765") */
  bridgeUrl: string;
  /** Working directory for the session */
  cwd?: string;
  /** MCP servers configuration */
  mcpServers?: unknown[];
  /** Request timeout in milliseconds (default: 30000) */
  requestTimeoutMs?: number;
  /** AcpStore notification configuration */
  storeConfig?: AcpStoreConfig;
  /** Whether to auto-connect on mount (default: true) */
  autoConnect?: boolean;
  /** Whether to auto-initialize after connection (default: true) */
  autoInitialize?: boolean;
}

/**
 * Connection state returned by useAcpConnection.
 */
export interface AcpConnectionState {
  /** The AcpStore instance for React integration */
  store: AcpStore | null;
  /** The SessionController instance */
  controller: SessionController | null;
  /** Whether actively connecting */
  isConnecting: boolean;
  /** Connection error if any */
  error: Error | null;
  /** Function to initiate connection */
  connect: () => void;
  /** Function to disconnect */
  disconnect: () => void;
}

/**
 * React hook for managing ACP bridge connection.
 *
 * This hook is browser-only due to WebSocket usage.
 * Returns connection state and control functions.
 *
 * @param config - Connection configuration
 * @returns Connection state and control functions
 */
export function useAcpConnection(config: AcpConnectionConfig): AcpConnectionState {
  const {
    bridgeUrl,
    cwd,
    mcpServers = [],
    requestTimeoutMs = 30000,
    storeConfig,
    autoConnect = true,
    autoInitialize = true,
  } = config;

  const [store, setStore] = useState<AcpStore | null>(null);
  const [controller, setController] = useState<SessionController | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const cleanupRef = useRef<(() => void) | null>(null);

  const connect = useCallback(async () => {
    // Prevent duplicate connections
    if (controller || store) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Create session controller (browser-only due to WebSocket)
      const newController = new SessionController(bridgeUrl, requestTimeoutMs);

      // Create AcpStore with the controller
      const newStore = createAcpStore(newController, storeConfig);

      // Subscribe to errors
      const unsubError = newController.on("error", (err) => {
        setError(err);
        setIsConnecting(false);
      });

      cleanupRef.current = () => {
        unsubError();
        newStore.destroy();
        newController.disconnect();
      };

      setController(newController);
      setStore(newStore);

      // Connect to bridge
      newController.connect();

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const unsub = newController.on("statusChange", (state) => {
          if (state.connectionStatus === "connected") {
            unsub();
            resolve();
          } else if (state.connectionStatus === "error") {
            unsub();
            reject(new Error("Connection failed"));
          }
        });

        // Timeout for connection
        setTimeout(() => {
          unsub();
          reject(new Error("Connection timeout"));
        }, 5000);
      });

      // Auto-initialize if configured
      if (autoInitialize) {
        await newController.initialize({
          name: "acp-chat-react-harness",
          version: "0.0.1",
        });

        // Create or load session
        if (cwd) {
          await newController.createSession(cwd, mcpServers);
        }
      }

      setIsConnecting(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsConnecting(false);
      setController(null);
      setStore(null);
    }
  }, [bridgeUrl, cwd, mcpServers, requestTimeoutMs, storeConfig, autoInitialize, controller, store]);

  const disconnect = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    setController(null);
    setStore(null);
    setIsConnecting(false);
    setError(null);
  }, []);

  // Auto-connect on mount if configured
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [autoConnect]); // Note: only run on mount/unmount

  return {
    store,
    controller,
    isConnecting,
    error,
    connect,
    disconnect,
  };
}

/**
 * Create a SessionController for manual connection management.
 *
 * This factory is browser-only due to WebSocket usage.
 *
 * @param bridgeUrl - WebSocket URL for the ACP bridge
 * @param requestTimeoutMs - Request timeout in milliseconds
 * @returns SessionController instance
 */
export function createSessionController(
  bridgeUrl: string,
  requestTimeoutMs = 30000
): SessionController {
  return new SessionController(bridgeUrl, requestTimeoutMs);
}

/**
 * Create an AcpStore with a connected SessionController.
 *
 * This is a convenience function for one-time store creation.
 * Browser-only due to WebSocket dependency.
 *
 * @param bridgeUrl - WebSocket URL for the ACP bridge
 * @param storeConfig - Store configuration
 * @param requestTimeoutMs - Request timeout in milliseconds
 * @returns Object with store and controller
 */
export function createConnectedStore(
  bridgeUrl: string,
  storeConfig?: AcpStoreConfig,
  requestTimeoutMs = 30000
): { store: AcpStore; controller: SessionController } {
  const controller = new SessionController(bridgeUrl, requestTimeoutMs);
  const store = createAcpStore(controller, storeConfig);
  return { store, controller };
}