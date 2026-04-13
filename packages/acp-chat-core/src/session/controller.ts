import type { BridgeEnvelope } from "../generated/index.js";
import { TransportClient } from "../transport/client.js";
import type { ConnectionStatus, InitSuccess } from "../transport/client.js";
import { FileSystemSubscriptionManager } from "../filesystem/subscription-manager.js";
import type {
  FileReadRequest,
  FileReadResponse,
  FileWriteRequest,
  FileWriteResponse,
  FileReadHandler,
  FileWriteHandler,
  FileSystemSubscription,
} from "../filesystem/types.js";

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
  configOptions: ConfigOption[] | null;
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

export interface ConfigOptionValue {
  value: string;
  name: string;
  description?: string;
}

export interface ConfigOption {
  id: string;
  name: string;
  description?: string;
  category?: string;
  type: string;
  currentValue: string;
  options: ConfigOptionValue[];
}

type StatusHandler = (state: SessionControllerState) => void;
type SessionUpdateHandler = (params: unknown) => void;
type TrafficHandler = (direction: "in" | "out", data: unknown) => void;
type ErrorHandler = (error: Error) => void;
type SessionClearingHandler = () => void;
type PermissionRequestHandler = (params: PermissionRequestParams & { requestId: number }) => void;
type ConfigOptionsHandler = (configOptions: ConfigOption[]) => void;

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
  private configOptionsHandlers = new Set<ConfigOptionsHandler>();
  private fileSystemManager: FileSystemSubscriptionManager;

  constructor(bridgeUrl: string, requestTimeoutMs = 30000) {
    this.requestTimeoutMs = requestTimeoutMs;
    this.transport = new TransportClient({ url: bridgeUrl, reconnect: true });
    this.state = {
      connectionStatus: "disconnected",
      bridgeStatus: "disconnected",
      sessionId: null,
      initialized: false,
      capabilities: null,
      configOptions: null,
    };
    this.fileSystemManager = new FileSystemSubscriptionManager();

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
  on(event: "configOptionsChange", handler: ConfigOptionsHandler): () => void;
  on(event: "statusChange" | "sessionUpdate" | "traffic" | "error" | "sessionClearing" | "permissionRequest" | "configOptionsChange", handler: unknown): () => void {
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
      case "configOptionsChange":
        this.configOptionsHandlers.add(handler as ConfigOptionsHandler);
        return () => this.configOptionsHandlers.delete(handler as ConfigOptionsHandler);
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

  private emitConfigOptionsChange(configOptions: ConfigOption[]): void {
    this.configOptionsHandlers.forEach((h) => { h(configOptions); });
  }

  getState(): SessionControllerState {
    return { ...this.state };
  }

  getConfigOptions(): ConfigOption[] | null {
    return this.state.configOptions;
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

  async setConfigOption(sessionId: string, configId: string, value: string): Promise<ConfigOption[]> {
    const result = await this.sendRequest("session/set_config_option", {
      sessionId,
      configId,
      value,
    });
    
    if (result && typeof result === 'object' && 'configOptions' in result) {
      const configOptions = (result as { configOptions: ConfigOption[] }).configOptions;
      this.state.configOptions = configOptions;
      this.emitConfigOptionsChange(configOptions);
    }
    
    return Array.isArray(result) ? result as unknown as ConfigOption[] : [];
  }

  async createSession(cwd: string, mcpServers: unknown[] = []): Promise<unknown> {
    const result = await this.sendRequest("session/new", { cwd, mcpServers });
    const sessionResult = result as { sessionId: string; configOptions?: ConfigOption[]; modes?: unknown };
    this.state.sessionId = sessionResult.sessionId;
    
    if (sessionResult.configOptions) {
      this.state.configOptions = sessionResult.configOptions;
      this.emitConfigOptionsChange(sessionResult.configOptions);
    }
    
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
    this.emitSessionClearing();
    const result = await this.sendRequest("session/load", {
      sessionId,
      cwd,
      mcpServers: mcpServers ?? [],
    });
    this.state.sessionId = sessionId;
    
    const loadResult = result as { configOptions?: ConfigOption[]; modes?: unknown };
    if (loadResult.configOptions) {
      this.state.configOptions = loadResult.configOptions;
      this.emitConfigOptionsChange(loadResult.configOptions);
    }
    
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
    
    // Wait for WebSocket to be connected before sending
    if (this.transport.getStatus() !== "connected") {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Connection timeout")), 5000);
        const unsubscribe = this.transport.on("statusChange", (status) => {
          if (status === "connected") {
            clearTimeout(timeout);
            unsubscribe();
            resolve();
          } else if (status === "error") {
            clearTimeout(timeout);
            unsubscribe();
            reject(new Error("Connection failed"));
          }
        });
      });
    }
    
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

        // Validate envelope has required fields
        if (!envelope.type) {
            this.emitError(new Error("Invalid envelope: missing type field"));
            return;
        }

        if (envelope.type === "bridge_status") {
            this.state.bridgeStatus = envelope.status;
            this.emitStatusChange();
            return;
        }

        if (envelope.type === "acp_payload") {
            this.handleAcpPayload(envelope.payload);
    }
  }

  public subscribeToFileReads(handler: FileReadHandler): FileSystemSubscription {
    return this.fileSystemManager.subscribeToFileReads(handler);
  }

  public subscribeToFileWrites(handler: FileWriteHandler): FileSystemSubscription {
    return this.fileSystemManager.subscribeToFileWrites(handler);
  }

  private handleAcpPayload(payload: unknown): void {
    // Validate payload is a non-null object before casting
    if (payload === null || typeof payload !== 'object') {
      this.emitError(new Error("Invalid ACP payload: not an object"));
      return;
    }
    
    const obj = payload as Record<string, unknown>;
    
    // Validate envelope has required fields
    const hasValidStructure = 
      ("id" in obj && typeof obj.id === "number") ||
      ("method" in obj && typeof obj.method === "string");
    
    if (!hasValidStructure) {
      this.emitError(new Error("Invalid ACP payload: missing required fields (id or method)"));
      return;
    }
    
    // Check for JSON-RPC notifications (method-based) first
    if ("method" in obj && typeof obj.method === "string") {
      if (obj.method === "session/update") {
        const params = obj.params as Record<string, unknown> | undefined;
        if (params && params.batched === true && Array.isArray(params.updates)) {
          const updates = params.updates as Record<string, unknown>[];
          for (let i = 0; i < updates.length; i++) {
            const item = updates[i]!;
            const itemParams = item.params as Record<string, unknown> | undefined;
            if (itemParams && typeof itemParams.update === "object" && itemParams.update !== null) {
              this.emitSessionUpdate({ sessionId: itemParams.sessionId, update: itemParams.update });
            } else if (typeof item.update === "object" && item.update !== null) {
              this.emitSessionUpdate({ sessionId: item.sessionId, update: item.update });
            }
          }
        } else {
          this.emitSessionUpdate(obj.params);
        }
      } else if (obj.method === "session/request_permission") {
        const params = obj.params as PermissionRequestParams & { requestId?: number } | undefined;
        const requestId = (obj.id as number | undefined) ?? params?.requestId;
        if (params && typeof requestId === "number") {
          this.emitPermissionRequest(params, requestId);
        }
      } else if (obj.method === "fs/read_text_file") {
        const requestId = obj.id as number | undefined;
        const params = obj.params as Record<string, unknown> | undefined;
        if (typeof requestId !== "number") {
          this.emitError(new Error("fs/read_text_file: missing or invalid request id"));
          return;
        }
        if (!params || typeof params.path !== "string") {
          this.sendJsonRpcErrorResponse(requestId, { code: -32602, message: "Invalid params: path required" });
          return;
        }
        this.handleFileReadRequest(requestId, params.path, params.line, params.limit);
      } else if (obj.method === "fs/write_text_file") {
        const requestId = obj.id as number | undefined;
        const params = obj.params as Record<string, unknown> | undefined;
        if (typeof requestId !== "number") {
          this.emitError(new Error("fs/write_text_file: missing or invalid request id"));
          return;
        }
        if (!params || typeof params.path !== "string" || typeof params.content !== "string") {
          this.sendJsonRpcErrorResponse(requestId, { code: -32602, message: "Invalid params: path and content required" });
          return;
        }
        this.handleFileWriteRequest(requestId, params.path, params.content);
      }
      // Don't return - let JSON-RPC responses also be processed if they have both method and id
    }
    
    // Check for JSON-RPC responses (id-based)
    if ("id" in obj && typeof obj.id === "number") {
      const pending = this.pendingRequests.get(obj.id);
      
      // Emit session updates for result messages even if there's no pending request
      // (e.g., server-initiated results from replay/capture)
      if (obj.result) {
        const result = obj.result as Record<string, unknown>;

        if (Array.isArray(result.messages)) {
          for (const msg of result.messages) {
            this.emitSessionUpdate({ sessionId: result.sessionId, update: msg });
          }
        }
        if (Array.isArray(result.thoughts)) {
          for (const thought of result.thoughts) {
            this.emitSessionUpdate({ sessionId: result.sessionId, update: thought });
          }
        }
      }
      
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
    }
    }

  private validatePath(path: string): boolean {
    if (path.includes("..")) {
      return false;
    }
    if (path.startsWith("/")) {
      return false;
    }
    return true;
  }

  private async handleFileReadRequest(requestId: number, path: string, line?: unknown, limit?: unknown): Promise<void> {
    if (!this.validatePath(path)) {
      this.sendJsonRpcErrorResponse(requestId, { code: -32602, message: "Invalid path" });
      return;
    }

    const request: FileReadRequest = { path };
    if (typeof line === "number") {
      request.line = line;
    }
    if (typeof limit === "number") {
      request.limit = limit;
    }

    const handlers = this.fileSystemManager.getReadHandlers();
    if (handlers.length === 0) {
      this.sendJsonRpcErrorResponse(requestId, { code: -32601, message: "No file read handlers available" });
      return;
    }

    const results = await Promise.allSettled(handlers.map(h => h(request)));

    const successful = results.find(r => r.status === "fulfilled" && r.value !== null) as PromiseFulfilledResult<FileReadResponse> | undefined;

    if (successful) {
      await this.sendJsonRpcResponse(requestId, successful.value);
    } else {
      this.sendJsonRpcErrorResponse(requestId, { code: -32000, message: "Failed to read file" });
    }
  }

  private async handleFileWriteRequest(requestId: number, path: string, content: string): Promise<void> {
    if (!this.validatePath(path)) {
      this.sendJsonRpcErrorResponse(requestId, { code: -32602, message: "Invalid path" });
      return;
    }

    const request: FileWriteRequest = {
      path,
      content,
    };

    const handlers = this.fileSystemManager.getWriteHandlers();
    if (handlers.length === 0) {
      this.sendJsonRpcErrorResponse(requestId, { code: -32601, message: "No file write handlers available" });
      return;
    }

    const results = await Promise.allSettled(handlers.map(h => h(request)));

    const successful = results.find(r => r.status === "fulfilled" && r.value !== null) as PromiseFulfilledResult<FileWriteResponse> | undefined;

    if (successful) {
      await this.sendJsonRpcResponse(requestId, successful.value);
    } else {
      this.sendJsonRpcErrorResponse(requestId, { code: -32000, message: "Failed to write file" });
    }
  }

  private async sendJsonRpcErrorResponse(requestId: number, error: { code: number; message: string }): Promise<void> {
    const payload = {
      jsonrpc: "2.0" as const,
      id: requestId,
      error,
    };
    this.emitTraffic("out", payload);
    this.transport.send(JSON.stringify(payload));
  }

  private async sendJsonRpcResponse(requestId: number, result: FileReadResponse | FileWriteResponse): Promise<void> {
    const payload = {
      jsonrpc: "2.0" as const,
      id: requestId,
      result,
    };
    this.emitTraffic("out", payload);
    this.transport.send(JSON.stringify(payload));
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