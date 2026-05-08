import type { Transport, ConnectionStatus } from "../transport/transport-interface.js";
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
import { TerminalSubscriptionManager } from "../terminals/subscription-manager.js";
import type {
  TerminalCreateHandler,
  TerminalOutputHandler,
  TerminalWaitForExitHandler,
  TerminalKillHandler,
  TerminalReleaseHandler,
  TerminalSubscription,
  CreateTerminalRequest,
  TerminalOutputRequest,
  WaitForTerminalExitRequest,
  KillTerminalRequest,
  ReleaseTerminalRequest,
} from "../terminals/types.js";
import type { ACPNotification, ACPResponse, ClientCapabilities } from "../protocol/types.js";

export interface StartAgentConfig {
 command: string;
 args?: string[];
 cwd?: string;
 env?: Array<[string, string]>;
}

interface PendingRequest {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
};

export interface SessionControllerState {
  connectionStatus: ConnectionStatus;
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
 private transport: Transport;
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
 private terminalManager: TerminalSubscriptionManager;

 /**
  * Create a SessionController with a transport.
  * 
  * @param transport - Transport implementation
  * @param requestTimeoutMs - Request timeout in milliseconds (default: 30000)
  */
 constructor(transport: Transport, requestTimeoutMs = 30000) {
   this.requestTimeoutMs = requestTimeoutMs;
   this.transport = transport;
   
   this.state = {
     connectionStatus: "disconnected",
     sessionId: null,
     initialized: false,
     capabilities: null,
     configOptions: null,
   };
   this.fileSystemManager = new FileSystemSubscriptionManager();
   this.terminalManager = new TerminalSubscriptionManager();

   // Wire up transport event handlers using the proper interface methods
   this.transport.onStatusChange((status) => this.handleTransportStatus(status));
   this.transport.onNotification((notification) => this.handleNotification(notification));
   this.transport.onError((error) => this.handleError(error));
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

  /**
   * Set the sessionId externally (e.g. when the server auto-creates a session
   * and notifies the client via SessionInit). Emits statusChange so React
   * subscribers see the updated state.
   */
  setSessionId(sessionId: string, configOptions?: unknown[]): void {
    this.state.sessionId = sessionId;
    if (configOptions) {
      this.state.configOptions = configOptions as ConfigOption[];
      this.emitConfigOptionsChange(this.state.configOptions);
    }
    this.emitStatusChange();
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

  async initialize(options?: {
    clientInfo?: { name: string; version: string };
    clientCapabilities?: ClientCapabilities;
  }): Promise<unknown> {
    const clientCapabilities: ClientCapabilities = options?.clientCapabilities ?? {};
    const params = {
      protocolVersion: 1,
      clientCapabilities,
      ...(options?.clientInfo ? { clientInfo: options.clientInfo } : {}),
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

 private sendNotification(method: string, params: unknown): void {
  const notification: ACPNotification = { jsonrpc: "2.0", method, params };
  this.emitTraffic("out", notification);
  // Use the transport's sendNotification method
  this.transport.sendNotification(notification as never);
 }

  private sendResponse(id: number, result: unknown): void {
    const response: ACPResponse<unknown> = { jsonrpc: "2.0", id, result };
    this.emitTraffic("out", response);
    this.transport.sendResponse(response);
  }

  private async sendRequest(method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = this.nextRequestId++;
      const request = { jsonrpc: "2.0" as const, id, method, params };

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${id} (${method}) timed out`));
      }, this.requestTimeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      // Emit traffic for outgoing request
      this.emitTraffic("out", request);

      // Use the transport's sendRequest method
      this.transport.sendRequest(request as never)
      .then((response: ACPResponse<unknown>) => {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        if (response.error) {
          reject(new Error(response.error.message));
        } else {
          resolve(response.result);
        }
      })
      .catch((error: Error) => {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(error);
      });
    });
  }

    private handleTransportStatus(status: ConnectionStatus): void {
        this.state.connectionStatus = status;
        this.emitStatusChange();
    }

    private handleNotification(notification: ACPNotification): void {
        this.emitTraffic("in", notification);
        this.handleAcpPayload(notification);
    }

  public subscribeToFileReads(handler: FileReadHandler): FileSystemSubscription {
    return this.fileSystemManager.subscribeToFileReads(handler);
  }

  public subscribeToFileWrites(handler: FileWriteHandler): FileSystemSubscription {
    return this.fileSystemManager.subscribeToFileWrites(handler);
  }

  public subscribeToTerminalCreate(handler: TerminalCreateHandler): TerminalSubscription {
    return this.terminalManager.subscribeToCreate(handler);
  }

  public subscribeToTerminalOutput(handler: TerminalOutputHandler): TerminalSubscription {
    return this.terminalManager.subscribeToOutput(handler);
  }

  public subscribeToTerminalWaitForExit(handler: TerminalWaitForExitHandler): TerminalSubscription {
    return this.terminalManager.subscribeToWaitForExit(handler);
  }

  public subscribeToTerminalKill(handler: TerminalKillHandler): TerminalSubscription {
    return this.terminalManager.subscribeToKill(handler);
  }

  public subscribeToTerminalRelease(handler: TerminalReleaseHandler): TerminalSubscription {
    return this.terminalManager.subscribeToRelease(handler);
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
      } else if (obj.method === "terminal/create") {
        const requestId = obj.id as number | undefined;
        const params = obj.params as Record<string, unknown> | undefined;
        if (typeof requestId !== "number") {
          this.emitError(new Error("terminal/create: missing or invalid request id"));
          return;
        }
        if (!params || typeof params.command !== "string") {
          this.sendJsonRpcErrorResponse(requestId, { code: -32602, message: "Invalid params: command required" });
          return;
        }
        this.handleTerminalCreateRequest(requestId, params);
      } else if (obj.method === "terminal/output") {
        const requestId = obj.id as number | undefined;
        const params = obj.params as Record<string, unknown> | undefined;
        if (typeof requestId !== "number") {
          this.emitError(new Error("terminal/output: missing or invalid request id"));
          return;
        }
        if (!params || typeof params.sessionId !== "string" || typeof params.terminalId !== "string") {
          this.sendJsonRpcErrorResponse(requestId, { code: -32602, message: "Invalid params: sessionId and terminalId required" });
          return;
        }
        this.handleTerminalOutputRequest(requestId, params);
      } else if (obj.method === "terminal/wait_for_exit") {
        const requestId = obj.id as number | undefined;
        const params = obj.params as Record<string, unknown> | undefined;
        if (typeof requestId !== "number") {
          this.emitError(new Error("terminal/wait_for_exit: missing or invalid request id"));
          return;
        }
        if (!params || typeof params.sessionId !== "string" || typeof params.terminalId !== "string") {
          this.sendJsonRpcErrorResponse(requestId, { code: -32602, message: "Invalid params: sessionId and terminalId required" });
          return;
        }
        this.handleTerminalWaitForExitRequest(requestId, params);
      } else if (obj.method === "terminal/kill") {
        const requestId = obj.id as number | undefined;
        const params = obj.params as Record<string, unknown> | undefined;
        if (typeof requestId !== "number") {
          this.emitError(new Error("terminal/kill: missing or invalid request id"));
          return;
        }
        if (!params || typeof params.sessionId !== "string" || typeof params.terminalId !== "string") {
          this.sendJsonRpcErrorResponse(requestId, { code: -32602, message: "Invalid params: sessionId and terminalId required" });
          return;
        }
        this.handleTerminalKillRequest(requestId, params);
      } else if (obj.method === "terminal/release") {
        const requestId = obj.id as number | undefined;
        const params = obj.params as Record<string, unknown> | undefined;
        if (typeof requestId !== "number") {
          this.emitError(new Error("terminal/release: missing or invalid request id"));
          return;
        }
        if (!params || typeof params.sessionId !== "string" || typeof params.terminalId !== "string") {
          this.sendJsonRpcErrorResponse(requestId, { code: -32602, message: "Invalid params: sessionId and terminalId required" });
          return;
        }
        this.handleTerminalReleaseRequest(requestId, params);
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
    
    // Handle errors - emit error event even if there's no pending request
    if ("error" in obj && obj.error) {
      const err = obj.error as { message: string };
      this.emitError(new Error(err.message));
    }
    
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(obj.id);
  
      if (!("error" in obj && obj.error)) {
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

  /**
   * Generic helper for handling terminal JSON-RPC requests.
   * Executes handlers via Promise.allSettled, sends success or error response.
   */
  private async handleTerminalRequest<T>(
    requestId: number,
    request: T,
    handlers: Array<(request: T) => Promise<unknown>>,
    noHandlersMsg: string,
    failedMsg: string,
  ): Promise<void> {
    if (handlers.length === 0) {
      this.sendJsonRpcErrorResponse(requestId, { code: -32601, message: noHandlersMsg });
      return;
    }

    const results = await Promise.allSettled(handlers.map((h) => h(request)));
    const successful = results.find(
      (r) => r.status === "fulfilled" && r.value !== null,
    ) as PromiseFulfilledResult<unknown> | undefined;

    if (successful) {
      await this.sendJsonRpcResponse(requestId, successful.value);
    } else {
      this.sendJsonRpcErrorResponse(requestId, { code: -32000, message: failedMsg });
    }
  }

  private async handleTerminalCreateRequest(
    requestId: number,
    params: Record<string, unknown>,
  ): Promise<void> {
    // Validate command is non-empty
    const command = params.command as string;
    if (!command || command.trim() === "") {
      this.sendJsonRpcErrorResponse(requestId, {
        code: -32602,
        message: "Invalid params: command must be a non-empty string",
      });
      return;
    }

    // Validate cwd for path traversal
    if (typeof params.cwd === "string" && params.cwd.includes("..")) {
      this.sendJsonRpcErrorResponse(requestId, {
        code: -32602,
        message: "Invalid params: cwd must not contain '..' (path traversal)",
      });
      return;
    }

    // Validate env entries
    if (Array.isArray(params.env)) {
      for (const entry of params.env) {
        if (
          typeof entry !== "object" ||
          entry === null ||
          Array.isArray(entry) ||
          !("name" in entry) ||
          !("value" in entry) ||
          typeof (entry as Record<string, unknown>).name !== "string" ||
          typeof (entry as Record<string, unknown>).value !== "string"
        ) {
          this.sendJsonRpcErrorResponse(requestId, {
            code: -32602,
            message: "Invalid params: each env entry must be { name: string, value: string }",
          });
          return;
        }
      }
    }

    const request: CreateTerminalRequest = {
      command,
      sessionId: params.sessionId as string,
    };
    if (Array.isArray(params.args)) {
      request.args = params.args as string[];
    }
    if (typeof params.cwd === "string") {
      request.cwd = params.cwd;
    }
    if (Array.isArray(params.env)) {
      request.env = params.env as Array<{ name: string; value: string }>;
    }
    if (typeof params.outputByteLimit === "number") {
      request.outputByteLimit = params.outputByteLimit;
    }

    await this.handleTerminalRequest(
      requestId,
      request,
      this.terminalManager.getCreateHandlers(),
      "No terminal create handlers available",
      "Failed to create terminal",
    );
  }

  private async handleTerminalOutputRequest(
    requestId: number,
    params: Record<string, unknown>,
  ): Promise<void> {
    const request: TerminalOutputRequest = {
      sessionId: params.sessionId as string,
      terminalId: params.terminalId as string,
    };

    await this.handleTerminalRequest(
      requestId,
      request,
      this.terminalManager.getOutputHandlers(),
      "No terminal output handlers available",
      "Failed to get terminal output",
    );
  }

  private async handleTerminalWaitForExitRequest(
    requestId: number,
    params: Record<string, unknown>,
  ): Promise<void> {
    const request: WaitForTerminalExitRequest = {
      sessionId: params.sessionId as string,
      terminalId: params.terminalId as string,
    };

    await this.handleTerminalRequest(
      requestId,
      request,
      this.terminalManager.getWaitForExitHandlers(),
      "No terminal wait_for_exit handlers available",
      "Failed to wait for terminal exit",
    );
  }

  private async handleTerminalKillRequest(
    requestId: number,
    params: Record<string, unknown>,
  ): Promise<void> {
    const request: KillTerminalRequest = {
      sessionId: params.sessionId as string,
      terminalId: params.terminalId as string,
    };

    await this.handleTerminalRequest(
      requestId,
      request,
      this.terminalManager.getKillHandlers(),
      "No terminal kill handlers available",
      "Failed to kill terminal",
    );
  }

  private async handleTerminalReleaseRequest(
    requestId: number,
    params: Record<string, unknown>,
  ): Promise<void> {
    const request: ReleaseTerminalRequest = {
      sessionId: params.sessionId as string,
      terminalId: params.terminalId as string,
    };

    await this.handleTerminalRequest(
      requestId,
      request,
      this.terminalManager.getReleaseHandlers(),
      "No terminal release handlers available",
      "Failed to release terminal",
    );
  }

  private async sendJsonRpcErrorResponse(requestId: number, error: { code: number; message: string }): Promise<void> {
    const payload = {
      jsonrpc: "2.0" as const,
      id: requestId,
      error,
    };
    this.emitTraffic("out", payload);
    this.transport.sendRawResponse(payload);
  }

  private async sendJsonRpcResponse(requestId: number, result: unknown): Promise<void> {
    const payload = {
      jsonrpc: "2.0" as const,
      id: requestId,
      result,
    };
    this.emitTraffic("out", payload);
    this.transport.sendRawResponse(payload);
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
