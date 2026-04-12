/**
 * Session lifecycle integration tests using replay fixtures.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { ReplayController } from "../../session/replay-controller.js";
import { ReplayRunner } from "../../test-utils/replay-runner.js";
import { loadFixture } from "../../test-utils/fixture-loader.js";
import {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  assertReplaySuccess,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  assertReplayStatistics,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  summarizeReplay,
} from "../../test-utils/replay-assertions.js";

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

describe("Session lifecycle integration", () => {
  let controller: ReplayController;

  beforeEach(() => {
    controller = new ReplayController({
      bridgeUrl: "ws://localhost:8080/replay-v2",
    });
  });

  afterEach(() => {
    controller.disconnect().catch(() => {});
  });

  describe("basic lifecycle with replay fixtures", () => {
    it("loads replay fixture successfully", () => {
      const fixture = loadFixture("tool-calling/session-1");
      expect(fixture.sessionId).toBeDefined();
      expect(fixture.events.length).toBeGreaterThan(0);
    });

    it("can create ReplayRunner with fixture", () => {
      const fixture = loadFixture("tool-calling/session-1");

      const runner = new ReplayRunner({
        controller,
        fixture,
        replaySpeed: 1.0,
        timeoutMs: 10000,
      });

      expect(runner).toBeDefined();
      expect(runner.getStatistics()).toBeDefined();
    });
  });

  describe("connection lifecycle", () => {
    it("initializes with disconnected state", () => {
      const state = controller.getState();
      expect(state.connectionStatus).toBe("disconnected");
      expect(state.initialized).toBe(false);
      expect(state.sessionId).toBeNull();
    });

    it("connects and updates connectionStatus", async () => {
      controller.connect();
      await new Promise((resolve) => setTimeout(resolve, 20));
      const state = controller.getState();
      expect(state.connectionStatus).toBe("connected");
    });
  });

  describe("session operations with mock", () => {
    beforeEach(() => {
      controller.connect();
    });

    it("initialize sets initialized flag", async () => {
      const mockTransport = (controller as any).transport;
      const envelope = {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "acp_payload" as const,
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

      const result = await controller.initialize({
        name: "test-client",
        version: "1.0.0",
      });

      const state = controller.getState();
      expect(state.initialized).toBe(true);
      expect(result).toBeDefined();
    });

    it("sendPrompt sends with correct structure", async () => {
      const mockTransport = (controller as any).transport;
      const sendSpy = vi.spyOn(mockTransport, "send");

      const envelope = {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "acp_payload" as const,
        payload: {
          jsonrpc: "2.0",
          id: 1,
          result: {},
        },
      };
      setTimeout(() => mockTransport.emitEnvelope(envelope), 10);

      await controller.sendPrompt("session-123", "Hello, world!");

      expect(sendSpy).toHaveBeenCalled();
      const sentData = sendSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(sentData);
      expect(parsed.method).toBe("session/prompt");
      expect(parsed.params.sessionId).toBe("session-123");
      expect(parsed.params.prompt).toEqual([
        { type: "text", text: "Hello, world!" },
      ]);
    });

    it("receives session updates from bridge", async () => {
      const sessionUpdateHandler = vi.fn();
      controller.on("sessionUpdate", sessionUpdateHandler);

      const mockTransport = (controller as any).transport;
      const envelope = {
        version: 1,
        seq: 0,
        timestamp_ms: Date.now(),
        type: "acp_payload" as const,
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

    it("responds to permission requests correctly", async () => {
      const mockTransport = (controller as any).transport;
      const sendSpy = vi.spyOn(mockTransport, "send");

      await controller.respondToPermission(42, "allow_once");

      expect(sendSpy).toHaveBeenCalled();
      const sentData = sendSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(sentData);
      expect(parsed.id).toBe(42);
      expect(parsed.result.outcome.outcome).toBe("selected");
      expect(parsed.result.outcome.optionId).toBe("allow_once");
    });

    it("cancels permission requests correctly", async () => {
      const mockTransport = (controller as any).transport;
      const sendSpy = vi.spyOn(mockTransport, "send");

      await controller.cancelPermission(42);

      expect(sendSpy).toHaveBeenCalled();
      const sentData = sendSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(sentData);
      expect(parsed.id).toBe(42);
      expect(parsed.result.outcome.outcome).toBe("cancelled");
    });

    it("sends cancel notification", async () => {
      const mockTransport = (controller as any).transport;
      const sendSpy = vi.spyOn(mockTransport, "send");

      controller.cancelPrompt("session-123");

      expect(sendSpy).toHaveBeenCalled();
      const sentData = sendSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(sentData);
      expect(parsed.method).toBe("session/cancel");
      expect(parsed.params.sessionId).toBe("session-123");
    });
  });

  describe("error handling", () => {
    it("emits error events for transport errors", async () => {
      controller.connect();
      await new Promise((resolve) => setTimeout(resolve, 20));

      const errorHandler = vi.fn();
      controller.on("error", errorHandler);

      const mockTransport = (controller as any).transport;
      const error = new Error("Connection failed");
      mockTransport.emitError(error);

      expect(errorHandler).toHaveBeenCalledWith(error);
    });
  });
});
