import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionController } from "./controller.js";
import { MockTransport } from "../test-utils/mocks.js";

describe("SessionController", () => {
  let controller: SessionController;
  let mockTransport: MockTransport;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTransport = new MockTransport();
    controller = new SessionController(mockTransport, 30000);
  });

  function getMockTransport(): MockTransport {
    return mockTransport;
  }

  function getLastSentData(): any {
    return getMockTransport().lastSent;
  }

  function emitNotification(notification: any) {
    getMockTransport().emitNotification(notification);
  }

  function emitStatus(status: "disconnected" | "connected") {
    getMockTransport().setStatus(status);
  }

  describe("initialization", () => {
    it("initializes with disconnected state", () => {
      const state = controller.getState();
      expect(state.connectionStatus).toBe("disconnected");
      expect(state.sessionId).toBeNull();
      expect(state.initialized).toBe(false);
    });

    it("exposes state through getState with copy semantics", () => {
      const state1 = controller.getState();
      const state2 = controller.getState();
      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2);
      (state1 as any).connectionStatus = "connected";
      expect(controller.getState().connectionStatus).toBe("disconnected");
    });
  });

  describe("connection lifecycle", () => {
    it("connects and updates connectionStatus to connected", () => {
      controller.connect();
      expect(controller.getState().connectionStatus).toBe("connected");
    });

    it("disconnects and updates connectionStatus to disconnected", () => {
      controller.connect();
      controller.disconnect();
      expect(controller.getState().connectionStatus).toBe("disconnected");
    });

    it("disconnect clears pending requests", async () => {
      const promise = controller.initialize({ name: "test", version: "1.0" });
      controller.disconnect();
      await expect(promise).rejects.toThrow("Disconnected");
    });

    it("emits statusChange on connection state changes", () => {
      const handler = vi.fn();
      controller.on("statusChange", handler);
      controller.connect();
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("event handlers", () => {
    it("accepts statusChange event handlers", () => {
      const handler = vi.fn();
      const unsubscribe = controller.on("statusChange", handler);
      emitStatus("connected");
      expect(handler).toHaveBeenCalled();
      unsubscribe();
      emitStatus("disconnected");
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("accepts sessionUpdate event handlers", () => {
      const handler = vi.fn();
      controller.on("sessionUpdate", handler);
      emitNotification({ jsonrpc: "2.0", method: "session/update", params: { sessionId: "test", update: { type: "test" } } });
      expect(handler).toHaveBeenCalled();
    });

    it("accepts traffic event handlers", () => {
      const handler = vi.fn();
      controller.on("traffic", handler);
      emitNotification({ jsonrpc: "2.0", method: "session/update", params: { sessionId: "test" } });
      expect(handler).toHaveBeenCalledWith("in", expect.any(Object));
    });

    it("accepts error event handlers", () => {
      const handler = vi.fn();
      controller.on("error", handler);
      emitNotification({ jsonrpc: "2.0", id: 1, error: { code: -32600, message: "Invalid Request" } });
      expect(handler).toHaveBeenCalled();
    });

    it("accepts sessionClearing event handlers", () => {
      const handler = vi.fn();
      controller.on("sessionClearing", handler);
      controller.loadSession("session-1", "/workspace");
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("accepts permissionRequest event handlers", () => {
      const handler = vi.fn();
      controller.on("permissionRequest", handler);
      emitNotification({
        jsonrpc: "2.0",
        id: 42,
        method: "session/request_permission",
        params: { sessionId: "test", toolCall: { toolCallId: "tool-1" }, options: [{ optionId: "opt-1", name: "Allow", kind: "allow_once" }] }
      });
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ sessionId: "test", requestId: 42 }));
    });
  });

  describe("initialization with connection", () => {
    it("initialize sends initialize request and sets initialized flag", async () => {
      await controller.initialize({ name: "test", version: "1.0" });
      expect(controller.getState().initialized).toBe(true);
      expect(getLastSentData()).toContain("initialize");
    });

    it("initialize works without clientInfo", async () => {
      await controller.initialize();
      expect(controller.getState().initialized).toBe(true);
    });

    it("initialize emits statusChange event", async () => {
      const handler = vi.fn();
      controller.on("statusChange", handler);
      await controller.initialize({ name: "test", version: "1.0" });
      expect(handler).toHaveBeenCalled();
    });

    it("initialize rejects on error response", async () => {
      mockTransport = new MockTransport(async () => { throw new Error("Init failed"); });
      controller = new SessionController(mockTransport, 30000);
      await expect(controller.initialize({ name: "test", version: "1.0" })).rejects.toThrow("Init failed");
    });

    it("initialize tracks outgoing traffic", async () => {
      const handler = vi.fn();
      controller.on("traffic", handler);
      await controller.initialize({ name: "test", version: "1.0" });
      expect(handler).toHaveBeenCalledWith("out", expect.objectContaining({ method: "initialize" }));
    });
  });

  describe("session management", () => {
    it("createSession creates new session and sets sessionId", async () => {
      mockTransport = new MockTransport(async () => ({ sessionId: "new-session-123" }));
      controller = new SessionController(mockTransport, 30000);
      await controller.createSession("/workspace");
      expect(controller.getState().sessionId).toBe("new-session-123");
    });

    it("createSession accepts mcpServers parameter", async () => {
      let capturedParams: any;
      mockTransport = new MockTransport(async (req) => { capturedParams = req.params; return { sessionId: "session-1" }; });
      controller = new SessionController(mockTransport, 30000);
      await controller.createSession("/workspace", [{ name: "server1" }]);
      expect(capturedParams).toEqual(expect.objectContaining({ mcpServers: [{ name: "server1" }] }));
    });

    it("createSession emits statusChange", async () => {
      mockTransport = new MockTransport(async () => ({ sessionId: "session-1" }));
      controller = new SessionController(mockTransport, 30000);
      const handler = vi.fn();
      controller.on("statusChange", handler);
      await controller.createSession("/workspace");
      expect(handler).toHaveBeenCalled();
    });

    it("loadSession emits sessionClearing before loading", async () => {
      const handler = vi.fn();
      controller.on("sessionClearing", handler);
      await controller.loadSession("existing-session", "/workspace");
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("loadSession accepts optional mcpServers", async () => {
      let capturedParams: any;
      mockTransport = new MockTransport(async (req) => { capturedParams = req.params; return {}; });
      controller = new SessionController(mockTransport, 30000);
      await controller.loadSession("session-1", "/workspace", [{ name: "server1" }]);
      expect(capturedParams).toEqual(expect.objectContaining({ mcpServers: [{ name: "server1" }] }));
    });

    it("listSessions returns sessions list", async () => {
      mockTransport = new MockTransport(async () => ({ sessions: [{ sessionId: "s1", cwd: "/w1" }, { sessionId: "s2", cwd: "/w2" }] }));
      controller = new SessionController(mockTransport, 30000);
      const result = await controller.listSessions();
      expect(result.sessions).toHaveLength(2);
    });

    it("listSessions accepts cursor and cwd parameters", async () => {
      let capturedParams: any;
      mockTransport = new MockTransport(async (req) => { capturedParams = req.params; return { sessions: [] }; });
      controller = new SessionController(mockTransport, 30000);
      await controller.listSessions("cursor-123", "/workspace");
      expect(capturedParams).toEqual({ cursor: "cursor-123", cwd: "/workspace" });
    });
  });

  describe("prompt lifecycle", () => {
    it("sendPrompt sends prompt with correct structure", async () => {
      await controller.sendPrompt("session-1", "Hello, agent!");
      const parsed = JSON.parse(getLastSentData());
      expect(parsed.method).toBe("session/prompt");
    });

    it("sendPrompt tracks outgoing traffic", async () => {
      const handler = vi.fn();
      controller.on("traffic", handler);
      await controller.sendPrompt("session-1", "Test prompt");
      expect(handler).toHaveBeenCalledWith("out", expect.any(Object));
    });

 it("cancelPrompt sends notification without id", () => {
  controller.cancelPrompt("session-1");
  const parsed = JSON.parse(getLastSentData());
  expect(parsed.method).toBe("session/cancel");
  expect(parsed.id).toBeUndefined();
 });

    it("cancelPrompt tracks outgoing traffic", () => {
      const handler = vi.fn();
      controller.on("traffic", handler);
      controller.cancelPrompt("session-1");
      expect(handler).toHaveBeenCalledWith("out", expect.any(Object));
    });
  });

  describe("permission handling", () => {
    it("respondToPermission sends correct response", async () => {
      const handler = vi.fn();
      controller.on("traffic", handler);
      await controller.respondToPermission(42, "allow-once");
      expect(handler).toHaveBeenCalledWith("out", expect.objectContaining({ result: { outcome: { outcome: "selected", optionId: "allow-once" } } }));
    });

    it("respondToPermission tracks outgoing traffic", async () => {
      const handler = vi.fn();
      controller.on("traffic", handler);
      await controller.respondToPermission(42, "allow-once");
      expect(handler).toHaveBeenCalledWith("out", expect.any(Object));
    });

    it("cancelPermission sends cancel response", async () => {
      const handler = vi.fn();
      controller.on("traffic", handler);
      await controller.cancelPermission(42);
      expect(handler).toHaveBeenCalledWith("out", expect.objectContaining({ result: { outcome: { outcome: "cancelled" } } }));
    });

    it("handles permission request from server", () => {
      const handler = vi.fn();
      controller.on("permissionRequest", handler);
      emitNotification({ jsonrpc: "2.0", id: 99, method: "session/request_permission", params: { sessionId: "test", toolCall: { toolCallId: "tool-1" }, options: [{ optionId: "opt-1", name: "Allow", kind: "allow_once" }] } });
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ sessionId: "test", requestId: 99 }));
    });
  });

  describe("filesystem operations", () => {
    it("subscribeToFileReads returns subscription", () => {
      const handler = vi.fn().mockResolvedValue({ content: "test" });
      const subscription = controller.subscribeToFileReads(handler);
      expect(subscription).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe("function");
    });

    it("subscribeToFileWrites returns subscription", () => {
      const handler = vi.fn().mockResolvedValue({ success: true });
      const subscription = controller.subscribeToFileWrites(handler);
      expect(subscription).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe("function");
    });

    it("handleFileReadRequest validates path and rejects paths with ..", async () => {
      const trafficHandler = vi.fn();
      controller.on("traffic", trafficHandler);
      const handler = vi.fn().mockResolvedValue({ content: "test" });
      controller.subscribeToFileReads(handler);
      emitNotification({ jsonrpc: "2.0", id: 1, method: "fs/read_text_file", params: { path: "../etc/passwd" } });
      await vi.waitFor(() => {
        const errors = trafficHandler.mock.calls.filter((c: any) => c[0] === "out" && c[1].error);
        expect(errors.length).toBeGreaterThan(0);
      });
    });

    it("handleFileReadRequest validates path and rejects absolute paths", async () => {
      const trafficHandler = vi.fn();
      controller.on("traffic", trafficHandler);
      const handler = vi.fn().mockResolvedValue({ content: "test" });
      controller.subscribeToFileReads(handler);
      emitNotification({ jsonrpc: "2.0", id: 1, method: "fs/read_text_file", params: { path: "/etc/passwd" } });
      await vi.waitFor(() => {
        const errors = trafficHandler.mock.calls.filter((c: any) => c[0] === "out" && c[1].error);
        expect(errors.length).toBeGreaterThan(0);
      });
    });

    it("handleFileReadRequest calls subscribed handler and sends response", async () => {
      const handler = vi.fn().mockResolvedValue({ content: "file content" });
      const trafficHandler = vi.fn();
      controller.on("traffic", trafficHandler);
      controller.subscribeToFileReads(handler);
      emitNotification({ jsonrpc: "2.0", id: 1, method: "fs/read_text_file", params: { path: "test.txt" } });
      await vi.waitFor(() => {
        expect(handler).toHaveBeenCalledWith({ path: "test.txt" });
        const responses = trafficHandler.mock.calls.filter((c: any) => c[0] === "out" && c[1].result);
        expect(responses.length).toBeGreaterThan(0);
      });
    });

    it("handleFileWriteRequest calls subscribed handler and sends response", async () => {
      const handler = vi.fn().mockResolvedValue({ success: true });
      controller.subscribeToFileWrites(handler);
      emitNotification({ jsonrpc: "2.0", id: 1, method: "fs/write_text_file", params: { path: "test.txt", content: "new content" } });
      await vi.waitFor(() => {
        expect(handler).toHaveBeenCalledWith({ path: "test.txt", content: "new content" });
      });
    });

    it("handleFileWriteRequest validates path", async () => {
      const trafficHandler = vi.fn();
      controller.on("traffic", trafficHandler);
      const handler = vi.fn().mockResolvedValue({ success: true });
      controller.subscribeToFileWrites(handler);
      emitNotification({ jsonrpc: "2.0", id: 1, method: "fs/write_text_file", params: { path: "../etc/passwd", content: "malicious" } });
      await vi.waitFor(() => {
        const errors = trafficHandler.mock.calls.filter((c: any) => c[0] === "out" && c[1].error);
        expect(errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe("session update handling", () => {
    it("emits sessionUpdate for session/update notifications", () => {
      const handler = vi.fn();
      controller.on("sessionUpdate", handler);
      emitNotification({ jsonrpc: "2.0", method: "session/update", params: { sessionId: "test", update: { type: "test_update" } }});
      expect(handler).toHaveBeenCalledWith({ sessionId: "test", update: { type: "test_update" } });
    });

    it("handles batched session updates", () => {
      const handler = vi.fn();
      controller.on("sessionUpdate", handler);
      emitNotification({ jsonrpc: "2.0", method: "session/update", params: { batched: true, updates: [{ params: { sessionId: "test", update: { type: "update1" } } }, { params: { sessionId: "test", update: { type: "update2" } } }] } });
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it("emits sessionUpdate for result messages", () => {
      const handler = vi.fn();
      controller.on("sessionUpdate", handler);
      emitNotification({ jsonrpc: "2.0", id: 1, result: { sessionId: "test", messages: [{ type: "agent_message_chunk", content: "Hello" }], thoughts: [{ type: "agent_thought_chunk", content: "Thinking" }] }});
      expect(handler).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("rejects requests on error response", async () => {
      mockTransport = new MockTransport(async () => ({ jsonrpc: "2.0", id: 1, error: { code: -32600, message: "Invalid Request" } }));
      controller = new SessionController(mockTransport, 30000);
      await expect(controller.initialize({ name: "test", version: "1.0" })).rejects.toThrow("Invalid Request");
    });

    it("emits error for transport errors", () => {
      const handler = vi.fn();
      controller.on("error", handler);
      mockTransport.emitError(new Error("Connection lost"));
      expect(handler).toHaveBeenCalledWith(new Error("Connection lost"));
    });

    it("rejects pending requests on disconnect", async () => {
      const promise = controller.initialize({ name: "test", version: "1.0" });
      controller.disconnect();
      await expect(promise).rejects.toThrow("Disconnected");
    });

    it("request timeout rejects pending request", async () => {
      mockTransport = new MockTransport(async () => new Promise(() => {}));
      const controllerWithTimeout = new SessionController(mockTransport, 10);
      await expect(controllerWithTimeout.initialize({ name: "test", version: "1.0" })).rejects.toThrow("timed out");
    });
  });

  describe("traffic tracking", () => {
    it("tracks incoming traffic from envelopes", () => {
      const handler = vi.fn();
      controller.on("traffic", handler);
      emitNotification({ jsonrpc: "2.0", method: "test" });
      expect(handler).toHaveBeenCalledWith("in", expect.any(Object));
    });

    it("tracks outgoing traffic from requests", async () => {
      const handler = vi.fn();
      controller.on("traffic", handler);
      await controller.initialize({ name: "test", version: "1.0" });
      expect(handler).toHaveBeenCalledWith("out", expect.objectContaining({ method: "initialize" }));
    });
  });

  describe("getState returns copies", () => {
    it("returns independent state objects", () => {
      const state1 = controller.getState();
      const state2 = controller.getState();
      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2);
    });

    it("modifications to returned state do not affect controller", () => {
      const state = controller.getState();
      (state as any).connectionStatus = "modified";
      expect(controller.getState().connectionStatus).toBe("disconnected");
    });
  });
});
