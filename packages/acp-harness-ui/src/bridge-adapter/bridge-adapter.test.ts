/**
 * BridgeAdapter unit tests.
 *
 * Tests the BridgeAdapter's event handling, state management,
 * notification forwarding, and input validation.
 * WsTransport is mocked to isolate BridgeAdapter behavior.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted to create shared mock functions accessible in vi.mock
const mocks = vi.hoisted(() => ({
  mockOnStatusChange: vi.fn(),
  mockOnBridgeStatus: vi.fn(),
  mockOnNotification: vi.fn(),
  mockOnError: vi.fn(),
  mockConnect: vi.fn().mockResolvedValue(undefined),
  mockDisconnect: vi.fn().mockResolvedValue(undefined),
  mockSendRequest: vi.fn().mockResolvedValue({ result: {} }),
  mockWsTransport: vi.fn(),
}));

vi.mock("@harms-haus/acp-ws-bridge", () => ({
  WsTransport: mocks.mockWsTransport.mockImplementation(() => ({
    connect: mocks.mockConnect,
    disconnect: mocks.mockDisconnect,
    onStatusChange: mocks.mockOnStatusChange,
    onBridgeStatus: mocks.mockOnBridgeStatus,
    onNotification: mocks.mockOnNotification,
    onError: mocks.mockOnError,
    sendRequest: mocks.mockSendRequest,
  })),
}));

import { BridgeAdapter } from "./bridge-adapter";

describe("BridgeAdapter", () => {
  let adapter: InstanceType<typeof BridgeAdapter>;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new BridgeAdapter("ws://localhost:8765");
  });

  describe("connect / disconnect", () => {
    it("should create WsTransport with correct URL", () => {
      adapter.connect();
      expect(mocks.mockWsTransport).toHaveBeenCalledWith("ws://localhost:8765");
    });

    it("should set connectionStatus to connecting on connect", () => {
      adapter.connect();
      expect(adapter.getState().connectionStatus).toBe("connecting");
      expect(adapter.getState().bridgeStatus).toBe("disconnected");
    });

    it("should not create duplicate transport on double connect", () => {
      adapter.connect();
      adapter.connect();
      expect(mocks.mockWsTransport).toHaveBeenCalledTimes(1);
    });

    it("should disconnect and reset state", async () => {
      adapter.connect();
      await adapter.disconnect();
      expect(mocks.mockDisconnect).toHaveBeenCalled();
      expect(adapter.getState().connectionStatus).toBe("disconnected");
      expect(adapter.getState().bridgeStatus).toBe("disconnected");
    });
  });

  describe("status change forwarding", () => {
    beforeEach(() => {
      adapter.connect();
    });

    it("should forward transport status changes", () => {
      const statusHandler = mocks.mockOnStatusChange.mock.calls[0][0];
      statusHandler("connected");
      expect(adapter.getState().connectionStatus).toBe("connected");
    });

    it("should forward bridge status changes", () => {
      const bridgeHandler = mocks.mockOnBridgeStatus.mock.calls[0][0];
      bridgeHandler("connected");
      expect(adapter.getState().bridgeStatus).toBe("connected");
    });

    it("should forward error events", () => {
      const errorHandler = mocks.mockOnError.mock.calls[0][0];
      const errorSpy = vi.fn();
      adapter.on("error", errorSpy);
      const testError = new Error("test error");
      errorHandler(testError);
      expect(errorSpy).toHaveBeenCalledWith(testError);
    });
  });

  describe("sessionUpdate notification forwarding", () => {
    beforeEach(() => {
      adapter.connect();
    });

    it("should forward single session/update notifications", () => {
      const notificationHandler = mocks.mockOnNotification.mock.calls[0][0];
      const updateSpy = vi.fn();
      adapter.on("sessionUpdate", updateSpy);

      notificationHandler({
        jsonrpc: "2.0",
        method: "session/update",
        params: { sessionId: "test", update: { type: "agent_message_chunk" } },
      });

      expect(updateSpy).toHaveBeenCalledWith({
        sessionId: "test",
        update: { type: "agent_message_chunk" },
      });
    });

    it("should forward batched session/update notifications", () => {
      const notificationHandler = mocks.mockOnNotification.mock.calls[0][0];
      const updateSpy = vi.fn();
      adapter.on("sessionUpdate", updateSpy);

      notificationHandler({
        jsonrpc: "2.0",
        method: "session/update",
        params: {
          batched: true,
          updates: [
            { sessionId: "s1", update: { type: "agent_message_chunk" } },
            { sessionId: "s2", update: { type: "tool_call" } },
          ],
        },
      });

      expect(updateSpy).toHaveBeenCalledTimes(2);
      expect(updateSpy).toHaveBeenNthCalledWith(1, {
        sessionId: "s1",
        update: { type: "agent_message_chunk" },
      });
      expect(updateSpy).toHaveBeenNthCalledWith(2, {
        sessionId: "s2",
        update: { type: "tool_call" },
      });
    });

    it("should forward batched updates with nested params format", () => {
      const notificationHandler = mocks.mockOnNotification.mock.calls[0][0];
      const updateSpy = vi.fn();
      adapter.on("sessionUpdate", updateSpy);

      notificationHandler({
        jsonrpc: "2.0",
        method: "session/update",
        params: {
          batched: true,
          updates: [
            { params: { sessionId: "s1", update: { type: "agent_message_chunk" } } },
          ],
        },
      });

      expect(updateSpy).toHaveBeenCalledWith({
        sessionId: "s1",
        update: { type: "agent_message_chunk" },
      });
    });

    it("should ignore notifications with unknown method", () => {
      const notificationHandler = mocks.mockOnNotification.mock.calls[0][0];
      const updateSpy = vi.fn();
      adapter.on("sessionUpdate", updateSpy);

      notificationHandler({ jsonrpc: "2.0", method: "unknown/method" });
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it("should ignore notifications without method", () => {
      const notificationHandler = mocks.mockOnNotification.mock.calls[0][0];
      const updateSpy = vi.fn();
      adapter.on("sessionUpdate", updateSpy);

      notificationHandler({ jsonrpc: "2.0" });
      expect(updateSpy).not.toHaveBeenCalled();
    });
  });

  describe("permissionRequest notification forwarding", () => {
    beforeEach(() => {
      adapter.connect();
    });

    it("should forward session/request_permission with id from notification", () => {
      const notificationHandler = mocks.mockOnNotification.mock.calls[0][0];
      const permSpy = vi.fn();
      adapter.on("permissionRequest", permSpy);

      notificationHandler({
        jsonrpc: "2.0",
        id: 42,
        method: "session/request_permission",
        params: { request_id: 42 },
      });

      expect(permSpy).toHaveBeenCalledWith({ request_id: 42 }, 42);
    });

    it("should fallback to 0 when both ids are missing", () => {
      const notificationHandler = mocks.mockOnNotification.mock.calls[0][0];
      const permSpy = vi.fn();
      adapter.on("permissionRequest", permSpy);

      notificationHandler({
        jsonrpc: "2.0",
        method: "session/request_permission",
        params: {},
      });

      expect(permSpy).toHaveBeenCalledWith({}, 0);
    });
  });

  describe("sessionClearing", () => {
    it("should emit sessionClearing before loadSession", async () => {
      adapter.connect();
      const clearingSpy = vi.fn();
      adapter.on("sessionClearing", clearingSpy);

      mocks.mockSendRequest.mockResolvedValue({
        result: { sessionId: "test-session", cwd: "/" },
      });

      await adapter.loadSession("test-session", "/");

      expect(clearingSpy).toHaveBeenCalledTimes(1);
      expect(clearingSpy.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.mockSendRequest.mock.invocationCallOrder[0]
      );
    });
  });

  describe("input validation", () => {
    beforeEach(() => {
      adapter.connect();
    });

    it("should reject empty sessionId in loadSession", async () => {
      await expect(adapter.loadSession("", "/")).rejects.toThrow(
        "sessionId must be a non-empty string"
      );
    });

    it("should reject empty cwd in loadSession", async () => {
      await expect(adapter.loadSession("test", "")).rejects.toThrow(
        "cwd must be a non-empty string"
      );
    });

    it("should reject whitespace-only sessionId", async () => {
      await expect(adapter.loadSession("   ", "/")).rejects.toThrow(
        "sessionId must be a non-empty string"
      );
    });

    it("should reject empty cursor in listSessions", async () => {
      await expect(adapter.listSessions("")).rejects.toThrow(
        "cursor must be a non-empty string if provided"
      );
    });

    it("should reject empty cwd in listSessions", async () => {
      await expect(adapter.listSessions(undefined, "")).rejects.toThrow(
        "cwd must be a non-empty string if provided"
      );
    });

    it("should reject calls when not connected", async () => {
      const disconnected = new BridgeAdapter("ws://localhost:8765");
      await expect(disconnected.listSessions()).rejects.toThrow("Not connected");
      await expect(disconnected.loadSession("s", "/")).rejects.toThrow("Not connected");
    });
  });

  describe("ID generation", () => {
    beforeEach(() => {
      adapter.connect();
    });

    it("should use monotonically increasing IDs", async () => {
      mocks.mockSendRequest.mockResolvedValue({ result: {} });

      await adapter.listSessions();
      await adapter.loadSession("s", "/");

      const calls = mocks.mockSendRequest.mock.calls;
      const id1 = calls[0][0].id;
      const id2 = calls[1][0].id;

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^session-list-\d+$/);
      expect(id2).toMatch(/^session-load-\d+$/);
    });
  });

  describe("setState shallow comparison", () => {
    it("should not emit statusChange when state is unchanged", () => {
      adapter.connect();
      const statusSpy = vi.fn();
      adapter.on("statusChange", statusSpy);

      const callCountAfterConnect = statusSpy.mock.calls.length;

      const statusHandler = mocks.mockOnStatusChange.mock.calls[0][0];
      statusHandler("connecting"); // already connecting
      expect(statusSpy.mock.calls.length).toBe(callCountAfterConnect);
    });
  });
});
