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
  private wsUrl: string;

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
  }

  /**
   * Connect to the WebSocket bridge.
   * This does NOT initiate replay - replay is controlled by the Rust controller.
   */
  connect(): void {
    if (this.transport) {
      return;
    }

    this.setState({ connectionStatus: 'connecting' });
    this.transport = new WsTransport(this.wsUrl);

    this.transport.onStatusChange((status: TransportStatus) => {
      const connectionStatus = this.mapTransportStatus(status);
      this.setState({ connectionStatus });
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
    const initRequest = {
      jsonrpc: '2.0' as const,
      id: 'init-1',
      method: 'initialize',
      params: {
        client_info: config,
        replay_data_path: replayDataPath,
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
      id: `config-${Date.now()}`,
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
      id: 'start-agent',
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
      id: `permission-${requestId}`,
      method: 'permission_response',
      params: { request_id: requestId, option_id: optionId },
    };

    await this.transport.sendRequest(permissionRequest);
  }

  private setState(partial: Partial<BridgeAdapterState>): void {
    const nextState = { ...this.state, ...partial };
    if (JSON.stringify(this.state) !== JSON.stringify(nextState)) {
      this.state = nextState;
      this.statusHandlers.forEach(handler => handler(this.state));
    }
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
