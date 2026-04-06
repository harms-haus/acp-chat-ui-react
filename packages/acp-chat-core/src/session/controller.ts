import type { BridgeEnvelope } from "../generated/index.js";
import { TransportClient } from "../transport/client.js";
import type { ConnectionStatus, InitSuccess } from "../transport/client.js";

export interface StartAgentConfig {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Array<[string, string]>;
}

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

export interface PermissionOption {
  optionId: string;
  name: string;
  kind: "allow_once" | "allow_always" | "deny" | "deny_always";
}

export interface PermissionRequestParams {
  sessionId: string;
  toolCall: {
    toolCallId: string;
  };
  options: PermissionOption[];
}

type StatusHandler = (state: SessionControllerState) => void;
type SessionUpdateHandler = (params: unknown) => void;
type TrafficHandler = (direction: "in" | "out", data: unknown) => void;
type ErrorHandler = (error: Error) => void;
type SessionClearingHandler = () => void;
type PermissionRequestHandler = (params: PermissionRequestParams & { requestId: number }) => void;

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
  private sessionClearingHandlers = new Set<SessionClearingHandler>();
  private permissionRequestHandlers = new Set<PermissionRequestHandler>();

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
  on(event: "sessionClearing", handler: SessionClearingHandler): () => void;
  on(event: "permissionRequest", handler: PermissionRequestHandler): () => void;
  on(event: "statusChange" | "sessionUpdate" | "traffic" | "error" | "sessionClearing" | "permissionRequest", handler: unknown): () => void {
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
      case "sessionClearing":
        this.sessionClearingHandlers.add(handler as SessionClearingHandler);
        return () => this.sessionClearingHandlers.delete(handler as SessionClearingHandler);
      case "permissionRequest":
        this.permissionRequestHandlers.add(handler as PermissionRequestHandler);
        return () => this.permissionRequestHandlers.delete(handler as PermissionRequestHandler);
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

  private emitSessionClearing(): void {
    this.sessionClearingHandlers.forEach((h) => { h(); });
  }

  private emitPermissionRequest(params: PermissionRequestParams, requestId: number): void {
    this.permissionRequestHandlers.forEach((h) => { h({ ...params, requestId }); });
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
    // Emit clearing event before loading to allow state reset
    this.emitSessionClearing();
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

 async respondToPermission(requestId: number, optionId: string): Promise<void> {
 	this.sendResponse(requestId, { outcome: { outcome: "selected", optionId } });
 }

 async cancelPermission(requestId: number): Promise<void> {
 	this.sendResponse(requestId, { outcome: { outcome: "cancelled" } });
 }

  async startAgent(config: StartAgentConfig): Promise<void> {
    const envelope: BridgeEnvelope = {
      version: 1,
      seq: 0,
      timestamp_ms: Date.now(),
      type: "start_agent",
      command: config.command,
      args: config.args ?? [],
      cwd: config.cwd ?? null,
      env: config.env ?? [],
    };
    const json = JSON.stringify(envelope);
    this.transport.send(json);
    this.emitTraffic("out", envelope);
  }

  async initLive(command: string, args: string[], cwd: string): Promise<InitSuccess> {
    return this.transport.initLive(command, args, cwd);
  }

  private sendNotification(method: string, params: unknown): void {
    const notification: JsonRpcNotification = { jsonrpc: "2.0", method, params };
    const json = JSON.stringify(notification);
    this.transport.send(json);
    this.emitTraffic("out", notification);
  }

  private sendResponse(id: number, result: unknown): void {
    const response: { jsonrpc: "2.0"; id: number; result: unknown } = { jsonrpc: "2.0", id, result };
    const json = JSON.stringify(response);
    this.transport.send(json);
    this.emitTraffic("out", response);
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
    console.log("[SessionController] handleAcpPayload:", Object.keys(obj), "id:", obj.id, "method:", obj.method);
    if ("id" in obj && typeof obj.id === "number") {
      const pending = this.pendingRequests.get(obj.id);
      console.log("[SessionController] Found pending request:", pending ? "yes" : "no", "for id:", obj.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(obj.id);

        if ("error" in obj && obj.error) {
          const err = obj.error as { message: string };
          pending.reject(new Error(err.message));
        } else {
          if (obj.result) {
            const result = obj.result as Record<string, unknown>;
            console.log("[SessionController] Response result keys:", Object.keys(result));

            try {
              const w = globalThis as Record<string, unknown>;
              if (!w.__ACP_DEBUG) w.__ACP_DEBUG = { loads: [] as unknown[] };
              const debug = w.__ACP_DEBUG as { loads: unknown[] };
              debug.loads.push({
                timestamp: new Date().toISOString(),
                result: JSON.parse(JSON.stringify(result)),
              });
              console.log("[SessionController] Raw result dumped to window.__ACP_DEBUG.loads");
            } catch (e) {
              console.warn("[SessionController] Failed to dump debug result:", e);
            }

            if (Array.isArray(result.messages)) {
              console.log("[SessionController] result.messages count:", result.messages.length);
              if (result.messages.length > 0) {
                console.log("[SessionController] First message keys:", Object.keys(result.messages[0] as object));
                console.log("[SessionController] First message sample:", JSON.stringify(result.messages[0]).slice(0, 500));
              }
              for (const msg of result.messages) {
                console.log("[SessionController] Emitting message update, type:", (msg as Record<string, unknown>).type ?? (msg as Record<string, unknown>).sessionUpdate);
                this.emitSessionUpdate({ sessionId: result.sessionId, update: msg });
              }
            } else {
              console.log("[SessionController] result.messages is NOT an array:", typeof result.messages);
            }
            if (Array.isArray(result.thoughts)) {
              console.log("[SessionController] result.thoughts count:", result.thoughts.length);
              for (const thought of result.thoughts) {
                console.log("[SessionController] Emitting thought update, type:", (thought as Record<string, unknown>).type ?? (thought as Record<string, unknown>).sessionUpdate);
                this.emitSessionUpdate({ sessionId: result.sessionId, update: thought });
              }
            }
            if (!Array.isArray(result.messages) && !Array.isArray(result.thoughts)) {
              console.log("[SessionController] No messages or thoughts arrays found in result. Full result:", JSON.stringify(result).slice(0, 1000));
            }
          } else {
            console.log("[SessionController] Response has no result field");
          }
          pending.resolve(obj.result);
        }
      }
    } else if ("method" in obj && obj.method === "session/update") {
      const params = obj.params as Record<string, unknown> | undefined;
      if (params && params.batched === true && Array.isArray(params.updates)) {
        const updates = params.updates as Record<string, unknown>[];
        console.log("[SessionController] Batched session/update with", updates.length, "items");
        for (let i = 0; i < updates.length; i++) {
          const item = updates[i]!;
          const itemParams = item.params as Record<string, unknown> | undefined;
          if (itemParams && typeof itemParams.update === "object" && itemParams.update !== null) {
            console.log("[SessionController] Batched item", i, "type:", (itemParams.update as Record<string, unknown>).type ?? (itemParams.update as Record<string, unknown>).sessionUpdate);
            this.emitSessionUpdate({ sessionId: itemParams.sessionId, update: itemParams.update });
          } else if (typeof item.update === "object" && item.update !== null) {
            console.log("[SessionController] Batched item", i, "flat type:", (item.update as Record<string, unknown>).type ?? (item.update as Record<string, unknown>).sessionUpdate);
            this.emitSessionUpdate({ sessionId: item.sessionId, update: item.update });
          } else {
            console.log("[SessionController] Batched item", i, "unrecognized shape, keys:", Object.keys(item));
          }
        }
      } else {
        console.log("[SessionController] Non-batched session/update, update keys:", params?.update ? Object.keys(params.update as object) : "no update");
        this.emitSessionUpdate(obj.params);
      }
    } else if ("method" in obj && obj.method === "session/request_permission") {
      const params = obj.params as PermissionRequestParams | undefined;
      const requestId = obj.id as number | undefined;
      if (params && typeof requestId === "number") {
        this.emitPermissionRequest(params, requestId);
      }
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