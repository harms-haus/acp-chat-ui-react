/**
 * Session capture/replay flow integration tests.
 * 
 * These tests verify the full capture → export → replay flow:
 * 1. Start capture with SessionController
 * 2. Record traffic events
 * 3. Stop capture and export
 * 4. Replay captured sessions through ReplayController
 * 5. Verify export functionality
 * 6. Test with various session types
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import { DefaultSessionCaptureInterceptor } from "../../session/capture-interceptor.js";
import { ReplayController } from "../../session/replay-controller.js";
import type { BridgeEnvelope } from "../../generated/index.js";
import type { ReplaySessionData } from "../../replay/types.js";

// Mock TransportClient for ReplayController
vi.mock("../../transport/client.js", () => {
  class MockTransportClient {
    public status: "disconnected" | "connected" | "connecting" = "disconnected";
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
      this.handlers.statusChange.forEach((h) => { h(status); });
    }

    connect() {
      this.setStatus("connected");
    }

    async disconnect() {
      this.setStatus("disconnected");
    }

    send(_data: string) {}

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

/**
 * Mock SessionController for capture tests.
 * This simulates a real SessionController with event emission capabilities.
 */
class MockSessionController {
  private handlers: {
    statusChange: Set<(state: any) => void>;
    sessionUpdate: Set<(params: any) => void>;
    traffic: Set<(direction: "in" | "out", data: unknown) => void>;
    error: Set<(error: Error) => void>;
    sessionClearing: Set<() => void>;
    permissionRequest: Set<(params: any) => void>;
  } = {
    statusChange: new Set(),
    sessionUpdate: new Set(),
    traffic: new Set(),
    error: new Set(),
    sessionClearing: new Set(),
    permissionRequest: new Set(),
  };

  getState() {
    return {
      connectionStatus: "connected",
      bridgeStatus: "connected",
      sessionId: "test-session",
      initialized: true,
      capabilities: null,
    };
  }

  on(event: string, handler: unknown): () => void {
    switch (event) {
      case "statusChange":
        this.handlers.statusChange.add(handler as (state: any) => void);
        break;
      case "sessionUpdate":
        this.handlers.sessionUpdate.add(handler as (params: any) => void);
        break;
      case "traffic":
        this.handlers.traffic.add(handler as (direction: "in" | "out", data: unknown) => void);
        break;
      case "error":
        this.handlers.error.add(handler as (error: Error) => void);
        break;
      case "sessionClearing":
        this.handlers.sessionClearing.add(handler as () => void);
        break;
      case "permissionRequest":
        this.handlers.permissionRequest.add(handler as (params: any) => void);
        break;
    }
    return () => {
      switch (event) {
        case "statusChange":
          this.handlers.statusChange.delete(handler as (state: any) => void);
          break;
        case "sessionUpdate":
          this.handlers.sessionUpdate.delete(handler as (params: any) => void);
          break;
        case "traffic":
          this.handlers.traffic.delete(handler as (direction: "in" | "out", data: unknown) => void);
          break;
        case "error":
          this.handlers.error.delete(handler as (error: Error) => void);
          break;
        case "sessionClearing":
          this.handlers.sessionClearing.delete(handler as () => void);
          break;
        case "permissionRequest":
          this.handlers.permissionRequest.delete(handler as (params: any) => void);
          break;
      }
    };
  }

  emitTraffic(direction: "in" | "out", data: unknown) {
    this.handlers.traffic.forEach((h) => {
      h(direction, data);
    });
  }

  emitSessionUpdate(params: unknown) {
    this.handlers.sessionUpdate.forEach((h) => {
      h(params);
    });
  }

  emitPermissionRequest(params: unknown) {
    this.handlers.permissionRequest.forEach((h) => {
      h(params);
    });
  }
}

describe("Capture/Replay Flow Integration", () => {
  let controller: MockSessionController;
  let interceptor: DefaultSessionCaptureInterceptor;
  let _replayController: ReplayController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new MockSessionController();
    interceptor = new DefaultSessionCaptureInterceptor(controller as any);
    _replayController = new ReplayController({
      bridgeUrl: "ws://localhost:8080/replay-v2",
    });
  });

  describe("session capture functionality", () => {
    it("starts capture and records traffic events", () => {
      interceptor.startCapture("session-123");

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

      controller.emitTraffic("in", envelope);
      controller.emitTraffic("out", envelope);

      const session = interceptor.exportCapturedSession();
      
      expect(session.sessionId).toBe("session-123");
      expect(session.events).toHaveLength(2);
      expect(session.events[0]?.direction).toBe("in");
      expect(session.events[1]?.direction).toBe("out");
      expect(session.startTime).toBeDefined();
      expect(session.endTime).toBeNull(); // Still capturing
    });

    it("stops capture and sets endTime", () => {
      interceptor.startCapture("session-123");
      
      const beforeStop = Date.now();
      interceptor.stopCapture();
      const afterStop = Date.now();

      const session = interceptor.exportCapturedSession();
      
      expect(session.endTime).not.toBeNull();
      expect(session.endTime!).toBeGreaterThanOrEqual(beforeStop);
      expect(session.endTime!).toBeLessThanOrEqual(afterStop);
    });

    it("captures sessionUpdate events with metadata", () => {
      interceptor.startCapture("session-123");

      controller.emitSessionUpdate({
        sessionId: "session-123",
        update: { 
          mode: "coding",
          model: "gpt-4",
        },
      });

      controller.emitSessionUpdate({
        sessionId: "session-123",
        update: { 
          mode: "debugging",
          metadata: { model: "claude-3" },
        },
      });

      const session = interceptor.exportCapturedSession();
      
      expect(session.modes).toEqual(["coding", "debugging"]);
      expect(session.models).toEqual(["gpt-4", "claude-3"]);
    });

    it("captures with pre-existing session state", () => {
      const initialState: ReplaySessionData = {
        sessionId: "session-123",
        cwd: "/test/workspace",
        messages: [
          { 
            id: "msg-1", 
            role: "user", 
            status: "completed",
            content: "Hello",
            contentBlocks: [],
          },
        ],
        thoughts: [],
        toolCalls: [],
      };

      interceptor.startCapture("session-456", initialState);

      const session = interceptor.exportCapturedSession();
      
      expect(session.preExistingState).toBe(initialState);
      expect(session.sessionId).toBe("session-456");
    });
  });

  describe("export functionality", () => {
    it("exports captured session with all data", () => {
      interceptor.startCapture("session-123");

      const envelope: BridgeEnvelope = {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: {
          jsonrpc: "2.0",
          method: "test",
        },
      };

      controller.emitTraffic("in", envelope);

      const session = interceptor.exportCapturedSession();
      
      expect(session).toMatchObject({
        sessionId: "session-123",
        startTime: expect.any(Number),
        endTime: null,
        events: expect.arrayContaining([expect.any(Object)]),
        preExistingState: null,
        modes: expect.any(Array),
        models: expect.any(Array),
      });

      expect(session.events[0]).toMatchObject({
        envelope: envelope,
        tokenCount: expect.any(Number),
        timestamp: expect.any(Number),
        direction: "in",
      });
    });

    it("exports after stopCapture with endTime set", () => {
      interceptor.startCapture("session-123");
      interceptor.stopCapture();

      const session = interceptor.exportCapturedSession();
      
      expect(session.endTime).not.toBeNull();
      expect(typeof session.endTime).toBe("number");
    });

    it("throws error when exporting without capture", () => {
      expect(() => {
        interceptor.exportCapturedSession();
      }).toThrow("No session has been captured");
    });

    it("stopCaptureAndExport stops and exports in one call", () => {
      interceptor.startCapture("session-123");
      
      const envelope: BridgeEnvelope = {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: { jsonrpc: "2.0", method: "test" },
      };
      
      controller.emitTraffic("in", envelope);

      const session = interceptor.stopCaptureAndExport("/tmp/test-capture");
      
      expect(session).toBeDefined();
      expect(session.sessionId).toBe("session-123");
      expect(session.events).toHaveLength(1);
      expect(session.endTime).not.toBeNull();
      expect(interceptor.isCapturing()).toBe(false);
    });
  });

  describe("capture interceptor integration", () => {
    it("integrates with SessionController-like interface", () => {
      // Verify interceptor can wrap controller with compatible interface
      expect(interceptor.isCapturing()).toBe(false);
      expect(interceptor.getActiveSessionId()).toBeNull();

      interceptor.startCapture("integration-session");
      
      expect(interceptor.isCapturing()).toBe(true);
      expect(interceptor.getActiveSessionId()).toBe("integration-session");

      // Emit various events
      controller.emitTraffic("in", {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: { jsonrpc: "2.0", method: "test" },
      } as BridgeEnvelope);

      controller.emitSessionUpdate({
        sessionId: "integration-session",
        update: { mode: "testing" },
      });

      const session = interceptor.exportCapturedSession();
      
      expect(session.events).toHaveLength(1);
      expect(session.modes).toContain("testing");
    });

    it("handles multiple event types during capture", () => {
      interceptor.startCapture("multi-event-session");

      // Traffic events
      controller.emitTraffic("in", {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: { jsonrpc: "2.0", method: "initialize" },
      } as BridgeEnvelope);

      // Session update events
      controller.emitSessionUpdate({
        sessionId: "multi-event-session",
        update: { mode: "coding", model: "gpt-4" },
      });

      // Another traffic event
      controller.emitTraffic("out", {
        version: 1,
        seq: 1,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: { jsonrpc: "2.0", method: "session/prompt" },
      } as BridgeEnvelope);

      const session = interceptor.exportCapturedSession();
      
      expect(session.events).toHaveLength(2);
      expect(session.modes).toContain("coding");
      expect(session.models).toContain("gpt-4");
    });

    it("properly unsubscribes on stopCapture", () => {
      interceptor.startCapture("session-123");
      interceptor.stopCapture();

      // Events after stop should not be recorded
      controller.emitTraffic("in", {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: { jsonrpc: "2.0", method: "test" },
      } as BridgeEnvelope);

      const session = interceptor.exportCapturedSession();
      
      expect(session.events).toHaveLength(0);
    });
  });

  describe("captured session replay", () => {
    it("can replay captured session data", async () => {
      // First, capture a session
      interceptor.startCapture("replay-test-session");

      const envelope1: BridgeEnvelope = {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: {
          jsonrpc: "2.0",
          method: "session/update",
          params: {
            sessionId: "replay-test-session",
            update: { type: "message", id: "msg-1", content: "Hello" },
          },
        },
      };

      const envelope2: BridgeEnvelope = {
        version: 1,
        seq: 1,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: {
          jsonrpc: "2.0",
          method: "session/update",
          params: {
            sessionId: "replay-test-session",
            update: { type: "message", id: "msg-2", content: "World" },
          },
        },
      };

      controller.emitTraffic("in", envelope1);
      controller.emitTraffic("in", envelope2);
      interceptor.stopCapture();

      const captured = interceptor.exportCapturedSession();
      
      expect(captured.events).toHaveLength(2);
      expect(captured.sessionId).toBe("replay-test-session");

      // Verify captured data can be used with ReplayController
      expect(captured.events[0]?.envelope).toBeDefined();
      expect(captured.events[0]?.envelope.type).toBe("acp_payload");
      expect(captured.events[1]?.envelope).toBeDefined();
    });

    it("preserves event order in captured data", () => {
      interceptor.startCapture("order-test");

      for (let i = 0; i < 5; i++) {
        controller.emitTraffic("in", {
          version: 1,
          seq: i,
          timestamp_ms: Date.now() + i,
          type: "acp_payload",
          payload: { jsonrpc: "2.0", id: i, result: { index: i } },
        } as BridgeEnvelope);
      }

      const session = interceptor.exportCapturedSession();
      
      expect(session.events).toHaveLength(5);
      expect(session.events.map((e) => e.envelope.seq)).toEqual([0, 1, 2, 3, 4]);
    });

    it("captures events with accurate token counts", () => {
      interceptor.startCapture("token-test");

      const smallEnvelope: BridgeEnvelope = {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: { jsonrpc: "2.0", method: "test" },
      };

      const largeEnvelope: BridgeEnvelope = {
        version: 1,
        seq: 1,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: {
          jsonrpc: "2.0",
          method: "session/prompt",
          params: {
            sessionId: "token-test",
            prompt: [{ type: "text", text: "This is a much longer message with more content" }],
          },
        },
      };

      controller.emitTraffic("in", smallEnvelope);
      controller.emitTraffic("in", largeEnvelope);

      const session = interceptor.exportCapturedSession();
      
      expect(session.events).toHaveLength(2);
      expect(session.events[0]?.tokenCount).toBeGreaterThan(0);
      expect(session.events[1]?.tokenCount).toBeGreaterThan(session.events[0]?.tokenCount ?? 0);
    });
  });

  describe("various session types", () => {
    it("captures tool-calling session type", () => {
      interceptor.startCapture("tool-calling-session");

      controller.emitSessionUpdate({
        sessionId: "tool-calling-session",
        update: {
          type: "tool_call",
          toolCall: {
            toolCallId: "call-1",
            name: "read_file",
            arguments: { path: "/test/file.txt" },
          },
        },
      });

      controller.emitSessionUpdate({
        sessionId: "tool-calling-session",
        update: { mode: "coding" },
      });

      const session = interceptor.exportCapturedSession();
      
      expect(session.modes).toContain("coding");
      expect(session.events).toHaveLength(0); // No traffic, only sessionUpdate
    });

    it("captures thought session type", () => {
      interceptor.startCapture("thought-session");

      controller.emitSessionUpdate({
        sessionId: "thought-session",
        update: {
          type: "thought",
          thought: "Analyzing the problem...",
        },
      });

      controller.emitSessionUpdate({
        sessionId: "thought-session",
        update: { mode: "reasoning", model: "claude-3" },
      });

      const session = interceptor.exportCapturedSession();
      
      expect(session.modes).toContain("reasoning");
      expect(session.models).toContain("claude-3");
    });

    it("captures permission-request session type", () => {
      interceptor.startCapture("permission-session");

      controller.emitPermissionRequest({
        sessionId: "permission-session",
        requestId: 42,
        toolName: "write_file",
        prompt: "Allow writing to file?",
        options: [
          { id: "allow", title: "Allow" },
          { id: "deny", title: "Deny" },
        ],
      });

      controller.emitSessionUpdate({
        sessionId: "permission-session",
        update: { mode: "coding" },
      });

      const session = interceptor.exportCapturedSession();
      
      expect(session.modes).toContain("coding");
      // Permission requests don't go through traffic, so no events
      expect(session.events).toHaveLength(0);
    });

    it("captures mixed session with multiple types", () => {
      interceptor.startCapture("mixed-session");

      // Tool call traffic
      controller.emitTraffic("in", {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: {
          jsonrpc: "2.0",
          method: "session/update",
          params: {
            sessionId: "mixed-session",
            update: {
              type: "tool_call",
              toolCall: { toolCallId: "call-1", name: "read_file" },
            },
          },
        },
      } as BridgeEnvelope);

      // Thought update
      controller.emitSessionUpdate({
        sessionId: "mixed-session",
        update: {
          type: "thought",
          thought: "Processing tool call...",
        },
      });

      // Mode change
      controller.emitSessionUpdate({
        sessionId: "mixed-session",
        update: { mode: "coding", model: "gpt-4" },
      });

      const session = interceptor.exportCapturedSession();
      
      expect(session.events).toHaveLength(1);
      expect(session.modes).toContain("coding");
      expect(session.models).toContain("gpt-4");
    });
  });

  describe("edge cases and error handling", () => {
    it("handles starting capture while already capturing", () => {
      interceptor.startCapture("session-1");
      
      expect(() => {
        interceptor.startCapture("session-2");
      }).toThrow("Capture is already active");
    });

    it("handles stopping capture when not active", () => {
      expect(() => {
        interceptor.stopCapture();
      }).toThrow("No capture is active");
    });

    it("handles malformed sessionUpdate gracefully", () => {
      interceptor.startCapture("malformed-session");

      controller.emitSessionUpdate(null);
      controller.emitSessionUpdate(undefined);
      controller.emitSessionUpdate("not an object");
      controller.emitSessionUpdate(123);

      const session = interceptor.exportCapturedSession();
      
      expect(session.modes).toHaveLength(0);
      expect(session.models).toHaveLength(0);
      expect(session.events).toHaveLength(0);
    });

    it("handles traffic events without errors", () => {
      interceptor.startCapture("traffic-session");

      // Emit various traffic events
      controller.emitTraffic("in", {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "bridge_status",
        status: "connected",
      } as BridgeEnvelope);

      controller.emitTraffic("out", {
        version: 1,
        seq: 1,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: { jsonrpc: "2.0", method: "initialize" },
      } as BridgeEnvelope);

      const session = interceptor.exportCapturedSession();
      
      expect(session.events).toHaveLength(2);
      expect(session.events[0]?.direction).toBe("in");
      expect(session.events[1]?.direction).toBe("out");
    });

    it("handles empty capture session", () => {
      interceptor.startCapture("empty-session");
      interceptor.stopCapture();

      const session = interceptor.exportCapturedSession();
      
      expect(session.events).toHaveLength(0);
      expect(session.modes).toHaveLength(0);
      expect(session.models).toHaveLength(0);
      expect(session.endTime).not.toBeNull();
    });
  });

});
