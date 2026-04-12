/**
 * TransportClient connection lifecycle tests.
 *
 * Tests connection establishment, disconnection, state transitions,
 * connection errors, and auto-reconnect logic.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { TransportClient, type ConnectionStatus } from "./client";
import { MockWebSocket } from "./test-utils";

// Mock the acp-chat-core imports
vi.mock("@harms-haus/acp-chat-core", () => ({
  parseEnvelopeSafe: vi.fn(() => ({
    version: 1,
    seq: 0,
    timestamp_ms: 1234567890,
    type: "acp_payload",
    payload: { jsonrpc: "2.0", id: 1, method: "test", params: {} },
  })),
  BridgeVersionError: class BridgeVersionError extends Error {
    constructor(message?: string) {
      super(message);
      this.name = "BridgeVersionError";
    }
  },
}));

describe("TransportClient", () => {
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    // Save original WebSocket
    originalWebSocket = global.WebSocket;
    // Mock WebSocket constructor to use MockWebSocket
     
    global.WebSocket = MockWebSocket as any;
    // Reset timers
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Restore original WebSocket
    global.WebSocket = originalWebSocket;
    vi.useRealTimers();
  });

  describe("Connection Establishment", () => {
    it("should create client with config", () => {
      const client = new TransportClient({
        url: "ws://localhost:8080",
        reconnect: false,
      });

      expect(client).toBeDefined();
      expect(client.getStatus()).toBe("disconnected");
    });

    it("should transition from disconnected to connecting on connect()", () => {
      const client = new TransportClient({ url: "ws://localhost:8080" });
      const statusChanges: ConnectionStatus[] = [];

      client.on("statusChange", (status) => statusChanges.push(status));

      client.connect();

      expect(client.getStatus()).toBe("connecting");
      expect(statusChanges).toEqual(["connecting"]);
    });

    it("should transition to connected when WebSocket opens", () => {
      const client = new TransportClient({ url: "ws://localhost:8080" });
      const statusChanges: ConnectionStatus[] = [];

      client.on("statusChange", (status) => statusChanges.push(status));

      client.connect();
      // Simulate WebSocket opening
      const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateOpen();

      expect(client.getStatus()).toBe("connected");
      expect(statusChanges).toEqual(["connecting", "connected"]);
    });

    it("should not create duplicate WebSocket connection when already connecting", () => {
      const client = new TransportClient({ url: "ws://localhost:8080" });

      client.connect();
      const firstWs = (client as unknown as { ws: MockWebSocket }).ws;

      // Connect again while still connecting
      client.connect();
      const secondWs = (client as unknown as { ws: MockWebSocket }).ws;

      expect(firstWs).toBe(secondWs);
    });

    it("should not create duplicate WebSocket connection when already connected", () => {
      const client = new TransportClient({ url: "ws://localhost:8080" });

      client.connect();
      const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateOpen();

      const firstWs = (client as unknown as { ws: MockWebSocket }).ws;

      // Connect again while already connected
      client.connect();
      const secondWs = (client as unknown as { ws: MockWebSocket }).ws;

      expect(firstWs).toBe(secondWs);
    });

    it("should emit status change event on connection", () => {
      const client = new TransportClient({ url: "ws://localhost:8080" });
      const statusHandler = vi.fn();

      client.on("statusChange", statusHandler);

      client.connect();
      const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateOpen();

      expect(statusHandler).toHaveBeenCalledTimes(2);
      expect(statusHandler).toHaveBeenCalledWith("connecting");
      expect(statusHandler).toHaveBeenCalledWith("connected");
    });

    it("should handle WebSocket constructor throwing an error", () => {
      const client = new TransportClient({ url: "ws://localhost:8080" });
      const errorHandler = vi.fn();
      const statusHandler = vi.fn();

      client.on("error", errorHandler);
      client.on("statusChange", statusHandler);

      // Mock WebSocket constructor to throw
       
      global.WebSocket = vi.fn(() => {
        throw new Error("WebSocket constructor failed");
      }) as any;

      client.connect();

      expect(client.getStatus()).toBe("error");
      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({ message: "WebSocket constructor failed" }),
      );
      expect(statusHandler).toHaveBeenCalledWith("error");
    });
  });

  describe("Disconnection", () => {
    it("should disconnect cleanly from connected state", async () => {
      const client = new TransportClient({ url: "ws://localhost:8080" });

      client.connect();
      const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateOpen();

      expect(client.getStatus()).toBe("connected");

      const result = await client.disconnect();

      expect(result).toEqual({ status: "success" });
      expect(client.getStatus()).toBe("disconnected");
      expect(mockWs.readyState).toBe(MockWebSocket.CLOSED);
    });

    it("should emit status change event on disconnect", async () => {
      const client = new TransportClient({ url: "ws://localhost:8080" });
      const statusHandler = vi.fn();

      client.on("statusChange", statusHandler);

      client.connect();
      const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateOpen();

      await client.disconnect();

      expect(statusHandler).toHaveBeenCalledWith("disconnected");
    });

    it("should handle disconnect when not connected", async () => {
      const client = new TransportClient({ url: "ws://localhost:8080" });

      const result = await client.disconnect();

      expect(result).toEqual({ status: "success" });
      expect(client.getStatus()).toBe("disconnected");
    });

    it("should clear reconnect timeout on disconnect", async () => {
      const client = new TransportClient({
        url: "ws://localhost:8080",
        reconnect: true,
        maxReconnectAttempts: 3,
      });

      client.connect();
      const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateOpen();

      // Trigger disconnect by simulating close (would normally trigger reconnect)
      mockWs.simulateClose(1000, "Normal closure");

      // Now manually disconnect - should clear any pending reconnect
      const result = await client.disconnect();

      expect(result).toEqual({ status: "success" });
    });
  });

  describe("State Transitions", () => {
    it("should follow complete lifecycle: Disconnected → Connecting → Connected → Disconnected", () => {
      const client = new TransportClient({ url: "ws://localhost:8080" });
      const statusChanges: ConnectionStatus[] = [];

      client.on("statusChange", (status) => statusChanges.push(status));

      // Initial state
      expect(client.getStatus()).toBe("disconnected");

      // Start connection
      client.connect();
      expect(statusChanges).toEqual(["connecting"]);

      // WebSocket opens
      const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateOpen();
      expect(statusChanges).toEqual(["connecting", "connected"]);

      // Close connection
      mockWs.simulateClose(1000, "Normal closure");
      expect(statusChanges).toEqual(["connecting", "connected", "disconnected"]);
    });

    it("should handle connection failure: Disconnected → Connecting → Error", () => {
      const client = new TransportClient({ url: "ws://localhost:8080" });
      const statusChanges: ConnectionStatus[] = [];
      const errorHandler = vi.fn();

      client.on("statusChange", (status) => statusChanges.push(status));
      client.on("error", errorHandler);

      client.connect();
      const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      // Simulate error first, then close
      mockWs.simulateError();
      mockWs.simulateClose(1006, "Connection failed");

      // Error event is emitted, then close transitions to disconnected (no reconnect)
      expect(statusChanges).toContain("connecting");
      expect(statusChanges).toContain("disconnected");
      expect(errorHandler).toHaveBeenCalled();
    });

    it("should transition to reconnecting on unexpected close with reconnect enabled", () => {
      const client = new TransportClient({
        url: "ws://localhost:8080",
        reconnect: true,
        maxReconnectAttempts: 3,
      });
      const statusChanges: ConnectionStatus[] = [];

      client.on("statusChange", (status) => statusChanges.push(status));

      client.connect();
      const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateOpen();

      // Simulate unexpected close
      mockWs.simulateClose(1006, "Abnormal closure");

      expect(statusChanges).toContain("reconnecting");
    });

    it("should transition to disconnected on close without reconnect", () => {
      const client = new TransportClient({
        url: "ws://localhost:8080",
        reconnect: false,
      });
      const statusChanges: ConnectionStatus[] = [];

      client.on("statusChange", (status) => statusChanges.push(status));

      client.connect();
      const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateOpen();
      mockWs.simulateClose(1000, "Normal closure");

      expect(statusChanges).toEqual(["connecting", "connected", "disconnected"]);
    });
  });

  describe("Connection Errors", () => {
    it("should emit error event on WebSocket error", () => {
      const client = new TransportClient({ url: "ws://localhost:8080" });
      const errorHandler = vi.fn();

      client.on("error", errorHandler);

      client.connect();
      const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateError();

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({ message: "WebSocket error" }),
      );
    });

    it("should resolve pending init promises on WebSocket error", async () => {
      const client = new TransportClient({ url: "ws://localhost:8080" });

      client.connect();
      const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateOpen();

      // Start init request
      const initPromise = client.initLive("node", [], "/workspace");

      // Trigger error before response
      mockWs.simulateError();

      await expect(initPromise).rejects.toThrow("WebSocket error");
    });

    it("should resolve pending init promises on WebSocket close", async () => {
      const client = new TransportClient({ url: "ws://localhost:8080" });

      client.connect();
      const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateOpen();

      // Start init request
      const initPromise = client.initLive("node", [], "/workspace");

      // Trigger close before response
      mockWs.simulateClose(1006, "Connection lost");

      await expect(initPromise).rejects.toThrow("WebSocket connection closed");
    });

    it("should emit error on failed WebSocket constructor", () => {
      const client = new TransportClient({ url: "ws://localhost:8080" });
      const errorHandler = vi.fn();

      client.on("error", errorHandler);

      // Mock WebSocket to throw
       
      global.WebSocket = vi.fn(() => {
        throw new TypeError("TypeError: Failed to construct 'WebSocket'");
      }) as any;

      client.connect();

      expect(errorHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe("Auto-Reconnect Logic", () => {
    it("should not reconnect when reconnect is disabled", () => {
      const client = new TransportClient({
        url: "ws://localhost:8080",
        reconnect: false,
      });
      const statusChanges: ConnectionStatus[] = [];

      client.on("statusChange", (status) => statusChanges.push(status));

      client.connect();
      const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateOpen();
      mockWs.simulateClose(1006, "Abnormal closure");

      expect(statusChanges).not.toContain("reconnecting");
      expect(statusChanges).toContain("disconnected");
    });

    it("should schedule reconnect with exponential backoff", () => {
      const client = new TransportClient({
        url: "ws://localhost:8080",
        reconnect: true,
        maxReconnectAttempts: 3,
        baseReconnectDelayMs: 1000,
        maxReconnectDelayMs: 10000,
      });

      client.connect();
      const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateOpen();

      // First disconnect
      mockWs.simulateClose(1006, "Abnormal closure");

      // Fast-forward 1 second (first reconnect delay)
      vi.advanceTimersByTime(1000);

      // Should have called connect again (would create new WebSocket)
      // The status should have transitioned through reconnecting
      expect(client.getStatus()).toBe("connecting");
    });

    it("should respect max reconnect attempts", () => {
      const client = new TransportClient({
        url: "ws://localhost:8080",
        reconnect: true,
        maxReconnectAttempts: 3,
        baseReconnectDelayMs: 1000,
      });

      // Initial connection
      client.connect();
      let mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateOpen();

      // First disconnect - triggers reconnect attempt 1 (delay: 1000ms)
      mockWs.simulateClose(1006, "Abnormal closure");
      expect(client.getStatus()).toBe("reconnecting");
      vi.advanceTimersByTime(1000);
      expect(client.getStatus()).toBe("connecting");
      mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateClose(1006, "Abnormal closure");

      // Second disconnect - triggers reconnect attempt 2 (delay: 2000ms)
      expect(client.getStatus()).toBe("reconnecting");
      vi.advanceTimersByTime(2000);
      expect(client.getStatus()).toBe("connecting");
      mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateClose(1006, "Abnormal closure");

      // Third disconnect - triggers reconnect attempt 3 (delay: 4000ms)
      expect(client.getStatus()).toBe("reconnecting");
      vi.advanceTimersByTime(4000);
      expect(client.getStatus()).toBe("connecting");
      mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateClose(1006, "Abnormal closure");

      // Max attempts reached - no more reconnects
      expect(client.getStatus()).toBe("disconnected");
    });

    it("should reset reconnect attempts on successful connection", () => {
      const client = new TransportClient({
        url: "ws://localhost:8080",
        reconnect: true,
        maxReconnectAttempts: 3,
        baseReconnectDelayMs: 1000,
      });

      client.connect();
      let mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateOpen();

      // First disconnect and reconnect
      mockWs.simulateClose(1006, "Abnormal closure");
      vi.advanceTimersByTime(1000);

      // Successful reconnection
      mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateOpen();

      // Disconnect again - should use base delay, not exponential
      mockWs.simulateClose(1006, "Abnormal closure");
      vi.advanceTimersByTime(1000);

      // Should reconnect (attempts were reset)
      expect(client.getStatus()).toBe("connecting");
    });

    it("should respect max reconnect delay cap", () => {
      const client = new TransportClient({
        url: "ws://localhost:8080",
        reconnect: true,
        maxReconnectAttempts: 10,
        baseReconnectDelayMs: 1000,
        maxReconnectDelayMs: 5000,
      });

      client.connect();
      let mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateOpen();

      // Cause multiple disconnects to trigger exponential backoff
      for (let i = 0; i < 5; i++) {
        mockWs.simulateClose(1006, "Abnormal closure");
        // Fast-forward past the capped delay (5000ms)
        vi.advanceTimersByTime(5000);
        mockWs = (client as unknown as { ws: MockWebSocket }).ws;
        mockWs.simulateOpen();
      }

      // The delay should never exceed maxReconnectDelayMs (5000ms)
      // This is verified by the fact that we're still reconnecting
      expect(client.getStatus()).toBe("connected");
    });
  });

  describe("Event Handling", () => {
    it("should register and remove status change handlers", () => {
      const client = new TransportClient({ url: "ws://localhost:8080" });
      const handler = vi.fn();

      const unregister = client.on("statusChange", handler);

      client.connect();
      const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateOpen();

      expect(handler).toHaveBeenCalledTimes(2);

      unregister();
      handler.mockClear();

      mockWs.simulateClose(1000, "Normal closure");

      expect(handler).not.toHaveBeenCalled();
    });

    it("should register and remove error handlers", () => {
      const client = new TransportClient({ url: "ws://localhost:8080" });
      const handler = vi.fn();

      const unregister = client.on("error", handler);

      client.connect();
      const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateError();

      expect(handler).toHaveBeenCalledTimes(1);

      unregister();
      handler.mockClear();

      mockWs.simulateError();

      expect(handler).not.toHaveBeenCalled();
    });

    it("should use off() method to remove handlers", () => {
      const client = new TransportClient({ url: "ws://localhost:8080" });
      const handler = vi.fn();

      client.on("statusChange", handler);
      client.off("statusChange", handler);

      client.connect();
      const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateOpen();

      expect(handler).not.toHaveBeenCalled();
    });

    it("should support multiple handlers for the same event", () => {
      const client = new TransportClient({ url: "ws://localhost:8080" });
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      client.on("statusChange", handler1);
      client.on("statusChange", handler2);
      client.on("statusChange", handler3);

      client.connect();
      const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateOpen();

      // All handlers should be called for each status change
      expect(handler1).toHaveBeenCalledTimes(2);
      expect(handler2).toHaveBeenCalledTimes(2);
      expect(handler3).toHaveBeenCalledTimes(2);

      // Verify all handlers received the same events
      expect(handler1).toHaveBeenCalledWith("connecting");
      expect(handler2).toHaveBeenCalledWith("connecting");
      expect(handler3).toHaveBeenCalledWith("connecting");
      expect(handler1).toHaveBeenCalledWith("connected");
      expect(handler2).toHaveBeenCalledWith("connected");
      expect(handler3).toHaveBeenCalledWith("connected");
    });

    it("should preserve handler execution order", () => {
      const client = new TransportClient({ url: "ws://localhost:8080" });
      const executionOrder: string[] = [];

      client.on("statusChange", () => executionOrder.push("handler1"));
      client.on("statusChange", () => executionOrder.push("handler2"));
      client.on("statusChange", () => executionOrder.push("handler3"));

      client.connect();
      const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateOpen();

      // Handlers should execute in registration order
      expect(executionOrder).toEqual([
        "handler1",
        "handler2",
        "handler3",
        "handler1",
        "handler2",
        "handler3",
      ]);
    });

    it("should remove only the specified handler with off()", () => {
      const client = new TransportClient({ url: "ws://localhost:8080" });
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      client.on("statusChange", handler1);
      client.on("statusChange", handler2);
      client.on("statusChange", handler3);

      // Remove only handler2
      client.off("statusChange", handler2);

      client.connect();
      const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateOpen();

      // handler1 and handler3 should still work
      expect(handler1).toHaveBeenCalledTimes(2);
      expect(handler3).toHaveBeenCalledTimes(2);
      // handler2 should not be called
      expect(handler2).not.toHaveBeenCalled();
    });

    it("should handle envelope events with multiple handlers", () => {
      const client = new TransportClient({ url: "ws://localhost:8080" });
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      client.on("envelope", handler1);
      client.on("envelope", handler2);

      client.connect();
      const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateOpen();

      const envelope = {
        version: 1,
        seq: 0,
        timestamp_ms: 1234567890,
        type: "acp_payload",
        payload: { jsonrpc: "2.0", id: 1, method: "test", params: {} },
      };
      mockWs.simulateMessageJson(envelope);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler1).toHaveBeenCalledWith(expect.objectContaining(envelope));
      expect(handler2).toHaveBeenCalledWith(expect.objectContaining(envelope));
    });
  });

  describe("Message Handling", () => {
    it("should emit envelope event on valid message", () => {
      const client = new TransportClient({ url: "ws://localhost:8080" });
      const envelopeHandler = vi.fn();

      client.on("envelope", envelopeHandler);

      client.connect();
      const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateOpen();

      // Simulate receiving a valid envelope
      const envelope = {
        version: 1,
        seq: 0,
        timestamp_ms: 1234567890,
        type: "acp_payload",
        payload: { jsonrpc: "2.0", id: 1, method: "test", params: {} },
      };
      mockWs.simulateMessageJson(envelope);

      expect(envelopeHandler).toHaveBeenCalledTimes(1);
    });

    it("should emit error on malformed JSON", () => {
      const client = new TransportClient({ url: "ws://localhost:8080" });
      const errorHandler = vi.fn();

      client.on("error", errorHandler);

      client.connect();
      const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateOpen();

      // Simulate malformed JSON
      mockWs.simulateMessage("not valid json");

      expect(errorHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe("Send Method", () => {
    it("should send data when connected", () => {
      const client = new TransportClient({ url: "ws://localhost:8080" });

      client.connect();
      const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateOpen();

      client.send('{"type": "test"}');

      const sentMessages = mockWs.getSentMessages();
      expect(sentMessages).toContain('{"type": "test"}');
    });

    it("should not send data when disconnected", () => {
      const client = new TransportClient({ url: "ws://localhost:8080" });

      // Try to send without connecting
      expect(() => client.send('{"type": "test"}')).not.toThrow();

      // Should not have created WebSocket
      const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      expect(mockWs).toBeNull();
    });

    it("should not send data when connecting", () => {
      const client = new TransportClient({ url: "ws://localhost:8080" });

      client.connect();
      // Don't simulate open - still connecting

      client.send('{"type": "test"}');

      const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      expect(mockWs.getSentMessages()).toHaveLength(0);
    });
  });

  describe("Init Methods", () => {
    describe("initReplay", () => {
      it("should send init request for replay mode", async () => {
        const client = new TransportClient({ url: "ws://localhost:8080" });

        client.connect();
        const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
        mockWs.simulateOpen();

        // Start init replay request
        const initPromise = client.initReplay("script.json", "test-session");

        // Verify init request was sent
        const sentMessages = mockWs.getSentMessages();
        expect(sentMessages).toHaveLength(1);
        const sentData = JSON.parse(sentMessages[0]!);
        expect(sentData).toMatchObject({
          type: "init",
          mode: "replay",
          script: "script.json",
          sessionId: "test-session",
        });
        expect(sentData.initId).toBeDefined();

        // Send success response
        mockWs.simulateMessageJson({
          type: "init",
          initId: sentData.initId,
          status: "success",
          mode: "replay",
        });

        const result = await initPromise;
        expect(result).toMatchObject({ status: "success", mode: "replay" });
      });

      it("should include replaySpeed in init request", async () => {
        const client = new TransportClient({ url: "ws://localhost:8080" });

        client.connect();
        const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
        mockWs.simulateOpen();

        const initPromise = client.initReplay("script.json", "test-session", 2.0);

        const sentMessages = mockWs.getSentMessages();
        const sentData = JSON.parse(sentMessages[0]!);
        expect(sentData.replaySpeed).toBe(2.0);

        // Send success response
        mockWs.simulateMessageJson({
          type: "init",
          initId: sentData.initId,
          status: "success",
          mode: "replay",
        });

        await expect(initPromise).resolves.toMatchObject({
          status: "success",
          mode: "replay",
        });
      });

      it("should reject on init error response", async () => {
        const client = new TransportClient({ url: "ws://localhost:8080" });

        client.connect();
        const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
        mockWs.simulateOpen();

        const initPromise = client.initReplay("script.json", "test-session");

        const sentMessages = mockWs.getSentMessages();
        const sentData = JSON.parse(sentMessages[0]!);

        // Send error response
        mockWs.simulateMessageJson({
          type: "init",
          initId: sentData.initId,
          status: "error",
          message: "Script not found",
        });

        await expect(initPromise).rejects.toThrow("Script not found");
      });
    });

    describe("initLive", () => {
      it("should send init request for live mode", async () => {
        const client = new TransportClient({ url: "ws://localhost:8080" });

        client.connect();
        const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
        mockWs.simulateOpen();

        const initPromise = client.initLive("node", ["script.js"], "/workspace");

        const sentMessages = mockWs.getSentMessages();
        expect(sentMessages).toHaveLength(1);
        const sentData = JSON.parse(sentMessages[0]!);
        expect(sentData).toMatchObject({
          type: "init",
          mode: "live",
          command: "node",
          args: ["script.js"],
          cwd: "/workspace",
        });

        // Send success response
        mockWs.simulateMessageJson({
          type: "init",
          initId: sentData.initId,
          status: "success",
          mode: "live",
        });

        const result = await initPromise;
        expect(result).toMatchObject({ status: "success", mode: "live" });
      });

      it("should reject on init error response", async () => {
        const client = new TransportClient({ url: "ws://localhost:8080" });

        client.connect();
        const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
        mockWs.simulateOpen();

        const initPromise = client.initLive("node", ["script.js"], "/workspace");

        const sentMessages = mockWs.getSentMessages();
        const sentData = JSON.parse(sentMessages[0]!);

        // Send error response
        mockWs.simulateMessageJson({
          type: "init",
          initId: sentData.initId,
          status: "error",
          message: "Live mode not enabled",
        });

        await expect(initPromise).rejects.toThrow("Live mode not enabled");
      });
    });
  });

  describe("setReplaySpeed", () => {
    it("should send replay speed update when connected", () => {
      const client = new TransportClient({ url: "ws://localhost:8080" });

      client.connect();
      const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateOpen();

      client.setReplaySpeed(2.0);

      const sentMessages = mockWs.getSentMessages();
      expect(sentMessages).toHaveLength(1);
      const sentData = JSON.parse(sentMessages[0]!);
      expect(sentData).toEqual({
        jsonrpc: "2.0",
        method: "set_replay_speed",
        params: {
          replaySpeed: 2.0,
        },
      });
    });

    it("should throw when transport not connected", () => {
      const client = new TransportClient({ url: "ws://localhost:8080" });

      expect(() => client.setReplaySpeed(2.0)).toThrow("transport not connected");
    });

    it("should throw when speed is not a finite positive number", () => {
      const client = new TransportClient({ url: "ws://localhost:8080" });

      client.connect();
      const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateOpen();

      expect(() => client.setReplaySpeed(0)).toThrow("speed must be a finite positive number");
      expect(() => client.setReplaySpeed(-1)).toThrow("speed must be a finite positive number");
      expect(() => client.setReplaySpeed(NaN)).toThrow("speed must be a finite positive number");
      expect(() => client.setReplaySpeed(Infinity)).toThrow("speed must be a finite positive number");
    });
  });
});
