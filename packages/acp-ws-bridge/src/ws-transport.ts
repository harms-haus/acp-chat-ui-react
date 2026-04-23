import type {
  Transport as CoreTransport,
  ConnectionStatus as CoreConnectionStatus,
  ACPRequest,
  ACPResponse,
  ACPNotification,
} from "@harms-haus/acp-chat-core";
import type {
  BridgeEnvelope,
} from "./generated/index.js";
import { parseEnvelopeSafe, BridgeVersionError } from "./bridge/index.js";
import { TransportClient } from "./client.js";

/**
 * WebSocket transport implementation for ACP.
 * Implements the core Transport interface while handling bridge envelope parsing.
 */
export class WsTransport implements CoreTransport {
  private client: TransportClient;
  private requestId = 0;
  private pendingRequests = new Map<string | number, { resolve: Function; reject: Function }>();
  private notificationHandlers = new Set<(notification: ACPNotification) => void>();
  private errorHandlers = new Set<(error: Error) => void>();
  private statusHandlers = new Set<(status: CoreConnectionStatus) => void>();

  constructor(url: string) {
    this.client = new TransportClient({ url, reconnect: true });

    // Subscribe to transport events
    const unsubscribeEnvelope = this.client.on('envelope', (envelope: BridgeEnvelope) => {
      this.handleBridgeEnvelope(envelope);
    });

    const unsubscribeError = this.client.on('error', (error: Error) => {
      this.errorHandlers.forEach(h => h(error));
    });

    const unsubscribeStatus = this.client.on('statusChange', (status: CoreConnectionStatus) => {
      this.statusHandlers.forEach(h => h(status));
    });
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const unsubscribe = this.client.on('statusChange', (status: CoreConnectionStatus) => {
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

  getStatus(): CoreConnectionStatus {
    return this.client.getStatus();
  }

  async sendRequest<T>(request: ACPRequest): Promise<ACPResponse<T>> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error('Request timeout'));
      }, 30000);

      this.pendingRequests.set(request.id, {
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

  onStatusChange(handler: (status: CoreConnectionStatus) => void): () => void {
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

  /**
   * Initialize replay mode.
   * @deprecated Use initReplay on harness-server instead (ws-bridge specific)
   */
  async initReplay(script: string, sessionId: string, replaySpeed?: number): Promise<{ status: 'success'; mode: 'replay' | 'live' }> {
    return this.client.initReplay(script, sessionId, replaySpeed);
  }

  /**
   * Initialize live mode.
   * @deprecated Use initLive on harness-server instead (ws-bridge specific)
   */
  async initLive(command: string, args: string[], cwd: string): Promise<{ status: 'success'; mode: 'replay' | 'live' }> {
    return this.client.initLive(command, args, cwd);
  }

  /**
   * Set replay speed.
   * @deprecated WebSocket specific - not standard ACP
   */
  setReplaySpeed(speed: number): void {
    this.client.setReplaySpeed(speed);
  }

  sendResponse<T = unknown>(response: ACPResponse<T>): void {
    this.client.send(JSON.stringify(response));
  }
}
