/**
 * Envelope serialization and deserialization tests.
 *
 * Tests BridgeEnvelope serialization to JSON, deserialization,
 * round-trip integrity, and extra_data field handling.
 */

import { describe, it, expect } from "vitest";
import { EnvelopeBuilder, MessageBuilder, TestConstants } from "./test-utils";
import type { BridgeEnvelope, BridgeMessage } from "@harms-haus/acp-chat-core";

describe("BridgeEnvelope serialization", () => {
  describe("Basic serialization", () => {
    it("should serialize envelope to JSON with all required fields", () => {
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.acpPayload({ test: "value" }))
        .version(1)
        .seq(42)
        .timestampMs(1234567890)
        .build();

      const json = JSON.stringify(envelope);
      const parsed = JSON.parse(json);

      expect(parsed.version).toBe(1);
      expect(parsed.seq).toBe(42);
      expect(parsed.timestamp_ms).toBe(1234567890);
      expect(parsed.type).toBe("acp_payload");
      expect(parsed.payload).toEqual({ test: "value" });
    });

    it("should serialize with default values from builder", () => {
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.acpPayload({}))
        .build();

      expect(envelope.version).toBe(1);
      expect(envelope.seq).toBe(0);
      expect(envelope.timestamp_ms).toBe(1234567890);
    });

    it("should preserve field names in snake_case", () => {
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.acpPayload({}))
        .timestampMs(9999999999)
        .build();

      const json = JSON.stringify(envelope);
      
      // Verify snake_case field name
      expect(json).toContain("timestamp_ms");
      expect(json).not.toContain("timestampMs");
      
      // Verify the value is correct
      const parsed = JSON.parse(json);
      expect(parsed.timestamp_ms).toBe(9999999999);
    });

    it("should serialize with version 1", () => {
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.acpPayload({}))
        .version(1)
        .build();

      const json = JSON.stringify(envelope);
      expect(JSON.parse(json).version).toBe(1);
    });

    it("should serialize with version 2", () => {
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.acpPayload({}))
        .version(2)
        .build();

      const json = JSON.stringify(envelope);
      expect(JSON.parse(json).version).toBe(2);
    });

    it("should serialize with large sequence number", () => {
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.acpPayload({}))
        .seq(999999)
        .build();

      const json = JSON.stringify(envelope);
      expect(JSON.parse(json).seq).toBe(999999);
    });

    it("should serialize with zero sequence number", () => {
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.acpPayload({}))
        .seq(0)
        .build();

      const json = JSON.stringify(envelope);
      expect(JSON.parse(json).seq).toBe(0);
    });
  });

  describe("extraData serialization", () => {
    it("should omit extraData field when undefined", () => {
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.acpPayload({}))
        .build();

      const json = JSON.stringify(envelope);
      const parsed = JSON.parse(json);

      expect(parsed.extraData).toBeUndefined();
      expect(json).not.toContain("extraData");
      expect(json).not.toContain("extra_data");
    });

    it("should serialize extraData when provided", () => {
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.acpPayload({}))
        .extraData({ key: "value", number: 42 })
        .build();

      const json = JSON.stringify(envelope);
      const parsed = JSON.parse(json);

      expect(parsed.extraData).toEqual({ key: "value", number: 42 });
    });

    it("should serialize empty extraData object", () => {
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.acpPayload({}))
        .extraData({})
        .build();

      const json = JSON.stringify(envelope);
      const parsed = JSON.parse(json);

      expect(parsed.extraData).toEqual({});
    });

    it("should serialize nested extraData", () => {
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.acpPayload({}))
        .extraData({
          nested: { deep: { value: "test" } },
          array: [1, 2, 3],
        })
        .build();

      const json = JSON.stringify(envelope);
      const parsed = JSON.parse(json);

      expect(parsed.extraData).toEqual({
        nested: { deep: { value: "test" } },
        array: [1, 2, 3],
      });
    });

    it("should serialize extraData with special characters in keys", () => {
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.acpPayload({}))
        .extraData({
          "kebab-case": "value1",
          snake_case: "value2",
          "camelCase": "value3",
          "PascalCase": "value4",
        })
        .build();

      const json = JSON.stringify(envelope);
      const parsed = JSON.parse(json);

      expect(parsed.extraData).toEqual({
        "kebab-case": "value1",
        snake_case: "value2",
        camelCase: "value3",
        PascalCase: "value4",
      });
    });

    it("should serialize extraData with null values", () => {
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.acpPayload({}))
        .extraData({
          nullValue: null,
          stringValue: "not null",
        })
        .build();

      const json = JSON.stringify(envelope);
      const parsed = JSON.parse(json);

      expect(parsed.extraData).toEqual({
        nullValue: null,
        stringValue: "not null",
      });
    });

    it("should serialize extraData with boolean values", () => {
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.acpPayload({}))
        .extraData({
          truthy: true,
          falsy: false,
        })
        .build();

      const json = JSON.stringify(envelope);
      const parsed = JSON.parse(json);

      expect(parsed.extraData).toEqual({
        truthy: true,
        falsy: false,
      });
    });

    it("should serialize extraData with numeric values", () => {
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.acpPayload({}))
        .extraData({
          integer: 42,
          float: 3.14,
          negative: -100,
          zero: 0,
        })
        .build();

      const json = JSON.stringify(envelope);
      const parsed = JSON.parse(json);

      expect(parsed.extraData).toEqual({
        integer: 42,
        float: 3.14,
        negative: -100,
        zero: 0,
      });
    });
  });

  describe("Round-trip serialization", () => {
    it("should preserve all fields through JSON.stringify/parse round-trip", () => {
      const original = EnvelopeBuilder.new()
        .message(MessageBuilder.acpPayload({ jsonrpc: "2.0", id: 1, method: "test" }))
        .version(1)
        .seq(123)
        .timestampMs(9876543210)
        .extraData({ metadata: "value" })
        .build();

      const json = JSON.stringify(original);
      const roundtrip: BridgeEnvelope = JSON.parse(json);

      expect(roundtrip.version).toBe(original.version);
      expect(roundtrip.seq).toBe(original.seq);
      expect(roundtrip.timestamp_ms).toBe(original.timestamp_ms);
      expect(roundtrip.type).toBe(original.type);
      expect((roundtrip as { payload: unknown }).payload).toEqual(
        (original as { payload: unknown }).payload
      );
      expect((roundtrip as { extraData?: Record<string, unknown> }).extraData).toEqual(
        (original as { extraData?: Record<string, unknown> }).extraData
      );
    });

    it("should preserve envelope without extraData through round-trip", () => {
      const original = EnvelopeBuilder.new()
        .message(MessageBuilder.acpPayload({}))
        .version(1)
        .seq(0)
        .timestampMs(1234567890)
        .build();

      const json = JSON.stringify(original);
      const roundtrip: BridgeEnvelope = JSON.parse(json);

      expect(roundtrip.version).toBe(1);
      expect(roundtrip.seq).toBe(0);
      expect(roundtrip.timestamp_ms).toBe(1234567890);
      expect((roundtrip as { extraData?: Record<string, unknown> }).extraData).toBeUndefined();
    });

    it("should preserve empty extraData object through round-trip", () => {
      const original = EnvelopeBuilder.new()
        .message(MessageBuilder.acpPayload({}))
        .extraData({})
        .build();

      const json = JSON.stringify(original);
      const roundtrip: BridgeEnvelope = JSON.parse(json);

      expect((roundtrip as { extraData?: Record<string, unknown> }).extraData).toEqual({});
    });

    it("should preserve complex extraData through round-trip", () => {
      const original = EnvelopeBuilder.new()
        .message(MessageBuilder.acpPayload({}))
        .extraData({
          nested: { a: 1, b: { c: 2 } },
          array: [1, "two", true, null],
          special: {
            "key-with-dash": "value",
            under_score: "value2",
          },
        })
        .build();

      const json = JSON.stringify(original);
      const roundtrip: BridgeEnvelope = JSON.parse(json);

      expect((roundtrip as { extraData?: Record<string, unknown> }).extraData).toEqual(
        (original as { extraData?: Record<string, unknown> }).extraData
      );
    });
  });

  describe("Serialization with all BridgeMessage variants", () => {
    it("should serialize acp_payload message", () => {
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.acpPayload({ method: "test", params: {} }))
        .build();

      const json = JSON.stringify(envelope);
      const parsed = JSON.parse(json);

      expect(parsed.type).toBe("acp_payload");
      expect(parsed.payload).toEqual({ method: "test", params: {} });
    });

    it("should serialize bridge_status message", () => {
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.bridgeStatus("connected"))
        .build();

      const json = JSON.stringify(envelope);
      const parsed = JSON.parse(json);

      expect(parsed.type).toBe("bridge_status");
      expect(parsed.status).toBe("connected");
    });

    it("should serialize all bridge_status variants", () => {
      const statuses: Array<"connected" | "disconnected" | "error"> = [
        "connected",
        "disconnected",
        "error",
      ];

      statuses.forEach((status) => {
        const envelope = EnvelopeBuilder.new()
          .message(MessageBuilder.bridgeStatus(status as "connected" | "disconnected" | "error"))
          .build();

        const json = JSON.stringify(envelope);
        const parsed = JSON.parse(json);

        expect(parsed.type).toBe("bridge_status");
        expect(parsed.status).toBe(status as string);
      });
    });

    it("should serialize stderr message", () => {
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.stderr("Error: something went wrong"))
        .build();

      const json = JSON.stringify(envelope);
      const parsed = JSON.parse(json);

      expect(parsed.type).toBe("stderr");
      expect(parsed.line).toBe("Error: something went wrong");
    });

    it("should serialize process_exit message with code and signal", () => {
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.processExit(1, "SIGTERM"))
        .build();

      const json = JSON.stringify(envelope);
      const parsed = JSON.parse(json);

      expect(parsed.type).toBe("process_exit");
      expect(parsed.code).toBe(1);
      expect(parsed.signal).toBe("SIGTERM");
    });

    it("should serialize process_exit message with null values", () => {
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.processExit(null, null))
        .build();

      const json = JSON.stringify(envelope);
      const parsed = JSON.parse(json);

      expect(parsed.type).toBe("process_exit");
      expect(parsed.code).toBe(null);
      expect(parsed.signal).toBe(null);
    });

    it("should serialize replay_metadata message", () => {
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.replayMetadata(1234567890, 100, "Test session"))
        .build();

      const json = JSON.stringify(envelope);
      const parsed = JSON.parse(json);

      expect(parsed.type).toBe("replay_metadata");
      expect(parsed.captured_at_ms).toBe(1234567890);
      expect(parsed.total_envelopes).toBe(100);
      expect(parsed.description).toBe("Test session");
    });

    it("should serialize replay_metadata message with null description", () => {
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.replayMetadata(1234567890, 100, null))
        .build();

      const json = JSON.stringify(envelope);
      const parsed = JSON.parse(json);

      expect(parsed.type).toBe("replay_metadata");
      expect(parsed.captured_at_ms).toBe(1234567890);
      expect(parsed.total_envelopes).toBe(100);
      expect(parsed.description).toBe(null);
    });

    it("should serialize start_agent message", () => {
      const envelope = EnvelopeBuilder.new()
        .message(
          MessageBuilder.startAgent("node", ["script.js"], "/workspace", [
            ["NODE_ENV", "test"],
            ["DEBUG", "true"],
          ]),
        )
        .build();

      const json = JSON.stringify(envelope);
      const parsed = JSON.parse(json);

      expect(parsed.type).toBe("start_agent");
      expect(parsed.command).toBe("node");
      expect(parsed.args).toEqual(["script.js"]);
      expect(parsed.cwd).toBe("/workspace");
      expect(parsed.env).toEqual([
        ["NODE_ENV", "test"],
        ["DEBUG", "true"],
      ]);
    });

    it("should serialize start_agent message with null cwd", () => {
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.startAgent("node", ["script.js"], null, []))
        .build();

      const json = JSON.stringify(envelope);
      const parsed = JSON.parse(json);

      expect(parsed.type).toBe("start_agent");
      expect(parsed.command).toBe("node");
      expect(parsed.args).toEqual(["script.js"]);
      expect(parsed.cwd).toBe(null);
      expect(parsed.env).toEqual([]);
    });

    it("should serialize start_agent message with empty env", () => {
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.startAgent("node", [], "/workspace", []))
        .build();

      const json = JSON.stringify(envelope);
      const parsed = JSON.parse(json);

      expect(parsed.type).toBe("start_agent");
      expect(parsed.command).toBe("node");
      expect(parsed.args).toEqual([]);
      expect(parsed.cwd).toBe("/workspace");
      expect(parsed.env).toEqual([]);
    });
  });

  describe("Round-trip with all message variants", () => {
    it("should round-trip acp_payload", () => {
      const original = EnvelopeBuilder.new()
        .message(MessageBuilder.acpPayload({ test: "data" }))
        .extraData({ meta: "info" })
        .build();

      const roundtrip: BridgeEnvelope = JSON.parse(JSON.stringify(original));

      expect(roundtrip.type).toBe("acp_payload");
      expect((roundtrip as { payload: unknown }).payload).toEqual({ test: "data" });
      expect((roundtrip as { extraData?: Record<string, unknown> }).extraData).toEqual({ meta: "info" });
    });

    it("should round-trip bridge_status", () => {
      const original = EnvelopeBuilder.new()
        .message(MessageBuilder.bridgeStatus("connected"))
        .extraData({ state: "active" })
        .build();

      const roundtrip: BridgeEnvelope = JSON.parse(JSON.stringify(original));

      expect(roundtrip.type).toBe("bridge_status");
      expect((roundtrip as { status: string }).status).toBe("connected");
      expect((roundtrip as { extraData?: Record<string, unknown> }).extraData).toEqual({ state: "active" });
    });

    it("should round-trip stderr", () => {
      const original = EnvelopeBuilder.new()
        .message(MessageBuilder.stderr("Test error line"))
        .extraData({ source: "stderr" })
        .build();

      const roundtrip: BridgeEnvelope = JSON.parse(JSON.stringify(original));

      expect(roundtrip.type).toBe("stderr");
      expect((roundtrip as { line: string }).line).toBe("Test error line");
      expect((roundtrip as { extraData?: Record<string, unknown> }).extraData).toEqual({ source: "stderr" });
    });

    it("should round-trip process_exit", () => {
      const original = EnvelopeBuilder.new()
        .message(MessageBuilder.processExit(0, "SIGINT"))
        .extraData({ exit: true })
        .build();

      const roundtrip: BridgeEnvelope = JSON.parse(JSON.stringify(original));

      expect(roundtrip.type).toBe("process_exit");
      expect((roundtrip as { code: number | null }).code).toBe(0);
      expect((roundtrip as { signal: string | null }).signal).toBe("SIGINT");
      expect((roundtrip as { extraData?: Record<string, unknown> }).extraData).toEqual({ exit: true });
    });

    it("should round-trip replay_metadata", () => {
      const original = EnvelopeBuilder.new()
        .message(MessageBuilder.replayMetadata(1234567890, 50, "Session"))
        .extraData({ replay: true })
        .build();

      const roundtrip: BridgeEnvelope = JSON.parse(JSON.stringify(original));

      expect(roundtrip.type).toBe("replay_metadata");
      expect((roundtrip as { captured_at_ms: number }).captured_at_ms).toBe(1234567890);
      expect((roundtrip as { total_envelopes: number }).total_envelopes).toBe(50);
      expect((roundtrip as { description: string | null }).description).toBe("Session");
      expect((roundtrip as { extraData?: Record<string, unknown> }).extraData).toEqual({ replay: true });
    });

    it("should round-trip start_agent", () => {
      const original = EnvelopeBuilder.new()
        .message(MessageBuilder.startAgent("python", ["app.py"], "/app", [["ENV", "prod"]]))
        .extraData({ agent: "started" })
        .build();

      const roundtrip: BridgeEnvelope = JSON.parse(JSON.stringify(original));

      expect(roundtrip.type).toBe("start_agent");
      expect((roundtrip as { command: string }).command).toBe("python");
      expect((roundtrip as { args: string[] }).args).toEqual(["app.py"]);
      expect((roundtrip as { cwd: string | null }).cwd).toBe("/app");
      expect((roundtrip as { env: Array<[string, string]> }).env).toEqual([["ENV", "prod"]]);
      expect((roundtrip as { extraData?: Record<string, unknown> }).extraData).toEqual({ agent: "started" });
    });
  });

  describe("Field name consistency", () => {
    it("should use snake_case for timestamp_ms in serialized JSON", () => {
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.acpPayload({}))
        .timestampMs(1234567890)
        .build();

      const json = JSON.stringify(envelope);
      
      // Must use snake_case to match Rust serialization
      expect(json).toContain('"timestamp_ms"');
      expect(json).not.toContain('"timestampMs"');
    });

    it("should use snake_case for captured_at_ms in replay_metadata", () => {
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.replayMetadata(1234567890, 100))
        .build();

      const json = JSON.stringify(envelope);
      
      expect(json).toContain('"captured_at_ms"');
      expect(json).not.toContain('"capturedAtMs"');
    });

    it("should use snake_case for total_envelopes in replay_metadata", () => {
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.replayMetadata(1234567890, 100))
        .build();

      const json = JSON.stringify(envelope);
      
      expect(json).toContain('"total_envelopes"');
      expect(json).not.toContain('"totalEnvelopes"');
    });

    it("should preserve extraData field name as camelCase (TypeScript convention)", () => {
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.acpPayload({}))
        .extraData({ key: "value" })
        .build();

      const json = JSON.stringify(envelope);
      
      // Note: extraData uses camelCase in TypeScript types
      // This matches the generated type definition
      expect(json).toContain('"extraData"');
    });
  });

  describe("Edge cases", () => {
    it("should handle very large timestamp values", () => {
      const largeTimestamp = Number.MAX_SAFE_INTEGER;
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.acpPayload({}))
        .timestampMs(largeTimestamp)
        .build();

      const json = JSON.stringify(envelope);
      const parsed = JSON.parse(json);

      expect(parsed.timestamp_ms).toBe(largeTimestamp);
    });

    it("should handle unicode in extraData values", () => {
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.acpPayload({}))
        .extraData({
          emoji: "🚀",
          chinese: "你好",
          arabic: "مرحبا",
        })
        .build();

      const json = JSON.stringify(envelope);
      const parsed = JSON.parse(json);

      expect(parsed.extraData).toEqual({
        emoji: "🚀",
        chinese: "你好",
        arabic: "مرحبا",
      });
    });

    it("should handle very long string values", () => {
      const longString = "a".repeat(10000);
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.acpPayload({}))
        .extraData({ long: longString })
        .build();

      const json = JSON.stringify(envelope);
      const parsed = JSON.parse(json);

      expect(parsed.extraData?.long).toBe(longString);
      expect(parsed.extraData?.long?.length).toBe(10000);
    });

    it("should handle deeply nested extraData", () => {
      const deepNested = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: "deep",
              },
            },
          },
        },
      };

      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.acpPayload({}))
        .extraData(deepNested)
        .build();

      const json = JSON.stringify(envelope);
      const parsed = JSON.parse(json);

      expect(parsed.extraData).toEqual(deepNested);
    });

    it("should handle mixed types in extraData arrays", () => {
      const envelope = EnvelopeBuilder.new()
        .message(MessageBuilder.acpPayload({}))
        .extraData({
          mixed: [1, "two", true, null, { nested: "object" }, [1, 2, 3]],
        })
        .build();

      const json = JSON.stringify(envelope);
      const parsed = JSON.parse(json);

      expect(parsed.extraData?.mixed).toEqual([
        1,
        "two",
        true,
        null,
        { nested: "object" },
        [1, 2, 3],
      ]);
    });
  });

  describe("TestConstants sample envelopes", () => {
    it("should serialize sampleAcpPayload correctly", () => {
      const envelope = TestConstants.sampleEnvelopeAcpPayload();

      const json = JSON.stringify(envelope);
      const parsed = JSON.parse(json);

      expect(parsed.type).toBe("acp_payload");
      expect(parsed.payload).toBeDefined();
      expect(parsed.version).toBe(1);
      expect(parsed.seq).toBe(0);
    });

    it("should serialize sampleBridgeStatus correctly", () => {
      const envelope = TestConstants.sampleEnvelopeBridgeStatus("connected");

      const json = JSON.stringify(envelope);
      const parsed = JSON.parse(json);

      expect(parsed.type).toBe("bridge_status");
      expect(parsed.status).toBe("connected");
    });

    it("should serialize sampleStderr correctly", () => {
      const envelope = TestConstants.sampleEnvelopeStderr();

      const json = JSON.stringify(envelope);
      const parsed = JSON.parse(json);

      expect(parsed.type).toBe("stderr");
      expect(parsed.line).toBe("Error: Something went wrong");
    });

    it("should serialize sampleProcessExit correctly", () => {
      const envelope = TestConstants.sampleEnvelopeProcessExit(1, "SIGTERM");

      const json = JSON.stringify(envelope);
      const parsed = JSON.parse(json);

      expect(parsed.type).toBe("process_exit");
      expect(parsed.code).toBe(1);
      expect(parsed.signal).toBe("SIGTERM");
    });

    it("should serialize sampleReplayMetadata correctly", () => {
      const envelope = TestConstants.sampleEnvelopeReplayMetadata();

      const json = JSON.stringify(envelope);
      const parsed = JSON.parse(json);

      expect(parsed.type).toBe("replay_metadata");
      expect(parsed.captured_at_ms).toBe(1234567890);
      expect(parsed.total_envelopes).toBe(100);
      expect(parsed.description).toBe("Test session");
    });

    it("should serialize sampleStartAgent correctly", () => {
      const envelope = TestConstants.sampleEnvelopeStartAgent();

      const json = JSON.stringify(envelope);
      const parsed = JSON.parse(json);

      expect(parsed.type).toBe("start_agent");
      expect(parsed.command).toBe("node");
      expect(parsed.args).toEqual(["script.js"]);
      expect(parsed.cwd).toBe("/workspace");
      expect(parsed.env).toEqual([["NODE_ENV", "test"]]);
    });
  });
});
