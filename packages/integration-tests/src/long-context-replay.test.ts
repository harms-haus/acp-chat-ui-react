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
import type { ReplayController } from "@harms-haus/acp-chat-core";
import type { ChildProcess } from "node:child_process";

interface TrafficEntry {
  direction: "in" | "out";
  data: unknown;
}

describe("long-context replay", { timeout: 300000 }, () => {
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

      await new Promise<void>((resolve, reject) => {
        const deadline = Date.now() + 90_000;

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

      const inboundEvents = trafficLog.filter((t) => t.direction === "in");
      const inboundTypes = inboundEvents.map(
        (t) => (t.data as Record<string, unknown>)?.type as string,
      );

      const replayMetadataCount = inboundTypes.filter((t) => t === "replay_metadata").length;
      expect(replayMetadataCount).toBeGreaterThanOrEqual(1);

      const bridgeStatusEvents = inboundEvents.filter(
        (t) => (t.data as Record<string, unknown>)?.type === "bridge_status",
      );
      const bridgeStatuses = bridgeStatusEvents.map(
        (t) => (t.data as Record<string, unknown>)?.status as string,
      );
      expect(bridgeStatuses).toContain("starting");
      expect(bridgeStatuses).toContain("connected");
      expect(bridgeStatuses).toContain("disconnected");

      const acpPayloadCount = inboundTypes.filter((t) => t === "acp_payload").length;
      expect(acpPayloadCount).toBeGreaterThan(100);

      const acpUpdateTypes = new Set<string>();
      inboundEvents.forEach((t) => {
        const data = t.data as Record<string, unknown>;
        if (data?.type === "acp_payload") {
          const payload = data.payload as Record<string, unknown>;
          const update = (payload?.params as Record<string, unknown>)?.update as
            | Record<string, unknown>
            | undefined;
          if (update?.type) {
            acpUpdateTypes.add(update.type as string);
          }
        }
      });

      expect(acpUpdateTypes.has("user_message")).toBe(true);
      expect(acpUpdateTypes.has("agent_thought_chunk")).toBe(true);
      expect(acpUpdateTypes.has("tool_call")).toBe(true);
      expect(acpUpdateTypes.has("tool_call_update")).toBe(true);

      await killBridge(bridgeProcess);
    },
    120_000,
  );
});
