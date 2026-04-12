import { describe, it, expect, vi, beforeEach } from "vitest";

import { ReplayController } from "../session/replay-controller.js";
import type { BridgeEnvelope } from "../generated/index.js";

// Mock TransportClient
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockTransportClientMap = new Map<number, any>();

vi.mock("../transport/client.js", () => {
  class MockTransportClient {
    public status: "disconnected" | "connected" = "disconnected";
    public lastSent: string | null = null;
    private handlers: {
      statusChange: Set<(status: "disconnected" | "connected") => void>;
      envelope: Set<(envelope: any) => void>;
      error: Set<(error: Error) => void>;
    } = {
      statusChange: new Set(),
      envelope: new Set(),
      error: new Set(),
    };

    constructor(private config: { url: string; reconnect: boolean }) {}

    on(event: "statusChange", handler: (status: "disconnected" | "connected") => void): () => void;
    on(event: "envelope", handler: (envelope: any) => void): () => void;
    on(event: "error", handler: (error: Error) => void): () => void;
    on(event: string, handler: unknown): () => void {
      switch (event) {
        case "statusChange":
          this.handlers.statusChange.add(handler as (status: "disconnected" | "connected") => void);
          break;
        case "envelope":
          this.handlers.envelope.add(handler as (envelope: any) => void);
          break;
        case "error":
          this.handlers.error.add(handler as (error: Error) => void);
          break;
      }
      return () => {
        switch (event) {
          case "statusChange":
            this.handlers.statusChange.delete(handler as (status: "disconnected" | "connected") => void);
            break;
          case "envelope":
            this.handlers.envelope.delete(handler as (envelope: any) => void);
            break;
          case "error":
            this.handlers.error.delete(handler as (error: Error) => void);
            break;
        }
      };
    }

    setStatus(status: "disconnected" | "connected") {
      this.status = status;
      this.handlers.statusChange.forEach((h) => {
        h(status);
      });
    }

    connect() {
      this.setStatus("connected");
    }

    disconnect() {
      this.setStatus("disconnected");
    }

    send(data: string) {
      this.lastSent = data;
    }

    emitEnvelope(envelope: any) {
      this.handlers.envelope.forEach((h) => {
        h(envelope);
      });
    }

    emitError(error: Error) {
      this.handlers.error.forEach((h) => {
        h(error);
      });
    }
  }

  return { TransportClient: MockTransportClient };
});

describe("ReplayController", () => {
  let controller: ReplayController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new ReplayController({
      bridgeUrl: "ws://localhost:8080/replay-v2",
    });
  });

  function getMockTransport(): any {
    return (controller as any).transport;
  }

  // Helper to get last sent data
  function _getLastSentData(): string | null {
    const mockTransport = getMockTransport();
    return mockTransport.lastSent;
  }

  describe("connection lifecycle", () => {
    it("initializes with disconnected state", () => {
      const state = controller.getState();
      expect(state.connectionStatus).toBe("disconnected");
      expect(state.bridgeStatus).toBe("disconnected");
      expect(state.sessionId).toBeNull();
      expect(state.initialized).toBe(false);
    });

    it("connects and updates connectionStatus to connected", () => {
      controller.connect();
      const state = controller.getState();
      expect(state.connectionStatus).toBe("connected");
    });

    it("disconnects and updates connectionStatus to disconnected", () => {
      controller.connect();
      controller.disconnect();
      const state = controller.getState();
      expect(state.connectionStatus).toBe("disconnected");
    });

    it("emits statusChange on connect", () => {
      const handler = vi.fn();
      controller.on("statusChange", handler);
      controller.connect();
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        connectionStatus: "connected",
      }));
    });

    it("emits statusChange on disconnect", () => {
      const handler = vi.fn();
      controller.on("statusChange", handler);
      controller.connect();
      handler.mockClear();

      controller.disconnect();
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        connectionStatus: "disconnected",
      }));
    });
  });

  describe("session lifecycle", () => {
    beforeEach(() => {
      controller.connect();
    });

    it("initialize sets initialized flag and capabilities", async () => {
      const statusHandler = vi.fn();
      controller.on("statusChange", statusHandler);

      const mockTransport = getMockTransport();
      const envelope: BridgeEnvelope = {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: {
          jsonrpc: "2.0",
          id: 1,
          result: {
            capabilities: { maxTokens: 4096 },
            sessionId: "test-session",
          },
        },
      };
      setTimeout(() => mockTransport.emitEnvelope(envelope), 10);

      const _result = await controller.initialize({
        name: "test-client",
        version: "1.0.0",
      });

      const state = controller.getState();
      expect(state.initialized).toBe(true);
      expect(state.capabilities).toEqual({
        capabilities: { maxTokens: 4096 },
        sessionId: "test-session",
      });
      expect(statusHandler).toHaveBeenCalled();
    });

    it("createSession sets sessionId", async () => {
      const statusHandler = vi.fn();
      controller.on("statusChange", statusHandler);

      const mockTransport = getMockTransport();
      const envelope: BridgeEnvelope = {
        version: 1,
        seq: 1,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: {
          jsonrpc: "2.0",
          id: 1,
          result: {
            sessionId: "session-123",
          },
        },
      };
      setTimeout(() => mockTransport.emitEnvelope(envelope), 10);

      await controller.createSession("/test/cwd", [], "test-demo", "session-123");

      const state = controller.getState();
      expect(state.sessionId).toBe("session-123");
      expect(statusHandler).toHaveBeenCalled();
    });

    it("sendPrompt sends prompt with correct structure", async () => {
      const mockTransport = getMockTransport();
      const envelope: BridgeEnvelope = {
        version: 1,
        seq: 1,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: {
          jsonrpc: "2.0",
          id: 1,
          result: {},
        },
      };
      setTimeout(() => mockTransport.emitEnvelope(envelope), 10);

      const sendSpy = vi.spyOn(mockTransport, "send");

      await controller.sendPrompt("session-123", "Hello, world!");

      expect(sendSpy).toHaveBeenCalled();
      const calls = sendSpy.mock.calls;
      if (calls.length > 0) {
        const firstCall = calls[0]!;
        const sentData = firstCall[0]!;
        const parsed = JSON.parse(sentData as string);
        expect(parsed.method).toBe("session/prompt");
        expect(parsed.params.sessionId).toBe("session-123");
        expect(parsed.params.prompt).toEqual([{ type: "text", text: "Hello, world!" }]);
      }
    });
  });

  describe("event handling", () => {
    beforeEach(() => {
      controller.connect();
    });

    it("emits sessionUpdate for session/update notifications", () => {
      const sessionUpdateHandler = vi.fn();
      controller.on("sessionUpdate", sessionUpdateHandler);

      const mockTransport = getMockTransport();
      const envelope: BridgeEnvelope = {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: {
          jsonrpc: "2.0",
          method: "session/update",
          params: {
            sessionId: "session-123",
            update: { type: "message", id: "msg-1", content: "Test" },
          },
        },
      };
      mockTransport.emitEnvelope(envelope);

      expect(sessionUpdateHandler).toHaveBeenCalledWith({
        sessionId: "session-123",
        update: { type: "message", id: "msg-1", content: "Test" },
      });
    });

    it("emits statusChange for bridge_status envelopes", () => {
      const statusHandler = vi.fn();
      controller.on("statusChange", statusHandler);

      const mockTransport = getMockTransport();
      const envelope: BridgeEnvelope = {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "bridge_status",
        status: "connected",
      };
      mockTransport.emitEnvelope(envelope);

      expect(statusHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          bridgeStatus: "connected",
        }),
      );
    });

    it("emits error for transport errors", () => {
      const errorHandler = vi.fn();
      controller.on("error", errorHandler);

      const mockTransport = getMockTransport();
      const error = new Error("Connection failed");
      mockTransport.emitError(error);

      expect(errorHandler).toHaveBeenCalledWith(error);
    });

    it("handles batched session updates", () => {
      const sessionUpdateHandler = vi.fn();
      controller.on("sessionUpdate", sessionUpdateHandler);

      const mockTransport = getMockTransport();
      const envelope: BridgeEnvelope = {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: {
          jsonrpc: "2.0",
          method: "session/update",
          params: {
            batched: true,
            updates: [
              {
                sessionId: "session-123",
                params: {
                  sessionId: "session-123",
                  update: { type: "message", id: "msg-1" },
                },
              },
              {
                sessionId: "session-123",
                update: { type: "message", id: "msg-2" },
              },
            ],
          },
        },
      };
      mockTransport.emitEnvelope(envelope);

      expect(sessionUpdateHandler).toHaveBeenCalledTimes(2);
      const calls = sessionUpdateHandler.mock.calls;
      if (calls.length >= 2) {
        const firstCall = calls[0]!;
        expect(firstCall[0]!).toEqual({
          sessionId: "session-123",
          update: { type: "message", id: "msg-1" },
        });
        const secondCall = calls[1]!;
        expect(secondCall[0]!).toEqual({
          sessionId: "session-123",
          update: { type: "message", id: "msg-2" },
        });
      }
    });

    it("emits permissionRequest for permission requests", () => {
      const permissionHandler = vi.fn();
      controller.on("permissionRequest", permissionHandler);

      const mockTransport = getMockTransport();
      const envelope: BridgeEnvelope = {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: {
          jsonrpc: "2.0",
          method: "session/request_permission",
          id: 42,
          params: {
            sessionId: "test-session",
            toolCall: { toolCallId: "tc-1" },
            options: [
              { optionId: "allow", name: "Allow", kind: "allow_once" },
              { optionId: "deny", name: "Deny", kind: "deny" },
            ],
          },
        },
      };
      mockTransport.emitEnvelope(envelope);

      expect(permissionHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 42,
          sessionId: "test-session",
          toolCall: { toolCallId: "tc-1" },
        }),
      );
    });
  });

  describe("cancelPrompt behavior", () => {
    beforeEach(() => {
      controller.connect();
    });

    it("sends notification for cancelPrompt", () => {
      const mockTransport = getMockTransport();
      const sendSpy = vi.spyOn(mockTransport, "send");

      controller.cancelPrompt("session-123");

      expect(sendSpy).toHaveBeenCalled();
      const calls = sendSpy.mock.calls;
      if (calls.length > 0) {
        const firstCall = calls[0]!;
        const sentData = firstCall[0]!;
        const parsed = JSON.parse(sentData as string);
        expect(parsed.method).toBe("session/cancel");
        expect(parsed.params.sessionId).toBe("session-123");
        expect(parsed.jsonrpc).toBe("2.0");
        expect("id" in parsed).toBe(false);
      }
    });
  });

  describe("fake modes and models", () => {
    it("exposes default modes via getState", () => {
      const controller = new ReplayController({
        bridgeUrl: "ws://localhost:8080/replay-v2",
      });

      const state = controller.getState();
      expect(state.modes).toEqual([
        { id: "replay", name: "Replay", description: "Replay a recorded session" },
      ]);
    });

    it("exposes custom modes via getState", () => {
      const controller = new ReplayController({
        bridgeUrl: "ws://localhost:8080/replay-v2",
        modes: [
          { id: "custom-mode-1", name: "Custom Mode 1", description: "Test mode 1" },
          { id: "custom-mode-2", name: "Custom Mode 2" },
        ],
      });

      const state = controller.getState();
      expect(state.modes).toEqual([
        { id: "custom-mode-1", name: "Custom Mode 1", description: "Test mode 1" },
        { id: "custom-mode-2", name: "Custom Mode 2" },
      ]);
    });

    it("exposes default models via getState", () => {
      const controller = new ReplayController({
        bridgeUrl: "ws://localhost:8080/replay-v2",
      });

      const state = controller.getState();
      expect(state.models).toEqual([
        {
          id: "replay-model",
          name: "Replay Model",
          description: "Simulated model from replay data",
          provider: "replay",
        },
      ]);
    });

    it("exposes custom models via getState", () => {
      const controller = new ReplayController({
        bridgeUrl: "ws://localhost:8080/replay-v2",
        models: [
          { id: "model-1", name: "Model 1", provider: "provider-a" },
          { id: "model-2", name: "Model 2", description: "Test model 2" },
        ],
      });

      const state = controller.getState();
      expect(state.models).toEqual([
        { id: "model-1", name: "Model 1", provider: "provider-a" },
        { id: "model-2", name: "Model 2", description: "Test model 2" },
      ]);
    });
  });

  describe("getState returns copies", () => {
    it("returns independent state objects", () => {
      const state1 = controller.getState();
      const state2 = controller.getState();

      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });

    it("modifications to returned state do not affect controller", () => {
      const state = controller.getState();
      (state as any).sessionId = "modified";

      const state2 = controller.getState();
      expect(state2.sessionId).toBeNull();
    });
  });

  describe("request timeout", () => {
    it("rejects requests that exceed timeout", async () => {
      controller.connect();

      const controllerWithTimeout = new ReplayController({
        bridgeUrl: "ws://localhost:8080/replay-v2",
        requestTimeoutMs: 100,
      });
      controllerWithTimeout.connect();

      await expect(
        controllerWithTimeout.initialize(),
      ).rejects.toThrow("timed out");
    });

    it("uses default timeout of 30000ms", () => {
      const controller = new ReplayController({
        bridgeUrl: "ws://localhost:8080/replay-v2",
      });

      expect((controller as any).requestTimeoutMs).toBe(30000);
    });

    it("allows custom timeout via options", () => {
      const controller = new ReplayController({
        bridgeUrl: "ws://localhost:8080/replay-v2",
        requestTimeoutMs: 5000,
      });

      expect((controller as any).requestTimeoutMs).toBe(5000);
    });
  });

  describe("traffic events", () => {
    beforeEach(() => {
      controller.connect();
    });

    it("emits traffic events for outgoing requests", async () => {
      const trafficHandler = vi.fn();
      controller.on("traffic", trafficHandler);

      const mockTransport = getMockTransport();
      const envelope: BridgeEnvelope = {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: {
          jsonrpc: "2.0",
          id: 1,
          result: {},
        },
      };
      setTimeout(() => mockTransport.emitEnvelope(envelope), 10);

      await controller.initialize();

      expect(trafficHandler).toHaveBeenCalled();
      const calls = trafficHandler.mock.calls;
      if (calls.length > 0) {
        const firstCall = calls[0];
        if (Array.isArray(firstCall) && firstCall.length >= 2) {
          const [direction, data] = firstCall;
          expect(direction).toBe("out");
          expect(data).toHaveProperty("method", "initialize");
        }
      }
    });

    it("emits traffic events for incoming envelopes", () => {
      const trafficHandler = vi.fn();
      controller.on("traffic", trafficHandler);

      const mockTransport = getMockTransport();
      const envelope: BridgeEnvelope = {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "bridge_status",
        status: "connected",
      };
      mockTransport.emitEnvelope(envelope);

      expect(trafficHandler).toHaveBeenCalledWith("in", envelope);
    });
  });

  describe("permission handling", () => {
    beforeEach(() => {
      controller.connect();
    });

    it("respondToPermission sends correct response", async () => {
      const mockTransport = getMockTransport();
      const sendSpy = vi.spyOn(mockTransport, "send");

      await controller.respondToPermission(42, "allow");

      expect(sendSpy).toHaveBeenCalled();
      const calls = sendSpy.mock.calls;
      if (calls.length > 0) {
        const firstCall = calls[0]!;
        const sentData = firstCall[0]!;
        const parsed = JSON.parse(sentData as string);
        expect(parsed.jsonrpc).toBe("2.0");
        expect(parsed.id).toBe(42);
        expect(parsed.result).toEqual({
          outcome: { outcome: "selected", optionId: "allow" },
        });
      }
    });

    it("cancelPermission sends cancel response", async () => {
      const mockTransport = getMockTransport();
      const sendSpy = vi.spyOn(mockTransport, "send");

      await controller.cancelPermission(42);

      expect(sendSpy).toHaveBeenCalled();
      const calls = sendSpy.mock.calls;
      if (calls.length > 0) {
        const firstCall = calls[0]!;
        const sentData = firstCall[0]!;
        const parsed = JSON.parse(sentData as string);
        expect(parsed.jsonrpc).toBe("2.0");
        expect(parsed.id).toBe(42);
        expect(parsed.result).toEqual({
          outcome: { outcome: "cancelled" },
        });
      }
    });
  });

  describe("session management", () => {
    beforeEach(() => {
      controller.connect();
    });

    it("listSessions returns sessions", async () => {
      const mockTransport = getMockTransport();
      const envelope: BridgeEnvelope = {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: {
          jsonrpc: "2.0",
          id: 1,
          result: {
            sessions: [
              {
                sessionId: "session-1",
                cwd: "/test/cwd",
                title: "Session 1",
                updatedAt: "2024-01-01T00:00:00Z",
              },
            ],
            nextCursor: "cursor-123",
          },
        },
      };
      setTimeout(() => mockTransport.emitEnvelope(envelope), 10);

      const result = await controller.listSessions(undefined, "/test/cwd");

      expect(result.sessions).toEqual([
        {
          sessionId: "session-1",
          cwd: "/test/cwd",
          title: "Session 1",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ]);
      expect(result.nextCursor).toBe("cursor-123");
    });

    it("loadSession emits sessionClearing and sets sessionId", async () => {
      const clearingHandler = vi.fn();
      const statusHandler = vi.fn();
      controller.on("sessionClearing", clearingHandler);
      controller.on("statusChange", statusHandler);

      const mockTransport = getMockTransport();
      const envelope: BridgeEnvelope = {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: {
          jsonrpc: "2.0",
          id: 1,
          result: { sessionId: "session-123" },
        },
      };
      setTimeout(() => mockTransport.emitEnvelope(envelope), 10);

      await controller.loadSession("session-123", "/test/cwd");

      expect(clearingHandler).toHaveBeenCalled();
      const state = controller.getState();
      expect(state.sessionId).toBe("session-123");
      expect(statusHandler).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("rejects initialize on bridge error", async () => {
      controller.connect();

      const mockTransport = getMockTransport();
      const envelope: BridgeEnvelope = {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: {
          jsonrpc: "2.0",
          id: 1,
          error: { message: "Initialization failed" },
        },
      };
      setTimeout(() => mockTransport.emitEnvelope(envelope), 10);

      await expect(controller.initialize()).rejects.toThrow("Initialization failed");
    });

    it("disconnect rejects all pending requests", async () => {
      controller.connect();

      const requestPromise = controller.initialize();
      controller.disconnect();

      await expect(requestPromise).rejects.toThrow("Disconnected");
    });
  });
});
