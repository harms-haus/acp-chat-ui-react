/**
 * ACP Protocol Compliance Tests
 * 
 * Tests ACP protocol message formats, JSON-RPC 2.0 compliance,
 * all ACP methods with valid/invalid params, error codes,
 * capability negotiation, and version compliance.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { ReplayController } from "../../session/replay-controller.js";
import {
  createACPPayload,
  createACPPayloadResult,
  createACPPayloadError,
  createACPPayloadNotification,
  createBridgeEnvelope,
  createInitializeResult,
  createCreateSessionResult,
  createListSessionsResult,
  createLoadSessionResult,
} from "../../test-utils/index.js";
import type {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  JsonRpcRequest,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  JsonRpcResponse,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  JsonRpcError,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  JsonRpcNotification,
} from "../../test-utils/index.js";

// Mock TransportClient for protocol testing
vi.mock("../../transport/client.js", () => {
  class MockTransportClient {
    public status: "disconnected" | "connected" | "connecting" = "disconnected";
    private handlers: {
      statusChange: Set<(status: "disconnected" | "connected" | "connecting") => void>;
      envelope: Set<(envelope: any) => void>;
      error: Set<(error: Error) => void>;
    } = {
      statusChange: new Set(),
      envelope: new Set(),
      error: new Set(),
    };

    constructor(private config: { url: string; reconnect: boolean }) {}

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

    setStatus(status: "disconnected" | "connected" | "connecting") {
      this.status = status;
      this.handlers.statusChange.forEach((h) => { h(status); });
    }

    connect() {
      this.setStatus("connecting");
      setTimeout(() => this.setStatus("connected"), 10);
    }

    async disconnect() {
      this.setStatus("disconnected");
    }

    send(data: string) {
      // Track sent messages for verification
      (this as any).lastSent = data;
    }

    emitEnvelope(envelope: any) {
      this.handlers.envelope.forEach((h) => { h(envelope); });
    }

    emitError(error: Error) {
      this.handlers.error.forEach((h) => { h(error); });
    }

  async initReplay(_script: string, _sessionId: string, _replaySpeed?: number) {
    return Promise.resolve({ status: "success" as const, mode: "replay" as const });
  }
  }

  return { TransportClient: MockTransportClient };
});

describe("ACP protocol compliance", () => {
  let controller: ReplayController;

  beforeEach(() => {
    controller = new ReplayController({
      bridgeUrl: "ws://localhost:8080/replay-v2",
    });
  });

  afterEach(() => {
    controller.disconnect().catch(() => {});
  });

  describe("JSON-RPC format", () => {
    it("JSON-RPC request has required fields (jsonrpc, id, method)", () => {
      const payload = createACPPayload({
        id: 1,
        method: "session/new",
        params: { cwd: "/test" },
      });

      expect(payload).toHaveProperty("jsonrpc", "2.0");
      expect(payload).toHaveProperty("id");
      expect(payload).toHaveProperty("method");
      expect(typeof payload.id).toBe("number");
      expect(typeof payload.method).toBe("string");
    });

    it("JSON-RPC response has required fields (jsonrpc, id, result)", () => {
      const payload = createACPPayloadResult({
        id: 1,
        result: { sessionId: "test-123" },
      });

      expect(payload).toHaveProperty("jsonrpc", "2.0");
      expect(payload).toHaveProperty("id");
      expect(payload).toHaveProperty("result");
      expect(payload.jsonrpc).toBe("2.0");
    });

    it("JSON-RPC error has required fields (jsonrpc, id, error)", () => {
      const payload = createACPPayloadError({
        id: 1,
        code: -32603,
        message: "Internal error",
      });

      expect(payload).toHaveProperty("jsonrpc", "2.0");
      expect(payload).toHaveProperty("id");
      expect(payload).toHaveProperty("error");
      expect(payload.error).toHaveProperty("code");
      expect(payload.error).toHaveProperty("message");
    });

    it("JSON-RPC notification has required fields (jsonrpc, method) and no id", () => {
      const payload = createACPPayloadNotification({
        method: "session/update",
        params: { sessionId: "test-123" },
      });

      expect(payload).toHaveProperty("jsonrpc", "2.0");
      expect(payload).toHaveProperty("method");
      expect(payload).not.toHaveProperty("id");
      expect(payload.jsonrpc).toBe("2.0");
    });

    it("Bridge envelope wraps ACP payload correctly", () => {
      const acpPayload = createACPPayload({
        id: 1,
        method: "session/new",
        params: { cwd: "/test" },
      });

      const envelope = createBridgeEnvelope({
        seq: 5,
        timestamp_ms: 1234567890,
        payload: acpPayload,
      });

      expect(envelope).toHaveProperty("version", 1);
      expect(envelope).toHaveProperty("seq", 5);
      expect(envelope).toHaveProperty("timestamp_ms", 1234567890);
      expect(envelope).toHaveProperty("type", "acp_payload");
      expect(envelope.type).toBe("acp_payload");
      if (envelope.type === "acp_payload") {
        expect(envelope.payload).toEqual(acpPayload);
      }
    });

    it("JSON-RPC 2.0 version is always '2.0' string", () => {
      const request = createACPPayload({ id: 1, method: "test" });
      const response = createACPPayloadResult({ id: 1, result: {} });
      const error = createACPPayloadError({ id: 1, code: -32600, message: "Error" });
      const notification = createACPPayloadNotification({ method: "test" });

      expect(request.jsonrpc).toBe("2.0");
      expect(response.jsonrpc).toBe("2.0");
      expect(error.jsonrpc).toBe("2.0");
      expect(notification.jsonrpc).toBe("2.0");
    });
  });

  describe("Methods", () => {
    beforeEach(() => {
      controller.connect();
    });

    describe("initialize", () => {
      it("sends initialize request with correct structure", async () => {
        const mockTransport = (controller as any).transport;
        const sendSpy = vi.spyOn(mockTransport, "send");

        const envelope = createBridgeEnvelope({
          payload: createACPPayloadResult({
            id: 1,
            result: createInitializeResult({
              capabilities: { tools: true, prompts: true },
              sessionId: "init-session",
            }),
          }),
        });
        setTimeout(() => mockTransport.emitEnvelope(envelope), 10);

        const result = await controller.initialize({
          name: "test-client",
          version: "1.0.0",
        });

        expect(sendSpy).toHaveBeenCalled();
        const sentData = sendSpy.mock.calls[0]?.[0] as string;
        const parsed = JSON.parse(sentData);

        expect(parsed).toHaveProperty("jsonrpc", "2.0");
        expect(parsed).toHaveProperty("method", "initialize");
        expect(parsed).toHaveProperty("id");
        expect(parsed.params).toHaveProperty("protocolVersion");
        expect(parsed.params).toHaveProperty("clientCapabilities");
        expect(result).toBeDefined();
      });

      it("initialize response includes capabilities", async () => {
        const mockTransport = (controller as any).transport;

        const envelope = createBridgeEnvelope({
          payload: createACPPayloadResult({
            id: 1,
            result: createInitializeResult({
              capabilities: {
                tools: true,
                prompts: true,
                resources: false,
              },
              sessionId: "test-session",
            }),
          }),
        });
        setTimeout(() => mockTransport.emitEnvelope(envelope), 10);

        const result = await controller.initialize({
          name: "test",
          version: "1.0.0",
        });

        const resultData = result as { capabilities?: Record<string, boolean> };
        expect(resultData.capabilities).toBeDefined();
      });
    });

    describe("session/new", () => {
      it("sends session/new request with cwd and mcpServers", async () => {
        const mockTransport = (controller as any).transport;
        const sendSpy = vi.spyOn(mockTransport, "send");

        // Wait for request to be sent, then respond with matching ID
        const responsePromise = new Promise<void>((resolve) => {
          const checkInterval = setInterval(() => {
            const lastSent = (mockTransport as any).lastSent as string;
            if (lastSent) {
              const parsed = JSON.parse(lastSent);
              if (parsed.method === "session/new" && typeof parsed.id === "number") {
                clearInterval(checkInterval);
                const envelope = createBridgeEnvelope({
                  payload: createACPPayloadResult({
                    id: parsed.id,
                    result: createCreateSessionResult({ sessionId: "new-session-123" }),
                  }),
                });
                mockTransport.emitEnvelope(envelope);
                resolve();
              }
            }
          }, 5);
        });

        const result = await controller.createSession("/test/workspace", [
          { name: "mcp-server-1" },
        ]);
        await responsePromise;

        expect(sendSpy).toHaveBeenCalled();
        const sentData = sendSpy.mock.calls[0]?.[0] as string;
        const parsed = JSON.parse(sentData);

        expect(parsed.method).toBe("session/new");
        expect(parsed.params.cwd).toBe("/test/workspace");
        expect(parsed.params.mcpServers).toHaveLength(1);
        expect(result).toBeDefined();
      });

      it("session/new response includes sessionId", async () => {
        const mockTransport = (controller as any).transport;

        // Wait for request to be sent, then respond with matching ID
        const responsePromise = new Promise<void>((resolve) => {
          const checkInterval = setInterval(() => {
            const lastSent = (mockTransport as any).lastSent as string;
            if (lastSent) {
              const parsed = JSON.parse(lastSent);
              if (parsed.method === "session/new" && typeof parsed.id === "number") {
                clearInterval(checkInterval);
                const envelope = createBridgeEnvelope({
                  payload: createACPPayloadResult({
                    id: parsed.id,
                    result: createCreateSessionResult({ sessionId: "unique-session-id" }),
                  }),
                });
                mockTransport.emitEnvelope(envelope);
                resolve();
              }
            }
          }, 5);
        });

        const result = await controller.createSession("/workspace");
        await responsePromise;

        const resultData = result as { sessionId: string };
        expect(resultData.sessionId).toBe("unique-session-id");
      });
    });

    describe("session/load", () => {
      it("sends session/load request with sessionId and cwd", async () => {
        const mockTransport = (controller as any).transport;
        const sendSpy = vi.spyOn(mockTransport, "send");

        const envelope = createBridgeEnvelope({
          payload: createACPPayloadResult({
            id: 1,
            result: createLoadSessionResult({ sessionId: "loaded-123" }),
          }),
        });
        setTimeout(() => mockTransport.emitEnvelope(envelope), 10);

        await controller.loadSession("session-123", "/workspace", []);

        expect(sendSpy).toHaveBeenCalled();
        const sentData = sendSpy.mock.calls[0]?.[0] as string;
        const parsed = JSON.parse(sentData);

        expect(parsed.method).toBe("session/load");
        expect(parsed.params.sessionId).toBe("session-123");
        expect(parsed.params.cwd).toBe("/workspace");
      });

      it("session/load emits sessionClearing event before loading", async () => {
        const mockTransport = (controller as any).transport;
        const clearHandler = vi.fn();
        controller.on("sessionClearing", clearHandler);

        const envelope = createBridgeEnvelope({
          payload: createACPPayloadResult({
            id: 1,
            result: createLoadSessionResult({ sessionId: "loaded-123" }),
          }),
        });
        setTimeout(() => mockTransport.emitEnvelope(envelope), 10);

        await controller.loadSession("session-123", "/workspace");

        expect(clearHandler).toHaveBeenCalled();
      });
    });

    describe("session/list", () => {
      it("sends session/list request with optional cursor and cwd", async () => {
        const mockTransport = (controller as any).transport;
        const sendSpy = vi.spyOn(mockTransport, "send");

        const envelope = createBridgeEnvelope({
          payload: createACPPayloadResult({
            id: 1,
            result: createListSessionsResult({
              sessions: [
                {
                  sessionId: "s1",
                  cwd: "/workspace1",
                  title: "Session 1",
                  updatedAt: "2024-01-01T00:00:00Z",
                },
              ],
              nextCursor: "cursor-1",
            }),
          }),
        });
        setTimeout(() => mockTransport.emitEnvelope(envelope), 10);

        const result = await controller.listSessions("cursor-1", "/workspace");

        expect(sendSpy).toHaveBeenCalled();
        const sentData = sendSpy.mock.calls[0]?.[0] as string;
        const parsed = JSON.parse(sentData);

        expect(parsed.method).toBe("session/list");
        expect(parsed.params.cursor).toBe("cursor-1");
        expect(parsed.params.cwd).toBe("/workspace");
        expect(result.sessions).toHaveLength(1);
      });

      it("session/list works without optional parameters", async () => {
        const mockTransport = (controller as any).transport;

        const envelope = createBridgeEnvelope({
          payload: createACPPayloadResult({
            id: 1,
            result: createListSessionsResult({
              sessions: [],
              nextCursor: null,
            }),
          }),
        });
        setTimeout(() => mockTransport.emitEnvelope(envelope), 10);

        const result = await controller.listSessions();

        expect(result.sessions).toEqual([]);
        expect(result.nextCursor).toBeNull();
      });
    });

    describe("session/prompt", () => {
      it("sends session/prompt request with sessionId and prompt array", async () => {
        const mockTransport = (controller as any).transport;
        const sendSpy = vi.spyOn(mockTransport, "send");

        const envelope = createBridgeEnvelope({
          payload: createACPPayloadResult({
            id: 1,
            result: {},
          }),
        });
        setTimeout(() => mockTransport.emitEnvelope(envelope), 10);

        await controller.sendPrompt("session-123", "Hello, agent!");

        expect(sendSpy).toHaveBeenCalled();
        const sentData = sendSpy.mock.calls[0]?.[0] as string;
        const parsed = JSON.parse(sentData);

        expect(parsed.method).toBe("session/prompt");
        expect(parsed.params.sessionId).toBe("session-123");
        expect(parsed.params.prompt).toEqual([
          { type: "text", text: "Hello, agent!" },
        ]);
      });

      it("session/prompt formats prompt as TextContent array", async () => {
        const mockTransport = (controller as any).transport;
        const sendSpy = vi.spyOn(mockTransport, "send");

        const envelope = createBridgeEnvelope({
          payload: createACPPayloadResult({ id: 1, result: {} }),
        });
        setTimeout(() => mockTransport.emitEnvelope(envelope), 10);

        await controller.sendPrompt("session-1", "Test prompt");

        const sentData = sendSpy.mock.calls[0]?.[0] as string;
        const parsed = JSON.parse(sentData);

        expect(Array.isArray(parsed.params.prompt)).toBe(true);
        expect(parsed.params.prompt[0]).toEqual({
          type: "text",
          text: "Test prompt",
        });
      });
    });

    describe("session/cancel", () => {
      it("sends session/cancel notification with sessionId", async () => {
        const mockTransport = (controller as any).transport;
        const sendSpy = vi.spyOn(mockTransport, "send");

        controller.cancelPrompt("session-123");

        expect(sendSpy).toHaveBeenCalled();
        const sentData = sendSpy.mock.calls[0]?.[0] as string;
        const parsed = JSON.parse(sentData);

        expect(parsed.method).toBe("session/cancel");
        expect(parsed.params.sessionId).toBe("session-123");
        expect(parsed).not.toHaveProperty("id"); // Notification, no id
      });

      it("session/cancel is a notification (no response expected)", () => {
        const mockTransport = (controller as any).transport;
        const sendSpy = vi.spyOn(mockTransport, "send");

        controller.cancelPrompt("session-1");

        const sentData = sendSpy.mock.calls[0]?.[0] as string;
        const parsed = JSON.parse(sentData);

        // Notifications don't have id field
        expect(parsed.id).toBeUndefined();
        expect(parsed.jsonrpc).toBe("2.0");
      });
    });
  });

  describe("Error handling", () => {
    it("JSON-RPC error code -32700 (Parse error)", () => {
      const error = createACPPayloadError({
        id: 1,
        code: -32700,
        message: "Parse error",
      });

      expect(error.error.code).toBe(-32700);
      expect(error.error.message).toBe("Parse error");
    });

    it("JSON-RPC error code -32600 (Invalid Request)", () => {
      const error = createACPPayloadError({
        id: 1,
        code: -32600,
        message: "Invalid Request",
      });

      expect(error.error.code).toBe(-32600);
      expect(error.error.message).toBe("Invalid Request");
    });

    it("JSON-RPC error code -32601 (Method not found)", () => {
      const error = createACPPayloadError({
        id: 1,
        code: -32601,
        message: "Method not found",
      });

      expect(error.error.code).toBe(-32601);
      expect(error.error.message).toBe("Method not found");
    });

    it("JSON-RPC error code -32602 (Invalid params)", () => {
      const error = createACPPayloadError({
        id: 1,
        code: -32602,
        message: "Invalid params",
      });

      expect(error.error.code).toBe(-32602);
      expect(error.error.message).toBe("Invalid params");
    });

    it("JSON-RPC error code -32603 (Internal error)", () => {
      const error = createACPPayloadError({
        id: 1,
        code: -32603,
        message: "Internal error",
      });

      expect(error.error.code).toBe(-32603);
      expect(error.error.message).toBe("Internal error");
    });

    it("ACP-specific error code -1 (Session not found)", () => {
      const error = createACPPayloadError({
        id: 1,
        code: -1,
        message: "Session not found",
      });

      expect(error.error.code).toBe(-1);
      expect(error.error.message).toBe("Session not found");
    });

    it("ACP-specific error code -2 (Invalid session state)", () => {
      const error = createACPPayloadError({
        id: 1,
        code: -2,
        message: "Invalid session state",
      });

      expect(error.error.code).toBe(-2);
      expect(error.error.message).toBe("Invalid session state");
    });

    it("ACP-specific error code -3 (Permission denied)", () => {
      const error = createACPPayloadError({
        id: 1,
        code: -3,
        message: "Permission denied",
      });

      expect(error.error.code).toBe(-3);
      expect(error.error.message).toBe("Permission denied");
    });

    it("ACP-specific error code -4 (Tool execution failed)", () => {
      const error = createACPPayloadError({
        id: 1,
        code: -4,
        message: "Tool execution failed",
      });

      expect(error.error.code).toBe(-4);
      expect(error.error.message).toBe("Tool execution failed");
    });

    it("Error response can include optional data field", () => {
      const error = createACPPayloadError({
        id: 1,
        code: -32602,
        message: "Invalid params",
        data: { field: "cwd", reason: "required" },
      });

      expect(error.error.data).toEqual({
        field: "cwd",
        reason: "required",
      });
    });
  });

  describe("Capabilities", () => {
    beforeEach(() => {
      controller.connect();
    });

    it("client sends capabilities during initialize", async () => {
      const mockTransport = (controller as any).transport;
      const sendSpy = vi.spyOn(mockTransport, "send");

      const envelope = createBridgeEnvelope({
        payload: createACPPayloadResult({
          id: 1,
          result: createInitializeResult({
            capabilities: { tools: true, prompts: true },
          }),
        }),
      });
      setTimeout(() => mockTransport.emitEnvelope(envelope), 10);

      await controller.initialize({
        name: "test-client",
        version: "1.0.0",
      });

      const sentData = sendSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(sentData);

      expect(parsed.params.clientCapabilities).toBeDefined();
    });

    it("agent returns capabilities in initialize response", async () => {
      const mockTransport = (controller as any).transport;

      const envelope = createBridgeEnvelope({
        payload: createACPPayloadResult({
          id: 1,
          result: createInitializeResult({
            capabilities: {
              tools: true,
              prompts: true,
              resources: false,
            },
          }),
        }),
      });
      setTimeout(() => mockTransport.emitEnvelope(envelope), 10);

      const result = await controller.initialize({
        name: "test",
        version: "1.0.0",
      });

      const resultData = result as { capabilities?: Record<string, boolean> };
      expect(resultData.capabilities?.tools).toBe(true);
      expect(resultData.capabilities?.prompts).toBe(true);
      expect(resultData.capabilities?.resources).toBe(false);
    });

    it("supports experimental capabilities", async () => {
      const mockTransport = (controller as any).transport;

      const envelope = createBridgeEnvelope({
        payload: createACPPayloadResult({
          id: 1,
          result: createInitializeResult({
            capabilities: {
              tools: true,
              experimental: {
                customFeature: true,
                betaApi: "v2",
              },
            },
          }),
        }),
      });
      setTimeout(() => mockTransport.emitEnvelope(envelope), 10);

      const result = await controller.initialize({
        name: "test",
        version: "1.0.0",
      });

      const resultData = result as { capabilities?: Record<string, unknown> };
      expect(resultData.capabilities?.experimental).toBeDefined();
    });
  });

  describe("Version compliance", () => {
    beforeEach(() => {
      controller.connect();
    });

    it("initialize request includes protocolVersion", async () => {
      const mockTransport = (controller as any).transport;
      const sendSpy = vi.spyOn(mockTransport, "send");

      const envelope = createBridgeEnvelope({
        payload: createACPPayloadResult({ id: 1, result: {} }),
      });
      setTimeout(() => mockTransport.emitEnvelope(envelope), 10);

      await controller.initialize({ name: "test", version: "1.0.0" });

      const sentData = sendSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(sentData);

      expect(parsed.params.protocolVersion).toBeDefined();
      expect(typeof parsed.params.protocolVersion).toBe("number");
    });

    it("bridge envelope uses version 1", () => {
      const envelope = createBridgeEnvelope({
        payload: createACPPayload({ id: 1, method: "test" }),
      });

      expect(envelope.version).toBe(1);
    });

    it("all envelopes have timestamp_ms field", () => {
      const envelope = createBridgeEnvelope({
        timestamp_ms: 1234567890,
        payload: createACPPayload({ id: 1, method: "test" }),
      });

      expect(envelope.timestamp_ms).toBe(1234567890);
    });

    it("all envelopes have seq field for ordering", () => {
      const envelope = createBridgeEnvelope({
        seq: 42,
        payload: createACPPayload({ id: 1, method: "test" }),
      });

      expect(envelope.seq).toBe(42);
    });
  });

  describe("Invalid params handling", () => {
    beforeEach(() => {
      controller.connect();
    });

    it("handles session/new with missing cwd parameter", async () => {
      const mockTransport = (controller as any).transport;

      const errorEnvelope = createBridgeEnvelope({
        payload: createACPPayloadError({
          id: 1,
          code: -32602,
          message: "Invalid params: cwd is required",
          data: { field: "cwd", reason: "required" },
        }),
      });
      setTimeout(() => mockTransport.emitEnvelope(errorEnvelope), 10);

      await expect(controller.createSession("", [])).rejects.toThrow();
    });

    it("handles session/load with invalid sessionId", async () => {
      const mockTransport = (controller as any).transport;

      const errorEnvelope = createBridgeEnvelope({
        payload: createACPPayloadError({
          id: 1,
          code: -1,
          message: "Session not found",
        }),
      });
      setTimeout(() => mockTransport.emitEnvelope(errorEnvelope), 10);

      await expect(controller.loadSession("invalid-id", "/workspace")).rejects.toThrow();
    });

    it("handles session/prompt with empty prompt", async () => {
      const mockTransport = (controller as any).transport;

      const envelope = createBridgeEnvelope({
        payload: createACPPayloadResult({ id: 1, result: {} }),
      });
      setTimeout(() => mockTransport.emitEnvelope(envelope), 10);

      // Empty prompt should still send (validation is server-side)
      await controller.sendPrompt("session-1", "");

      const sentData = (mockTransport as any).lastSent as string;
      const parsed = JSON.parse(sentData);

      expect(parsed.method).toBe("session/prompt");
      expect(parsed.params.prompt).toEqual([{ type: "text", text: "" }]);
    });
  });
});
