import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TransportClient } from "../../transport/client.js";
import type { BridgeEnvelope } from "../../generated/index.js";

/**
 * Integration tests for WebSocket connection lifecycle.
 * 
 * These tests verify the full connection flow including:
 * - Connection establishment and teardown
 * - Reconnection with exponential backoff
 * - Connection state transitions
 * - Connection error scenarios
 * - Graceful degradation
 * - Multiple connection attempts
 * 
 * Unlike unit tests, these tests use mocked WebSocket to test
 * the full integration of the TransportClient with WebSocket-like behavior.
 */

// Mock WebSocket constructor and prototype - use numeric literals to avoid WebSocket dependency
const mockWebSocketPrototype = {
  send: vi.fn(),
  close: vi.fn(),
  readyState: 1, // WebSocket.OPEN equivalent
  onopen: null as (() => void) | null,
  onmessage: null as ((event: MessageEvent) => void) | null,
  onerror: null as (() => void) | null,
  onclose: null as (() => void) | null,
};

let createdWebSocket: typeof mockWebSocketPrototype;

// Helper to create a fresh WebSocket mock
function createWebSocketMock() {
  createdWebSocket = { ...mockWebSocketPrototype };
  const WebSocketMock = vi.fn(() => createdWebSocket) as unknown as typeof WebSocket;
  vi.stubGlobal("WebSocket", WebSocketMock);
  return WebSocketMock;
}

describe("Connection Lifecycle Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWebSocketPrototype.send.mockClear();
    mockWebSocketPrototype.close.mockClear();
    mockWebSocketPrototype.readyState = WebSocket.OPEN;
    mockWebSocketPrototype.onopen = null;
    mockWebSocketPrototype.onmessage = null;
    mockWebSocketPrototype.onerror = null;
    mockWebSocketPrototype.onclose = null;
    createWebSocketMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("connection establishment", () => {
    it("establishes connection and transitions through states", () => {
      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
        reconnect: false,
      });

      const statusChanges: string[] = [];
      transport.on("statusChange", (status) => statusChanges.push(status));

      // Initial state
      expect(transport.getStatus()).toBe("disconnected");

      // Connect
      transport.connect();
      expect(transport.getStatus()).toBe("connecting");

      // WebSocket opens
      createdWebSocket.onopen?.();
      expect(transport.getStatus()).toBe("connected");

      // Verify state transition sequence
      expect(statusChanges).toEqual(["connecting", "connected"]);
    });

    it("emits statusChange events during connection", () => {
      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
      });

      const statusHandler = vi.fn();
      transport.on("statusChange", statusHandler);

      transport.connect();
      createdWebSocket.onopen?.();

      expect(statusHandler).toHaveBeenCalledTimes(2);
      expect(statusHandler).toHaveBeenNthCalledWith(1, "connecting");
      expect(statusHandler).toHaveBeenNthCalledWith(2, "connected");
    });

    it("handles connection when WebSocket constructor throws", () => {
      const errorHandler = vi.fn();
      const statusHandler = vi.fn();

      // Make WebSocket constructor throw
      vi.stubGlobal("WebSocket", vi.fn(() => {
        throw new Error("WebSocket construction failed");
      }));

      const transport = new TransportClient({
        url: "ws://invalid-url",
      });
      transport.on("error", errorHandler);
      transport.on("statusChange", statusHandler);

      transport.connect();

      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
      expect(statusHandler).toHaveBeenCalledWith("error");
      expect(transport.getStatus()).toBe("error");
    });

    it("prevents duplicate connections", () => {
      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
      });

      transport.connect();
      const firstCallCount = vi.mocked(WebSocket).mock.calls.length;

      // Connect again while already connecting
      transport.connect();
      expect(vi.mocked(WebSocket).mock.calls.length).toBe(firstCallCount);

      // Complete connection
      createdWebSocket.onopen?.();

      // Connect again while already connected
      transport.connect();
      expect(vi.mocked(WebSocket).mock.calls.length).toBe(firstCallCount);
    });
  });

  describe("connection teardown", () => {
    it("gracefully disconnects from connected state", async () => {
      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
        reconnect: true,
      });

      const statusHandler = vi.fn();
      transport.on("statusChange", statusHandler);

      transport.connect();
      createdWebSocket.onopen?.();
      expect(transport.getStatus()).toBe("connected");

      const result = await transport.disconnect();

      expect(result).toEqual({ status: "success" });
      expect(createdWebSocket.close).toHaveBeenCalled();
      expect(transport.getStatus()).toBe("disconnected");
      expect(statusHandler).toHaveBeenCalledWith("disconnected");
    });

    it("clears reconnect timeout on manual disconnect", async () => {
      vi.useFakeTimers();

      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
        reconnect: true,
        maxReconnectAttempts: 5,
        baseReconnectDelayMs: 100,
      });

      transport.connect();
      createdWebSocket.onopen?.();
      createdWebSocket.onclose?.(); // Trigger reconnect

      expect(transport.getStatus()).toBe("reconnecting");

      await transport.disconnect();

      // Advance timers to verify no reconnection occurs
      vi.advanceTimersByTime(500);
      expect(transport.getStatus()).toBe("disconnected");

      vi.useRealTimers();
    });

    it("disconnects from any state", async () => {
      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
      });

      // Disconnect from disconnected state
      const result1 = await transport.disconnect();
      expect(result1.status).toBe("success");

      // Connect but don't complete
      transport.connect();
      const result2 = await transport.disconnect();
      expect(result2.status).toBe("success");

      // Connect and complete, then disconnect
      transport.connect();
      createdWebSocket.onopen?.();
      const result3 = await transport.disconnect();
      expect(result3.status).toBe("success");
    });
  });

  describe("reconnection with exponential backoff", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("reconnects automatically on unexpected close", () => {
      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
        reconnect: true,
        maxReconnectAttempts: 5,
        baseReconnectDelayMs: 100,
      });

      const statusHandler = vi.fn();
      transport.on("statusChange", statusHandler);

      transport.connect();
      createdWebSocket.onopen?.();
      createdWebSocket.onclose?.();

      expect(statusHandler).toHaveBeenCalledWith("reconnecting");

      // Advance to reconnect time
      vi.advanceTimersByTime(200);
      expect(statusHandler).toHaveBeenCalledWith("connecting");
    });

    it("uses exponential backoff for reconnect delays", () => {
      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
        reconnect: true,
        maxReconnectAttempts: 10,
        baseReconnectDelayMs: 100,
        maxReconnectDelayMs: 1000,
      });

      transport.connect();
      createdWebSocket.onopen?.();

      // First reconnect: 100ms (100 * 2^0)
      createdWebSocket.onclose?.();
      vi.advanceTimersByTime(100);
      createdWebSocket.onopen?.();

      // Second reconnect: 200ms (100 * 2^1)
      createdWebSocket.onclose?.();
      vi.advanceTimersByTime(200);
      createdWebSocket.onopen?.();

      // Third reconnect: 400ms (100 * 2^2)
      createdWebSocket.onclose?.();
      vi.advanceTimersByTime(400);
      createdWebSocket.onopen?.();

      // Fourth reconnect: 800ms (100 * 2^3)
      createdWebSocket.onclose?.();
      vi.advanceTimersByTime(800);
      createdWebSocket.onopen?.();

      // Verify successful reconnections
      expect(transport.getStatus()).toBe("connected");
    });

    it("respects maxReconnectDelayMs cap", () => {
      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
        reconnect: true,
        maxReconnectAttempts: 20,
        baseReconnectDelayMs: 100,
        maxReconnectDelayMs: 500,
      });

      transport.connect();
      createdWebSocket.onopen?.();

      // Trigger multiple closes to reach max delay
      for (let i = 0; i < 10; i++) {
        createdWebSocket.onclose?.();
        vi.advanceTimersByTime(600); // Wait for reconnect
        createdWebSocket.onopen?.();
      }

      // After many attempts, the delay should be capped at maxReconnectDelayMs
      // We verify by checking the transport still reconnects (doesn't give up)
      expect(transport.getStatus()).toBe("connected");
    });

    it("stops reconnecting after maxReconnectAttempts", () => {
      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
        reconnect: true,
        maxReconnectAttempts: 3,
        baseReconnectDelayMs: 100,
      });
      
      transport.connect();
      createdWebSocket.onopen?.();
      
      // First close - attempt 0 < 3, will reconnect
      createdWebSocket.onclose?.();
      vi.advanceTimersByTime(100);
      
      // Second close - attempt 1 < 3, will reconnect
      createdWebSocket.onclose?.();
      vi.advanceTimersByTime(200);
      
      // Third close - attempt 2 < 3, will reconnect
      createdWebSocket.onclose?.();
      vi.advanceTimersByTime(400);
      
      // Fourth close - attempt 3 NOT < 3, will NOT reconnect
      createdWebSocket.onclose?.();
      expect(transport.getStatus()).toBe("disconnected");
    });

    it("resets reconnectAttempts on successful connection", async () => {
      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
        reconnect: true,
        maxReconnectAttempts: 3,
        baseReconnectDelayMs: 100,
      });

      transport.connect();
      createdWebSocket.onopen?.();

      // First close and reconnect
      createdWebSocket.onclose?.();
      vi.advanceTimersByTime(200);
      createdWebSocket.onopen?.();

      // Disconnect cleanly (resets reconnectAttempts)
      await transport.disconnect();

      // Reconnect - should start from attempt 1 again
      transport.connect();
      createdWebSocket.onopen?.();
      createdWebSocket.onclose?.();

      // Should still be in reconnecting state (not exceeded max)
      expect(transport.getStatus()).toBe("reconnecting");
    });

    it("does not reconnect when reconnect is disabled", () => {
      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
        reconnect: false,
      });

      const statusHandler = vi.fn();
      transport.on("statusChange", statusHandler);

      transport.connect();
      createdWebSocket.onopen?.();
      createdWebSocket.onclose?.();

      expect(statusHandler).toHaveBeenCalledWith("disconnected");

      vi.advanceTimersByTime(5000);
      expect(transport.getStatus()).toBe("disconnected");
    });
  });

  describe("connection state transitions", () => {
    it("follows correct state machine: disconnected → connecting → connected", () => {
      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
      });

      const states: string[] = [];
      transport.on("statusChange", (status) => states.push(status));

      expect(transport.getStatus()).toBe("disconnected");

      transport.connect();
      expect(transport.getStatus()).toBe("connecting");

      createdWebSocket.onopen?.();
      expect(transport.getStatus()).toBe("connected");

      expect(states).toEqual(["connecting", "connected"]);
    });

    it("transitions to reconnecting on unexpected close", () => {
      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
        reconnect: true,
      });

      const states: string[] = [];
      transport.on("statusChange", (status) => states.push(status));

      transport.connect();
      createdWebSocket.onopen?.();
      createdWebSocket.onclose?.();

      expect(states).toContain("reconnecting");
      expect(transport.getStatus()).toBe("reconnecting");
    });

    it("transitions from reconnecting to connecting on reconnect attempt", () => {
      vi.useFakeTimers();

      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
        reconnect: true,
        baseReconnectDelayMs: 100,
      });

      const states: string[] = [];
      transport.on("statusChange", (status) => states.push(status));

      transport.connect();
      createdWebSocket.onopen?.();
      createdWebSocket.onclose?.();

      expect(states).toContain("reconnecting");

      vi.advanceTimersByTime(200);
      expect(states).toContain("connecting");

      vi.useRealTimers();
    });

    it("transitions from reconnecting to disconnected after max attempts", () => {
      vi.useFakeTimers();

      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
        reconnect: true,
        maxReconnectAttempts: 2,
      });

      transport.connect();
      createdWebSocket.onopen?.();

      // First close - attempt 0 < 2, will reconnect
      createdWebSocket.onclose?.();
      vi.advanceTimersByTime(100);

      // Second close - attempt 1 < 2, will reconnect
      createdWebSocket.onclose?.();
      vi.advanceTimersByTime(200);

      // Third close - attempt 2 NOT < 2, will NOT reconnect
      createdWebSocket.onclose?.();

      expect(transport.getStatus()).toBe("disconnected");

      vi.useRealTimers();
    });

    it("transitions to error state on WebSocket construction failure", () => {
      vi.stubGlobal("WebSocket", vi.fn(() => {
        throw new Error("Construction failed");
      }));

      const transport = new TransportClient({
        url: "ws://invalid",
      });

      const states: string[] = [];
      transport.on("statusChange", (status) => states.push(status));

      transport.connect();

      expect(states).toContain("error");
      expect(transport.getStatus()).toBe("error");
    });
  });

  describe("connection error scenarios", () => {
    it("handles WebSocket error event", () => {
      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
      });

      const errorHandler = vi.fn();
      transport.on("error", errorHandler);

      transport.connect();
      createdWebSocket.onerror?.();

      expect(errorHandler).toHaveBeenCalledWith(new Error("WebSocket error"));
    });

    it("handles WebSocket close event with error", () => {
      vi.useFakeTimers();

      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
        reconnect: true,
      });

      const errorHandler = vi.fn();
      transport.on("error", errorHandler);

      transport.connect();
      createdWebSocket.onopen?.();

      // Simulate close with error code
      createdWebSocket.onclose?.();

      // Should be in reconnecting state immediately
      expect(transport.getStatus()).toBe("reconnecting");

      vi.useRealTimers();
    });

    it("handles invalid URL gracefully", () => {
      const errorHandler = vi.fn();

      // Mock WebSocket to throw on invalid URL
      vi.stubGlobal("WebSocket", vi.fn((url) => {
        if (url === "ws://invalid-url") {
          throw new Error("Invalid URL");
        }
        return createdWebSocket;
      }));

      const transport = new TransportClient({
        url: "ws://invalid-url",
      });
      transport.on("error", errorHandler);

      transport.connect();

      expect(errorHandler).toHaveBeenCalled();
    });

    it("handles message parsing errors gracefully", () => {
      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
      });

      const errorHandler = vi.fn();
      transport.on("error", errorHandler);

      transport.connect();
      createdWebSocket.onopen?.();

      // Send invalid JSON
      createdWebSocket.onmessage?.(new MessageEvent("message", {
        data: "not valid json",
      }));

      expect(errorHandler).toHaveBeenCalled();
    });

    it("continues operating after recoverable error", () => {
      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
      });

      const errorHandler = vi.fn();
      transport.on("error", errorHandler);

      transport.connect();
      createdWebSocket.onopen?.();

      // Trigger error
      createdWebSocket.onerror?.();
      errorHandler.mockClear();

      // Should still be able to send
      transport.send("test message");
      expect(createdWebSocket.send).toHaveBeenCalledWith("test message");
    });
  });

  describe("graceful degradation", () => {
    it("handles rapid connect/disconnect cycles", async () => {
      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
      });

      // Rapid cycles
      for (let i = 0; i < 5; i++) {
        transport.connect();
        createdWebSocket.onopen?.();
        await transport.disconnect();
      }

      expect(transport.getStatus()).toBe("disconnected");
    });

    it("handles multiple close events without crashing", () => {
      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
        reconnect: true,
      });

      transport.connect();
      createdWebSocket.onopen?.();

      // Multiple close events
      createdWebSocket.onclose?.();
      createdWebSocket.onclose?.();
      createdWebSocket.onclose?.();

      // Should not crash
      expect(transport.getStatus()).toBe("reconnecting");
    });

    it("handles multiple error events without crashing", () => {
      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
      });

      const errorHandler = vi.fn();
      transport.on("error", errorHandler);

      transport.connect();
      createdWebSocket.onopen?.();

      // Multiple errors
      createdWebSocket.onerror?.();
      createdWebSocket.onerror?.();
      createdWebSocket.onerror?.();

      // Should not crash
      expect(transport).toBeDefined();
    });

    it("handles reconnect during manual disconnect", async () => {
      vi.useFakeTimers();

      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
        reconnect: true,
        baseReconnectDelayMs: 100,
      });

      transport.connect();
      createdWebSocket.onopen?.();
      createdWebSocket.onclose?.();

      expect(transport.getStatus()).toBe("reconnecting");

      // Disconnect during reconnect wait
      await transport.disconnect();

      // Advance timers to verify no reconnection
      vi.advanceTimersByTime(500);
      expect(transport.getStatus()).toBe("disconnected");

      vi.useRealTimers();
    });
  });

  describe("multiple connection attempts", () => {
    it("allows reconnection after manual disconnect", async () => {
      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
      });

      // First connection
      transport.connect();
      createdWebSocket.onopen?.();
      expect(transport.getStatus()).toBe("connected");

      await transport.disconnect();
      expect(transport.getStatus()).toBe("disconnected");

      // Second connection
      transport.connect();
      createdWebSocket.onopen?.();
      expect(transport.getStatus()).toBe("connected");
    });

    it("tracks connection attempts correctly", () => {
      vi.useFakeTimers();

      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
        reconnect: true,
        maxReconnectAttempts: 5,
        baseReconnectDelayMs: 100,
      });

      transport.connect();
      createdWebSocket.onopen?.();

      // Track reconnect attempts
      for (let i = 0; i < 3; i++) {
        createdWebSocket.onclose?.();
        vi.advanceTimersByTime(200);
        createdWebSocket.onopen?.();
      }

      // Should still be able to reconnect (under max)
      createdWebSocket.onclose?.();
      expect(transport.getStatus()).toBe("reconnecting");

      vi.useRealTimers();
    });

    it("handles connection after all reconnect attempts exhausted", () => {
      vi.useFakeTimers();

      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
        reconnect: true,
        maxReconnectAttempts: 2,
        baseReconnectDelayMs: 100,
      });

      transport.connect();
      createdWebSocket.onopen?.();

      // First close - attempt 0 < 2, will reconnect
      createdWebSocket.onclose?.();
      vi.advanceTimersByTime(100);

      // Second close - attempt 1 < 2, will reconnect
      createdWebSocket.onclose?.();
      vi.advanceTimersByTime(200);

      // Third close - attempt 2 NOT < 2, will NOT reconnect
      createdWebSocket.onclose?.();
      expect(transport.getStatus()).toBe("disconnected");

      // Manual reconnect should work
      transport.connect();
      expect(transport.getStatus()).toBe("connecting");

      vi.useRealTimers();
    });

    it("preserves configuration across reconnections", () => {
      vi.useFakeTimers();

      const config = {
        url: "ws://localhost:8080/test",
        reconnect: true,
        maxReconnectAttempts: 5,
        baseReconnectDelayMs: 200,
        maxReconnectDelayMs: 2000,
      };

      const transport = new TransportClient(config);

      transport.connect();
      createdWebSocket.onopen?.();

      // Reconnect multiple times
      for (let i = 0; i < 3; i++) {
        createdWebSocket.onclose?.();
        vi.advanceTimersByTime(300);
        createdWebSocket.onopen?.();
      }

      // Configuration should be preserved
      expect(transport.getStatus()).toBe("connected");

      vi.useRealTimers();
    });
  });

  describe("event emission during lifecycle", () => {
    it("emits events to multiple handlers", () => {
      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
      });

      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      transport.on("statusChange", handler1);
      transport.on("statusChange", handler2);
      transport.on("statusChange", handler3);

      transport.connect();
      createdWebSocket.onopen?.();

      expect(handler1).toHaveBeenCalledTimes(2);
      expect(handler2).toHaveBeenCalledTimes(2);
      expect(handler3).toHaveBeenCalledTimes(2);
    });

    it("stops emitting to unregistered handlers", () => {
      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
      });

      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const unsubscribe = transport.on("statusChange", handler1);
      transport.on("statusChange", handler2);

      // Unregister handler1
      unsubscribe();

      transport.connect();
      createdWebSocket.onopen?.();

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(2);
    });

    it("emits error events during connection lifecycle", () => {
      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
      });

      const errorHandler = vi.fn();
      transport.on("error", errorHandler);

      transport.connect();
      createdWebSocket.onopen?.();

      // Trigger various error scenarios
      createdWebSocket.onerror?.();
      createdWebSocket.onmessage?.(new MessageEvent("message", {
        data: "invalid json",
      }));

      expect(errorHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe("edge cases", () => {
    it("handles zero reconnect delay", () => {
      vi.useFakeTimers();

      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
        reconnect: true,
        baseReconnectDelayMs: 0,
      });

      transport.connect();
      createdWebSocket.onopen?.();
      createdWebSocket.onclose?.();

      // Reconnect should be scheduled immediately
      vi.advanceTimersByTime(1);
      expect(transport.getStatus()).toBe("connecting");

      vi.useRealTimers();
    });

    it("handles very large reconnect delay", () => {
      vi.useFakeTimers();

      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
        reconnect: true,
        baseReconnectDelayMs: 10000,
        maxReconnectDelayMs: 60000,
      });

      transport.connect();
      createdWebSocket.onopen?.();
      createdWebSocket.onclose?.();

      expect(transport.getStatus()).toBe("reconnecting");

      // Should not reconnect before delay
      vi.advanceTimersByTime(5000);
      expect(transport.getStatus()).toBe("reconnecting");

      // Should reconnect after delay
      vi.advanceTimersByTime(6000);
      expect(transport.getStatus()).toBe("connecting");

      vi.useRealTimers();
    });

    it("handles concurrent connect calls during connection", () => {
      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
      });

      // Multiple concurrent connect calls
      transport.connect();
      transport.connect();
      transport.connect();

      // Should only create one WebSocket
      expect(vi.mocked(WebSocket).mock.calls.length).toBe(1);

      createdWebSocket.onopen?.();
      expect(transport.getStatus()).toBe("connected");
    });

    it("handles message received before connection completes", () => {
      const transport = new TransportClient({
        url: "ws://localhost:8080/test",
      });

      const envelopeHandler = vi.fn();
      transport.on("envelope", envelopeHandler);

      transport.connect();

      // Receive message before onopen
      const envelope: BridgeEnvelope = {
        version: 1,
        seq: 1,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: {
          jsonrpc: "2.0",
          id: 1,
          method: "test",
        },
      };

      createdWebSocket.onmessage?.(new MessageEvent("message", {
        data: JSON.stringify(envelope),
      }));

      // Message should still be processed
      expect(envelopeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          seq: 1,
          type: "acp_payload",
        })
      );
    });
  });
});
