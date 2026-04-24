/**
 * BridgeAdapter - Adapts WsTransport for harness UI consumption.
 * 
 * This adapter provides a controller-like interface that the harness UI
 * expects, but delegates all actual replay/session logic to the Rust
 * controller via the WebSocket bridge.
 * 
 * Key design principles:
 * - NO replay logic - replay is controlled by the Rust controller
 * - NO session management - sessions are managed by the Rust side
 * - Transport only - this is a thin adapter for UI integration
 */

import { WsTransport, type ConnectionStatus as TransportStatus } from '@harms-haus/acp-ws-bridge';

export interface BridgeAdapterState {
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  bridgeStatus: string;
  sessionId: string | null;
  initialized: boolean;
  capabilities: Record<string, unknown> | null;
}

export interface BridgeAdapterEvents {
  statusChange: (state: BridgeAdapterState) => void;
  error: (error: Error) => void;
  /**
   * Emitted when a session/update notification is received.
   * This mirrors SessionController.on("sessionUpdate", ...) for AcpStore compatibility.
   */
  sessionUpdate: (params: unknown) => void;
  /**
   * Emitted when a session/request_permission notification is received.
   */
  permissionRequest: (params: unknown, requestId: number) => void;
  /**
   * Emitted when a session is about to be loaded (before loadSession).
   * This mirrors SessionController.on("sessionClearing", ...) for AcpStore compatibility.
   */
  sessionClearing: () => void;
}

type EventHandler<T extends unknown[]> = (...args: T) => void;

export class BridgeAdapter {
  private transport: WsTransport | null = null;
  private state: BridgeAdapterState = {
    connectionStatus: 'disconnected',
    bridgeStatus: 'disconnected',
    sessionId: null,
    initialized: false,
    capabilities: null,
  };
  private statusHandlers = new Set<EventHandler<[BridgeAdapterState]>>();
  private errorHandlers = new Set<EventHandler<[Error]>>();
  private sessionUpdateHandlers = new Set<EventHandler<[unknown]>>();
  private permissionRequestHandlers = new Set<EventHandler<[unknown, number]>>();
  private sessionClearingHandlers = new Set<EventHandler<[]>>();
  private wsUrl: string;
  private nextRequestId = 0;

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
  }

  /**
   * Generate a unique request ID for JSON-RPC requests.
   * Uses a counter to ensure monotonic, collision-free IDs.
   */
  private generateRequestId(prefix: string): string {
    return `${prefix}-${++this.nextRequestId}`;
  }

  /**
   * Connect to the WebSocket bridge.
   * This does NOT initiate replay - replay is controlled by the Rust controller.
   */
  connect(): void {
    if (this.transport) {
      return;
    }

    this.setState({ connectionStatus: 'connecting', bridgeStatus: 'disconnected' });
    this.transport = new WsTransport(this.wsUrl);

    this.transport.onStatusChange((status: TransportStatus) => {
      const connectionStatus = this.mapTransportStatus(status);
      this.setState({ connectionStatus });
    });

    this.transport.onBridgeStatus?.((status) => {
      this.setState({ bridgeStatus: status });
    });

    this.transport.onNotification((notification) => {
      this.handleNotification(notification);
    });

    this.transport.onError((error: Error) => {
      this.errorHandlers.forEach(handler => handler(error));
    });

    this.transport.connect().catch(error => {
      this.errorHandlers.forEach(handler => handler(error));
    });
  }

  /**
   * Disconnect from the bridge.
   */
  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.disconnect();
      this.transport = null;
    }
    this.setState({ connectionStatus: 'disconnected', bridgeStatus: 'disconnected' });
  }

  /**
   * Get current state.
   */
  getState(): BridgeAdapterState {
    return { ...this.state };
  }

  /**
   * Subscribe to state changes.
   */
  on(event: 'statusChange', handler: EventHandler<[BridgeAdapterState]>): () => void;
  on(event: 'error', handler: EventHandler<[Error]>): () => void;
  on(event: 'sessionUpdate', handler: EventHandler<[unknown]>): () => void;
  on(event: 'permissionRequest', handler: EventHandler<[unknown, number]>): () => void;
  on(event: 'sessionClearing', handler: EventHandler<[]>): () => void;
  on(event: string, handler: unknown): () => void {
    if (event === 'statusChange') {
      const typedHandler = handler as EventHandler<[BridgeAdapterState]>;
      this.statusHandlers.add(typedHandler);
      return () => this.statusHandlers.delete(typedHandler);
    }
    if (event === 'error') {
      const typedHandler = handler as EventHandler<[Error]>;
      this.errorHandlers.add(typedHandler);
      return () => this.errorHandlers.delete(typedHandler);
    }
    if (event === 'sessionUpdate') {
      const typedHandler = handler as EventHandler<[unknown]>;
      this.sessionUpdateHandlers.add(typedHandler);
      return () => this.sessionUpdateHandlers.delete(typedHandler);
    }
    if (event === 'permissionRequest') {
      const typedHandler = handler as EventHandler<[unknown, number]>;
      this.permissionRequestHandlers.add(typedHandler);
      return () => this.permissionRequestHandlers.delete(typedHandler);
    }
    if (event === 'sessionClearing') {
      const typedHandler = handler as EventHandler<[]>;
      this.sessionClearingHandlers.add(typedHandler);
      return () => this.sessionClearingHandlers.delete(typedHandler);
    }
    return () => {};
  }

  /**
   * Initialize the session.
   * For replay mode, this tells the Rust controller to start replay.
   */
  async initialize(config: { name: string; version: string }, replayDataPath?: string): Promise<void> {
    if (!this.transport) {
      throw new Error('Not connected');
    }

    // Send initialization request via WebSocket
    // The Rust controller handles the actual replay logic
    // Rust expects: params._meta.replay.replayDataPath
    const initRequest = {
      jsonrpc: '2.0' as const,
      id: this.generateRequestId('init'),
      method: 'initialize',
      params: {
        client_info: config,
        _meta: replayDataPath ? {
          replay: {
            replayDataPath,
          },
        } : {},
      },
    };

    try {
      await this.transport.sendRequest(initRequest);
      this.setState({ initialized: true });
    } catch (error) {
      throw new Error(`Failed to initialize: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Set a configuration option.
   * For replay, this might include replay speed.
   */
  async setConfigOption(key: string, value: unknown): Promise<void> {
    if (!this.transport) {
      throw new Error('Not connected');
    }

    const configRequest = {
      jsonrpc: '2.0' as const,
      id: this.generateRequestId('config'),
      method: 'set_config',
      params: { key, value },
    };

    await this.transport.sendRequest(configRequest);
  }

  /**
   * Start an agent in live mode.
   */
  async startAgent(config: { command: string; args: string[]; cwd?: string }): Promise<void> {
    if (!this.transport) {
      throw new Error('Not connected');
    }

    const startRequest = {
      jsonrpc: '2.0' as const,
      id: this.generateRequestId('start-agent'),
      method: 'start_agent',
      params: config,
    };

    await this.transport.sendRequest(startRequest);
  }

  /**
   * Respond to a permission request.
   */
  async respondToPermission(requestId: number, optionId: string): Promise<void> {
    if (!this.transport) {
      throw new Error('Not connected');
    }

    const permissionRequest = {
      jsonrpc: '2.0' as const,
      id: this.generateRequestId('permission'),
      method: 'permission_response',
      params: { request_id: requestId, option_id: optionId },
    };

    await this.transport.sendRequest(permissionRequest);
  }

  /**
   * List available sessions from the replay manifest.
   * Calls ACP session/list method.
   *
   * @param cursor - Optional pagination cursor from previous listSessions call
   * @param cwd - Optional working directory to filter sessions
   * @returns Object containing sessions array and optional nextCursor for pagination
   * @throws Error if not connected or if parameters are invalid
   */
  async listSessions(cursor?: string, cwd?: string): Promise<{ sessions: Array<{ sessionId: string; cwd: string; title?: string; updatedAt?: string; _meta?: unknown }>; nextCursor?: string }> {
    if (!this.transport) {
      throw new Error('Not connected');
    }
    if (cursor !== undefined && cursor.trim() === '') {
      throw new Error('cursor must be a non-empty string if provided');
    }
    if (cwd !== undefined && cwd.trim() === '') {
      throw new Error('cwd must be a non-empty string if provided');
    }

    const params: Record<string, unknown> = {};
    if (cursor) params.cursor = cursor;
    if (cwd) params.cwd = cwd;

    const request = {
      jsonrpc: '2.0' as const,
      id: this.generateRequestId('session-list'),
      method: 'session/list',
      params,
    };

    const response = await this.transport.sendRequest(request);
    if (response.error) {
      throw new Error(response.error.message);
    }
    return response.result as { sessions: Array<{ sessionId: string; cwd: string; title?: string; updatedAt?: string; _meta?: unknown }>; nextCursor?: string };
  }

  /**
   * Load a session by ID.
   * Calls ACP session/load method.
   * The Rust server will start replay streaming after this.
   *
   * @param sessionId - The ID of the session to load (must be non-empty)
   * @param cwd - Working directory for the session (must be non-empty)
   * @param mcpServers - Optional MCP servers to include
   * @returns The result from the server
   * @throws Error if not connected or if parameters are invalid
   */
  async loadSession(sessionId: string, cwd: string, mcpServers?: unknown[]): Promise<unknown> {
    if (!this.transport) {
      throw new Error('Not connected');
    }
    if (typeof sessionId !== 'string' || sessionId.trim() === '') {
      throw new Error('sessionId must be a non-empty string');
    }
    if (typeof cwd !== 'string' || cwd.trim() === '') {
      throw new Error('cwd must be a non-empty string');
    }

    // Emit sessionClearing BEFORE sending the request (mirrors SessionController behavior)
    // This resets the AcpStore's normalized state for the new session
    this.sessionClearingHandlers.forEach(h => h());

    const request = {
      jsonrpc: '2.0' as const,
      id: this.generateRequestId('session-load'),
      method: 'session/load',
      params: { sessionId, cwd, mcpServers: mcpServers ?? [] },
    };

    const response = await this.transport.sendRequest(request);
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    // Update state with loaded session
    this.setState({ sessionId });
    
    return response.result;
  }

  /**
   * Handle incoming ACP notifications from the transport.
   * Dispatches to specific handlers based on method name.
   */
  private handleNotification(notification: { method?: string; params?: unknown; id?: number | string }): void {
    if (!notification.method) return;

    switch (notification.method) {
      case 'session/update':
        this.handleSessionUpdate(notification);
        break;
      case 'session/request_permission':
        this.handlePermissionRequest(notification);
        break;
    }
  }

  /**
   * Handle session/update notifications, including batched updates.
   */
  private handleSessionUpdate(notification: { params?: unknown }): void {
    const params = notification.params as Record<string, unknown> | undefined;
    if (params && params.batched === true && Array.isArray(params.updates)) {
      for (const item of params.updates) {
        if (typeof item !== 'object' || item === null) continue;
        const itemParams = (item as Record<string, unknown>).params as Record<string, unknown> | undefined;
        if (itemParams && typeof itemParams.update === 'object' && itemParams.update !== null) {
          this.sessionUpdateHandlers.forEach(h => h({ sessionId: itemParams.sessionId, update: itemParams.update }));
        } else if (typeof item.update === 'object' && item.update !== null) {
          this.sessionUpdateHandlers.forEach(h => h({ sessionId: (item as Record<string, unknown>).sessionId, update: item.update }));
        }
      }
    } else {
      this.sessionUpdateHandlers.forEach(h => h(params));
    }
  }

  /**
   * Handle session/request_permission notifications.
   */
  private handlePermissionRequest(notification: { params?: unknown; id?: number | string }): void {
    const params = notification.params as Record<string, unknown> | undefined;
    const requestId = (notification.id as number | undefined) ?? (params?.requestId as number | undefined) ?? 0;
    this.permissionRequestHandlers.forEach(h => h(params, requestId));
  }

  private setState(partial: Partial<BridgeAdapterState>): void {
    // Early return if no keys to update
    const keys = Object.keys(partial) as (keyof BridgeAdapterState)[];
    if (keys.length === 0) return;

    // Shallow comparison - check if any property actually changed
    const hasChanges = keys.some(key => this.state[key] !== partial[key]);
    if (!hasChanges) return;

    this.state = { ...this.state, ...partial };
    this.statusHandlers.forEach(handler => handler(this.state));
  }

  private mapTransportStatus(status: TransportStatus): BridgeAdapterState['connectionStatus'] {
    switch (status) {
      case 'connected':
        return 'connected';
      case 'connecting':
      case 'reconnecting':
        return 'connecting';
      case 'error':
        return 'error';
      case 'disconnected':
      default:
        return 'disconnected';
    }
  }
}
