/**
 * Long-context replay integration test
 *
 * Spawns the Rust bridge in replay-v2 mode, drives the full session lifecycle
 * via ReplayController, and asserts that the event stream has the correct
 * type ordering with no errors.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupWebSocketPolyfill } from "./helpers/websocket-polyfill.js";
import { spawnBridge, killBridge, findAvailablePort } from "./helpers/bridge.js";
import type { ReplayController } from "@acp/chat-core";
import type { ChildProcess } from "node:child_process";

interface TrafficEntry {
  direction: "in" | "out";
  data: unknown;
}

describe("long-context replay", () => {
  let bridgeProcess: ChildProcess;
  let port: number;
  let controller: ReplayController;
  let trafficLog: TrafficEntry[] = [];
  let errorEvents: Error[] = [];

  beforeAll(async () => {
    // Polyfill must happen before any acp-chat-core import
    await setupWebSocketPolyfill();

    const { ReplayController: RC } = await import("@acp/chat-core");

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

  it(
    "should replay the full long-context session with correct event ordering",
    async () => {
      controller.connect();

      // Wait for connection to be established
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timeout waiting for connection"));
        }, 10000);

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

      // Init replay - this triggers the bridge to start streaming events
      await controller.initReplay("long-context", "session-1");

      // Wait for bridge_status:disconnected (replay complete)
      // The replay bridge streams events automatically after init - no need for JSON-RPC calls
      await new Promise<void>((resolve, reject) => {
        const deadline = Date.now() + 90_000;

        const check = () => {
          const lastInbound = trafficLog
            .filter((t) => t.direction === "in")
            .pop();

          if (
            lastInbound &&
            (lastInbound.data as Record<string, unknown>)?.type ===
              "bridge_status" &&
            (lastInbound.data as Record<string, unknown>)?.status ===
              "disconnected"
          ) {
            resolve();
            return;
          }

          if (Date.now() > deadline) {
            reject(
              new Error(
                "Timed out waiting for bridge_status:disconnected after 90s",
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
        (e) => !e.message.includes("WebSocket") && !e.message.includes("disconnected"),
      );

      expect(unexpectedErrors).toHaveLength(0);

      const inboundTypes = trafficLog
        .filter((t) => t.direction === "in")
        .map((t) => (t.data as Record<string, unknown>)?.type as string);

      // First event is init response, then replay stream starts
      // Find the first replay_metadata in the stream
      const firstReplayMetadataIndex = inboundTypes.indexOf("replay_metadata");
      expect(firstReplayMetadataIndex).toBeGreaterThanOrEqual(0);

      const second = trafficLog.filter((t) => t.direction === "in")[firstReplayMetadataIndex + 1];
      expect(second?.data).toEqual(
        expect.objectContaining({
          type: "bridge_status",
          status: "starting",
        }),
      );

      const third = trafficLog.filter((t) => t.direction === "in")[firstReplayMetadataIndex + 2];
      expect(third?.data).toEqual(
        expect.objectContaining({
          type: "bridge_status",
          status: "connected",
        }),
      );

      const last = trafficLog.filter((t) => t.direction === "in").pop();
      expect(last?.data).toEqual(
        expect.objectContaining({
          type: "bridge_status",
          status: "disconnected",
        }),
      );

      const payloadTypes = inboundTypes.slice(firstReplayMetadataIndex + 3, -1);
      for (const t of payloadTypes) {
        expect(t).toBe("acp_payload");
      }

      expect(payloadTypes.length).toBeGreaterThan(100);

      const exitPromise = new Promise<number | null>((resolve) => {
        // Handle case where process already exited
        if (bridgeProcess.exitCode !== null) {
          resolve(bridgeProcess.exitCode);
          return;
        }
        bridgeProcess.once("exit", (code) => resolve(code));
      });

      const exitCode = await exitPromise;
      expect(bridgeProcess.killed || exitCode !== null).toBe(true);
    },
    120_000,
  );
});
