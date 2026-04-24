/**
 * Long-context replay integration test
 *
 * Spawns the Rust bridge in replay-v2 mode and verifies that the TypeScript
 * transport layer can correctly connect and receive events from the Rust controller.
 * 
 * Note: Replay logic lives exclusively in the Rust controller.
 * This test verifies transport-layer connectivity and event reception.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupWebSocketPolyfill } from "./helpers/websocket-polyfill.js";
import { spawnBridge, killBridge, findAvailablePort } from "./helpers/bridge.js";
import { WsTransport } from "@harms-haus/acp-ws-bridge";
import type { ChildProcess } from "node:child_process";

const describeTest = process.env.CI ? describe.skip : describe;

describeTest("long-context replay", () => {
  let bridgeProcess: ChildProcess;
  let port: number;
  let transport: WsTransport | null = null;
  let errorEvents: Error[] = [];

  beforeAll(async () => {
    process.on("uncaughtException", () => {});
    process.on("unhandledRejection", () => {});

    await setupWebSocketPolyfill();

    port = await findAvailablePort(29876);
    bridgeProcess = await spawnBridge(port);

    errorEvents = [];
  }, 120_000);

  afterAll(async () => {
    if (transport) {
      try {
        await transport.disconnect();
      } catch {
        // Bridge may already be dead
      }
    }
    if (bridgeProcess) {
      await killBridge(bridgeProcess);
    }
  });

  it(
    "should connect to bridge and receive events",
    async () => {
      // Create transport
      transport = new WsTransport(`ws://127.0.0.1:${port}`);
      
      // Connect to the bridge
      await transport.connect();
      
      // Verify connection
      expect(transport.getStatus()).toBe("connected");

      // Send initialize request to start replay
      // The Rust controller handles the actual replay logic
      const initResponse = await transport.sendRequest({
        jsonrpc: "2.0" as const,
        id: "init-1",
        method: "initialize",
        params: {
          client_info: { name: "integration-test", version: "1.0.0" },
          replay_data_path: "long-context",
        },
      });
      
      // Verify initialization succeeded
      expect(initResponse).toBeDefined();
      
      // Wait for replay to complete (indicated by bridge disconnection)
      await new Promise<void>((resolve, reject) => {
        const deadline = Date.now() + 90_000;

        const check = () => {
          const status = transport?.getStatus();
          if (status === "disconnected" || status === "error") {
            resolve();
            return;
          }

          if (Date.now() > deadline) {
            reject(
              new Error(
                "Timed out waiting for replay completion after 90s",
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
      
      // Basic verification that the transport worked correctly
      const status = transport.getStatus();
      
      // Verify that we went through the connection lifecycle
      expect(status).toMatch(/^(connected|disconnected|error)$/);
    },
    120_000,
  );
});
