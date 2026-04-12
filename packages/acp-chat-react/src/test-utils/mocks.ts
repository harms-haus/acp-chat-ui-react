/**
 * Mock implementations for ACP React testing.
 *
 * This module provides mock implementations and factory functions for creating
 * test instances of the ACP store and related components.
 */

import { AcpStore, createAcpStore } from '../store/index.js';
import type { SessionControllerState, PermissionOption } from '@harms-haus/acp-chat-core';

/**
 * Mock session controller for testing ACP session management.
 * This is a simplified version of the core's MockSessionController.
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
    permissionRequest: Set<(params: {
      sessionId: string;
      toolCall: { toolCallId: string };
      options: PermissionOption[];
    }) => void>;
  } = {
    statusChange: new Set(),
    sessionUpdate: new Set(),
    traffic: new Set(),
    error: new Set(),
    sessionClearing: new Set(),
    permissionRequest: new Set(),
  };

  on(event: any, handler: any): () => void {
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

  off(event: any, handler: any): void {
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

  connect() {
    this.state.connectionStatus = 'connected';
    this.state.bridgeStatus = 'connected';
    this.emitStatus();
  }

  disconnect() {
    this.state.connectionStatus = 'disconnected';
    this.state.bridgeStatus = 'disconnected';
    this.emitStatus();
  }

  getState(): SessionControllerState {
    return { ...this.state };
  }

  emitStatus() {
    this.handlers.statusChange.forEach((h) => {
      h(this.getState());
    });
  }

  emitSessionUpdate(params: {
    messages?: Array<{ role: string; content: string; contentBlocks?: unknown[]; id?: string; turnId?: string }>;
    thoughts?: Array<{ content: string; id?: string; turnId?: string }>;
    toolCalls?: Array<{ toolCallId: string; kind: string; title: string; status?: string }>;
    permissionRequests?: Array<{ requestId: number; sessionId: string; toolCallId: string; options: unknown[]; status: string }>;
  }) {
    // Convert normalized data to ACP protocol format
    if (params.messages) {
      for (const msg of params.messages) {
        const update = {
          type: msg.role === 'user' ? 'user_message' : 'agent_message_chunk',
          turnId: msg.turnId ?? `turn-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          role: msg.role,
          content: msg.contentBlocks ?? [{ type: 'text', text: msg.content }],
          status: 'done',
          timestamp: Date.now(),
        };
        this.handlers.sessionUpdate.forEach((h) => {
          h({ update });
        });
      }
    }

    if (params.thoughts) {
      for (const thought of params.thoughts) {
        const update = {
          type: 'agent_thought_chunk',
          turnId: thought.turnId ?? `turn-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          content: [{ type: 'text', text: thought.content }],
          status: 'done',
          timestamp: Date.now(),
        };
        this.handlers.sessionUpdate.forEach((h) => {
          h({ update });
        });
      }
    }

    if (params.toolCalls) {
      for (const toolCall of params.toolCalls) {
        const update = {
          type: 'tool_call',
          toolCallId: toolCall.toolCallId,
          kind: toolCall.kind,
          title: toolCall.title,
          status: toolCall.status ?? 'completed',
          timestamp: Date.now(),
        };
        this.handlers.sessionUpdate.forEach((h) => {
          h({ update });
        });
      }
    }

    if (params.permissionRequests) {
      for (const req of params.permissionRequests) {
        const update = {
          type: 'permission_request',
          requestId: req.requestId,
          sessionId: req.sessionId,
          toolCallId: req.toolCallId,
          options: req.options,
          status: req.status,
          timestamp: Date.now(),
        };
        this.handlers.sessionUpdate.forEach((h) => {
          h({ update });
        });
      }
    }
  }

  emitError(error: Error) {
    this.handlers.error.forEach((h) => {
      h(error);
    });
  }

  emitSessionClearing() {
    this.handlers.sessionClearing.forEach((h) => {
      h();
    });
  }

  emitPermissionRequest(params: {
    sessionId: string;
    toolCall: { toolCallId: string };
    options: PermissionOption[];
  }) {
    this.handlers.permissionRequest.forEach((h) => {
      h(params);
    });
  }

  emitTraffic(direction: 'in' | 'out', data: unknown) {
    this.handlers.traffic.forEach((h) => {
      h(direction, data);
    });
  }
}

/**
 * Configuration options for creating a mock store.
 */
export interface MockStoreConfig {
  /** Initial session state */
  sessionState?: Partial<SessionControllerState>;
  /** Store configuration options */
  storeConfig?: {
    /** Maximum time to wait before flushing React notifications (default: 0 for tests) */
    notificationCadenceMs?: number;
    /** Whether to enable notification batching (default: false for tests) */
    enableBatching?: boolean;
  };
}

/**
 * Create a mock ACP store with a mock session controller.
 *
 * @example
 * ```tsx
 * import { mockStore, customRender } from '@/test-utils';
 * import { MyComponent } from './MyComponent';
 *
 * test('renders with mock store', () => {
 *   const { store, controller } = mockStore({
 *     sessionState: { initialized: true, sessionId: 'test-123' }
 *   });
 *
 *   customRender(<MyComponent />, { sessionController: controller });
 * });
 * ```
 */
export function mockStore(config: MockStoreConfig = {}): {
  store: AcpStore;
  controller: MockSessionController;
} {
  const { sessionState, storeConfig } = config;

  const controller = new MockSessionController();

  if (sessionState) {
    controller.state = {
      ...controller.state,
      ...sessionState,
    };
  }

  const store = createAcpStore(controller as any, {
    notificationCadenceMs: storeConfig?.notificationCadenceMs ?? 0,
    enableBatching: storeConfig?.enableBatching ?? false,
  });

  return { store, controller };
}

/**
 * Create a mock chat core session controller.
 * This creates a MockSessionController with optional initial state.
 *
 * @example
 * ```tsx
 * import { mockChatCore } from '@/test-utils';
 *
 * test('uses mock controller', () => {
 *   const controller = mockChatCore({ initialized: true });
 *   expect(controller.getState().initialized).toBe(true);
 * });
 * ```
 */
export function mockChatCore(
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

/**
 * Create a mock ACP store (alias for mockStore).
 * Use this for semantic clarity in your tests.
 */
export function createMockAcpStore(config: MockStoreConfig = {}): {
  store: AcpStore;
  controller: MockSessionController;
} {
  return mockStore(config);
}
