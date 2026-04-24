/**
 * Test suite for mock implementations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  MockTransport, 
  MockSessionController, 
  createMockTransport, 
  createMockController 
} from '../mocks.js';

describe('mocks', () => {
  describe('MockTransport', () => {
    let transport: MockTransport;

    beforeEach(() => {
      transport = new MockTransport();
    });

    describe('initialization', () => {
      it('initializes with disconnected status', () => {
        expect(transport.status).toBe('disconnected');
      });

      it('getStatus returns current status', () => {
        expect(transport.getStatus()).toBe('disconnected');
      });
    });

    describe('event handling with on', () => {
      it('registers and calls statusChange handler', () => {
        const handler = vi.fn();
        transport.onStatusChange(handler);
        
        transport.setStatus('connected');
        expect(handler).toHaveBeenCalledWith('connected');
      });

      it('registers and calls notification handler', () => {
        const handler = vi.fn();
        transport.onNotification(handler);
        
        transport.emitNotification({ jsonrpc: '2.0', method: 'test' });
        expect(handler).toHaveBeenCalledWith({ jsonrpc: '2.0', method: 'test' });
      });

      it('registers and calls error handler', () => {
        const handler = vi.fn();
        transport.onError(handler);
        
        const error = new Error('Test error');
        transport.emitError(error);
        expect(handler).toHaveBeenCalledWith(error);
      });

      it('unregisters handler with unsubscribe function', () => {
        const handler = vi.fn();
        const unsubscribe = transport.onStatusChange(handler);
        
        unsubscribe();
        transport.setStatus('connected');
        expect(handler).not.toHaveBeenCalled();
      });

      it('supports multiple handlers for same event', () => {
        const handler1 = vi.fn();
        const handler2 = vi.fn();
        
        transport.onStatusChange(handler1);
        transport.onStatusChange(handler2);
        
        transport.setStatus('connected');
        
        expect(handler1).toHaveBeenCalledTimes(1);
        expect(handler2).toHaveBeenCalledTimes(1);
      });

      it('only removes specific handler with unsubscribe', () => {
        const handler1 = vi.fn();
        const handler2 = vi.fn();
        
        transport.onStatusChange(handler1);
        const unsubscribe1 = transport.onStatusChange(handler2);
        
        unsubscribe1();
        transport.setStatus('connected');
        
        expect(handler1).toHaveBeenCalledTimes(1);
        expect(handler2).not.toHaveBeenCalled();
      });
    });

    describe('connection simulation', () => {
      it('connect sets status to connected', async () => {
        await transport.connect();
        expect(transport.status).toBe('connected');
      });

      it('connect emits statusChange event', async () => {
        const handler = vi.fn();
        transport.onStatusChange(handler);
        
        await transport.connect();
        expect(handler).toHaveBeenCalledWith('connected');
      });

      it('disconnect sets status to disconnected', async () => {
        await transport.connect();
        await transport.disconnect();
        expect(transport.status).toBe('disconnected');
      });

      it('disconnect emits statusChange event', async () => {
        await transport.connect();
        const handler = vi.fn();
        transport.onStatusChange(handler);
        
        await transport.disconnect();
        expect(handler).toHaveBeenCalledWith('disconnected');
      });

      it('sendRequest returns mock response', async () => {
        const request = { jsonrpc: '2.0' as const, id: 1, method: 'initialize' as const, params: {} };
        const response = await transport.sendRequest(request);
        
        expect(response).toEqual({ jsonrpc: '2.0', id: 1, result: {} });
      });

      it('sendNotification is no-op', () => {
        expect(() => transport.sendNotification({ jsonrpc: '2.0' as const, method: 'test' }))
          .not.toThrow();
      });
    });
  });

  describe('MockSessionController', () => {
    let controller: MockSessionController;

    beforeEach(() => {
      controller = new MockSessionController();
    });

    describe('initialization', () => {
      it('initializes with default state', () => {
        expect(controller.state).toEqual({
          connectionStatus: 'disconnected',
          sessionId: null,
          initialized: false,
          capabilities: null,
          configOptions: null,
        });
      });

      it('getState returns copy of state', () => {
        const state1 = controller.getState();
        const state2 = controller.getState();
        
        expect(state1).toEqual(state2);
        expect(state1).not.toBe(state2);
      });
    });

    describe('event handling with on', () => {
      it('registers and calls statusChange handler', () => {
        const handler = vi.fn();
        controller.on('statusChange', handler);
        
        controller.emitStatus();
        expect(handler).toHaveBeenCalled();
      });

      it('registers and calls sessionUpdate handler', () => {
        const handler = vi.fn();
        controller.on('sessionUpdate', handler);
        
        controller.emitSessionUpdate({ type: 'test' });
        expect(handler).toHaveBeenCalledWith({ type: 'test' });
      });

      it('registers and calls traffic handler', () => {
        const handler = vi.fn();
        controller.on('traffic', handler);
        
        controller.emitTraffic('in', { data: 'test' });
        expect(handler).toHaveBeenCalledWith('in', { data: 'test' });
      });

      it('registers and calls error handler', () => {
        const handler = vi.fn();
        controller.on('error', handler);
        
        const error = new Error('Test');
        controller.emitError(error);
        expect(handler).toHaveBeenCalledWith(error);
      });

      it('unregisters handler with unsubscribe function', () => {
        const handler = vi.fn();
        const unsubscribe = controller.on('statusChange', handler);
        
        unsubscribe();
        controller.emitStatus();
        expect(handler).not.toHaveBeenCalled();
      });

      it('supports multiple handlers for same event', () => {
        const handler1 = vi.fn();
        const handler2 = vi.fn();
        
        controller.on('statusChange', handler1);
        controller.on('statusChange', handler2);
        
        controller.emitStatus();
        
        expect(handler1).toHaveBeenCalledTimes(1);
        expect(handler2).toHaveBeenCalledTimes(1);
      });

      it('only removes specific handler with unsubscribe', () => {
        const handler1 = vi.fn();
        const handler2 = vi.fn();
        
        controller.on('statusChange', handler1);
        const unsubscribe = controller.on('statusChange', handler2);
        
        unsubscribe();
        controller.emitStatus();
        
        expect(handler1).toHaveBeenCalledTimes(1);
        expect(handler2).not.toHaveBeenCalled();
      });
    });

    describe('off method', () => {
      it('unregisters handler with off method', () => {
        const handler = vi.fn();
        controller.on('statusChange', handler);
        controller.off('statusChange', handler);
        
        controller.emitStatus();
        expect(handler).not.toHaveBeenCalled();
      });
    });

    describe('connection simulation', () => {
      it('connect updates state to connected', () => {
        controller.connect();
        expect(controller.state.connectionStatus).toBe('connected');
      });

      it('connect emits statusChange event', () => {
        const handler = vi.fn();
        controller.on('statusChange', handler);
        
        controller.connect();
        expect(handler).toHaveBeenCalled();
      });

      it('disconnect updates state to disconnected', () => {
        controller.connect();
        controller.disconnect();
        expect(controller.state.connectionStatus).toBe('disconnected');
      });

      it('disconnect emits statusChange event', () => {
        controller.connect();
        const handler = vi.fn();
        controller.on('statusChange', handler);
        
        controller.disconnect();
        expect(handler).toHaveBeenCalled();
      });
    });

    describe('emit methods', () => {
      it('emitSessionClearing calls handlers', () => {
        const handler = vi.fn();
        controller.on('sessionClearing', handler);
        
        controller.emitSessionClearing();
        expect(handler).toHaveBeenCalledTimes(1);
      });

      it('emitPermissionRequest calls handlers with params', () => {
        const handler = vi.fn();
        controller.on('permissionRequest', handler);
        
        controller.emitPermissionRequest({
          sessionId: 'test',
          toolCall: { toolCallId: 'tool-1' },
          options: [{ optionId: 'opt-1', name: 'Allow', kind: 'allow_once' }]
        });
        
        expect(handler).toHaveBeenCalledWith({
          sessionId: 'test',
          toolCall: { toolCallId: 'tool-1' },
          options: [{ optionId: 'opt-1', name: 'Allow', kind: 'allow_once' }]
        });
      });
    });
  });

  describe('factory functions', () => {
    describe('createMockTransport', () => {
      it('creates MockTransport instance', () => {
        const transport = createMockTransport();
        
        expect(transport).toBeInstanceOf(MockTransport);
        expect(transport.status).toBe('disconnected');
      });
    });

    describe('createMockController', () => {
      it('creates MockSessionController with default state', () => {
        const controller = createMockController();
        
        expect(controller).toBeInstanceOf(MockSessionController);
        expect(controller.state.connectionStatus).toBe('disconnected');
      });

      it('creates MockSessionController with custom initial state', () => {
        const controller = createMockController({
          connectionStatus: 'connected',
          sessionId: 'custom-session',
        });
        
        expect(controller.state.connectionStatus).toBe('connected');
        expect(controller.state.sessionId).toBe('custom-session');
      });
    });
  });
});
