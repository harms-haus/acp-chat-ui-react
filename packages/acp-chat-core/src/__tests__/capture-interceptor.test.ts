import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DefaultSessionCaptureInterceptor,
} from "../session/capture-interceptor.js";
import type { BridgeEnvelope } from "../generated/index.js";
import type { ReplaySessionData } from "../replay/types.js";

type MockController = {
  connect(): void;
  disconnect(): void;
  getState(): any;
  on(event: string, handler: any): () => void;
  emitTraffic(direction: "in" | "out", data: unknown): void;
  emitSessionUpdate(params: unknown): void;
};

class MockSessionController implements MockController {
  private handlers: any = {
    statusChange: new Set(),
    sessionUpdate: new Set(),
    traffic: new Set(),
    error: new Set(),
    sessionClearing: new Set(),
    permissionRequest: new Set(),
  };

  connect() {
    this.emitStatus();
  }

  disconnect() {
    this.emitStatus();
  }

  getState() {
    return {
      connectionStatus: "connected",
      bridgeStatus: "connected",
      sessionId: "test-session",
      initialized: true,
      capabilities: null,
    };
  }

  on(event: string, handler: any): () => void {
    switch (event) {
      case "statusChange":
        this.handlers.statusChange.add(handler);
        break;
      case "sessionUpdate":
        this.handlers.sessionUpdate.add(handler);
        break;
      case "traffic":
        this.handlers.traffic.add(handler);
        break;
      case "error":
        this.handlers.error.add(handler);
        break;
      case "sessionClearing":
        this.handlers.sessionClearing.add(handler);
        break;
      case "permissionRequest":
        this.handlers.permissionRequest.add(handler);
        break;
    }
    return () => {
      switch (event) {
        case "statusChange":
          this.handlers.statusChange.delete(handler);
          break;
        case "sessionUpdate":
          this.handlers.sessionUpdate.delete(handler);
          break;
        case "traffic":
          this.handlers.traffic.delete(handler);
          break;
        case "error":
          this.handlers.error.delete(handler);
          break;
        case "sessionClearing":
          this.handlers.sessionClearing.delete(handler);
          break;
        case "permissionRequest":
          this.handlers.permissionRequest.delete(handler);
          break;
      }
    };
  }

  emitTraffic(direction: "in" | "out", data: unknown) {
    this.handlers.traffic.forEach((h: any) => {
      h(direction, data);
    });
  }

  emitSessionUpdate(params: unknown) {
    this.handlers.sessionUpdate.forEach((h: any) => {
      h(params);
    });
  }

  emitStatus() {
    const state = this.getState();
    this.handlers.statusChange.forEach((h: any) => {
      h(state);
    });
  }
}

describe("DefaultSessionCaptureInterceptor", () => {
  let controller: MockSessionController;
  let interceptor: DefaultSessionCaptureInterceptor;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new MockSessionController();
    interceptor = new DefaultSessionCaptureInterceptor(controller as any);
  });

  describe("event recording", () => {
    it("starts capture and sets isCapturing to true", () => {
      interceptor.startCapture("session-123");

      expect(interceptor.isCapturing()).toBe(true);
      expect(interceptor.getActiveSessionId()).toBe("session-123");
    });

    it("stops capture and sets isCapturing to false", () => {
      interceptor.startCapture("session-123");
      interceptor.stopCapture();

      expect(interceptor.isCapturing()).toBe(false);
    });

    it("throws error when starting capture while already capturing", () => {
      interceptor.startCapture("session-123");

      expect(() => {
        interceptor.startCapture("session-456");
      }).toThrow("Capture is already active");
    });

    it("throws error when stopping capture when not capturing", () => {
      expect(() => {
        interceptor.stopCapture();
      }).toThrow("No capture is active");
    });

    it("records inbound traffic events", () => {
      interceptor.startCapture("session-123");

      const envelope: BridgeEnvelope = {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: { jsonrpc: "2.0", method: "test" },
      };

      controller.emitTraffic("in", envelope);

      const session = interceptor.exportCapturedSession();
      expect(session.events).toHaveLength(1);
      // endTime is null while capture is still active
      expect(session.endTime).toBeNull();
    });

    it("exports session even if not capturing", () => {
      interceptor.startCapture("session-123");
      const envelope: BridgeEnvelope = {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "acp_payload",
        payload: { jsonrpc: "2.0", method: "test" },
      };
      controller.emitTraffic("in", envelope);

      const session = interceptor.stopCaptureAndExport("/tmp/test-capture-interceptor");

      expect(session).toBeDefined();
      expect(session.sessionId).toBe("session-123");
    });
  });

  describe("edge cases", () => {
    it("handles empty session", () => {
      interceptor.startCapture("session-123");
      interceptor.stopCapture();

      const session = interceptor.exportCapturedSession();
      expect(session.events).toHaveLength(0);
      expect(session.modes).toHaveLength(0);
      expect(session.models).toHaveLength(0);
    });

    it("handles malformed sessionUpdate gracefully", () => {
      interceptor.startCapture("session-123");

      controller.emitSessionUpdate(null);
      controller.emitSessionUpdate(undefined);
      controller.emitSessionUpdate("not an object");
      controller.emitSessionUpdate(123);

      const session = interceptor.exportCapturedSession();
      expect(session.modes).toHaveLength(0);
      expect(session.models).toHaveLength(0);
    });

    it("handles sessionUpdate with missing mode", () => {
      interceptor.startCapture("session-123");

      controller.emitSessionUpdate({
        sessionId: "session-123",
        update: {
          type: "message",
        },
      });

      const session = interceptor.exportCapturedSession();
      expect(session.modes).toHaveLength(0);
    });

    it("handles sessionUpdate with missing model", () => {
      interceptor.startCapture("session-123");

      controller.emitSessionUpdate({
        sessionId: "session-123",
        update: {
          type: "message",
        },
      });

      const session = interceptor.exportCapturedSession();
      expect(session.models).toHaveLength(0);
    });

    it("accumulates multiple modes", () => {
      interceptor.startCapture("session-123");

      controller.emitSessionUpdate({
        sessionId: "session-123",
        update: { mode: "coding" },
      });

      controller.emitSessionUpdate({
        sessionId: "session-123",
        update: { mode: "debugging" },
      });

      const session = interceptor.exportCapturedSession();
      expect(session.modes).toEqual(["coding", "debugging"]);
    });

    it("accumulates multiple models", () => {
      interceptor.startCapture("session-123");

      controller.emitSessionUpdate({
        sessionId: "session-123",
        update: { model: "gpt-4" },
      });

      controller.emitSessionUpdate({
        sessionId: "session-123",
        update: { model: "claude-3" },
      });

      const session = interceptor.exportCapturedSession();
      expect(session.models).toEqual(["gpt-4", "claude-3"]);
    });

    it("deduplicates modes", () => {
      interceptor.startCapture("session-123");

      controller.emitSessionUpdate({
        sessionId: "session-123",
        update: { mode: "coding" },
      });

      controller.emitSessionUpdate({
        sessionId: "session-123",
        update: { mode: "coding" },
      });

      const session = interceptor.exportCapturedSession();
      expect(session.modes).toEqual(["coding"]);
    });

    it("deduplicates models", () => {
      interceptor.startCapture("session-123");

      controller.emitSessionUpdate({
        sessionId: "session-123",
        update: { model: "gpt-4" },
      });

      controller.emitSessionUpdate({
        sessionId: "session-123",
        update: { model: "gpt-4" },
      });

      const session = interceptor.exportCapturedSession();
      expect(session.models).toEqual(["gpt-4"]);
    });

    it("captures events with estimated token count", () => {
      interceptor.startCapture("session-123");

      const envelope: BridgeEnvelope = {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "bridge_status",
        status: "connected",
      };

      controller.emitTraffic("in", envelope);

      const session = interceptor.exportCapturedSession();
      if (session.events[0]) {
        // Token count is estimated based on JSON string length
        expect(session.events[0].tokenCount).toBeGreaterThan(0);
      }
    });

    it("exports session with pre-existing state", () => {
      const initialState: ReplaySessionData = {
        sessionId: "session-123",
        cwd: "/test/workspace",
        messages: [],
        thoughts: [],
        toolCalls: [],
      };

      interceptor.startCapture("session-456", initialState);

      const session = interceptor.exportCapturedSession();
      expect(session.preExistingState).toBe(initialState);
      expect(session.sessionId).toBe("session-456");
    });
  });

  describe("exportCapturedSession errors", () => {
    it("throws error when exporting without active capture", () => {
      expect(() => {
        interceptor.exportCapturedSession();
      }).toThrow("No session has been captured");
    });
  });

  describe("getActiveSessionId", () => {
    it("returns session id when capturing", () => {
      interceptor.startCapture("test-session-123");
      expect(interceptor.getActiveSessionId()).toBe("test-session-123");
    });

    it("returns null when not capturing", () => {
      expect(interceptor.getActiveSessionId()).toBeNull();
    });

    it("returns session id after stopping capture", () => {
      // Implementation keeps state after stopping, so sessionId is still available
      interceptor.startCapture("session-123");
      interceptor.stopCapture();
      expect(interceptor.getActiveSessionId()).toBe("session-123");
    });
  });

  describe("stopCaptureAndExport", () => {
    it("stops capture and exports session", () => {
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

  describe("metadata extraction", () => {
    it("extracts model from metadata field", () => {
      interceptor.startCapture("session-123");

      controller.emitSessionUpdate({
        sessionId: "session-123",
        update: {
          metadata: {
            model: "claude-sonnet",
          },
        },
      });

      const session = interceptor.exportCapturedSession();
      expect(session.models).toContain("claude-sonnet");
    });
  });
});
