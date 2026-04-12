import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionController } from "./controller.js";
import type { BridgeEnvelope } from "../generated/index.js";

// Mock TransportClient
vi.mock("../transport/client.js", () => {
  class MockTransportClient {
    public status: "disconnected" | "connecting" | "connected" | "reconnecting" | "error" = "disconnected";
    private handlers: {
      statusChange: Set<(status: "disconnected" | "connecting" | "connected" | "reconnecting" | "error") => void>;
      envelope: Set<(envelope: any) => void>;
      error: Set<(error: Error) => void>;
    } = {
      statusChange: new Set(),
      envelope: new Set(),
      error: new Set(),
    };
    public lastSent: string | null = null;

    constructor(private config: { url: string; reconnect: boolean }) {}

    on(event: "statusChange", handler: (status: "disconnected" | "connecting" | "connected" | "reconnecting" | "error") => void): () => void;
    on(event: "envelope", handler: (envelope: any) => void): () => void;
    on(event: "error", handler: (error: Error) => void): () => void;
    on(event: string, handler: unknown): () => void {
      switch (event) {
        case "statusChange":
          this.handlers.statusChange.add(handler as (status: "disconnected" | "connecting" | "connected" | "reconnecting" | "error") => void);
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
            this.handlers.statusChange.delete(handler as (status: "disconnected" | "connecting" | "connected" | "reconnecting" | "error") => void);
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

    connect() {
      this.setStatus("connected");
    }

    disconnect() {
      this.setStatus("disconnected");
    }

    send(data: string) {
      // Track sent data for assertions and extract request ID
      this.lastSent = data;
      try {
        const parsed = JSON.parse(data);
        if (parsed.id) {
          (this as any).lastRequestId = parsed.id;
        }
      } catch {
        // Ignore parse errors
      }
    }

    getStatus() {
      return this.status;
    }

    setStatus(status: "disconnected" | "connecting" | "connected" | "reconnecting" | "error") {
      this.status = status;
      this.handlers.statusChange.forEach((h) => {
        h(status);
      });
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

    async initLive(_command: string, _args: string[], _cwd: string) {
      return { status: "success" as const, mode: "live" as const };
    }
  }

  return { TransportClient: MockTransportClient };
});

describe("SessionController", () => {
  let controller: SessionController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new SessionController("ws://localhost:8080/bridge", 30000);
  });

  function getMockTransport(): any {
    return (controller as any).transport;
  }

  // Helper to get the last request ID from sent data
  function getLastRequestId(): number {
    const mockTransport = getMockTransport();
    if (!mockTransport.lastSent) {
      throw new Error("No request sent yet");
    }
    const parsed = JSON.parse(mockTransport.lastSent);
    return parsed.id;
  }

  // Helper to simulate response from server
  function simulateResponse(requestId: number, result: unknown) {
    const mockTransport = getMockTransport();
    const envelope: BridgeEnvelope = {
      version: 1,
      seq: requestId,
      timestamp_ms: Date.now(),
      type: "acp_payload",
      payload: {
        jsonrpc: "2.0",
        id: requestId,
        result,
      },
    };
    mockTransport.emitEnvelope(envelope);
  }

  function simulateError(requestId: number, message: string) {
    const mockTransport = getMockTransport();
    const envelope: BridgeEnvelope = {
      version: 1,
      seq: requestId,
      timestamp_ms: Date.now(),
      type: "acp_payload",
      payload: {
        jsonrpc: "2.0",
        id: requestId,
        error: { message },
      },
    };
    mockTransport.emitEnvelope(envelope);
  }

  describe("initialization", () => {
    it("initializes with disconnected state", () => {
      const state = controller.getState();
      expect(state.connectionStatus).toBe("disconnected");
      expect(state.bridgeStatus).toBe("disconnected");
      expect(state.sessionId).toBeNull();
      expect(state.initialized).toBe(false);
      expect(state.capabilities).toBeNull();
    });

    it("exposes state through getState with copy semantics", () => {
      const state1 = controller.getState();
      const state2 = controller.getState();
      
      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
      
      // Mutating returned state doesn't affect controller
      (state1 as any).sessionId = "mutated";
      expect(controller.getState().sessionId).toBeNull();
    });
  });

  describe("connection lifecycle", () => {
    it("connects and updates connectionStatus to connected", () => {
      const statusHandler = vi.fn();
      controller.on("statusChange", statusHandler);
      
      controller.connect();
      
      const state = controller.getState();
      expect(state.connectionStatus).toBe("connected");
      expect(statusHandler).toHaveBeenCalledWith(
        expect.objectContaining({ connectionStatus: "connected" })
      );
    });

    it("disconnects and updates connectionStatus to disconnected", () => {
      controller.connect();
      const statusHandler = vi.fn();
      controller.on("statusChange", statusHandler);
      
      controller.disconnect();
      
      const state = controller.getState();
      expect(state.connectionStatus).toBe("disconnected");
      expect(statusHandler).toHaveBeenCalledWith(
        expect.objectContaining({ connectionStatus: "disconnected" })
      );
    });

    it("disconnect clears pending requests", async () => {
      controller.connect();
      
      // Start a request but don't respond
      const initPromise = controller.initialize();
      
      // Disconnect before response
      controller.disconnect();
      
      await expect(initPromise).rejects.toThrow("Disconnected");
    });

    it("emits statusChange on connection state changes", () => {
      const statusHandler = vi.fn();
      controller.on("statusChange", statusHandler);
      
      controller.connect();
      controller.disconnect();
      
      expect(statusHandler).toHaveBeenCalledTimes(2);
      expect(statusHandler).toHaveBeenNthCalledWith(1, expect.objectContaining({
        connectionStatus: "connected",
      }));
      expect(statusHandler).toHaveBeenNthCalledWith(2, expect.objectContaining({
        connectionStatus: "disconnected",
      }));
    });
  });

  describe("event handlers", () => {
    it("accepts statusChange event handlers", () => {
      const handler = vi.fn();
      const unsubscribe = controller.on("statusChange", handler);
      
      expect(typeof unsubscribe).toBe("function");
      
      controller.connect();
      expect(handler).toHaveBeenCalled();
      
      // Unsubscribe works
      unsubscribe();
      handler.mockClear();
      controller.disconnect();
      expect(handler).not.toHaveBeenCalled();
    });

  it("accepts sessionUpdate event handlers", () => {
    const handler = vi.fn();
    const unsubscribe = controller.on("sessionUpdate", handler);

    expect(typeof unsubscribe).toBe("function");

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
            sessionId: "test-session",
            update: { type: "message", content: "test" },
          },
        },
      };
      mockTransport.emitEnvelope(envelope);
      
      expect(handler).toHaveBeenCalledWith({
        sessionId: "test-session",
        update: { type: "message", content: "test" },
      });
      
      unsubscribe();
      handler.mockClear();
      mockTransport.emitEnvelope(envelope);
      expect(handler).not.toHaveBeenCalled();
    });

    it("accepts traffic event handlers", () => {
      const handler = vi.fn();
      const unsubscribe = controller.on("traffic", handler);
      
      expect(typeof unsubscribe).toBe("function");
      
      controller.connect();
      const mockTransport = getMockTransport();
      const envelope: BridgeEnvelope = {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "bridge_status",
        status: "connected",
      };
      mockTransport.emitEnvelope(envelope);
      
      expect(handler).toHaveBeenCalledWith("in", envelope);
      
      unsubscribe();
      handler.mockClear();
      mockTransport.emitEnvelope(envelope);
      expect(handler).not.toHaveBeenCalled();
    });

    it("accepts error event handlers", () => {
      const handler = vi.fn();
      const unsubscribe = controller.on("error", handler);
      
      expect(typeof unsubscribe).toBe("function");
      
      const mockTransport = getMockTransport();
      const error = new Error("Connection failed");
      mockTransport.emitError(error);
      
      expect(handler).toHaveBeenCalledWith(error);
      
      unsubscribe();
      handler.mockClear();
      mockTransport.emitError(new Error("Another error"));
      expect(handler).not.toHaveBeenCalled();
    });

    it("accepts sessionClearing event handlers", async () => {
      const handler = vi.fn();
      const unsubscribe = controller.on("sessionClearing", handler);
      
      expect(typeof unsubscribe).toBe("function");
      
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
          result: { sessionId: "new-session" },
        },
      };
      
      // This will be called after loadSession emits clearing
      setTimeout(() => mockTransport.emitEnvelope(envelope), 10);
      
      // loadSession emits sessionClearing before loading
      const loadPromise = controller.loadSession("old-session", "/test");
      
      // Clearing should be emitted
      expect(handler).toHaveBeenCalled();
      
      await loadPromise;
      
      unsubscribe();
    });

    it("accepts permissionRequest event handlers", () => {
      const handler = vi.fn();
      const unsubscribe = controller.on("permissionRequest", handler);
      
      expect(typeof unsubscribe).toBe("function");
      
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
      
      expect(handler).toHaveBeenCalledWith({
        sessionId: "test-session",
        toolCall: { toolCallId: "tc-1" },
        options: [
          { optionId: "allow", name: "Allow", kind: "allow_once" },
          { optionId: "deny", name: "Deny", kind: "deny" },
        ],
        requestId: 42,
      });
      
      unsubscribe();
    });
  });

  describe("initialization with connection", () => {
    beforeEach(() => {
      controller.connect();
    });

  it("initialize sends initialize request and sets initialized flag", async () => {
    const _mockTransport = getMockTransport();
      
      // Start initialize and get request ID
      const initPromise = controller.initialize({
        name: "test-client",
        version: "1.0.0",
      });
      
      // Extract request ID from sent data and respond
      const requestId = getLastRequestId();
      simulateResponse(requestId, {
        capabilities: { maxTokens: 4096 },
        protocolVersion: 1,
      });

      const result = await initPromise;

      const state = controller.getState();
      expect(state.initialized).toBe(true);
      expect(state.capabilities).toEqual({
        capabilities: { maxTokens: 4096 },
        protocolVersion: 1,
      });
      expect(result).toEqual({
        capabilities: { maxTokens: 4096 },
        protocolVersion: 1,
      });
    });

    it("initialize works without clientInfo", async () => {
      const _mockTransport = getMockTransport();
      
      const initPromise = controller.initialize();
      const requestId = getLastRequestId();
      simulateResponse(requestId, { capabilities: {} });

      await initPromise;
      expect(controller.getState().initialized).toBe(true);
    });

    it("initialize emits statusChange event", async () => {
      const statusHandler = vi.fn();
      controller.on("statusChange", statusHandler);

      const _mockTransport = getMockTransport();
      
      const initPromise = controller.initialize();
      const requestId = getLastRequestId();
      simulateResponse(requestId, { capabilities: {} });

      await initPromise;

      expect(statusHandler).toHaveBeenCalledWith(
        expect.objectContaining({ initialized: true })
      );
    });

    it("initialize rejects on error response", async () => {
      const _mockTransport = getMockTransport();
      
      const initPromise = controller.initialize();
      const requestId = getLastRequestId();
      simulateError(requestId, "Initialization failed");

      await expect(initPromise).rejects.toThrow("Initialization failed");
    });

    it("initialize tracks outgoing traffic", async () => {
      const trafficHandler = vi.fn();
      controller.on("traffic", trafficHandler);

      const _mockTransport = getMockTransport();
      
      const initPromise = controller.initialize();
      const requestId = getLastRequestId();
      simulateResponse(requestId, { capabilities: {} });

      await initPromise;

      expect(trafficHandler).toHaveBeenCalledWith("out", expect.objectContaining({
        method: "initialize",
      }));
    });
  });

  describe("session management", () => {
    beforeEach(() => {
      controller.connect();
    });

    it("createSession creates new session and sets sessionId", async () => {
      const _mockTransport = getMockTransport();
      
      const createPromise = controller.createSession("/test/workspace", []);
      const requestId = getLastRequestId();
      simulateResponse(requestId, { sessionId: "new-session-123" });

      const result = await createPromise;

      expect(controller.getState().sessionId).toBe("new-session-123");
      expect(result).toEqual({ sessionId: "new-session-123" });
    });

    it("createSession accepts mcpServers parameter", async () => {
      const mockTransport = getMockTransport();
      const sendSpy = vi.spyOn(mockTransport, "send");
      
      const createPromise = controller.createSession("/test", [{ name: "test-mcp", config: {} }]);
      const requestId = getLastRequestId();
      simulateResponse(requestId, { sessionId: "session-with-mcp" });

      await createPromise;

      expect(sendSpy).toHaveBeenCalled();
      const sentData = sendSpy.mock.calls[0]![0]!;
      const parsed = JSON.parse(sentData as string);
      expect(parsed.params.mcpServers).toEqual([{ name: "test-mcp", config: {} }]);
    });

    it("createSession emits statusChange", async () => {
      const statusHandler = vi.fn();
      controller.on("statusChange", statusHandler);

      const _mockTransport = getMockTransport();
      
      const createPromise = controller.createSession("/test", []);
      const requestId = getLastRequestId();
      simulateResponse(requestId, { sessionId: "session-123" });

      await createPromise;

      expect(statusHandler).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: "session-123" })
      );
    });

    it("loadSession emits sessionClearing before loading", async () => {
      const clearingHandler = vi.fn();
      controller.on("sessionClearing", clearingHandler);

      const _mockTransport = getMockTransport();
      
      const loadPromise = controller.loadSession("existing-session", "/test");
      
      // Verify clearing was emitted immediately
      expect(clearingHandler).toHaveBeenCalled();
      
      const requestId = getLastRequestId();
      simulateResponse(requestId, { sessionId: "existing-session" });

      await loadPromise;

      expect(controller.getState().sessionId).toBe("existing-session");
    });

    it("loadSession accepts optional mcpServers", async () => {
      const mockTransport = getMockTransport();
      const sendSpy = vi.spyOn(mockTransport, "send");
      
      const loadPromise = controller.loadSession("session-1", "/test", [{ name: "mcp" }]);
      const requestId = getLastRequestId();
      simulateResponse(requestId, { sessionId: "loaded" });

      await loadPromise;

      const sentData = sendSpy.mock.calls[0]![0]!;
      const parsed = JSON.parse(sentData as string);
      expect(parsed.params.mcpServers).toEqual([{ name: "mcp" }]);
    });

    it("listSessions returns sessions list", async () => {
      const _mockTransport = getMockTransport();
      
      const listPromise = controller.listSessions();
      const requestId = getLastRequestId();
      simulateResponse(requestId, {
        sessions: [
          { sessionId: "s1", cwd: "/path1", title: "Session 1", updatedAt: "2024-01-01" },
          { sessionId: "s2", cwd: "/path2" },
        ],
        nextCursor: "cursor-123",
      });

      const result = await listPromise;

      expect(result.sessions).toHaveLength(2);
      expect(result.sessions[0].sessionId).toBe("s1");
      expect(result.nextCursor).toBe("cursor-123");
    });

    it("listSessions accepts cursor and cwd parameters", async () => {
      const mockTransport = getMockTransport();
      const sendSpy = vi.spyOn(mockTransport, "send");
      
      const listPromise = controller.listSessions("cursor-abc", "/specific/cwd");
      const requestId = getLastRequestId();
      simulateResponse(requestId, { sessions: [] });

      await listPromise;

      const sentData = sendSpy.mock.calls[0]![0]!;
      const parsed = JSON.parse(sentData as string);
      expect(parsed.params.cursor).toBe("cursor-abc");
      expect(parsed.params.cwd).toBe("/specific/cwd");
    });
  });

  describe("prompt lifecycle", () => {
    beforeEach(() => {
      controller.connect();
    });

    it("sendPrompt sends prompt with correct structure", async () => {
      const mockTransport = getMockTransport();
      const sendSpy = vi.spyOn(mockTransport, "send");
      
      const promptPromise = controller.sendPrompt("session-123", "Hello, world!");
      const requestId = getLastRequestId();
      simulateResponse(requestId, {});

      await promptPromise;

      expect(sendSpy).toHaveBeenCalled();
      const sentData = sendSpy.mock.calls[0]![0]!;
      const parsed = JSON.parse(sentData as string);
      expect(parsed.method).toBe("session/prompt");
      expect(parsed.params.sessionId).toBe("session-123");
      expect(parsed.params.prompt).toEqual([{ type: "text", text: "Hello, world!" }]);
    });

    it("sendPrompt tracks outgoing traffic", async () => {
      const trafficHandler = vi.fn();
      controller.on("traffic", trafficHandler);

      const _mockTransport = getMockTransport();
      
      const promptPromise = controller.sendPrompt("session-123", "Test prompt");
      const requestId = getLastRequestId();
      simulateResponse(requestId, {});

      await promptPromise;

      expect(trafficHandler).toHaveBeenCalledWith("out", expect.objectContaining({
        method: "session/prompt",
      }));
    });

    it("cancelPrompt sends notification without id", () => {
      const mockTransport = getMockTransport();
      const sendSpy = vi.spyOn(mockTransport, "send");

      controller.cancelPrompt("session-123");

      expect(sendSpy).toHaveBeenCalled();
      const sentData = sendSpy.mock.calls[0]![0]!;
      const parsed = JSON.parse(sentData as string);
      expect(parsed.method).toBe("session/cancel");
      expect(parsed.params.sessionId).toBe("session-123");
      expect(parsed.jsonrpc).toBe("2.0");
      expect("id" in parsed).toBe(false); // Notifications don't have id
    });

    it("cancelPrompt tracks outgoing traffic", () => {
      const trafficHandler = vi.fn();
      controller.on("traffic", trafficHandler);

      controller.cancelPrompt("session-123");

      expect(trafficHandler).toHaveBeenCalledWith("out", expect.objectContaining({
        method: "session/cancel",
      }));
    });
  });

  describe("permission handling", () => {
    beforeEach(() => {
      controller.connect();
    });

    it("respondToPermission sends correct response", async () => {
      const mockTransport = getMockTransport();
      const sendSpy = vi.spyOn(mockTransport, "send");

      await controller.respondToPermission(42, "allow-once");

      expect(sendSpy).toHaveBeenCalled();
      const sentData = sendSpy.mock.calls[0]![0]!;
      const parsed = JSON.parse(sentData as string);
      expect(parsed.jsonrpc).toBe("2.0");
      expect(parsed.id).toBe(42);
      expect(parsed.result).toEqual({
        outcome: { outcome: "selected", optionId: "allow-once" },
      });
    });

    it("respondToPermission tracks outgoing traffic", async () => {
      const trafficHandler = vi.fn();
      controller.on("traffic", trafficHandler);

      await controller.respondToPermission(42, "allow");

      expect(trafficHandler).toHaveBeenCalledWith("out", expect.objectContaining({
        id: 42,
        result: expect.objectContaining({
          outcome: expect.objectContaining({ optionId: "allow" }),
        }),
      }));
    });

    it("cancelPermission sends cancel response", async () => {
      const mockTransport = getMockTransport();
      const sendSpy = vi.spyOn(mockTransport, "send");

      await controller.cancelPermission(42);

      expect(sendSpy).toHaveBeenCalled();
      const sentData = sendSpy.mock.calls[0]![0]!;
      const parsed = JSON.parse(sentData as string);
      expect(parsed.jsonrpc).toBe("2.0");
      expect(parsed.id).toBe(42);
      expect(parsed.result).toEqual({
        outcome: { outcome: "cancelled" },
      });
    });

    it("handles permission request from server", () => {
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
          id: 99,
          params: {
            sessionId: "test-session",
            toolCall: { toolCallId: "tc-read-file" },
            options: [
              { optionId: "allow", name: "Allow", kind: "allow_once" },
              { optionId: "deny", name: "Deny", kind: "deny" },
            ],
          },
        },
      };
      mockTransport.emitEnvelope(envelope);

      expect(permissionHandler).toHaveBeenCalledWith({
        sessionId: "test-session",
        toolCall: { toolCallId: "tc-read-file" },
        options: expect.arrayContaining([
          expect.objectContaining({ optionId: "allow" }),
        ]),
        requestId: 99,
      });
    });
  });

  describe("filesystem operations", () => {
    beforeEach(() => {
      controller.connect();
    });

    it("subscribeToFileReads returns subscription", () => {
      const handler = vi.fn();
      const subscription = controller.subscribeToFileReads(handler);

      expect(subscription).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe("function");
    });

    it("subscribeToFileWrites returns subscription", () => {
      const handler = vi.fn();
      const subscription = controller.subscribeToFileWrites(handler);

      expect(subscription).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe("function");
    });

    it("handleFileReadRequest validates path and rejects paths with ..", async () => {
      const mockTransport = getMockTransport();
      const sendSpy = vi.spyOn(mockTransport, "send");

      // Subscribe to file reads
      controller.subscribeToFileReads(async () => ({ content: "test content" }));

      // Simulate server request with invalid path
      const envelope: BridgeEnvelope = {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: {
          jsonrpc: "2.0",
          method: "fs/read_text_file",
          id: 100,
          params: { path: "../../../etc/passwd" },
        },
      };
      mockTransport.emitEnvelope(envelope);

      // Should send error response for invalid path
      await vi.waitFor(() => {
        expect(sendSpy).toHaveBeenCalled();
      }, { timeout: 1000 });
      
      const sentData = sendSpy.mock.calls[sendSpy.mock.calls.length - 1]![0]!;
      const parsed = JSON.parse(sentData as string);
      expect(parsed.id).toBe(100);
      expect(parsed.error).toBeDefined();
      expect(parsed.error.message).toBe("Invalid path");
    });

    it("handleFileReadRequest validates path and rejects absolute paths", async () => {
      const mockTransport = getMockTransport();
      const sendSpy = vi.spyOn(mockTransport, "send");
      const fileReadHandler = vi.fn().mockResolvedValue({ content: "test" });
      
      controller.subscribeToFileReads(fileReadHandler);

      const envelope: BridgeEnvelope = {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: {
          jsonrpc: "2.0",
          method: "fs/read_text_file",
          id: 100,
          params: { path: "/etc/passwd" },
        },
      };
      mockTransport.emitEnvelope(envelope);

      // Should send error response for absolute path
      await vi.waitFor(() => {
        expect(sendSpy).toHaveBeenCalled();
      }, { timeout: 1000 });
      
      // Should not call handler
      expect(fileReadHandler).not.toHaveBeenCalled();
      const sentData = sendSpy.mock.calls[sendSpy.mock.calls.length - 1]![0]!;
      const parsed = JSON.parse(sentData as string);
      expect(parsed.id).toBe(100);
      expect(parsed.error).toBeDefined();
      expect(parsed.error.message).toBe("Invalid path");
    });

    it("handleFileReadRequest calls subscribed handler and sends response", async () => {
      const mockTransport = getMockTransport();
      const sendSpy = vi.spyOn(mockTransport, "send");
      const fileReadHandler = vi.fn().mockResolvedValue({ content: "file content here" });
      
      controller.subscribeToFileReads(fileReadHandler);

      const envelope: BridgeEnvelope = {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: {
          jsonrpc: "2.0",
          method: "fs/read_text_file",
          id: 100,
          params: { path: "src/index.ts", line: 1, limit: 10 },
        },
      };
      mockTransport.emitEnvelope(envelope);

      // Wait for async handler to complete AND response to be sent
      await vi.waitFor(() => {
        expect(fileReadHandler).toHaveBeenCalled();
        expect(sendSpy).toHaveBeenCalled();
      }, { timeout: 1000 });

      expect(fileReadHandler).toHaveBeenCalledWith({
        path: "src/index.ts",
        line: 1,
        limit: 10,
      });
      const sentData = sendSpy.mock.calls[sendSpy.mock.calls.length - 1]![0]!;
      const parsed = JSON.parse(sentData as string);
      expect(parsed.id).toBe(100);
      expect(parsed.result).toEqual({ content: "file content here" });
    });

    it("handleFileWriteRequest calls subscribed handler and sends response", async () => {
      const mockTransport = getMockTransport();
      const sendSpy = vi.spyOn(mockTransport, "send");
      const fileWriteHandler = vi.fn().mockResolvedValue({ success: true });
      
      controller.subscribeToFileWrites(fileWriteHandler);

      const envelope: BridgeEnvelope = {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: {
          jsonrpc: "2.0",
          method: "fs/write_text_file",
          id: 101,
          params: { path: "output.txt", content: "hello world" },
        },
      };
      mockTransport.emitEnvelope(envelope);

      // Wait for async handler to complete AND response to be sent
      await vi.waitFor(() => {
        expect(fileWriteHandler).toHaveBeenCalled();
        expect(sendSpy).toHaveBeenCalled();
      }, { timeout: 1000 });

      expect(fileWriteHandler).toHaveBeenCalledWith({
        path: "output.txt",
        content: "hello world",
      });
      const sentData = sendSpy.mock.calls[sendSpy.mock.calls.length - 1]![0]!;
      const parsed = JSON.parse(sentData as string);
      expect(parsed.id).toBe(101);
      expect(parsed.result).toEqual({ success: true });
    });

    it("handleFileWriteRequest validates path", async () => {
      const mockTransport = getMockTransport();
      const sendSpy = vi.spyOn(mockTransport, "send");
      const fileWriteHandler = vi.fn().mockResolvedValue({ success: true });
      
      controller.subscribeToFileWrites(fileWriteHandler);

      const envelope: BridgeEnvelope = {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: {
          jsonrpc: "2.0",
          method: "fs/write_text_file",
          id: 101,
          params: { path: "../malicious.txt", content: "hack" },
        },
      };
      mockTransport.emitEnvelope(envelope);

      // Wait for error response to be sent
      await vi.waitFor(() => {
        expect(sendSpy).toHaveBeenCalled();
      }, { timeout: 1000 });
      
      // Should send error response, not call handler
      expect(fileWriteHandler).not.toHaveBeenCalled();
      const sentData = sendSpy.mock.calls[sendSpy.mock.calls.length - 1]![0]!;
      const parsed = JSON.parse(sentData as string);
      expect(parsed.id).toBe(101);
      expect(parsed.error).toBeDefined();
      expect(parsed.error.message).toBe("Invalid path");
    });
  });

  describe("startAgent and initLive", () => {
    beforeEach(() => {
      controller.connect();
    });

    it("startAgent sends bridge envelope with agent config", async () => {
      const mockTransport = getMockTransport();
      const sendSpy = vi.spyOn(mockTransport, "send");
      const trafficHandler = vi.fn();
      controller.on("traffic", trafficHandler);

      // Wait for connection to be established
      await new Promise(resolve => setTimeout(resolve, 10));

      await controller.startAgent({
        command: "node",
        args: ["agent.js"],
        cwd: "/workspace",
        env: [["NODE_ENV", "test"]],
      });

      expect(sendSpy).toHaveBeenCalled();
      const sentData = sendSpy.mock.calls[0]![0]!;
      const parsed = JSON.parse(sentData as string);
      expect(parsed.type).toBe("start_agent");
      expect(parsed.command).toBe("node");
      expect(parsed.args).toEqual(["agent.js"]);
      expect(parsed.cwd).toBe("/workspace");
      expect(parsed.env).toEqual([["NODE_ENV", "test"]]);
    });

    it("startAgent waits for WebSocket connection before sending", async () => {
      const mockTransport = getMockTransport();
      const sendSpy = vi.spyOn(mockTransport, "send");

      // Set transport to disconnected state
      mockTransport.setStatus("disconnected");

      // Start agent (should wait for connection)
      const startPromise = controller.startAgent({ command: "test" });

      // Simulate connection after delay
      setTimeout(() => mockTransport.setStatus("connected"), 50);

      await startPromise;
      expect(sendSpy).toHaveBeenCalled();
    });

    it("startAgent rejects if connection times out", async () => {
      const mockTransport = getMockTransport();
      mockTransport.setStatus("disconnected");

      // Don't connect, just wait for timeout
      await expect(controller.startAgent({ command: "test" }))
        .rejects.toThrow("Connection timeout");
    });

    it("initLive delegates to transport", async () => {
      const result = await controller.initLive("npx", ["-y", "agent"], "/workspace");

      expect(result).toEqual({ status: "success", mode: "live" });
    });
  });

  describe("session update handling", () => {
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
                update: { type: "thought", id: "t-1" },
              },
            ],
          },
        },
      };
      mockTransport.emitEnvelope(envelope);

      expect(sessionUpdateHandler).toHaveBeenCalledTimes(2);
      expect(sessionUpdateHandler).toHaveBeenNthCalledWith(1, {
        sessionId: "session-123",
        update: { type: "message", id: "msg-1" },
      });
      expect(sessionUpdateHandler).toHaveBeenNthCalledWith(2, {
        sessionId: "session-123",
        update: { type: "thought", id: "t-1" },
      });
    });

    it("emits sessionUpdate for result messages", async () => {
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
          id: 1,
          result: {
            sessionId: "session-123",
            messages: [{ type: "message", content: "response" }],
            thoughts: [{ type: "thought", content: "thinking" }],
          },
        },
      };
      mockTransport.emitEnvelope(envelope);

      await vi.waitFor(() => {
        expect(sessionUpdateHandler).toHaveBeenCalledTimes(2);
      }, { timeout: 100 });
    });
  });

  describe("bridge status handling", () => {
    beforeEach(() => {
      controller.connect();
    });

    it("updates bridgeStatus on bridge_status envelope", () => {
      const statusHandler = vi.fn();
      controller.on("statusChange", statusHandler);

      const mockTransport = getMockTransport();
      const envelope: BridgeEnvelope = {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "bridge_status",
        status: "ready",
      };
      mockTransport.emitEnvelope(envelope);

      expect(controller.getState().bridgeStatus).toBe("ready");
      expect(statusHandler).toHaveBeenCalledWith(
        expect.objectContaining({ bridgeStatus: "ready" })
      );
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      controller.connect();
    });

    it("rejects requests on error response", async () => {
      const _mockTransport = getMockTransport();
      
      const createPromise = controller.createSession("/test", []);
      const requestId = getLastRequestId();
      simulateError(requestId, "Session not found");

      await expect(createPromise).rejects.toThrow("Session not found");
    });

    it("emits error for transport errors", () => {
      const errorHandler = vi.fn();
      controller.on("error", errorHandler);

      const mockTransport = getMockTransport();
      const error = new Error("WebSocket connection failed");
      mockTransport.emitError(error);

      expect(errorHandler).toHaveBeenCalledWith(error);
    });

    it("rejects pending requests on disconnect", async () => {
      const _mockTransport = getMockTransport();

      // Start request but don't respond
      const initPromise = controller.initialize();

      // Disconnect before response arrives
      controller.disconnect();

      await expect(initPromise).rejects.toThrow("Disconnected");
    });

    it("request timeout rejects pending request", async () => {
      const controllerWithTimeout = new SessionController("ws://test", 50);
      controllerWithTimeout.connect();

      try {
        // Don't respond, let it timeout
        await expect(controllerWithTimeout.initialize())
          .rejects.toThrow(/timed out/);
      } finally {
        await controllerWithTimeout.disconnect();
      }
    });
  });

  describe("traffic tracking", () => {
    beforeEach(() => {
      controller.connect();
    });

    it("tracks incoming traffic from envelopes", () => {
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

    it("tracks outgoing traffic from requests", async () => {
      const trafficHandler = vi.fn();
      controller.on("traffic", trafficHandler);

      const _mockTransport = getMockTransport();
      
      const createPromise = controller.createSession("/test", []);
      const requestId = getLastRequestId();
      simulateResponse(requestId, {});

      await createPromise;

      expect(trafficHandler).toHaveBeenCalledWith("out", expect.objectContaining({
        method: "session/new",
      }));
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
});
