import { describe, it, expect, vi } from 'vitest';

import {
  // Fixture loaders
  listFixtures,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  loadReplayFixture,
  loadReplayFixtureMetadata,
  // Mock implementations
  MockTransportClient,
  MockSessionController,
  createMockTransport,
  createMockController,
  // Factory functions
  createACPPayload,
  createACPPayloadResult,
  createACPPayloadError,
  createACPPayloadNotification,
  createBridgeEnvelope,
  createBridgeStatusEnvelope,
  createSessionUpdate,
  createSessionUpdateEnvelope,
  createInitializeResult,
  createCreateSessionResult,
  createPermissionRequestParams as _createPermissionRequestParams,
  createPermissionRequestEnvelope,
  createListSessionsResult,
  createLoadSessionResult,
  createBatchedSessionUpdatesEnvelope,
} from '../test-utils';

import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError,
  JsonRpcNotification,
  SessionUpdate,
} from '../test-utils';

describe('test-utils exports', () => {
  describe('fixture loaders', () => {
    it('listFixtures returns array of strings', () => {
      const fixtures = listFixtures();
      expect(Array.isArray(fixtures)).toBe(true);
      expect(fixtures.every((f) => typeof f === 'string')).toBe(true);
    });

    it('loadReplayFixtureMetadata returns valid session', () => {
      const fixtures = listFixtures();
      if (fixtures.length > 0) {
        const session = loadReplayFixtureMetadata(fixtures[0]!);
        expect(session).toBeDefined();
        expect(session.sessionId).toBeDefined();
        expect(Array.isArray(session.events)).toBe(true);
        expect(session.events).toHaveLength(0); // Metadata only, no events
      }
    });
  });

  describe('mock implementations', () => {
    it('createMockTransport creates MockTransportClient', () => {
      const transport = createMockTransport();
      expect(transport).toBeInstanceOf(MockTransportClient);
      expect(transport.status).toBe('disconnected');
    });

    it('createMockController creates MockSessionController', () => {
      const controller = createMockController();
      expect(controller).toBeInstanceOf(MockSessionController);
      const state = controller.getState();
      expect(state.sessionId).toBeNull();
    });

    it('MockTransportClient can emit events', () => {
      const transport = createMockTransport();
      const statusHandler = vi.fn();
      transport.on('statusChange', statusHandler);

      transport.setStatus('connected');
      expect(statusHandler).toHaveBeenCalledWith('connected');
    });

    it('MockSessionController can emit events', () => {
      const controller = createMockController();
      const sessionUpdateHandler = vi.fn();
      controller.on('sessionUpdate', sessionUpdateHandler);

      controller.emitSessionUpdate({
        sessionId: 'test',
        update: { type: 'message' },
      });
      expect(sessionUpdateHandler).toHaveBeenCalledWith({
        sessionId: 'test',
        update: { type: 'message' },
      });
    });
  });

  describe('factory functions', () => {
    it('createACPPayload creates valid JSON-RPC request', () => {
      const payload = createACPPayload({
        id: 1,
        method: 'test/method',
        params: { foo: 'bar' },
      });

      expect(payload.jsonrpc).toBe('2.0');
      expect(payload.id).toBe(1);
      expect(payload.method).toBe('test/method');
      expect(payload.params).toEqual({ foo: 'bar' });

      // Type check
      const _typeCheck: JsonRpcRequest = payload;
      expect(_typeCheck).toBeDefined();
    });

    it('createACPPayloadResult creates valid JSON-RPC response', () => {
      const payload = createACPPayloadResult({
        id: 1,
        result: { success: true },
      });

      expect(payload.jsonrpc).toBe('2.0');
      expect(payload.id).toBe(1);
      expect(payload.result).toEqual({ success: true });

      // Type check
      const _typeCheck: JsonRpcResponse = payload;
      expect(_typeCheck).toBeDefined();
    });

    it('createACPPayloadError creates valid JSON-RPC error', () => {
      const payload = createACPPayloadError({
        id: 1,
        code: -32603,
        message: 'Internal error',
      });

      expect(payload.jsonrpc).toBe('2.0');
      expect(payload.id).toBe(1);
      expect(payload.error.code).toBe(-32603);
      expect(payload.error.message).toBe('Internal error');

      // Type check
      const _typeCheck: JsonRpcError = payload;
      expect(_typeCheck).toBeDefined();
    });

    it('createACPPayloadNotification creates valid JSON-RPC notification', () => {
      const payload = createACPPayloadNotification({
        method: 'test/notification',
        params: { data: 'test' },
      });

      expect(payload.jsonrpc).toBe('2.0');
      expect(payload.method).toBe('test/notification');
      expect(payload.params).toEqual({ data: 'test' });

      // Type check
      const _typeCheck: JsonRpcNotification = payload;
      expect(_typeCheck).toBeDefined();
    });

    it('createBridgeEnvelope creates valid BridgeEnvelope', () => {
      const payload = createACPPayload({ id: 1, method: 'test' });
      const envelope = createBridgeEnvelope({
        seq: 5,
        timestamp_ms: 1234567890,
        payload,
      });

      expect(envelope.version).toBe(1);
      expect(envelope.seq).toBe(5);
      expect(envelope.timestamp_ms).toBe(1234567890);
      expect(envelope.type).toBe('acp_payload');
      if (envelope.type === 'acp_payload') {
        expect(envelope.payload).toEqual(payload);
      }
    });

    it('createBridgeStatusEnvelope creates valid status envelope', () => {
      const envelope = createBridgeStatusEnvelope({
        status: 'connected',
        seq: 1,
        timestamp_ms: 1234567890,
      });

      expect(envelope.version).toBe(1);
      expect(envelope.seq).toBe(1);
      expect(envelope.type).toBe('bridge_status');
      if (envelope.type === 'bridge_status') {
        expect(envelope.status).toBe('connected');
      }
    });

    it('createSessionUpdate creates valid session update', () => {
      const update = createSessionUpdate({
        sessionId: 'session-123',
        update: {
          type: 'message',
          id: 'msg-1',
          content: 'Hello',
        },
      });

      expect(update.sessionId).toBe('session-123');
      expect(update.update.type).toBe('message');
      expect(update.update.id).toBe('msg-1');
      expect(update.update.content).toBe('Hello');

      // Type check
      const _typeCheck: SessionUpdate = update;
      expect(_typeCheck).toBeDefined();
    });

    it('createSessionUpdateEnvelope creates valid envelope', () => {
      const envelope = createSessionUpdateEnvelope({
        sessionId: 'session-123',
        update: {
          type: 'message',
          id: 'msg-1',
        },
      });

      expect(envelope.type).toBe('acp_payload');
      if (envelope.type === 'acp_payload') {
        expect((envelope.payload as any).method).toBe('session/update');
      }
    });

    it('createInitializeResult creates valid result', () => {
      const result = createInitializeResult({
        capabilities: { maxTokens: 8192 },
        sessionId: 'init-session',
      });

      const resultData = result as { capabilities?: Record<string, unknown>; sessionId?: string };
      expect(resultData.capabilities).toEqual({ maxTokens: 8192 });
      expect(resultData.sessionId).toBe('init-session');
    });

    it('createCreateSessionResult creates valid result', () => {
      const result = createCreateSessionResult({
        sessionId: 'new-session',
      });

      const resultData = result as { sessionId?: string };
      expect(resultData.sessionId).toBe('new-session');
    });

    it('createPermissionRequestEnvelope creates valid envelope', () => {
      const envelope = createPermissionRequestEnvelope({
        requestId: 42,
        sessionId: 'session-123',
        toolName: 'read_file',
      });

      expect(envelope.type).toBe('acp_payload');
      if (envelope.type === 'acp_payload') {
        expect((envelope.payload as any).method).toBe('session/request_permission');
      }
    });

    it('createListSessionsResult creates valid result', () => {
      const result = createListSessionsResult({
        sessions: [
          {
            sessionId: 's1',
            cwd: '/test',
            title: 'Session 1',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
        nextCursor: 'cursor-1',
      });

      const resultData = result as { sessions?: unknown[]; nextCursor?: string | null };
      expect(Array.isArray(resultData.sessions)).toBe(true);
      expect(resultData.sessions).toHaveLength(1);
      expect(resultData.nextCursor).toBe('cursor-1');
    });

    it('createLoadSessionResult creates valid result', () => {
      const result = createLoadSessionResult({
        sessionId: 'loaded-id',
      });

      const resultData = result as { sessionId?: string };
      expect(resultData.sessionId).toBe('loaded-id');
    });

    it('createBatchedSessionUpdatesEnvelope creates valid envelope', () => {
      const envelope = createBatchedSessionUpdatesEnvelope({
        updates: [
          {
            sessionId: 's1',
            update: { type: 'message', id: 'm1' },
          },
          {
            sessionId: 's1',
            update: { type: 'message', id: 'm2' },
          },
        ],
      });

      expect(envelope.type).toBe('acp_payload');
      if (envelope.type === 'acp_payload') {
        const payload = envelope.payload as any;
        expect(payload.method).toBe('session/update');
        expect(payload.params.batched).toBe(true);
        expect(payload.params.updates).toHaveLength(2);
      }
    });
  });
});
