/**
 * Comprehensive tests for mock implementations.
 *
 * This test file covers all mock classes and factory functions
 * in mocks.ts to ensure they work correctly for testing.
 */

import { describe, it, expect, vi } from "vitest";
import {
  MockTransportClient,
  MockSessionController,
  createMockTransport,
  createMockController,
} from '../mocks.js';
import type { BridgeEnvelope } from '../../generated/index.js';
import type { PermissionOption } from '../../session/controller.js';

describe("mocks", () => {
  describe("MockTransportClient", () => {
    describe("constructor and initialization", () => {
      it("initializes with provided config", () => {
        const config = {
          url: 'ws://test:8080',
          reconnect: true,
          maxReconnectAttempts: 5,
        };
        const transport = new MockTransportClient(config);
        
        expect(transport.config).toEqual(config);
        expect(transport.status).toBe('disconnected');
      });

      it("initializes with disconnected status by default", () => {
        const transport = new MockTransportClient({ url: 'ws://localhost' });
        expect(transport.status).toBe('disconnected');
      });
    });

    describe("event handling with on/off", () => {
      it("registers and calls statusChange handler", () => {
        const transport = new MockTransportClient({ url: 'ws://localhost' });
        const handler = vi.fn();
        
        transport.on('statusChange', handler);
        transport.setStatus('connected');
        
        expect(handler).toHaveBeenCalledWith('connected');
      });

      it("registers and calls envelope handler", () => {
        const transport = new MockTransportClient({ url: 'ws://localhost' });
        const handler = vi.fn();
        const envelope: BridgeEnvelope = {
          version: 1,
          seq: 1,
          timestamp_ms: Date.now(),
          type: 'bridge_status',
          status: 'connected',
        };
        
        transport.on('envelope', handler);
        transport.emitEnvelope(envelope);
        
        expect(handler).toHaveBeenCalledWith(envelope);
      });

      it("registers and calls error handler", () => {
        const transport = new MockTransportClient({ url: 'ws://localhost' });
        const handler = vi.fn();
        const error = new Error('Test error');
        
        transport.on('error', handler);
        transport.emitError(error);
        
        expect(handler).toHaveBeenCalledWith(error);
      });

      it("unregisters handler with off method", () => {
        const transport = new MockTransportClient({ url: 'ws://localhost' });
        const handler = vi.fn();
        
        transport.on('statusChange', handler);
        transport.off('statusChange', handler);
        transport.setStatus('connected');
        
        expect(handler).not.toHaveBeenCalled();
      });

      it("unregisters handler with unsubscribe function from on", () => {
        const transport = new MockTransportClient({ url: 'ws://localhost' });
        const handler = vi.fn();
        
        const unsubscribe = transport.on('statusChange', handler);
        unsubscribe();
        transport.setStatus('connected');
        
        expect(handler).not.toHaveBeenCalled();
      });

      it("supports multiple handlers for same event", () => {
        const transport = new MockTransportClient({ url: 'ws://localhost' });
        const handler1 = vi.fn();
        const handler2 = vi.fn();
        
        transport.on('statusChange', handler1);
        transport.on('statusChange', handler2);
        transport.setStatus('connected');
        
        expect(handler1).toHaveBeenCalledWith('connected');
        expect(handler2).toHaveBeenCalledWith('connected');
      });

      it("only removes specific handler with off", () => {
        const transport = new MockTransportClient({ url: 'ws://localhost' });
        const handler1 = vi.fn();
        const handler2 = vi.fn();
        
        transport.on('statusChange', handler1);
        transport.on('statusChange', handler2);
        transport.off('statusChange', handler1);
        transport.setStatus('connected');
        
        expect(handler1).not.toHaveBeenCalled();
        expect(handler2).toHaveBeenCalledWith('connected');
      });
    });

    describe("connection simulation", () => {
      it("connect method sets status to connected", () => {
        const transport = new MockTransportClient({ url: 'ws://localhost' });
        
        transport.connect();
        
        expect(transport.status).toBe('connected');
      });

      it("connect emits statusChange event", () => {
        const transport = new MockTransportClient({ url: 'ws://localhost' });
        const handler = vi.fn();
        
        transport.on('statusChange', handler);
        transport.connect();
        
        expect(handler).toHaveBeenCalledWith('connected');
      });

      it("disconnect method sets status to disconnected", () => {
        const transport = new MockTransportClient({ url: 'ws://localhost' });
        transport.connect();
        
        transport.disconnect();
        
        expect(transport.status).toBe('disconnected');
      });

      it("disconnect emits statusChange event", () => {
        const transport = new MockTransportClient({ url: 'ws://localhost' });
        transport.connect();
        const handler = vi.fn();
        
        transport.on('statusChange', handler);
        transport.disconnect();
        
        expect(handler).toHaveBeenCalledWith('disconnected');
      });

      it("send method is no-op", () => {
        const transport = new MockTransportClient({ url: 'ws://localhost' });
        
        expect(() => transport.send('test data')).not.toThrow();
      });
    });

    describe("setStatus method", () => {
      it("updates status and emits event", () => {
        const transport = new MockTransportClient({ url: 'ws://localhost' });
        const handler = vi.fn();
        
        transport.on('statusChange', handler);
        transport.setStatus('connecting');
        
        expect(transport.status).toBe('connecting');
        expect(handler).toHaveBeenCalledWith('connecting');
      });

      it("emits even when status unchanged", () => {
        const transport = new MockTransportClient({ url: 'ws://localhost' });
        const handler = vi.fn();
        
        transport.on('statusChange', handler);
        transport.setStatus('disconnected');
        
        expect(handler).toHaveBeenCalledWith('disconnected');
      });

      it("supports all status values", () => {
        const transport = new MockTransportClient({ url: 'ws://localhost' });
        const handler = vi.fn();
        
        transport.on('statusChange', handler);
        
        transport.setStatus('connecting');
        transport.setStatus('connected');
        transport.setStatus('reconnecting');
        transport.setStatus('error');
        transport.setStatus('disconnected');
        
        expect(handler).toHaveBeenCalledTimes(5);
        expect(handler).toHaveBeenLastCalledWith('disconnected');
      });
    });

    describe("emitEnvelope method", () => {
      it("emits envelope to all registered handlers", () => {
        const transport = new MockTransportClient({ url: 'ws://localhost' });
        const handler1 = vi.fn();
        const handler2 = vi.fn();
        const envelope: BridgeEnvelope = {
          version: 1,
          seq: 1,
          timestamp_ms: Date.now(),
          type: 'bridge_status',
          status: 'connected',
        };
        
        transport.on('envelope', handler1);
        transport.on('envelope', handler2);
        transport.emitEnvelope(envelope);
        
        expect(handler1).toHaveBeenCalledWith(envelope);
        expect(handler2).toHaveBeenCalledWith(envelope);
      });

      it("does nothing when no handlers registered", () => {
        const transport = new MockTransportClient({ url: 'ws://localhost' });
        
        expect(() => transport.emitEnvelope({
          version: 1,
          seq: 1,
          timestamp_ms: Date.now(),
          type: 'bridge_status',
          status: 'connected',
        })).not.toThrow();
      });
    });

    describe("emitError method", () => {
      it("emits error to all registered handlers", () => {
        const transport = new MockTransportClient({ url: 'ws://localhost' });
        const handler1 = vi.fn();
        const handler2 = vi.fn();
        const error = new Error('Test error');
        
        transport.on('error', handler1);
        transport.on('error', handler2);
        transport.emitError(error);
        
        expect(handler1).toHaveBeenCalledWith(error);
        expect(handler2).toHaveBeenCalledWith(error);
      });

      it("can emit different errors", () => {
        const transport = new MockTransportClient({ url: 'ws://localhost' });
        const handler = vi.fn();
        
        transport.on('error', handler);
        transport.emitError(new Error('Error 1'));
        transport.emitError(new Error('Error 2'));
        
        expect(handler).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe("MockSessionController", () => {
    describe("constructor and initialization", () => {
      it("initializes with default state", () => {
        const controller = new MockSessionController();
        
        expect(controller.state).toEqual({
          connectionStatus: 'disconnected',
          bridgeStatus: 'disconnected',
          sessionId: null,
          initialized: false,
          capabilities: null,
        });
      });
    });

    describe("event handling with on/off", () => {
      it("registers and calls statusChange handler", () => {
        const controller = new MockSessionController();
        const handler = vi.fn();
        
        controller.on('statusChange', handler);
        controller.emitStatus();
        
        expect(handler).toHaveBeenCalledWith(controller.getState());
      });

      it("registers and calls sessionUpdate handler", () => {
        const controller = new MockSessionController();
        const handler = vi.fn();
        const params = { sessionId: 'test', update: { type: 'message' } };
        
        controller.on('sessionUpdate', handler);
        controller.emitSessionUpdate(params);
        
        expect(handler).toHaveBeenCalledWith(params);
      });

      it("registers and calls traffic handler", () => {
        const controller = new MockSessionController();
        const handler = vi.fn();
        
        controller.on('traffic', handler);
        controller.emitTraffic('in', { data: 'test' });
        
        expect(handler).toHaveBeenCalledWith('in', { data: 'test' });
      });

      it("registers and calls error handler", () => {
        const controller = new MockSessionController();
        const handler = vi.fn();
        const error = new Error('Test error');
        
        controller.on('error', handler);
        controller.emitError(error);
        
        expect(handler).toHaveBeenCalledWith(error);
      });

      it("registers and calls sessionClearing handler", () => {
        const controller = new MockSessionController();
        const handler = vi.fn();
        
        controller.on('sessionClearing', handler);
        controller.emitSessionClearing();
        
        expect(handler).toHaveBeenCalled();
      });

      it("registers and calls permissionRequest handler", () => {
        const controller = new MockSessionController();
        const handler = vi.fn();
        const params = {
          sessionId: 'test',
          toolCall: { toolCallId: 'call-1' },
          options: [{ optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' } as PermissionOption],
        };
        
        controller.on('permissionRequest', handler);
        controller.emitPermissionRequest(params);
        
        expect(handler).toHaveBeenCalledWith(params);
      });

      it("unregisters handler with off method", () => {
        const controller = new MockSessionController();
        const handler = vi.fn();
        
        controller.on('statusChange', handler);
        controller.off('statusChange', handler);
        controller.emitStatus();
        
        expect(handler).not.toHaveBeenCalled();
      });

      it("unregisters handler with unsubscribe function", () => {
        const controller = new MockSessionController();
        const handler = vi.fn();
        
        const unsubscribe = controller.on('statusChange', handler);
        unsubscribe();
        controller.emitStatus();
        
        expect(handler).not.toHaveBeenCalled();
      });
    });

    describe("connection simulation", () => {
      it("connect method updates state to connected", () => {
        const controller = new MockSessionController();
        
        controller.connect();
        
        expect(controller.state.connectionStatus).toBe('connected');
        expect(controller.state.bridgeStatus).toBe('connected');
      });

      it("connect emits statusChange event", () => {
        const controller = new MockSessionController();
        const handler = vi.fn();
        
        controller.on('statusChange', handler);
        controller.connect();
        
        expect(handler).toHaveBeenCalled();
      });

      it("disconnect method updates state to disconnected", () => {
        const controller = new MockSessionController();
        controller.connect();
        
        controller.disconnect();
        
        expect(controller.state.connectionStatus).toBe('disconnected');
        expect(controller.state.bridgeStatus).toBe('disconnected');
      });

      it("disconnect emits statusChange event", () => {
        const controller = new MockSessionController();
        controller.connect();
        const handler = vi.fn();
        
        controller.on('statusChange', handler);
        controller.disconnect();
        
        expect(handler).toHaveBeenCalled();
      });
    });

    describe("getState method", () => {
      it("returns a copy of the state", () => {
        const controller = new MockSessionController();
        
        const state1 = controller.getState();
        const state2 = controller.getState();
        
        expect(state1).toEqual(state2);
        expect(state1).not.toBe(state2);
      });

      it("reflects changes to state", () => {
        const controller = new MockSessionController();
        controller.connect();
        
        const state = controller.getState();
        
        expect(state.connectionStatus).toBe('connected');
      });
    });

    describe("emitStatus method", () => {
      it("emits current state to handlers", () => {
        const controller = new MockSessionController();
        const handler = vi.fn();
        
        controller.on('statusChange', handler);
        controller.emitStatus();
        
        expect(handler).toHaveBeenCalledWith(controller.getState());
      });

      it("does not require handlers to be registered", () => {
        const controller = new MockSessionController();
        
        expect(() => controller.emitStatus()).not.toThrow();
      });
    });

    describe("emitTraffic method", () => {
      it("emits traffic events with direction and data", () => {
        const controller = new MockSessionController();
        const handler = vi.fn();
        
        controller.on('traffic', handler);
        controller.emitTraffic('out', { message: 'test' });
        
        expect(handler).toHaveBeenCalledWith('out', { message: 'test' });
      });

      it("supports both in and out directions", () => {
        const controller = new MockSessionController();
        const handler = vi.fn();
        
        controller.on('traffic', handler);
        controller.emitTraffic('in', {});
        controller.emitTraffic('out', {});
        
        expect(handler).toHaveBeenCalledTimes(2);
      });
    });

    describe("emitSessionUpdate method", () => {
      it("emits session update params to handlers", () => {
        const controller = new MockSessionController();
        const handler = vi.fn();
        const params = { sessionId: 'test', update: { type: 'message' } };
        
        controller.on('sessionUpdate', handler);
        controller.emitSessionUpdate(params);
        
        expect(handler).toHaveBeenCalledWith(params);
      });
    });

    describe("emitError method", () => {
      it("emits error to handlers", () => {
        const controller = new MockSessionController();
        const handler = vi.fn();
        const error = new Error('Controller error');
        
        controller.on('error', handler);
        controller.emitError(error);
        
        expect(handler).toHaveBeenCalledWith(error);
      });
    });

    describe("emitSessionClearing method", () => {
      it("emits session clearing event", () => {
        const controller = new MockSessionController();
        const handler = vi.fn();
        
        controller.on('sessionClearing', handler);
        controller.emitSessionClearing();
        
        expect(handler).toHaveBeenCalled();
      });
    });

    describe("emitPermissionRequest method", () => {
      it("emits permission request to handlers", () => {
        const controller = new MockSessionController();
        const handler = vi.fn();
        const params = {
          sessionId: 'test',
          toolCall: { toolCallId: 'call-1' },
          options: [{ optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' } as PermissionOption],
        };
        
        controller.on('permissionRequest', handler);
        controller.emitPermissionRequest(params);
        
        expect(handler).toHaveBeenCalledWith(params);
      });
    });
  });

  describe("createMockTransport factory", () => {
    it("creates MockTransportClient with default config", () => {
      const transport = createMockTransport();
      
      expect(transport).toBeInstanceOf(MockTransportClient);
      expect(transport.config.url).toBe('ws://localhost:8080/mock');
    });

    it("creates MockTransportClient with custom url", () => {
      const transport = createMockTransport({ url: 'ws://custom:9000' });
      
      expect(transport.config.url).toBe('ws://custom:9000');
    });

    it("creates MockTransportClient with custom reconnect settings", () => {
      const transport = createMockTransport({
        reconnect: false,
        maxReconnectAttempts: 3,
        baseReconnectDelayMs: 500,
        maxReconnectDelayMs: 5000,
      });
      
      expect(transport.config.reconnect).toBe(false);
      expect(transport.config.maxReconnectAttempts).toBe(3);
      expect(transport.config.baseReconnectDelayMs).toBe(500);
      expect(transport.config.maxReconnectDelayMs).toBe(5000);
    });

    it("creates MockTransportClient with partial custom settings", () => {
      const transport = createMockTransport({
        url: 'ws://test:8080',
        reconnect: true,
      });
      
      expect(transport.config.url).toBe('ws://test:8080');
      expect(transport.config.reconnect).toBe(true);
    });
  });

  describe("createMockController factory", () => {
    it("creates MockSessionController with default state", () => {
      const controller = createMockController();
      
      expect(controller).toBeInstanceOf(MockSessionController);
      expect(controller.state.sessionId).toBeNull();
      expect(controller.state.initialized).toBe(false);
    });

    it("creates MockSessionController with custom initial state", () => {
      const controller = createMockController({
        sessionId: 'custom-session',
        initialized: true,
        connectionStatus: 'connected',
        bridgeStatus: 'connected',
        capabilities: { maxTokens: 8192 },
      });
      
      expect(controller.state.sessionId).toBe('custom-session');
      expect(controller.state.initialized).toBe(true);
      expect(controller.state.connectionStatus).toBe('connected');
      expect(controller.state.bridgeStatus).toBe('connected');
      expect(controller.state.capabilities).toEqual({ maxTokens: 8192 });
    });

    it("creates MockSessionController with partial custom state", () => {
      const controller = createMockController({
        sessionId: 'test-session',
      });
      
      expect(controller.state.sessionId).toBe('test-session');
      expect(controller.state.initialized).toBe(false);
    });
  });
});
