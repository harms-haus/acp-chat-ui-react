/**
 * Filesystem events integration test
 *
 * Tests that SessionController correctly handles fs/read_text_file and fs/write_text_file
 * events through the replay system and that registered handlers are invoked.
 * 
 * @deprecated This test uses ReplayController which doesn't have subscribeToFileReads/subscribeToFileWrites.
 * These methods are only available on SessionController. Test needs to be rewritten.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupWebSocketPolyfill } from "./helpers/websocket-polyfill.js";
import { spawnBridge, killBridge, findAvailablePort } from "./helpers/bridge.js";
import type { ReplayController } from "@harms-haus/acp-chat-core";
import type { ChildProcess } from "node:child_process";

interface TrafficEntry {
  direction: "in" | "out";
  data: unknown;
}

describe.skip("filesystem events", () => {
  let bridgeProcess: ChildProcess;
  let port: number;
  let controller: ReplayController;
  let trafficLog: TrafficEntry[] = [];
  let errorEvents: Error[] = [];

  beforeAll(async () => {
    process.on("uncaughtException", () => {});
    process.on("unhandledRejection", () => {});

    await setupWebSocketPolyfill();

    const { ReplayController: RC } = await import("@harms-haus/acp-chat-core");

    port = await findAvailablePort(29876);
    bridgeProcess = await spawnBridge(port);

    controller = new RC({ bridgeUrl: `ws://127.0.0.1:${port}` });

    trafficLog = [];
    errorEvents = [];

    controller.on("traffic", (direction, data) => {
      trafficLog.push({ direction, data });
    });

    controller.on("error", (error) => {
      errorEvents.push(error);
    });
  }, 120_000);

  afterAll(async () => {
    if (controller) {
      try {
        await controller.disconnect();
      } catch {
        // Bridge may already be dead
      }
    }
    if (bridgeProcess) {
      await killBridge(bridgeProcess);
    }
  });

  it("should trigger filesystem read and write handlers during replay", async () => {
    controller.connect();

    // Wait for connection to be established
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout waiting for connection"));
      }, 10_000);

      const checkStatus = () => {
        const state = controller.getState();
        if (state.connectionStatus === "connected" || state.bridgeStatus === "connected") {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkStatus, 100);
        }
      };

      checkStatus();
    });

    // Register filesystem handlers
    const readRequests: Array<{ path: string; line?: number; limit?: number }> = [];
    const writeRequests: Array<{ path: string; content: unknown }> = [];

    (controller as any).subscribeToFileReads(async (request) => {
      readRequests.push(request);
      return { content: JSON.stringify(request) };
    });

    (controller as any).subscribeToFileWrites(async (request) => {
      writeRequests.push(request);
      return { success: true };
    });

    // Init replay - this triggers the bridge to start streaming events
    await controller.initReplay("filesystem-test", "fs-test-session");

    // Wait for replay to complete
    await new Promise<void>((resolve, reject) => {
      const deadline = Date.now() + 30_000;

      const check = () => {
        const hasDisconnected = trafficLog.some(
          (t) =>
            t.direction === "in" &&
            (t.data as Record<string, unknown>)?.type === "bridge_status" &&
            (t.data as Record<string, unknown>)?.status === "disconnected",
        );

        if (hasDisconnected) {
          resolve();
          return;
        }

        if (Date.now() > deadline) {
          reject(
            new Error(
              "Timed out waiting for bridge_status:disconnected after 30s",
            ),
          );
          return;
        }

        setTimeout(check, 200);
      };

      check();
    });

    // Filter out expected WebSocket disconnection errors
    const unexpectedErrors = errorEvents.filter(
      (e) => {
        const isWebSocketDisconnection =
          e.message.includes("WebSocket") && e.message.includes("disconnected");
        const isExpected = e.message === "WebSocket disconnected" ||
                           e.message.includes("WebSocket connection closed");
        // Only suppress WebSocket disconnection errors, not all errors
        return !isWebSocketDisconnection || isExpected;
      },
    );

    expect(unexpectedErrors).toHaveLength(0);

    // Verify fs read request was made
    const inboundEvents = trafficLog.filter((t) => t.direction === "in");
    const acpPayloads = inboundEvents.filter(
      (t) => (t.data as Record<string, unknown>)?.type === "acp_payload",
    );

    const fsReadPayloads = acpPayloads.filter(
      (t) => (t.data as Record<string, unknown>)?.method === "fs/read_text_file",
    );

    expect(fsReadPayloads).toHaveLength(1);

    const fsReadPayload = fsReadPayloads[0]!.data as Record<string, unknown>;
    const fsReadParams = fsReadPayload.params as Record<string, unknown>;

    // Verify request parameters match the XML script
    expect(fsReadParams).toHaveProperty("path");
    expect(fsReadParams!.path).toBe("config.json");

    // Verify fs read response was sent
    const fsWritePayloads = acpPayloads.filter(
      (t) => (t.data as Record<string, unknown>)?.method === "fs/write_text_file",
    );

    expect(fsWritePayloads).toHaveLength(1);

    const fsWritePayload = fsWritePayloads[0]!.data as Record<string, unknown>;
    const fsWriteParams = fsWritePayload.params as Record<string, unknown>;

    // Verify write request parameters
    expect(fsWriteParams).toHaveProperty("path");
    expect(fsWriteParams!.path).toBe("config.json");
    expect(fsWriteParams).toHaveProperty("content");
    expect(fsWriteParams!.content).toBe('{"debug": false}');

    // Verify handlers were called with correct params
    expect(readRequests).toHaveLength(1);
    expect(readRequests[0]).toEqual({
      path: "config.json",
    });

    expect(writeRequests).toHaveLength(1);
      expect(writeRequests[0]).toEqual({
        path: "config.json",
        content: '{"debug": false}',
      });
    },
    30_000,
  );
});
