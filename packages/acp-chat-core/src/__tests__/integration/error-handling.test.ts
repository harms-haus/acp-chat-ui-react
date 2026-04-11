/**
 * Error handling integration tests.
 *
 * Tests error scenarios including:
 * - Network errors (disconnect, reconnect failures)
 * - Parse errors (malformed JSON, invalid envelopes)
 * - Timeout errors (request timeouts)
 * - Recovery mechanisms (auto-reconnect)
 * - Error event emission
 * - State transitions on error
 * - Permission denied scenarios
 * - Invalid session state errors
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { BridgeEnvelope } from "../../generated/index.js";

// Mock the TransportClient BEFORE any imports that use it
vi.mock("../../transport/client.js", () => {
  class MockTransportClient {
    public status: "disconnected" | "connected" | "connecting" | "error" | "reconnecting" = "disconnected";
    private handlers: {
      statusChange: Set<(status: any) => void>;
      envelope: Set<(envelope: BridgeEnvelope) => void>;
      error: Set<(error: Error) => void>;
    } = {
      statusChange: new Set(),
      envelope: new Set(),
      error: new Set(),
    };

    constructor(public config: { url: string; reconnect: boolean }) {}

    on(event: string, handler: unknown): () => void {
      switch (event) {
        case "statusChange":
          this.handlers.statusChange.add(handler as (status: any) => void);
          break;
        case "envelope":
          this.handlers.envelope.add(handler as (envelope: BridgeEnvelope) => void);
          break;
        case "error":
          this.handlers.error.add(handler as (error: Error) => void);
          break;
      }
      return () => {
        switch (event) {
          case "statusChange":
            this.handlers.statusChange.delete(handler as (status: any) => void);
            break;
          case "envelope":
            this.handlers.envelope.delete(handler as (envelope: BridgeEnvelope) => void);
            break;
          case "error":
            this.handlers.error.delete(handler as (error: Error) => void);
            break;
        }
      };
    }

    connect() {
      this.setStatus("connected");
    }

    disconnect() {
      this.setStatus("disconnected");
    }

    send(_data: string) {}

    setStatus(status: any) {
      this.status = status;
      this.handlers.statusChange.forEach((h) => { h(status); });
    }

    emitEnvelope(envelope: BridgeEnvelope) {
      this.handlers.envelope.forEach((h) => { h(envelope); });
    }

    emitError(error: Error) {
      this.handlers.error.forEach((h) => { h(error); });
    }
  }

  return { 
    TransportClient: MockTransportClient,
  };
});

import { SessionController } from "../../session/controller.js";
import type { ConnectionStatus } from "../../transport/client.js";
import {
  createACPPayloadError,
  createBridgeEnvelope,
} from "../../test-utils/factories.js";

describe("Error handling integration", () => {
  let controller: SessionController;
  let mockTransport: any;

  beforeEach(() => {
    controller = new SessionController("ws://localhost:8080");
    mockTransport = (controller as any).transport;
  });

  afterEach(() => {
    controller.disconnect();
    vi.clearAllMocks();
  });

  describe("network errors", () => {
    it("emits error event on WebSocket connection failure", async () => {
      const errorHandler = vi.fn();
      controller.on("error", errorHandler);

      // Simulate connection error
      mockTransport.setStatus("error");
      mockTransport.emitError(new Error("WebSocket connection failed"));

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({ message: "WebSocket connection failed" })
      );
    });

    it("emits error event on unexpected disconnection", async () => {
      controller.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const errorHandler = vi.fn();
      controller.on("error", errorHandler);

      // Simulate unexpected disconnection
      mockTransport.emitError(new Error("Connection lost"));

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Connection lost" })
      );
    });

    it("rejects pending requests on disconnect", async () => {
      controller.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Start a request that will be pending
      const initializePromise = controller.initialize({
        name: "test-client",
        version: "1.0.0",
      });

      // Disconnect before response
      controller.disconnect();

      await expect(initializePromise).rejects.toThrow("Disconnected");
    });

    it("updates connectionStatus to disconnected on error", async () => {
      controller.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const statusHandler = vi.fn();
      controller.on("statusChange", statusHandler);

      mockTransport.setStatus("error");

      const state = controller.getState();
      expect(state.connectionStatus).toBe("error");
    });
  });

  describe("parse errors", () => {
    it("emits error event on malformed JSON", async () => {
      const errorHandler = vi.fn();
      controller.on("error", errorHandler);

      // Simulate receiving malformed JSON
      mockTransport.emitError(new SyntaxError("Unexpected token in JSON"));

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Unexpected token in JSON",
        })
      );
    });

    it("emits error event on invalid BridgeEnvelope", async () => {
      const errorHandler = vi.fn();
      controller.on("error", errorHandler);

      // Simulate receiving invalid envelope structure
      const invalidEnvelope = {
        version: 999, // Unsupported version
        seq: 0,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: {},
      };

      mockTransport.emitEnvelope(invalidEnvelope as any);

      // Should emit error for invalid envelope
      expect(errorHandler).toHaveBeenCalled();
    });

    it("handles missing required fields in envelope", async () => {
      const errorHandler = vi.fn();
      controller.on("error", errorHandler);

      // Simulate envelope missing required fields
      const incompleteEnvelope = {
        version: 1,
        // Missing seq, timestamp_ms, type, payload
      };

      mockTransport.emitEnvelope(incompleteEnvelope as any);

      // Should emit error for incomplete envelope
      expect(errorHandler).toHaveBeenCalled();
    });

    it("emits error on JSON-RPC parse error", async () => {
      const errorHandler = vi.fn();
      controller.on("error", errorHandler);

      // Simulate parse error during message handling
      mockTransport.emitError(new Error("Failed to parse JSON-RPC message"));

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Failed to parse JSON-RPC message",
        })
      );
    });
  });

  describe("timeout errors", () => {
    it("rejects request after timeout", async () => {
      controller.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Create controller with short timeout
      const shortTimeoutController = new SessionController(
        "ws://localhost:8080",
        100 // 100ms timeout
      );
      const shortTimeoutTransport = (shortTimeoutController as any).transport;
      shortTimeoutTransport.connect();

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Send request without response
      const promise = shortTimeoutController.sendPrompt(
        "session-123",
        "Test prompt"
      );

      await expect(promise).rejects.toThrow("timed out");

      shortTimeoutController.disconnect();
    });

    it("clears timeout on successful response", async () => {
      controller.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const mockTransport = (controller as any).transport;

      // Schedule response before timeout
      const envelope = createBridgeEnvelope({
        seq: 1,
        timestamp_ms: Date.now(),
        payload: {
          jsonrpc: "2.0",
          id: 1,
          result: { success: true },
        },
      });

      // Send request
      const promise = (controller as any).sendRequest("test/method", {});

      // Respond immediately
      setTimeout(() => mockTransport.emitEnvelope(envelope), 10);

      const result = await promise;
      expect(result).toEqual({ success: true });
    });

    it("rejects multiple pending requests on timeout", async () => {
      const shortTimeoutController = new SessionController(
        "ws://localhost:8080",
        50 // 50ms timeout
      );
      const shortTimeoutTransport = (shortTimeoutController as any).transport;
      shortTimeoutTransport.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Send multiple requests
      const promises = [
        shortTimeoutController.initialize({ name: "test", version: "1.0" }),
        shortTimeoutController.createSession("/test"),
      ];

      // Wait for timeouts
      await expect(promises[0]).rejects.toThrow("timed out");
      await expect(promises[1]).rejects.toThrow("timed out");

      shortTimeoutController.disconnect();
    });
  });

  describe("recovery mechanisms", () => {
    it("can reconnect after disconnection", async () => {
      controller.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(controller.getState().connectionStatus).toBe("connected");

      controller.disconnect();
      expect(controller.getState().connectionStatus).toBe("disconnected");

      controller.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(controller.getState().connectionStatus).toBe("connected");
    });

    it("maintains state after reconnection", async () => {
      controller.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Initialize and create session
      const mockTransport = (controller as any).transport;

      const initEnvelope = createBridgeEnvelope({
        seq: 1,
        payload: {
          jsonrpc: "2.0",
          id: 1,
          result: { capabilities: { maxTokens: 4096 } },
        },
      });

      const sessionEnvelope = createBridgeEnvelope({
        seq: 2,
        payload: {
          jsonrpc: "2.0",
          id: 2,
          result: { sessionId: "test-session" },
        },
      });

      const initPromise = controller.initialize({
        name: "test",
        version: "1.0",
      });
      setTimeout(() => mockTransport.emitEnvelope(initEnvelope), 10);
      await initPromise;

      const sessionPromise = controller.createSession("/test");
      setTimeout(() => mockTransport.emitEnvelope(sessionEnvelope), 10);
      await sessionPromise;

      expect(controller.getState().sessionId).toBe("test-session");
      expect(controller.getState().initialized).toBe(true);

      // Disconnect and reconnect
      controller.disconnect();
      controller.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      // State should be preserved
      expect(controller.getState().sessionId).toBe("test-session");
      expect(controller.getState().initialized).toBe(true);
    });

    it("emits statusChange events during reconnection", async () => {
      const statusHandler = vi.fn();
      controller.on("statusChange", statusHandler);

      controller.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      controller.disconnect();
      controller.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(statusHandler).toHaveBeenCalledTimes(3);
      expect(statusHandler.mock.calls[0]?.[0]?.connectionStatus).toBe("connected");
      expect(statusHandler.mock.calls[1]?.[0]?.connectionStatus).toBe(
        "disconnected"
      );
      expect(statusHandler.mock.calls[2]?.[0]?.connectionStatus).toBe("connected");
    });
  });

  describe("error event emission", () => {
    it("emits error event with error details", async () => {
      const errorHandler = vi.fn();
      controller.on("error", errorHandler);

      const testError = new Error("Test error message");
      mockTransport.emitError(testError);

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith(testError);
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Test error message",
        })
      );
    });

    it("supports multiple error handlers", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      controller.on("error", handler1);
      controller.on("error", handler2);

      mockTransport.emitError(new Error("Test error"));

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it("error handler can be unsubscribed", async () => {
      const errorHandler = vi.fn();
      const unsubscribe = controller.on("error", errorHandler);

      unsubscribe();

      mockTransport.emitError(new Error("Test error"));

      expect(errorHandler).not.toHaveBeenCalled();
    });
  });

  describe("state transitions on error", () => {
    it("transitions to error state on connection failure", async () => {
      const statusHandler = vi.fn();
      controller.on("statusChange", statusHandler);

      mockTransport.setStatus("error");

      const state = controller.getState();
      expect(state.connectionStatus).toBe("error");
      expect(statusHandler).toHaveBeenCalledWith(
        expect.objectContaining({ connectionStatus: "error" })
      );
    });

    it("preserves sessionId on transient error", async () => {
      controller.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Set session ID
      const mockTransport = (controller as any).transport;
      const envelope = createBridgeEnvelope({
        seq: 1,
        payload: {
          jsonrpc: "2.0",
          id: 1,
          result: { sessionId: "test-session" },
        },
      });

      const promise = controller.createSession("/test");
      setTimeout(() => mockTransport.emitEnvelope(envelope), 10);
      await promise;

      expect(controller.getState().sessionId).toBe("test-session");

      // Simulate transient error
      mockTransport.emitError(new Error("Transient error"));

      // Session ID should be preserved
      expect(controller.getState().sessionId).toBe("test-session");
    });

    it("clears pending requests on disconnect", async () => {
      controller.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Start a pending request
      const promise = controller.initialize({ name: "test", version: "1.0" });

      // Disconnect immediately
      controller.disconnect();

      await expect(promise).rejects.toThrow("Disconnected");

      // After disconnect, state should be disconnected
      expect(controller.getState().connectionStatus).toBe("disconnected");
    });
  });

  describe("permission denied scenarios", () => {
    it("handles permission denial gracefully", async () => {
      controller.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const errorHandler = vi.fn();
      controller.on("error", errorHandler);

      // Simulate permission denied error from server
      const errorEnvelope = createBridgeEnvelope({
        seq: 1,
        payload: createACPPayloadError({
          id: 1,
          code: -32603,
          message: "Permission denied",
        }),
      });

      const mockTransport = (controller as any).transport;

      const promise = controller.createSession("/test");
      setTimeout(() => mockTransport.emitEnvelope(errorEnvelope), 10);

      await expect(promise).rejects.toThrow("Permission denied");

      // Controller should still be functional
      expect(controller.getState().connectionStatus).toBe("connected");
    });

    it("ignores session/request_permission envelope", async () => {
      controller.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const permissionHandler = vi.fn();
      controller.on("permissionRequest", permissionHandler);

      const transport = (controller as any).transport;

      const permissionEnvelope: BridgeEnvelope = {
        version: 1,
        seq: 1,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: {
          jsonrpc: "2.0",
          method: "session/request_permission",
          params: {
            sessionId: "test-session",
            toolCall: { toolCallId: "tool-1" },
            options: [
              {
                optionId: "allow_once",
                name: "Allow Once",
                kind: "allow_once" as const,
              },
              {
                optionId: "deny",
                name: "Deny",
                kind: "deny" as const,
              },
            ],
          },
        },
      };

      transport.emitEnvelope(permissionEnvelope);
      
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(permissionHandler).not.toHaveBeenCalled();
    });

    it("can respond to permission request", async () => {
      controller.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const mockTransport = (controller as any).transport;
      const sendSpy = vi.spyOn(mockTransport, "send");

      await controller.respondToPermission(42, "allow_once");

      expect(sendSpy).toHaveBeenCalled();
      const sentData = sendSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(sentData);
      expect(parsed.result.outcome.outcome).toBe("selected");
      expect(parsed.result.outcome.optionId).toBe("allow_once");
    });

    it("can cancel permission request", async () => {
      controller.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const mockTransport = (controller as any).transport;
      const sendSpy = vi.spyOn(mockTransport, "send");

      await controller.cancelPermission(42);

      expect(sendSpy).toHaveBeenCalled();
      const sentData = sendSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(sentData);
      expect(parsed.result.outcome.outcome).toBe("cancelled");
    });
  });

  describe("invalid session state errors", () => {
    it("handles request without active session", async () => {
      controller.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const errorHandler = vi.fn();
      controller.on("error", errorHandler);

      // Simulate error when no session is active
      const errorEnvelope = createBridgeEnvelope({
        seq: 1,
        payload: createACPPayloadError({
          id: 1,
          code: -32000,
          message: "No active session",
        }),
      });

      const mockTransport = (controller as any).transport;

      const promise = controller.sendPrompt("non-existent-session", "Hello");
      setTimeout(() => mockTransport.emitEnvelope(errorEnvelope), 10);

      await expect(promise).rejects.toThrow("No active session");
    });

    it("handles invalid session ID format", async () => {
      controller.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const errorHandler = vi.fn();
      controller.on("error", errorHandler);

      const errorEnvelope = createBridgeEnvelope({
        seq: 1,
        payload: createACPPayloadError({
          id: 1,
          code: -32602,
          message: "Invalid session ID format",
        }),
      });

      const mockTransport = (controller as any).transport;

      const promise = controller.loadSession("invalid!", "/test");
      setTimeout(() => mockTransport.emitEnvelope(errorEnvelope), 10);

      await expect(promise).rejects.toThrow("Invalid session ID format");
    });

    it("handles session not found error", async () => {
      controller.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const errorHandler = vi.fn();
      controller.on("error", errorHandler);

      const errorEnvelope = createBridgeEnvelope({
        seq: 1,
        payload: createACPPayloadError({
          id: 1,
          code: -32001,
          message: "Session not found",
        }),
      });

      const mockTransport = (controller as any).transport;

      const promise = controller.loadSession("old-session", "/test");
      setTimeout(() => mockTransport.emitEnvelope(errorEnvelope), 10);

      await expect(promise).rejects.toThrow("Session not found");
    });

    it("handles method not found error", async () => {
      controller.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const errorHandler = vi.fn();
      controller.on("error", errorHandler);

      const errorEnvelope = createBridgeEnvelope({
        seq: 1,
        payload: createACPPayloadError({
          id: 1,
          code: -32601,
          message: "Method not found",
        }),
      });

      const mockTransport = (controller as any).transport;

      // Try to call a non-existent method
      const promise = (controller as any).sendRequest(
        "nonexistent/method",
        {}
      );
      setTimeout(() => mockTransport.emitEnvelope(errorEnvelope), 10);

      await expect(promise).rejects.toThrow("Method not found");
    });
  });

  describe("error recovery patterns", () => {
    it("continues functioning after error event", async () => {
      controller.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const errorHandler = vi.fn();
      controller.on("error", errorHandler);

      // Emit error
      mockTransport.emitError(new Error("Recoverable error"));
      expect(errorHandler).toHaveBeenCalledTimes(1);

      // Controller should still be functional
      expect(controller.getState().connectionStatus).toBe("connected");

      // Should be able to send new requests
      const transport = (controller as any).transport;
      const envelope = createBridgeEnvelope({
        seq: 1,
        payload: {
          jsonrpc: "2.0",
          id: 1,
          result: { success: true },
        },
      });

      const promise = (controller as any).sendRequest("test/method", {});
      setTimeout(() => transport.emitEnvelope(envelope), 10);

      const result = await promise;
      expect(result).toEqual({ success: true });
    });

    it("can handle multiple consecutive errors", async () => {
      controller.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const errorHandler = vi.fn();
      controller.on("error", errorHandler);

      // Emit multiple errors
      mockTransport.emitError(new Error("Error 1"));
      mockTransport.emitError(new Error("Error 2"));
      mockTransport.emitError(new Error("Error 3"));

      expect(errorHandler).toHaveBeenCalledTimes(3);
      expect(errorHandler).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ message: "Error 1" })
      );
      expect(errorHandler).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ message: "Error 2" })
      );
      expect(errorHandler).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ message: "Error 3" })
      );
    });
  });
});
