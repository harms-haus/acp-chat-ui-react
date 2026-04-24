/**
 * Mock implementations for testing ACP Chat Core.
 *
 * This module provides mock implementations of Transport and SessionController
 * for testing purposes. These mocks support event emission and basic state management.
 */

import type { Transport, ConnectionStatus } from '../transport/transport-interface.js';
import type { ACPRequest, ACPResponse, ACPNotification } from '../protocol/types.js';
import type { SessionControllerState, PermissionOption } from '../session/controller.js';

/**
 * Mock transport implementation for testing.
 * Implements the Transport interface with event emission capabilities.
 */
export class MockTransport implements Transport {
 public status: ConnectionStatus = 'disconnected';
 public lastSent: string | null = null;
 public lastRequestId: number | null = null;
 private statusHandlers = new Set<(status: ConnectionStatus) => void>();
 private notificationHandlers = new Set<(notification: ACPNotification) => void>();
 private errorHandlers = new Set<(error: Error) => void>();
 private requestHandler?: (request: ACPRequest) => Promise<unknown>;
 private responseHandlers = new Set<(response: ACPResponse<unknown>) => void>();

 constructor(handler?: (request: ACPRequest) => Promise<unknown>) {
  if (handler) {
   this.requestHandler = handler;
  }
 }

 connect(): Promise<void> {
  this.setStatus('connected');
  return Promise.resolve();
 }

 disconnect(): Promise<void> {
  this.setStatus('disconnected');
  return Promise.resolve();
 }

 getStatus(): ConnectionStatus {
  return this.status;
 }

 async sendRequest<T = unknown>(request: ACPRequest): Promise<ACPResponse<T>> {
  this.lastSent = JSON.stringify(request);
  if (request.id) {
   this.lastRequestId = typeof request.id === 'number' ? request.id : parseInt(request.id as string, 10);
  }
  if (this.requestHandler) {
   const result = await this.requestHandler(request);
   // If result is already an ACPResponse (has jsonrpc and id), return it as-is
   if (result && typeof result === 'object' && 'jsonrpc' in result && 'id' in result) {
    return result as ACPResponse<T>;
   }
   // Otherwise wrap it in a response
   return { jsonrpc: '2.0', id: request.id ?? 0, result: result as T } as ACPResponse<T>;
  }
  return { jsonrpc: '2.0', id: request.id ?? 0, result: {} as T };
 }

 sendNotification(notification: ACPNotification): void {
  this.lastSent = JSON.stringify(notification);
 }

 sendResponse<T = unknown>(response: ACPResponse<T>): void {
  this.lastSent = JSON.stringify(response);
  this.responseHandlers.forEach(h => h(response));
 }

 onNotification(handler: (notification: ACPNotification) => void): () => void {
  this.notificationHandlers.add(handler);
  return () => this.notificationHandlers.delete(handler);
 }

 onError(handler: (error: Error) => void): () => void {
  this.errorHandlers.add(handler);
  return () => this.errorHandlers.delete(handler);
 }

 onStatusChange(handler: (status: ConnectionStatus) => void): () => void {
  this.statusHandlers.add(handler);
  return () => this.statusHandlers.delete(handler);
 }

 setStatus(status: ConnectionStatus) {
  this.status = status;
  this.statusHandlers.forEach(h => h(status));
 }

 emitNotification(notification: ACPNotification) {
  this.notificationHandlers.forEach(h => h(notification));
 }

 emitError(error: Error) {
  this.errorHandlers.forEach(h => h(error));
 }
}

/**
 * Mock session controller for testing ACP session management.
 */
export class MockSessionController {
  public state: SessionControllerState = {
    connectionStatus: 'disconnected',
    sessionId: null,
    initialized: false,
    capabilities: null,
    configOptions: null,
  };

  private handlers: {
    statusChange: Set<(state: SessionControllerState) => void>;
    sessionUpdate: Set<(params: unknown) => void>;
    traffic: Set<(direction: 'in' | 'out', data: unknown) => void>;
    error: Set<(error: Error) => void>;
    sessionClearing: Set<() => void>;
    permissionRequest: Set<(params: { sessionId: string; toolCall: { toolCallId: string }; options: PermissionOption[] }) => void>;
  } = {
    statusChange: new Set(),
    sessionUpdate: new Set(),
    traffic: new Set(),
    error: new Set(),
    sessionClearing: new Set(),
    permissionRequest: new Set(),
  };

  on(event: 'statusChange', handler: (state: SessionControllerState) => void): () => void;
  on(event: 'sessionUpdate', handler: (params: unknown) => void): () => void;
  on(event: 'traffic', handler: (direction: 'in' | 'out', data: unknown) => void): () => void;
  on(event: 'error', handler: (error: Error) => void): () => void;
  on(event: 'sessionClearing', handler: () => void): () => void;
  on(event: 'permissionRequest', handler: (params: { sessionId: string; toolCall: { toolCallId: string }; options: PermissionOption[] }) => void): () => void;
  on(event: string, handler: unknown): () => void {
    switch (event) {
      case 'statusChange':
        this.handlers.statusChange.add(handler as (state: SessionControllerState) => void);
        return () => this.handlers.statusChange.delete(handler as (state: SessionControllerState) => void);
      case 'sessionUpdate':
        this.handlers.sessionUpdate.add(handler as (params: unknown) => void);
        return () => this.handlers.sessionUpdate.delete(handler as (params: unknown) => void);
      case 'traffic':
        this.handlers.traffic.add(handler as (direction: 'in' | 'out', data: unknown) => void);
        return () => this.handlers.traffic.delete(handler as (direction: 'in' | 'out', data: unknown) => void);
      case 'error':
        this.handlers.error.add(handler as (error: Error) => void);
        return () => this.handlers.error.delete(handler as (error: Error) => void);
      case 'sessionClearing':
        this.handlers.sessionClearing.add(handler as () => void);
        return () => this.handlers.sessionClearing.delete(handler as () => void);
      case 'permissionRequest':
        this.handlers.permissionRequest.add(handler as (params: { sessionId: string; toolCall: { toolCallId: string }; options: PermissionOption[] }) => void);
        return () => this.handlers.permissionRequest.delete(handler as (params: { sessionId: string; toolCall: { toolCallId: string }; options: PermissionOption[] }) => void);
      default:
        return () => {};
    }
  }

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
        this.handlers.permissionRequest.delete(handler as (params: { sessionId: string; toolCall: { toolCallId: string }; options: PermissionOption[] }) => void);
        break;
    }
  }

  connect() {
    this.state.connectionStatus = 'connected';
    this.emitStatus();
  }

  disconnect() {
    this.state.connectionStatus = 'disconnected';
    this.emitStatus();
  }

  getState(): SessionControllerState {
    return { ...this.state };
  }

  emitStatus() {
    this.handlers.statusChange.forEach((h) => h(this.getState()));
  }

  emitTraffic(direction: 'in' | 'out', data: unknown) {
    this.handlers.traffic.forEach((h) => h(direction, data));
  }

  emitSessionUpdate(params: unknown) {
    this.handlers.sessionUpdate.forEach((h) => h(params));
  }

  emitError(error: Error) {
    this.handlers.error.forEach((h) => h(error));
  }

  emitSessionClearing() {
    this.handlers.sessionClearing.forEach((h) => h());
  }

  emitPermissionRequest(params: { sessionId: string; toolCall: { toolCallId: string }; options: PermissionOption[] }) {
    this.handlers.permissionRequest.forEach((h) => h(params));
  }
}

export function createMockTransport(handler?: (request: ACPRequest) => Promise<ACPResponse<unknown>>): MockTransport {
  return new MockTransport(handler);
}

export function createMockController(initialState?: Partial<SessionControllerState>): MockSessionController {
  const controller = new MockSessionController();
  if (initialState) {
    controller.state = { ...controller.state, ...initialState };
  }
  return controller;
}
