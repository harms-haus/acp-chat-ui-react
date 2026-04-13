import type { BridgeEnvelope } from "../generated/index.js";
import { TransportClient } from "../transport/client.js";
import type { ConnectionStatus } from "../transport/client.js";
import type {
  SessionControllerState,
  PermissionRequestParams,
  PermissionOption,
} from "./controller.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single fake mode exposed by the replay controller. */
export interface ReplayMode {
  id: string;
  name: string;
  description?: string;
}

/** A single fake model exposed by the replay controller. */
export interface ReplayModel {
  id: string;
  name: string;
  description?: string;
  provider?: string;
}

/** Constructor options for {@link ReplayController}. */
export interface ReplayControllerOptions {
  /** WebSocket URL of the Rust bridge replay-v2 endpoint. */
  bridgeUrl: string;
  /** Fake modes to expose via {@link getState}. */
  modes?: ReplayMode[];
  /** Fake models to expose via {@link getState}. */
  models?: ReplayModel[];
  /** JSON-RPC request timeout in milliseconds (default 30 000). */
  requestTimeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

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

export interface ReplayControllerState extends SessionControllerState {
  modes: ReplayMode[];
  models: ReplayModel[];
}

type StatusHandler = (state: ReplayControllerState) => void;
type SessionUpdateHandler = (params: unknown) => void;
type TrafficHandler = (direction: "in" | "out", data: unknown) => void;
type ErrorHandler = (error: Error) => void;
type SessionClearingHandler = () => void;
type PermissionRequestHandler = (
  params: PermissionRequestParams & { requestId: number },
) => void;

// ---------------------------------------------------------------------------
// ReplayController
// ---------------------------------------------------------------------------

/**
 * A {@link SessionController}-compatible controller that drives the Rust bridge
 * in **replay-v2** mode over a WebSocket connection.
 *
 * The bridge replays a pre-recorded `.jsonl` session file, emitting
 * {@link BridgeEnvelope}s that this controller normalises into sessionUpdate
 * events consumed by the AcpStore.
 *
 * Fake modes and models are configurable so that the SettingsPanel can render
 * meaningful options even though there is no live agent.
 */
export class ReplayController {
  // -- transport ---------------------------------------------------------------
  private transport: TransportClient;
  private nextRequestId = 1;
  private pendingRequests = new Map<number, PendingRequest>();
  private requestTimeoutMs: number;

  // -- state -------------------------------------------------------------------
  private state: ReplayControllerState;

  // -- handler sets ------------------------------------------------------------
  private statusHandlers = new Set<StatusHandler>();
  private sessionUpdateHandlers = new Set<SessionUpdateHandler>();
  private trafficHandlers = new Set<TrafficHandler>();
  private errorHandlers = new Set<ErrorHandler>();
  private sessionClearingHandlers = new Set<SessionClearingHandler>();
  private permissionRequestHandlers = new Set<PermissionRequestHandler>();

  // ---------------------------------------------------------------------------
  // Construction
  // ---------------------------------------------------------------------------

  constructor(options: ReplayControllerOptions) {
    this.requestTimeoutMs = options.requestTimeoutMs ?? 30_000;
    this.transport = new TransportClient({
      url: options.bridgeUrl,
      reconnect: false,
    });

    this.state = {
      connectionStatus: "disconnected",
      bridgeStatus: "disconnected",
      sessionId: null,
      initialized: false,
      capabilities: null,
      configOptions: null,
      modes: options.modes ?? [
        { id: "replay", name: "Replay", description: "Replay a recorded session" },
      ],
      models: options.models ?? [
        { id: "replay-model", name: "Replay Model", description: "Simulated model from replay data", provider: "replay" },
      ],
    };

    // Wire transport events
    this.transport.on("statusChange", (status: ConnectionStatus) =>
      this.handleTransportStatus(status),
    );
    this.transport.on("envelope", (envelope: BridgeEnvelope) =>
      this.handleEnvelope(envelope),
    );
    this.transport.on("error", (error: Error) => this.handleError(error));
  }

  // ---------------------------------------------------------------------------
  // Public event subscription (mirrors SessionController signature)
  // ---------------------------------------------------------------------------

  on(event: "statusChange", handler: StatusHandler): () => void;
  on(event: "sessionUpdate", handler: SessionUpdateHandler): () => void;
  on(event: "traffic", handler: TrafficHandler): () => void;
  on(event: "error", handler: ErrorHandler): () => void;
  on(event: "sessionClearing", handler: SessionClearingHandler): () => void;
  on(
    event: "permissionRequest",
    handler: PermissionRequestHandler,
  ): () => void;
  on(
    event:
      | "statusChange"
      | "sessionUpdate"
      | "traffic"
      | "error"
      | "sessionClearing"
      | "permissionRequest",
    handler: unknown,
  ): () => void {
    switch (event) {
      case "statusChange":
        this.statusHandlers.add(handler as StatusHandler);
        return () => this.statusHandlers.delete(handler as StatusHandler);
      case "sessionUpdate":
        this.sessionUpdateHandlers.add(handler as SessionUpdateHandler);
        return () =>
          this.sessionUpdateHandlers.delete(handler as SessionUpdateHandler);
      case "traffic":
        this.trafficHandlers.add(handler as TrafficHandler);
        return () => this.trafficHandlers.delete(handler as TrafficHandler);
      case "error":
        this.errorHandlers.add(handler as ErrorHandler);
        return () => this.errorHandlers.delete(handler as ErrorHandler);
      case "sessionClearing":
        this.sessionClearingHandlers.add(handler as SessionClearingHandler);
        return () =>
          this.sessionClearingHandlers.delete(
            handler as SessionClearingHandler,
          );
      case "permissionRequest":
        this.permissionRequestHandlers.add(
          handler as PermissionRequestHandler,
        );
        return () =>
          this.permissionRequestHandlers.delete(
            handler as PermissionRequestHandler,
          );
    }
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  getState(): ReplayControllerState {
    return { ...this.state };
  }

  // ---------------------------------------------------------------------------
  // Connection lifecycle
  // ---------------------------------------------------------------------------

  /** Open the WebSocket to the bridge replay-v2 endpoint. */
  connect(): void {
    this.transport.connect();
  }

  /**
   * Initialize replay mode with script and session ID.
   * Must be called after connect() and before creating sessions.
   */
  async initReplay(script: string, sessionId: string, replaySpeed?: number): Promise<{ status: "success"; mode: "replay" | "live" }> {
    return this.transport.initReplay(script, sessionId, replaySpeed);
  }

  /** Close the WebSocket and reject all pending requests. */
  async disconnect(): Promise<void> {
    try {
      await this.transport.disconnect();
    } finally {
      this.rejectAllPending(new Error("Disconnected"));
    }
  }

  // ---------------------------------------------------------------------------
  // SessionController protocol
  // ---------------------------------------------------------------------------

  /** Send `initialize` JSON-RPC to the bridge. */
  async initialize(clientInfo?: {
    name: string;
    version: string;
  }): Promise<unknown> {
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

  /**
   * Send `session/new` with replay-specific params.
   *
   * The bridge expects `demoType` and an optional `sessionId` so that it can
   * look up the correct replay file.
   */
  async createSession(
    cwd: string,
    mcpServers: unknown[] = [],
    demoType?: string,
    sessionId?: string,
  ): Promise<unknown> {
    const params: Record<string, unknown> = { cwd, mcpServers };
    if (demoType !== undefined) params.demoType = demoType;
    if (sessionId !== undefined) params.sessionId = sessionId;

    const result = await this.sendRequest("session/new", params);
    const sessionResult = result as { sessionId: string };
    this.state.sessionId = sessionResult.sessionId;
    this.emitStatusChange();
    return result;
  }

  async listSessions(
    cursor?: string,
    cwd?: string,
  ): Promise<{
    sessions: Array<{
      sessionId: string;
      cwd: string;
      title?: string;
      updatedAt?: string;
      _meta?: unknown;
    }>;
    nextCursor?: string;
  }> {
    const params: Record<string, unknown> = {};
    if (cursor) params.cursor = cursor;
    if (cwd) params.cwd = cwd;
    const result = (await this.sendRequest(
      "session/list",
      params,
    )) as {
      sessions: Array<{
        sessionId: string;
        cwd: string;
        title?: string;
        updatedAt?: string;
        _meta?: unknown;
      }>;
      nextCursor?: string;
    };
    return result;
  }

  /**
   * Load a pre-existing session.
   *
   * In replay mode this loads session state from `session-data.json` and then
   * waits for the user to send a prompt.
   */
  async loadSession(
    sessionId: string,
    cwd: string,
    mcpServers?: unknown[],
  ): Promise<unknown> {
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

  /**
   * Send a user prompt.
   *
   * The bridge will respond with replay events streamed as BridgeEnvelope
   * messages. Those are picked up by {@link handleEnvelope} and emitted as
   * sessionUpdate events.
   */
  async sendPrompt(sessionId: string, prompt: string): Promise<void> {
    const promptBlocks = [{ type: "text", text: prompt }];
    await this.sendRequest("session/prompt", {
      sessionId,
      prompt: promptBlocks,
    });
  }

  /** Tell the bridge to stop streaming replay events. */
  async cancelPrompt(sessionId: string): Promise<void> {
    this.sendNotification("session/cancel", { sessionId });
  }

  /** Respond to a permission request from the bridge. */
  async respondToPermission(
    requestId: number,
    optionId: string,
  ): Promise<void> {
    this.sendResponse(requestId, { outcome: { outcome: "selected", optionId } });
  }

  /** Cancel a pending permission request (send deny response). */
  async cancelPermission(requestId: number): Promise<void> {
    this.sendResponse(requestId, { outcome: { outcome: "cancelled" } });
  }

  setReplaySpeed(speed: number): void {
    this.sendNotification("set_replay_speed", { replaySpeed: speed });
  }

  // ---------------------------------------------------------------------------
  // Private: emit helpers
  // ---------------------------------------------------------------------------

  private emitStatusChange(): void {
    const state = this.getState();
    this.statusHandlers.forEach((h) => {
      h(state);
    });
  }

  private emitSessionUpdate(params: unknown): void {
    this.sessionUpdateHandlers.forEach((h) => {
      h(params);
    });
  }

  private emitTraffic(direction: "in" | "out", data: unknown): void {
    this.trafficHandlers.forEach((h) => {
      h(direction, data);
    });
  }

  private emitError(error: Error): void {
    this.errorHandlers.forEach((h) => {
      h(error);
    });
  }

  private emitSessionClearing(): void {
    this.sessionClearingHandlers.forEach((h) => {
      h();
    });
  }

  private emitPermissionRequest(
    params: PermissionRequestParams,
    requestId: number,
  ): void {
    this.permissionRequestHandlers.forEach((h) => {
      h({ ...params, requestId });
    });
  }

  // ---------------------------------------------------------------------------
  // Private: JSON-RPC send helpers
  // ---------------------------------------------------------------------------

  private sendRequest(
    method: string,
    params: unknown,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = this.nextRequestId++;
      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        id,
        method,
        params,
      };

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

  private sendNotification(method: string, params: unknown): void {
    const notification: JsonRpcNotification = {
      jsonrpc: "2.0",
      method,
      params,
    };
    const json = JSON.stringify(notification);
    this.transport.send(json);
    this.emitTraffic("out", notification);
  }

  private sendResponse(id: number, result: unknown): void {
    const response: { jsonrpc: "2.0"; id: number; result: unknown } = {
      jsonrpc: "2.0",
      id,
      result,
    };
    const json = JSON.stringify(response);
    this.transport.send(json);
    this.emitTraffic("out", response);
  }

  // ---------------------------------------------------------------------------
  // Private: transport event handlers
  // ---------------------------------------------------------------------------

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

    if (envelope.type === "replay_metadata") {
      // Informational — no action needed beyond logging / traffic
      return;
    }

    if (envelope.type === "acp_payload") {
      this.handleAcpPayload(envelope.payload);
    }
  }

  // ---------------------------------------------------------------------------
  // Private: ACP payload handling (mirrors SessionController logic)
  // ---------------------------------------------------------------------------

  private handleAcpPayload(payload: unknown): void {
    const obj = payload as Record<string, unknown>;

    // Check for JSON-RPC notifications (method-based) first
    if ("method" in obj && typeof obj.method === "string") {
      // --- JSON-RPC notification: session/update ---
      if (obj.method === "session/update") {
        const params = obj.params as Record<string, unknown> | undefined;
        if (params && params.batched === true && Array.isArray(params.updates)) {
          const updates = params.updates as Record<string, unknown>[];
          for (const item of updates) {
            const itemParams = item.params as
              | Record<string, unknown>
              | undefined;
            if (
              itemParams &&
              typeof itemParams.update === "object" &&
              itemParams.update !== null
            ) {
              this.emitSessionUpdate({
                sessionId: itemParams.sessionId,
                update: itemParams.update,
              });
            } else if (typeof item.update === "object" && item.update !== null) {
              this.emitSessionUpdate({
                sessionId: item.sessionId,
                update: item.update,
              });
            }
          }
        } else {
          this.emitSessionUpdate(obj.params);
        }
        return;
      }

      // --- JSON-RPC notification: session/request_permission ---
      if (obj.method === "session/request_permission") {
        const params = obj.params as PermissionRequestParams | undefined;
        const requestId = obj.id as number | undefined;
        if (params && typeof requestId === "number") {
          this.emitPermissionRequest(params, requestId);
        }
        return;
      }
      
      // --- Permission request from replay stream (session/update with permission_request) ---
      if (obj.method === "session/update") {
        const params = obj.params as Record<string, unknown> | undefined;
        if (params && typeof params.update === "object" && params.update !== null) {
          const update = params.update as Record<string, unknown>;
          if (update.sessionUpdate === "permission_request" && update.status === "pending") {
            const permissionRequest = {
              sessionId: update.sessionId as string,
              toolCall: {
                toolCallId: update.toolCallId as string,
              },
              options: update.options as PermissionOption[],
              requestId: update.requestId as number,
            };
            this.emitPermissionRequest(permissionRequest, update.requestId as number);
          }
        }
        return;
      }
    }

    // --- JSON-RPC response (has numeric id) ---
    if ("id" in obj && typeof obj.id === "number") {
      const pending = this.pendingRequests.get(obj.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(obj.id);

        if ("error" in obj && obj.error) {
          const err = obj.error as { message: string };
          pending.reject(new Error(err.message));
        } else if (obj.result) {
          const result = obj.result as Record<string, unknown>;

          // Emit individual messages / thoughts from result batches
          if (Array.isArray(result.messages)) {
            for (const msg of result.messages) {
              this.emitSessionUpdate({
                sessionId: result.sessionId,
                update: msg,
              });
            }
          }
          if (Array.isArray(result.thoughts)) {
            for (const thought of result.thoughts) {
              this.emitSessionUpdate({
                sessionId: result.sessionId,
                update: thought,
              });
            }
          }

          pending.resolve(obj.result);
        } else {
          pending.resolve(obj.result);
        }
      }
      return;
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
