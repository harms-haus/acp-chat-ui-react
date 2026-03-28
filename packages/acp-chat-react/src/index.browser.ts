/**
 * @fileoverview Browser-only entry point for ACP connection utilities.
 * 
 * This module exports browser-only ACP connection utilities that should
 * only be client-side code. The SSR-safe main index.ts should remain
 * free of browser-only APIs like WebSocket connection logic.
 * 
 * Import this module only in browser environments where you need
 * to establish a live ACP bridge connection or connect to a replay server.
 * 
 * @example
 * // In your client-side React app:
 * import { createBrowserAcpStore, useAcpConnection } from '@acp/chat-react/browser';
 * 
 * // SSR-safe main index.ts is imported by default for server environments
 * import { AcpStore, useMessages } from '@acp/chat-react';
 */

import { useEffect, useRef, useState } from "react";
import {
  SessionController,
  type SessionControllerState,
} from "@acp/chat-core";
import { AcpStore, createAcpStore, type AcpStoreConfig } from "./store/index.js";

export { SessionController } from "@acp/chat-core";
export type { SessionControllerState } from "@acp/chat-core";

/**
 * Configuration for browser ACP connection.
 */
export interface BrowserAcpConfig {
  /** WebSocket URL for the ACP bridge (e.g., ws://localhost:8765) */
  bridgeUrl: string;
  /** Store configuration (notification batching, etc.) */
  storeConfig?: AcpStoreConfig;
  /** Whether to auto-connect on mount (default: true) */
  autoConnect?: boolean;
  /** Whether to auto-initialize session after connection (default: true) */
  autoInitialize?: boolean;
  /** Working directory for session creation */
  cwd?: string;
}

/**
 * Connection state for the browser ACP hook.
 */
export interface BrowserConnectionState {
  /** Current connection status */
  status: "disconnected" | "connecting" | "connected" | "initialized" | "error";
  /** Error message if status is "error" */
  error?: string | null;
  /** Session ID if initialized */
  sessionId?: string | null;
}

/**
 * Create an AcpStore connected to a live ACP bridge session.
 * This is browser-only - do not use in SSR code paths.
 * 
 * @param config - Browser ACP configuration
 * @returns AcpStore instance and connection state
 */
export function createBrowserAcpStore(config: BrowserAcpConfig): {
  store: AcpStore;
  controller: SessionController;
  connect: () => void;
  disconnect: () => void;
} {
  const controller = new SessionController(config.bridgeUrl);
  const store = createAcpStore(controller, config.storeConfig);

  return {
    store,
    controller,
    connect: () => {
      controller.connect();
    },
    disconnect: () => {
      controller.disconnect();
    },
  };
}

/**
 * React hook to manage ACP connection lifecycle.
 * This is browser-only - do not use in SSR code paths.
 * 
 * Creates a connected AcpStore and manages connection lifecycle.
 * Automatically connects on mount and disconnects on unmount by default.
 * 
 * @param config - Browser ACP configuration
 * @returns Store instance and connection state
 */
export function useAcpConnection(config: BrowserAcpConfig): {
  store: AcpStore | null;
  connectionState: BrowserConnectionState;
} {
  // Refs to store controller and store for cleanup
  const controllerRef = useRef<SessionController | null>(null);
  const storeRef = useRef<AcpStore | null>(null);
  
  const [connectionState, setConnectionState] = useState<BrowserConnectionState>({
    status: "disconnected",
  });
  
  const [store, setStore] = useState<AcpStore | null>(null);

  useEffect(() => {
    // Create controller and store
    const controller = new SessionController(config.bridgeUrl);
    const acpStore = createAcpStore(controller, config.storeConfig);
    
    controllerRef.current = controller;
    storeRef.current = acpStore;
    setStore(acpStore);

    // Subscribe to status changes
    const unsubscribe = controller.on("statusChange", (state: SessionControllerState) => {
      setConnectionState({
        status: state.initialized 
          ? "initialized" 
          : state.connectionStatus === "connected" 
            ? "connected" 
            : state.connectionStatus === "connecting" 
            ? "connecting" 
            : state.connectionStatus === "reconnecting" 
            ? "connecting" 
            : "disconnected",
        sessionId: state.sessionId,
      });
    });

    const unsubscribeError = controller.on("error", (error: Error) => {
      setConnectionState({
        status: "error",
        error: error.message,
      });
    });

    // Auto-connect if configured
    if (config.autoConnect ?? true) {
      setConnectionState({ status: "connecting" });
      controller.connect();
    }

    // Cleanup on unmount
    return () => {
      unsubscribe();
      unsubscribeError();
      acpStore.destroy();
      controller.disconnect();
      controllerRef.current = null;
      storeRef.current = null;
      setStore(null);
      setConnectionState({ status: "disconnected" });
    };
  }, [config.bridgeUrl, config.storeConfig, config.autoConnect]);

  // Auto-initialize after connection if configured
  useEffect(() => {
    if (
      connectionState.status === "connected" &&
      (config.autoInitialize ?? true) &&
      controllerRef.current &&
      !store?.getSessionState().initialized
    ) {
      controllerRef.current.initialize().then(() => {
        // Session initialization handled by statusChange handler
      }).catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        setConnectionState({
          status: "error",
          error: errorMessage,
        });
      });
    }
  }, [connectionState.status, config.autoInitialize, store]);

  return { store, connectionState };
}

/**
 * Check if running in a browser environment.
 * Useful for conditional imports in SSR-safe code.
 */
export function isBrowserEnvironment(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

/**
 * Check if running in a server (SSR) environment.
 */
export function isServerEnvironment(): boolean {
  return !isBrowserEnvironment();
}