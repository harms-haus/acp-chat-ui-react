/**
 * WebSocket transport implementation for ACP.
 * 
 * This transport layer:
 * - Wraps TransportClient for ACP-specific operations
 * - Handles bridge envelope parsing
 * - Provides request/response semantics for ACP JSON-RPC
 * 
 * NO REPLAY LOGIC: This transport does not initiate or control replays.
 * Replay control lives exclusively in the Rust controller.
 */

import type { BridgeEnvelope } from "./generated/index.js";
import { TransportClient } from "./client.js";

// Minimal ACP types for ws-bridge (transport layer only)
// Full ACP types live in @agentclientprotocol/sdk
export type ACPRequest = {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: unknown;
};

export type ACPResponse<T = unknown> = {
  jsonrpc: "2.0";
  id: number | string;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
};

export type ACPNotification = {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
};

// Transport interface
export interface Transport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): ConnectionStatus;
  sendRequest<T>(request: ACPRequest): Promise<ACPResponse<T>>;
  sendNotification(notification: ACPNotification): void;
  sendResponse<T>(response: ACPResponse<T>): void;
  onNotification(handler: (notification: ACPNotification) => void): () => void;
  onError(handler: (error: Error) => void): () => void;
  onStatusChange(handler: (status: ConnectionStatus) => void): () => void;
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "error";

// ACP method names
export type ACPMethod =
  | "initialize"
  | "session/new"
  | "session/load"
  | "session/list"
  | "session/prompt"
  | "session/cancel"
  | "session/update"
  | "session/request_permission"
  | string;

// ACP update types
export type ACPUpdateType =
  | "agent_message_chunk"
  | "agent_thought_chunk"
  | "user_message"
  | "user_message_chunk"
  | "tool_call"
  | "tool_call_update"
  | "permission_request"
  | string;

// Session notification type
export type SessionNotification = ACPNotification & { method: "session/update" };

/**
 * WebSocket transport implementation for ACP.
 * Implements the Transport interface while handling bridge envelope parsing.
 */
export class WsTransport implements Transport {
  private client: TransportClient;
  private requestId = 0;
  private pendingRequests = new Map<string | number, { resolve: Function; reject: Function }>();
  private notificationHandlers = new Set<(notification: ACPNotification) => void>();
  private errorHandlers = new Set<(error: Error) => void>();
  private statusHandlers = new Set<(status: ConnectionStatus) => void>();

 constructor(url: string) {
  this.client = new TransportClient({ url, reconnect: true });

  // Subscribe to transport events
  this.client.on('envelope', (envelope: BridgeEnvelope) => {
   this.handleBridgeEnvelope(envelope);
  });

  this.client.on('error', (error: Error) => {
   this.errorHandlers.forEach(h => h(error));
  });

  this.client.on('statusChange', (status: ConnectionStatus) => {
   this.statusHandlers.forEach(h => h(status));
  });
 }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const unsubscribe = this.client.on('statusChange', (status: ConnectionStatus) => {
        if (status === 'connected') {
          unsubscribe();
          resolve();
        } else if (status === 'error') {
          unsubscribe();
          reject(new Error('Failed to connect'));
        }
      });
      this.client.connect();
    });
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }

  getStatus(): ConnectionStatus {
    return this.client.getStatus();
  }

  async sendRequest<T>(request: ACPRequest): Promise<ACPResponse<T>> {
    const id = this.requestId++;
    request.id = id;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }, 30000);

      this.pendingRequests.set(id, {
        resolve: (response: ACPResponse<T>) => {
          clearTimeout(timeout);
          resolve(response);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      this.client.send(JSON.stringify(request));
    });
  }

  sendNotification(notification: ACPNotification): void {
    this.client.send(JSON.stringify(notification));
  }

  onNotification(handler: (notification: ACPNotification) => void): () => void {
    this.notificationHandlers.add(handler);
    return () => this.notificationHandlers.delete(handler);
  }

  onError(handler: (error: Error) => void): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  onStatusChange(handler: (status: ConnectionStatus) => void): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  private handleBridgeEnvelope(envelope: BridgeEnvelope): void {
    // Extract ACP notification from bridge envelope
    if (envelope.type !== 'acp_payload') return;

    const payload = envelope.payload as unknown as ACPNotification | ACPResponse<unknown>;

    // Check if it's a response to a pending request
    if ('id' in payload && this.pendingRequests.has(payload.id)) {
      const { resolve } = this.pendingRequests.get(payload.id)!;
      this.pendingRequests.delete(payload.id);
      resolve(payload as ACPResponse<unknown>);
      return;
    }

    // Otherwise, it's a notification
    this.notificationHandlers.forEach(handler => handler(payload as ACPNotification));
  }

  sendResponse<T = unknown>(response: ACPResponse<T>): void {
    this.client.send(JSON.stringify(response));
  }
}
