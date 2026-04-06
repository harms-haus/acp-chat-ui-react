import type { BridgeEnvelope } from "../generated/index.js";
import { parseEnvelopeSafe, BridgeVersionError } from "../bridge/index.js";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "error";

export interface TransportEvents {
    statusChange: (status: ConnectionStatus) => void;
    envelope: (envelope: BridgeEnvelope) => void;
    error: (error: Error) => void;
}

export interface TransportConfig {
    url: string;
    reconnect?: boolean;
    maxReconnectAttempts?: number;
    baseReconnectDelayMs?: number;
    maxReconnectDelayMs?: number;
}

type StatusHandler = (status: ConnectionStatus) => void;
type EnvelopeHandler = (envelope: BridgeEnvelope) => void;
type ErrorHandler = (error: Error) => void;

export interface InitSuccess {
    status: "success";
    mode: "replay" | "live";
}

export interface InitError {
    status: "error";
    message: string;
}

export interface DisconnectSuccess {
    status: "success";
}

export class TransportClient {
    private ws: WebSocket | null = null;
    private status: ConnectionStatus = "disconnected";
    private reconnectAttempts = 0;
    private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    private statusHandlers = new Set<StatusHandler>();
    private envelopeHandlers = new Set<EnvelopeHandler>();
    private errorHandlers = new Set<ErrorHandler>();
    private pendingInitResolves = new Map<string, (value: InitSuccess | InitError) => void>();

    constructor(private config: TransportConfig) {}

    on(event: "statusChange", handler: StatusHandler): () => void;
    on(event: "envelope", handler: EnvelopeHandler): () => void;
    on(event: "error", handler: ErrorHandler): () => void;
    on(event: keyof TransportEvents, handler: unknown): () => void {
        const handlers = this.getHandlers(event);
        handlers.add(handler as never);
        return () => handlers.delete(handler as never);
    }

    off(event: "statusChange", handler: StatusHandler): void;
    off(event: "envelope", handler: EnvelopeHandler): void;
    off(event: "error", handler: ErrorHandler): void;
    off(event: keyof TransportEvents, handler: unknown): void {
        this.getHandlers(event).delete(handler as never);
    }

    private getHandlers(event: keyof TransportEvents): Set<unknown> {
        switch (event) {
            case "statusChange": return this.statusHandlers as Set<unknown>;
            case "envelope": return this.envelopeHandlers as Set<unknown>;
            case "error": return this.errorHandlers as Set<unknown>;
        }
    }

    private emitStatusChange(status: ConnectionStatus): void {
        this.statusHandlers.forEach((h) => { h(status); });
    }

    private emitEnvelope(envelope: BridgeEnvelope): void {
        this.envelopeHandlers.forEach((h) => { h(envelope); });
    }

    private emitError(error: Error): void {
        this.errorHandlers.forEach((h) => { h(error); });
    }

    connect(): void {
        if (this.ws && (this.status === "connected" || this.status === "connecting")) {
            return;
        }

        this.setStatus("connecting");

        try {
            this.ws = new WebSocket(this.config.url);
            this.ws.onopen = () => this.handleOpen();
            this.ws.onmessage = (e: MessageEvent) => this.handleMessage(e);
            this.ws.onerror = () => this.handleError();
            this.ws.onclose = () => this.handleClose();
        } catch (error) {
            this.setStatus("error");
            this.emitError(error instanceof Error ? error : new Error(String(error)));
        }
    }

    async disconnect(): Promise<DisconnectSuccess> {
        return new Promise((resolve) => {
            this.clearReconnectTimeout();
            if (this.ws) {
                this.ws.close();
                this.ws = null;
            }
            this.setStatus("disconnected");
            resolve({status: "success"});
        });
    }

    send(data: string): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(data);
        }
    }

    getStatus(): ConnectionStatus {
        return this.status;
    }

    async initReplay(script: string, sessionId: string): Promise<InitSuccess> {
        return new Promise((resolve, reject) => {
            const initId = crypto.randomUUID();
            const payload = {
                type: "init",
                mode: "replay" as const,
                script,
                sessionId,
                initId
            };

            this.pendingInitResolves.set(initId, (response) => {
                if (response.status === "success") {
                    resolve(response);
                } else {
                    reject(new Error(response.message));
                }
            });

            this.send(JSON.stringify(payload));
        });
    }

    async initLive(command: string, args: string[], cwd: string): Promise<InitSuccess> {
        return new Promise((resolve, reject) => {
            const initId = crypto.randomUUID();
            const payload = {
                type: "init",
                mode: "live" as const,
                command,
                args,
                cwd,
                initId
            };

            this.pendingInitResolves.set(initId, (response) => {
                if (response.status === "success") {
                    resolve(response);
                } else {
                    reject(new Error(response.message));
                }
            });

            this.send(JSON.stringify(payload));
        });
    }

    private setStatus(status: ConnectionStatus): void {
        if (this.status !== status) {
            this.status = status;
            this.emitStatusChange(status);
        }
    }

    private handleOpen(): void {
        this.reconnectAttempts = 0;
        this.setStatus("connected");
    }

  private handleMessage(event: MessageEvent): void {
    try {
      console.log('[TransportClient] handleMessage called, data:', event.data);
      // First, check if this is an init response (not wrapped in BridgeEnvelope)
      const data = JSON.parse(event.data as string);
      console.log('[TransportClient] Parsed data:', data);

      // Handle init responses (success or error)
      if (data.type === "init" && data.initId && this.pendingInitResolves.has(data.initId)) {
        console.log('[TransportClient] This is an init response, resolving...');
        const resolve = this.pendingInitResolves.get(data.initId)!;
        this.pendingInitResolves.delete(data.initId);
        resolve(data);
        return;
      }

    // Handle error responses from server (e.g., "script not found", "live mode not enabled")
    if (data.error) {
      console.log('[TransportClient] Server error response:', data.error);
      
      // Clean up any pending init promise if this error includes an initId
      if (data.initId) {
        const resolve = this.pendingInitResolves.get(data.initId);
        if (resolve) {
          this.pendingInitResolves.delete(data.initId);
          resolve({ status: "error", message: data.error });
        }
      }
      
      this.emitError(new Error(data.error));
      return;
    }

      console.log('[TransportClient] Parsing as BridgeEnvelope...');
      // For all other messages, parse as BridgeEnvelope
      const result = parseEnvelopeSafe(event.data as string);

      if (result instanceof BridgeVersionError) {
        this.emitError(result);
        return;
      }

      this.emitEnvelope(result);
    } catch (error) {
      console.error('[TransportClient] Failed to parse message:', error);
      this.emitError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private handleError(): void {
    if (this.pendingInitResolves.size > 0) {
      for (const [, resolve] of this.pendingInitResolves) {
        resolve({ status: "error", message: "WebSocket error" });
      }
      this.pendingInitResolves.clear();
    }
    this.emitError(new Error("WebSocket error"));
  }

  private handleClose(): void {
    this.ws = null;

    if (this.pendingInitResolves.size > 0) {
      for (const [, resolve] of this.pendingInitResolves) {
        resolve({ status: "error", message: "WebSocket connection closed" });
      }
      this.pendingInitResolves.clear();
    }

    if (this.config.reconnect && this.reconnectAttempts < (this.config.maxReconnectAttempts ?? 10)) {
      this.setStatus("reconnecting");
      this.scheduleReconnect();
    } else {
      this.setStatus("disconnected");
    }
  }

    private scheduleReconnect(): void {
        this.reconnectAttempts++;
        const baseDelay = this.config.baseReconnectDelayMs ?? 1000;
        const maxDelay = this.config.maxReconnectDelayMs ?? 30000;
        const delay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts - 1), maxDelay);

        this.reconnectTimeout = setTimeout(() => {
            this.connect();
        }, delay);
    }

    private clearReconnectTimeout(): void {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
    }
}