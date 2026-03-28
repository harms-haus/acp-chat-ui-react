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

export class TransportClient {
    private ws: WebSocket | null = null;
    private status: ConnectionStatus = "disconnected";
    private reconnectAttempts = 0;
    private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    private statusHandlers = new Set<StatusHandler>();
    private envelopeHandlers = new Set<EnvelopeHandler>();
    private errorHandlers = new Set<ErrorHandler>();

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

    disconnect(): void {
        this.clearReconnectTimeout();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.setStatus("disconnected");
    }

    send(data: string): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(data);
        }
    }

    getStatus(): ConnectionStatus {
        return this.status;
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
        const result = parseEnvelopeSafe(event.data as string);
        
        if (result instanceof BridgeVersionError) {
            this.emitError(result);
            return;
        }
        
        this.emitEnvelope(result);
    }

    private handleError(): void {
        this.emitError(new Error("WebSocket error"));
    }

    private handleClose(): void {
        this.ws = null;

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