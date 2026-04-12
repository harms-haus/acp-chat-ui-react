/**
 * Mock implementations for testing ACP Chat Core.
 *
 * This module provides mock implementations of TransportClient and SessionController
 * for testing purposes. These mocks support event emission and basic state management.
 */

import type { BridgeEnvelope } from '../generated/index.js';
import type { ConnectionStatus, TransportConfig } from '../transport/client.js';
import type { SessionControllerState, PermissionOption } from '../session/controller.js';

/**
 * Mock transport client for testing WebSocket connections.
 *
 * Simulates a TransportClient with event emission capabilities.
 */
export class MockTransportClient {
  public status: ConnectionStatus = 'disconnected';
  private handlers: {
    statusChange: Set<(status: ConnectionStatus) => void>;
    envelope: Set<(envelope: BridgeEnvelope) => void>;
    error: Set<(error: Error) => void>;
  } = {
    statusChange: new Set(),
    envelope: new Set(),
    error: new Set(),
  };

  constructor(public config: TransportConfig) {}

  /**
   * Register an event handler.
   * @returns Unsubscribe function
   */
  on(event: 'statusChange', handler: (status: ConnectionStatus) => void): () => void;
  on(event: 'envelope', handler: (envelope: BridgeEnvelope) => void): () => void;
  on(event: 'error', handler: (error: Error) => void): () => void;
  on(event: string, handler: unknown): () => void {
    switch (event) {
      case 'statusChange':
        this.handlers.statusChange.add(handler as (status: ConnectionStatus) => void);
        break;
      case 'envelope':
        this.handlers.envelope.add(handler as (envelope: BridgeEnvelope) => void);
        break;
      case 'error':
        this.handlers.error.add(handler as (error: Error) => void);
        break;
    }
    return () => {
      switch (event) {
        case 'statusChange':
          this.handlers.statusChange.delete(
            handler as (status: ConnectionStatus) => void
          );
          break;
        case 'envelope':
          this.handlers.envelope.delete(
            handler as (envelope: BridgeEnvelope) => void
          );
          break;
        case 'error':
          this.handlers.error.delete(handler as (error: Error) => void);
          break;
      }
    };
  }

  /**
   * Unregister an event handler.
   */
  off(event: 'statusChange', handler: (status: ConnectionStatus) => void): void;
  off(event: 'envelope', handler: (envelope: BridgeEnvelope) => void): void;
  off(event: 'error', handler: (error: Error) => void): void;
  off(event: string, handler: unknown): void {
    switch (event) {
      case 'statusChange':
        this.handlers.statusChange.delete(
          handler as (status: ConnectionStatus) => void
        );
        break;
      case 'envelope':
        this.handlers.envelope.delete(
          handler as (envelope: BridgeEnvelope) => void
        );
        break;
      case 'error':
        this.handlers.error.delete(handler as (error: Error) => void);
        break;
    }
  }

  /**
   * Simulate connection.
   */
  connect() {
    this.setStatus('connected');
  }

  /**
   * Simulate disconnection.
   */
  disconnect() {
    this.setStatus('disconnected');
  }

  /**
   * Simulate sending data (no-op for mock).
   */
  send(_data: string): void {
    // No-op for mock
  }

  /**
   * Update status and emit event.
   */
  setStatus(status: ConnectionStatus) {
    this.status = status;
    this.handlers.statusChange.forEach((h) => {
      h(status);
    });
  }

  /**
   * Emit a bridge envelope event.
   */
  emitEnvelope(envelope: BridgeEnvelope) {
    this.handlers.envelope.forEach((h) => {
      h(envelope);
    });
  }

  /**
   * Emit an error event.
   */
  emitError(error: Error) {
    this.handlers.error.forEach((h) => {
      h(error);
    });
  }
}

/**
 * Mock session controller for testing ACP session management.
 *
 * Simulates a SessionController with event emission capabilities.
 */
export class MockSessionController {
  public state: SessionControllerState = {
    connectionStatus: 'disconnected',
    bridgeStatus: 'disconnected',
    sessionId: null,
    initialized: false,
    capabilities: null,
  };

  private handlers: {
    statusChange: Set<(state: SessionControllerState) => void>;
    sessionUpdate: Set<(params: unknown) => void>;
    traffic: Set<(direction: 'in' | 'out', data: unknown) => void>;
    error: Set<(error: Error) => void>;
    sessionClearing: Set<() => void>;
    permissionRequest: Set<
      (params: {
        sessionId: string;
        toolCall: { toolCallId: string };
        options: PermissionOption[];
      }) => void
    >;
  } = {
    statusChange: new Set(),
    sessionUpdate: new Set(),
    traffic: new Set(),
    error: new Set(),
    sessionClearing: new Set(),
    permissionRequest: new Set(),
  };

  /**
   * Register an event handler.
   * @returns Unsubscribe function
   */
  on(event: 'statusChange', handler: (state: SessionControllerState) => void): () => void;
  on(event: 'sessionUpdate', handler: (params: unknown) => void): () => void;
  on(event: 'traffic', handler: (direction: 'in' | 'out', data: unknown) => void): () => void;
  on(event: 'error', handler: (error: Error) => void): () => void;
  on(event: 'sessionClearing', handler: () => void): () => void;
  on(event: 'permissionRequest', handler: (params: {
    sessionId: string;
    toolCall: { toolCallId: string };
    options: PermissionOption[];
  }) => void): () => void;
  on(event: string, handler: unknown): () => void {
    switch (event) {
      case 'statusChange':
        this.handlers.statusChange.add(handler as (state: SessionControllerState) => void);
        break;
      case 'sessionUpdate':
        this.handlers.sessionUpdate.add(handler as (params: unknown) => void);
        break;
      case 'traffic':
        this.handlers.traffic.add(handler as (direction: 'in' | 'out', data: unknown) => void);
        break;
      case 'error':
        this.handlers.error.add(handler as (error: Error) => void);
        break;
      case 'sessionClearing':
        this.handlers.sessionClearing.add(handler as () => void);
        break;
      case 'permissionRequest':
        this.handlers.permissionRequest.add(handler as (params: {
          sessionId: string;
          toolCall: { toolCallId: string };
          options: PermissionOption[];
        }) => void);
        break;
    }
    return () => {
      switch (event) {
        case 'statusChange':
          this.handlers.statusChange.delete(handler as (state: SessionControllerState) => void);
          break;
        case 'sessionUpdate':
          this.handlers.sessionUpdate.delete(handler as (params: unknown) => void);
          break;
        case 'traffic':
          this.handlers.traffic.delete(handler as (direction: 'in' | 'out', data: unknown) => void);
          break;
        case 'error':
          this.handlers.error.delete(handler as (error: Error) => void);
          break;
        case 'sessionClearing':
          this.handlers.sessionClearing.delete(handler as () => void);
          break;
        case 'permissionRequest':
          this.handlers.permissionRequest.delete(handler as (params: {
            sessionId: string;
            toolCall: { toolCallId: string };
            options: PermissionOption[];
          }) => void);
          break;
      }
    };
  }

  /**
   * Unregister an event handler.
   */
  off(event: 'statusChange', handler: (state: SessionControllerState) => void): void;
  off(event: 'sessionUpdate', handler: (params: unknown) => void): void;
  off(event: 'traffic', handler: (direction: 'in' | 'out', data: unknown) => void): void;
  off(event: 'error', handler: (error: Error) => void): void;
  off(event: 'sessionClearing', handler: () => void): void;
  off(event: 'permissionRequest', handler: (params: {
    sessionId: string;
    toolCall: { toolCallId: string };
    options: PermissionOption[];
  }) => void): void;
  off(event: string, handler: unknown): void {
    switch (event) {
      case 'statusChange':
        this.handlers.statusChange.delete(handler as (state: SessionControllerState) => void);
        break;
      case 'sessionUpdate':
        this.handlers.sessionUpdate.delete(handler as (params: unknown) => void);
        break;
      case 'traffic':
        this.handlers.traffic.delete(handler as (direction: 'in' | 'out', data: unknown) => void);
        break;
      case 'error':
        this.handlers.error.delete(handler as (error: Error) => void);
        break;
      case 'sessionClearing':
        this.handlers.sessionClearing.delete(handler as () => void);
        break;
      case 'permissionRequest':
        this.handlers.permissionRequest.delete(handler as (params: {
          sessionId: string;
          toolCall: { toolCallId: string };
          options: PermissionOption[];
        }) => void);
        break;
    }
  }

  /**
   * Simulate connection.
   */
  connect() {
    this.state.connectionStatus = 'connected';
    this.state.bridgeStatus = 'connected';
    this.emitStatus();
  }

  /**
   * Simulate disconnection.
   */
  disconnect() {
    this.state.connectionStatus = 'disconnected';
    this.state.bridgeStatus = 'disconnected';
    this.emitStatus();
  }

  /**
   * Get the current state.
   */
  getState(): SessionControllerState {
    return { ...this.state };
  }

  /**
   * Emit a status change event.
   */
  emitStatus() {
    this.handlers.statusChange.forEach((h) => {
      h(this.getState());
    });
  }

  /**
   * Emit a traffic event.
   */
  emitTraffic(direction: 'in' | 'out', data: unknown) {
    this.handlers.traffic.forEach((h) => {
      h(direction, data);
    });
  }

  /**
   * Emit a session update event.
   */
  emitSessionUpdate(params: unknown) {
    this.handlers.sessionUpdate.forEach((h) => {
      h(params);
    });
  }

  /**
   * Emit an error event.
   */
  emitError(error: Error) {
    this.handlers.error.forEach((h) => {
      h(error);
    });
  }

  /**
   * Emit a session clearing event.
   */
  emitSessionClearing() {
    this.handlers.sessionClearing.forEach((h) => {
      h();
    });
  }

  /**
   * Emit a permission request event.
   */
  emitPermissionRequest(params: {
    sessionId: string;
    toolCall: { toolCallId: string };
    options: PermissionOption[];
  }) {
    this.handlers.permissionRequest.forEach((h) => {
      h(params);
    });
  }
}

/**
 * Create a mock transport client with default configuration.
 */
export function createMockTransport(
  config?: Partial<TransportConfig>
): MockTransportClient {
  const transportConfig: TransportConfig = {
    url: config?.url ?? 'ws://localhost:8080/mock',
    ...(config?.reconnect !== undefined && { reconnect: config.reconnect }),
    ...(config?.maxReconnectAttempts !== undefined && {
      maxReconnectAttempts: config.maxReconnectAttempts,
    }),
    ...(config?.baseReconnectDelayMs !== undefined && {
      baseReconnectDelayMs: config.baseReconnectDelayMs,
    }),
    ...(config?.maxReconnectDelayMs !== undefined && {
      maxReconnectDelayMs: config.maxReconnectDelayMs,
    }),
  };
  return new MockTransportClient(transportConfig);
}

/**
 * Create a mock session controller with default state.
 */
export function createMockController(
  initialState?: Partial<SessionControllerState>
): MockSessionController {
  const controller = new MockSessionController();
  if (initialState) {
    controller.state = {
      ...controller.state,
      ...initialState,
    };
  }
  return controller;
}
