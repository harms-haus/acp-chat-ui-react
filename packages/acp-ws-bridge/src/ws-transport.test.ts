/**
 * WsTransport bridge_status handling tests.
 *
 * Tests that WsTransport correctly handles bridge_status envelopes
 * and emits them through the onBridgeStatus callback.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WsTransport } from "./ws-transport";
import { MockWebSocket } from "./test-utils";

describe("WsTransport bridge_status handling", () => {
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    originalWebSocket = global.WebSocket;
    global.WebSocket = MockWebSocket as any;
    vi.useFakeTimers();
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
    vi.useRealTimers();
  });

  it("should expose onBridgeStatus method", () => {
    const transport = new WsTransport("ws://localhost:8765");
    expect(transport.onBridgeStatus).toBeDefined();
    expect(typeof transport.onBridgeStatus).toBe("function");
  });

  it("should call onBridgeStatus handler when bridge_status envelope received", async () => {
    const transport = new WsTransport("ws://localhost:8765");
    const statuses: string[] = [];

    transport.onBridgeStatus((status) => statuses.push(status));

    // Connect to set up the transport
    const connectPromise = transport.connect();

    // Access the underlying MockWebSocket via TransportClient
    const client = (transport as unknown as { client: { ws: MockWebSocket } }).client;
    const mockWs = client.ws;

    // Simulate connection open
    mockWs.simulateOpen();

    // Simulate receiving a bridge_status envelope
    mockWs.simulateMessageJson({
      version: 1,
      seq: 1,
      timestamp_ms: 1234567890,
      type: "bridge_status",
      status: "connected",
    });

    await connectPromise;

    expect(statuses).toContain("connected");
  });

  it("should call onBridgeStatus handler for all bridge_status variants", async () => {
    const transport = new WsTransport("ws://localhost:8765");
    const statuses: string[] = [];

    transport.onBridgeStatus((status) => statuses.push(status));

    const connectPromise = transport.connect();

    const client = (transport as unknown as { client: { ws: MockWebSocket } }).client;
    const mockWs = client.ws;
    mockWs.simulateOpen();

    // Send multiple bridge_status messages
    for (const status of ["starting", "connected", "reconnecting", "disconnected"]) {
      mockWs.simulateMessageJson({
        version: 1,
        seq: statuses.length + 1,
        timestamp_ms: 1234567890,
        type: "bridge_status",
        status,
      });
    }

    await connectPromise;

    expect(statuses).toEqual(["starting", "connected", "reconnecting", "disconnected"]);
  });

  it("should not call onBridgeStatus for non-bridge_status envelopes", async () => {
    const transport = new WsTransport("ws://localhost:8765");
    const statuses: string[] = [];

    transport.onBridgeStatus((status) => statuses.push(status));

    const connectPromise = transport.connect();

    const client = (transport as unknown as { client: { ws: MockWebSocket } }).client;
    const mockWs = client.ws;
    mockWs.simulateOpen();

    // Send an acp_payload envelope (should not trigger bridge_status handler)
    mockWs.simulateMessageJson({
      version: 1,
      seq: 1,
      timestamp_ms: 1234567890,
      type: "acp_payload",
      payload: { jsonrpc: "2.0", method: "session/update", params: {} },
    });

    await connectPromise;

    expect(statuses).toHaveLength(0);
  });

  it("should support multiple onBridgeStatus handlers", async () => {
    const transport = new WsTransport("ws://localhost:8765");
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    transport.onBridgeStatus(handler1);
    transport.onBridgeStatus(handler2);

    const connectPromise = transport.connect();

    const client = (transport as unknown as { client: { ws: MockWebSocket } }).client;
    const mockWs = client.ws;
    mockWs.simulateOpen();

    mockWs.simulateMessageJson({
      version: 1,
      seq: 1,
      timestamp_ms: 1234567890,
      type: "bridge_status",
      status: "connected",
    });

    await connectPromise;

    expect(handler1).toHaveBeenCalledWith("connected");
    expect(handler2).toHaveBeenCalledWith("connected");
  });

  it("should unsubscribe handler when unsubscribe function is called", async () => {
    const transport = new WsTransport("ws://localhost:8765");
    const handler = vi.fn();

    const unsubscribe = transport.onBridgeStatus(handler);

    const connectPromise = transport.connect();

    const client = (transport as unknown as { client: { ws: MockWebSocket } }).client;
    const mockWs = client.ws;
    mockWs.simulateOpen();

    // First message - handler should be called
    mockWs.simulateMessageJson({
      version: 1,
      seq: 1,
      timestamp_ms: 1234567890,
      type: "bridge_status",
      status: "starting",
    });
    expect(handler).toHaveBeenCalledTimes(1);

    // Unsubscribe
    unsubscribe();

    // Second message - handler should NOT be called
    mockWs.simulateMessageJson({
      version: 1,
      seq: 2,
      timestamp_ms: 1234567890,
      type: "bridge_status",
      status: "connected",
    });

    await connectPromise;

    expect(handler).toHaveBeenCalledTimes(1); // Still just 1
  });
});
