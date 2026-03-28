import type { BridgeEnvelope } from "../generated/index.js";
import { TransportClient } from "../transport/client.js";
import type { ConnectionStatus } from "../transport/client.js";

interface JsonRpcRequest {
    jsonrpc: "2.0";
    id: number;
    method: string;
    params?: unknown;
}

interface JsonRpcNotification {
    jsonrpc: "2.0";
    method: string;
    params?: unknown;
}

type PendingRequest = {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
};

export interface SessionControllerState {
    connectionStatus: ConnectionStatus;
    bridgeStatus: string;
    sessionId: string | null;
    initialized: boolean;
    capabilities: unknown | null;
}

type StatusHandler = (state: SessionControllerState) => void;
type SessionUpdateHandler = (params: unknown) => void;
type TrafficHandler = (direction: "in" | "out", data: unknown) => void;
type ErrorHandler = (error: Error) => void;

export class SessionController {
    private transport: TransportClient;
    private nextRequestId = 1;
    private pendingRequests = new Map<number, PendingRequest>();
    private requestTimeoutMs: number;
    private state: SessionControllerState;
    private statusHandlers = new Set<StatusHandler>();
    private sessionUpdateHandlers = new Set<SessionUpdateHandler>();
    private trafficHandlers = new Set<TrafficHandler>();
    private errorHandlers = new Set<ErrorHandler>();

    constructor(bridgeUrl: string, requestTimeoutMs = 30000) {
        this.requestTimeoutMs = requestTimeoutMs;
        this.transport = new TransportClient({ url: bridgeUrl, reconnect: true });
        this.state = {
            connectionStatus: "disconnected",
            bridgeStatus: "disconnected",
            sessionId: null,
            initialized: false,
            capabilities: null,
        };

        this.transport.on("statusChange", (status: ConnectionStatus) => this.handleTransportStatus(status));
        this.transport.on("envelope", (envelope: BridgeEnvelope) => this.handleEnvelope(envelope));
        this.transport.on("error", (error: Error) => this.handleError(error));
    }

    on(event: "statusChange", handler: StatusHandler): () => void;
    on(event: "sessionUpdate", handler: SessionUpdateHandler): () => void;
    on(event: "traffic", handler: TrafficHandler): () => void;
    on(event: "error", handler: ErrorHandler): () => void;
    on(event: "statusChange" | "sessionUpdate" | "traffic" | "error", handler: unknown): () => void {
        switch (event) {
            case "statusChange":
                this.statusHandlers.add(handler as StatusHandler);
                return () => this.statusHandlers.delete(handler as StatusHandler);
            case "sessionUpdate":
                this.sessionUpdateHandlers.add(handler as SessionUpdateHandler);
                return () => this.sessionUpdateHandlers.delete(handler as SessionUpdateHandler);
            case "traffic":
                this.trafficHandlers.add(handler as TrafficHandler);
                return () => this.trafficHandlers.delete(handler as TrafficHandler);
            case "error":
                this.errorHandlers.add(handler as ErrorHandler);
                return () => this.errorHandlers.delete(handler as ErrorHandler);
        }
    }

    private emitStatusChange(): void {
        this.statusHandlers.forEach((h) => { h(this.getState()); });
    }

    private emitSessionUpdate(params: unknown): void {
        this.sessionUpdateHandlers.forEach((h) => { h(params); });
    }

    private emitTraffic(direction: "in" | "out", data: unknown): void {
        this.trafficHandlers.forEach((h) => { h(direction, data); });
    }

    private emitError(error: Error): void {
        this.errorHandlers.forEach((h) => { h(error); });
    }

    getState(): SessionControllerState {
        return { ...this.state };
    }

    connect(): void {
        this.transport.connect();
    }

    disconnect(): void {
        this.transport.disconnect();
        this.rejectAllPending(new Error("Disconnected"));
    }

    async initialize(clientInfo?: { name: string; version: string }): Promise<unknown> {
        const params = {
            protocolVersion: 1,
            clientCapabilities: {},
            ...(clientInfo ? { clientInfo } : {}),
        };
        const result = await this.sendRequest("initialize", params);
        this.state.initialized = true;
        this.state.capabilities = result;
        this.emitStatusChange();
        return result;
    }

  async createSession(cwd: string, mcpServers: unknown[] = []): Promise<unknown> {
    const result = await this.sendRequest("session/new", { cwd, mcpServers });
  const sessionResult = result as { sessionId: string };
  this.state.sessionId = sessionResult.sessionId;
  this.emitStatusChange();
  return result;
}

  async listSessions(cursor?: string, cwd?: string): Promise<{ sessions: Array<{ sessionId: string; cwd: string; title?: string; updatedAt?: string; _meta?: unknown }>; nextCursor?: string }> {
    const params: Record<string, unknown> = {};
    if (cursor) params.cursor = cursor;
    if (cwd) params.cwd = cwd;
    const result = await this.sendRequest("session/list", params) as { sessions: Array<{ sessionId: string; cwd: string; title?: string; updatedAt?: string; _meta?: unknown }>; nextCursor?: string };
    return result;
  }

    async loadSession(sessionId: string, cwd: string, mcpServers?: unknown[]): Promise<unknown> {
        const result = await this.sendRequest("session/load", {
            sessionId,
            cwd,
            mcpServers: mcpServers ?? [],
        });
        this.state.sessionId = sessionId;
        this.emitStatusChange();
        return result;
    }

  async sendPrompt(sessionId: string, prompt: string): Promise<void> {
    const promptBlocks = [{ type: "text", text: prompt }];
    await this.sendRequest("session/prompt", { sessionId, prompt: promptBlocks });
  }

async cancelPrompt(sessionId: string): Promise<void> {
	this.sendNotification("session/cancel", { sessionId });
}

private sendNotification(method: string, params: unknown): void {
	const notification: JsonRpcNotification = { jsonrpc: "2.0", method, params };
	const json = JSON.stringify(notification);
	this.transport.send(json);
	this.emitTraffic("out", notification);
}

    private sendRequest(method: string, params: unknown): Promise<unknown> {
        return new Promise((resolve, reject) => {
            const id = this.nextRequestId++;
            const request: JsonRpcRequest = { jsonrpc: "2.0", id, method, params };

            const timeout = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`Request ${id} (${method}) timed out`));
            }, this.requestTimeoutMs);

            this.pendingRequests.set(id, { resolve, reject, timeout });

            const json = JSON.stringify(request);
            this.transport.send(json);
            this.emitTraffic("out", request);
        });
    }

    private handleTransportStatus(status: ConnectionStatus): void {
        this.state.connectionStatus = status;
        this.emitStatusChange();
    }

    private handleEnvelope(envelope: BridgeEnvelope): void {
        this.emitTraffic("in", envelope);

        if (envelope.type === "bridge_status") {
            this.state.bridgeStatus = envelope.status;
            this.emitStatusChange();
            return;
        }

        if (envelope.type === "acp_payload") {
            this.handleAcpPayload(envelope.payload);
        }
    }

    private handleAcpPayload(payload: unknown): void {
        const obj = payload as Record<string, unknown>;
        if ("id" in obj && typeof obj.id === "number") {
            const pending = this.pendingRequests.get(obj.id);
            if (pending) {
                clearTimeout(pending.timeout);
                this.pendingRequests.delete(obj.id);

                if ("error" in obj && obj.error) {
                    const err = obj.error as { message: string };
                    pending.reject(new Error(err.message));
                } else {
                    pending.resolve(obj.result);
                }
            }
        } else if ("method" in obj && obj.method === "session/update") {
            this.emitSessionUpdate(obj.params);
        }
    }

    private handleError(error: Error): void {
        this.emitError(error);
    }

    private rejectAllPending(error: Error): void {
        for (const pending of this.pendingRequests.values()) {
            clearTimeout(pending.timeout);
            pending.reject(error);
        }
        this.pendingRequests.clear();
    }
}