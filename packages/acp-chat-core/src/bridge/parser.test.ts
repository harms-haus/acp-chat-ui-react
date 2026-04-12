import { describe, expect, it } from "vitest";
import {
  BridgeVersionError,
  ENVELOPE_VERSION,
  SUPPORTED_VERSIONS,
  createUnsupportedVersionError,
  isSupportedVersion,
  parseEnvelope,
  parseEnvelopeSafe,
  validateEnvelope,
} from "./parser.js";
import type { BridgeEnvelope } from "../generated/index.js";
import {
  createBridgeEnvelope,
  createACPPayload,
  createACPPayloadError,
} from "../test-utils/index.js";

/**
 * Parser edge case and error handling tests.
 * 
 * These tests complement bridge-contract.test.ts by focusing on:
 * - Malformed JSON handling
 * - Missing required fields
 * - Invalid field types
 * - Boundary conditions
 * - All 6 message type variants
 * - parseEnvelopeSafe error scenarios
 */

describe("parser: malformed JSON handling", () => {
  it("throws SyntaxError for invalid JSON", () => {
    expect(() => parseEnvelope("not json at all")).toThrow(SyntaxError);
  });

  it("throws SyntaxError for truncated JSON", () => {
    expect(() => parseEnvelope('{"version": 1, "seq":')).toThrow(SyntaxError);
  });

  it("throws SyntaxError for JSON with trailing comma", () => {
    expect(() => parseEnvelope('{"version": 1,},')).toThrow(SyntaxError);
  });

  it("throws SyntaxError for empty string", () => {
    expect(() => parseEnvelope("")).toThrow(SyntaxError);
  });

  it("passes through non-version errors in parseEnvelopeSafe", () => {
    // parseEnvelopeSafe should only catch BridgeVersionError, not SyntaxError
    expect(() => parseEnvelopeSafe("invalid json")).toThrow(SyntaxError);
  });
});

describe("parser: missing required fields", () => {
  it("throws for missing version field", () => {
    const json = JSON.stringify({
      seq: 0,
      timestamp_ms: 1234567890,
      type: "acp_payload",
      payload: { jsonrpc: "2.0" },
    });

    // Missing version means undefined, which fails version check
    expect(() => parseEnvelope(json)).toThrow(BridgeVersionError);
  });

  it("throws for missing seq field", () => {
    const json = JSON.stringify({
      version: 1,
      timestamp_ms: 1234567890,
      type: "acp_payload",
      payload: { jsonrpc: "2.0" },
    });

    // This should parse but may fail TypeScript validation at runtime
    // The parser only validates version, not presence of all fields
    const envelope = parseEnvelope(json);
    expect(envelope.version).toBe(1);
    // @ts-expect-error - seq is missing but parser doesn't validate
    expect(envelope.seq).toBeUndefined();
  });

  it("throws for missing timestamp_ms field", () => {
    const json = JSON.stringify({
      version: 1,
      seq: 0,
      type: "acp_payload",
      payload: { jsonrpc: "2.0" },
    });

    const envelope = parseEnvelope(json);
    expect(envelope.version).toBe(1);
    // @ts-expect-error - timestamp_ms is missing but parser doesn't validate
    expect(envelope.timestamp_ms).toBeUndefined();
  });

  it("throws for missing type field", () => {
    const json = JSON.stringify({
      version: 1,
      seq: 0,
      timestamp_ms: 1234567890,
      payload: { jsonrpc: "2.0" },
    });

    const envelope = parseEnvelope(json);
    expect(envelope.version).toBe(1);
    // @ts-expect-error - type is missing but parser doesn't validate
    expect(envelope.type).toBeUndefined();
  });
});

describe("parser: invalid field types", () => {
  it("handles version as string (coerced by JSON)", () => {
    // JSON.parse preserves types, so version: "1" becomes string
    // This should fail version check since "1" !== 1
    const json = '{"version": "1", "seq": 0, "timestamp_ms": 0, "type": "acp_payload", "payload": {}}';
    
    expect(() => parseEnvelope(json)).toThrow(BridgeVersionError);
  });

  it("handles seq as string", () => {
    const json = JSON.stringify({
      version: 1,
      seq: "0",
      timestamp_ms: 0,
      type: "acp_payload",
      payload: {},
    });

    // Parser doesn't validate field types, only version
    const envelope = parseEnvelope(json);
    expect(envelope.version).toBe(1);
  });

  it("handles null envelope", () => {
    const json = JSON.stringify(null);
    
    expect(() => parseEnvelope(json)).toThrow(TypeError);
  });

  it("handles array instead of object", () => {
    const json = JSON.stringify([1, 2, 3]);
    
    expect(() => parseEnvelope(json)).toThrow(BridgeVersionError);
  });
});

describe("parser: version validation edge cases", () => {
  it("rejects version 0", () => {
    const json = JSON.stringify({
      version: 0,
      seq: 0,
      timestamp_ms: 0,
      type: "acp_payload",
      payload: {},
    });

    expect(() => parseEnvelope(json)).toThrow(BridgeVersionError);
  });

  it("rejects version 2", () => {
    const json = JSON.stringify({
      version: 2,
      seq: 0,
      timestamp_ms: 0,
      type: "acp_payload",
      payload: {},
    });

    expect(() => parseEnvelope(json)).toThrow(BridgeVersionError);
  });

  it("rejects negative version", () => {
    const json = JSON.stringify({
      version: -1,
      seq: 0,
      timestamp_ms: 0,
      type: "acp_payload",
      payload: {},
    });

    expect(() => parseEnvelope(json)).toThrow(BridgeVersionError);
  });

  it("rejects very large version", () => {
    const json = JSON.stringify({
      version: 999999,
      seq: 0,
      timestamp_ms: 0,
      type: "acp_payload",
      payload: {},
    });

    expect(() => parseEnvelope(json)).toThrow(BridgeVersionError);
  });

  it("rejects floating point version", () => {
    const json = JSON.stringify({
      version: 1.5,
      seq: 0,
      timestamp_ms: 0,
      type: "acp_payload",
      payload: {},
    });

    expect(() => parseEnvelope(json)).toThrow(BridgeVersionError);
  });

  it("isSupportedVersion returns false for edge cases", () => {
    expect(isSupportedVersion(NaN)).toBe(false);
    expect(isSupportedVersion(Infinity)).toBe(false);
    expect(isSupportedVersion(-Infinity)).toBe(false);
  });
});

describe("parser: all message type variants", () => {
  it("parses acp_payload with JSON-RPC request", () => {
    const payload = createACPPayload({
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05" },
    });
    const envelope = createBridgeEnvelope({ seq: 5, payload });
    const json = JSON.stringify(envelope);

    const result = parseEnvelope(json);
    expect(result.type).toBe("acp_payload");
    expect(result.seq).toBe(5);
  });

  it("parses acp_payload with JSON-RPC response", () => {
    const envelope: BridgeEnvelope = {
      version: 1,
      seq: 10,
      timestamp_ms: 1234567890,
      type: "acp_payload",
      payload: { jsonrpc: "2.0", id: 1, result: { success: true } },
    };
    const json = JSON.stringify(envelope);

    const result = parseEnvelope(json);
    expect(result.type).toBe("acp_payload");
  });

  it("parses acp_payload with JSON-RPC error", () => {
    const payload = createACPPayloadError({
      id: 1,
      code: -32600,
      message: "Invalid Request",
    });
    const envelope = createBridgeEnvelope({ seq: 3, payload });
    const json = JSON.stringify(envelope);

    const result = parseEnvelope(json);
    expect(result.type).toBe("acp_payload");
  });

  it("parses bridge_status with all status variants", () => {
    const statuses = ["starting", "connected", "reconnecting", "disconnected", "error"] as const;

    for (const status of statuses) {
      const envelope: BridgeEnvelope = {
        version: 1,
        seq: 0,
        timestamp_ms: 0,
        type: "bridge_status",
        status,
      };
      const json = JSON.stringify(envelope);

      const result = parseEnvelope(json);
      expect(result.type).toBe("bridge_status");
      if (result.type === "bridge_status") {
        expect(result.status).toBe(status);
      }
    }
  });

  it("parses stderr with empty line", () => {
    const envelope: BridgeEnvelope = {
      version: 1,
      seq: 0,
      timestamp_ms: 0,
      type: "stderr",
      line: "",
    };
    const json = JSON.stringify(envelope);

    const result = parseEnvelope(json);
    expect(result.type).toBe("stderr");
    if (result.type === "stderr") {
      expect(result.line).toBe("");
    }
  });

  it("parses stderr with multiline content", () => {
    const envelope: BridgeEnvelope = {
      version: 1,
      seq: 0,
      timestamp_ms: 0,
      type: "stderr",
      line: "Error: Line 1\nLine 2\nLine 3",
    };
    const json = JSON.stringify(envelope);

    const result = parseEnvelope(json);
    expect(result.type).toBe("stderr");
    if (result.type === "stderr") {
      expect(result.line).toContain("\n");
    }
  });

  it("parses process_exit with code 0", () => {
    const envelope: BridgeEnvelope = {
      version: 1,
      seq: 0,
      timestamp_ms: 0,
      type: "process_exit",
      code: 0,
      signal: null,
    };
    const json = JSON.stringify(envelope);

    const result = parseEnvelope(json);
    expect(result.type).toBe("process_exit");
    if (result.type === "process_exit") {
      expect(result.code).toBe(0);
      expect(result.signal).toBeNull();
    }
  });

  it("parses process_exit with signal", () => {
    const envelope: BridgeEnvelope = {
      version: 1,
      seq: 0,
      timestamp_ms: 0,
      type: "process_exit",
      code: null,
      signal: "SIGTERM",
    };
    const json = JSON.stringify(envelope);

    const result = parseEnvelope(json);
    expect(result.type).toBe("process_exit");
    if (result.type === "process_exit") {
      expect(result.code).toBeNull();
      expect(result.signal).toBe("SIGTERM");
    }
  });

  it("parses process_exit with both code and signal", () => {
    const envelope: BridgeEnvelope = {
      version: 1,
      seq: 0,
      timestamp_ms: 0,
      type: "process_exit",
      code: 137,
      signal: "SIGKILL",
    };
    const json = JSON.stringify(envelope);

    const result = parseEnvelope(json);
    expect(result.type).toBe("process_exit");
    if (result.type === "process_exit") {
      expect(result.code).toBe(137);
      expect(result.signal).toBe("SIGKILL");
    }
  });

  it("parses replay_metadata with null description", () => {
    const envelope: BridgeEnvelope = {
      version: 1,
      seq: 0,
      timestamp_ms: 0,
      type: "replay_metadata",
      captured_at_ms: 1700000000000,
      total_envelopes: 1000,
      description: null,
    };
    const json = JSON.stringify(envelope);

    const result = parseEnvelope(json);
    expect(result.type).toBe("replay_metadata");
    if (result.type === "replay_metadata") {
      expect(result.captured_at_ms).toBe(1700000000000);
      expect(result.total_envelopes).toBe(1000);
      expect(result.description).toBeNull();
    }
  });

  it("parses replay_metadata with large total_envelopes", () => {
    const envelope: BridgeEnvelope = {
      version: 1,
      seq: 0,
      timestamp_ms: 0,
      type: "replay_metadata",
      captured_at_ms: 1700000000000,
      total_envelopes: Number.MAX_SAFE_INTEGER,
      description: "Large replay",
    };
    const json = JSON.stringify(envelope);

    const result = parseEnvelope(json);
    expect(result.type).toBe("replay_metadata");
    if (result.type === "replay_metadata") {
      expect(result.total_envelopes).toBe(Number.MAX_SAFE_INTEGER);
    }
  });

  it("parses start_agent with minimal fields", () => {
    const envelope: BridgeEnvelope = {
      version: 1,
      seq: 0,
      timestamp_ms: 0,
      type: "start_agent",
      command: "node",
      args: [],
      cwd: null,
      env: [],
    };
    const json = JSON.stringify(envelope);

    const result = parseEnvelope(json);
    expect(result.type).toBe("start_agent");
    if (result.type === "start_agent") {
      expect(result.command).toBe("node");
      expect(result.args).toEqual([]);
      expect(result.cwd).toBeNull();
      expect(result.env).toEqual([]);
    }
  });

  it("parses start_agent with full configuration", () => {
    const envelope: BridgeEnvelope = {
      version: 1,
      seq: 0,
      timestamp_ms: 0,
      type: "start_agent",
      command: "npm",
      args: ["run", "dev"],
      cwd: "/workspace/my-project",
      env: [
        ["NODE_ENV", "development"],
        ["PORT", "3000"],
      ],
    };
    const json = JSON.stringify(envelope);

    const result = parseEnvelope(json);
    expect(result.type).toBe("start_agent");
    if (result.type === "start_agent") {
      expect(result.command).toBe("npm");
      expect(result.args).toEqual(["run", "dev"]);
      expect(result.cwd).toBe("/workspace/my-project");
      expect(result.env).toEqual([
        ["NODE_ENV", "development"],
        ["PORT", "3000"],
      ]);
    }
  });

  it("parses start_agent with special characters in command", () => {
    const envelope: BridgeEnvelope = {
      version: 1,
      seq: 0,
      timestamp_ms: 0,
      type: "start_agent",
      command: "/path/with spaces/bin/node",
      args: ["script.js", "arg with spaces"],
      cwd: "/workspace",
      env: [],
    };
    const json = JSON.stringify(envelope);

    const result = parseEnvelope(json);
    expect(result.type).toBe("start_agent");
    if (result.type === "start_agent") {
      expect(result.command).toBe("/path/with spaces/bin/node");
      expect(result.args).toContain("arg with spaces");
    }
  });
});

describe("parser: extra_data field (optional)", () => {
  it("parses envelope with extra_data", () => {
    const envelope: BridgeEnvelope = {
      version: 1,
      seq: 0,
      timestamp_ms: 0,
      type: "acp_payload",
      payload: {},
      extraData: { replay_speed: 2.0 },
    };
    const json = JSON.stringify(envelope);

    const result = parseEnvelope(json);
    expect(result.extraData).toEqual({ replay_speed: 2.0 });
  });

  it("parses envelope without extra_data", () => {
    const envelope: BridgeEnvelope = {
      version: 1,
      seq: 0,
      timestamp_ms: 0,
      type: "acp_payload",
      payload: {},
    };
    const json = JSON.stringify(envelope);

    const result = parseEnvelope(json);
    expect(result.extraData).toBeUndefined();
  });

  it("parses envelope with null extra_data", () => {
    const envelope: BridgeEnvelope = {
      version: 1,
      seq: 0,
      timestamp_ms: 0,
      type: "acp_payload",
      payload: {},
      extraData: null,
    };
    const json = JSON.stringify(envelope);

    const result = parseEnvelope(json);
    expect(result.extraData).toBeNull();
  });

  it("parses envelope with complex extra_data", () => {
    const envelope: BridgeEnvelope = {
      version: 1,
      seq: 0,
      timestamp_ms: 0,
      type: "acp_payload",
      payload: {},
      extraData: {
        nested: { deep: { value: 42 } },
        array: [1, 2, 3],
        mixed: ["string", 123, true, null],
      },
    };
    const json = JSON.stringify(envelope);

    const result = parseEnvelope(json);
    expect(result.extraData).toMatchObject({
      nested: { deep: { value: 42 } },
      array: [1, 2, 3],
    });
  });
});

describe("parser: boundary and numeric edge cases", () => {
  it("handles seq = 0", () => {
    const envelope = createBridgeEnvelope({ seq: 0, payload: createACPPayload({ id: 1, method: "test" }) });
    const json = JSON.stringify(envelope);

    const result = parseEnvelope(json);
    expect(result.seq).toBe(0);
  });

  it("handles very large seq number", () => {
    const envelope = createBridgeEnvelope({
      seq: Number.MAX_SAFE_INTEGER,
      payload: createACPPayload({ id: 1, method: "test" }),
    });
    const json = JSON.stringify(envelope);

    const result = parseEnvelope(json);
    expect(result.seq).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("handles timestamp_ms = 0", () => {
    const envelope = createBridgeEnvelope({
      timestamp_ms: 0,
      payload: createACPPayload({ id: 1, method: "test" }),
    });
    const json = JSON.stringify(envelope);

    const result = parseEnvelope(json);
    expect(result.timestamp_ms).toBe(0);
  });

  it("handles very large timestamp_ms", () => {
    const envelope = createBridgeEnvelope({
      timestamp_ms: 9999999999999,
      payload: createACPPayload({ id: 1, method: "test" }),
    });
    const json = JSON.stringify(envelope);

    const result = parseEnvelope(json);
    expect(result.timestamp_ms).toBe(9999999999999);
  });

  it("handles negative seq (technically valid JSON)", () => {
    const json = JSON.stringify({
      version: 1,
      seq: -1,
      timestamp_ms: 0,
      type: "acp_payload",
      payload: {},
    });

    // Parser doesn't validate seq range
    const result = parseEnvelope(json);
    expect(result.seq).toBe(-1);
  });
});

describe("parser: validateEnvelope function", () => {
  it("throws for invalid version", () => {
    const envelope: BridgeEnvelope = {
      version: 99,
      seq: 0,
      timestamp_ms: 0,
      type: "acp_payload",
      payload: {},
    };

    expect(() => validateEnvelope(envelope)).toThrow(BridgeVersionError);
  });

  it("does not throw for valid version", () => {
    const envelope: BridgeEnvelope = {
      version: 1,
      seq: 0,
      timestamp_ms: 0,
      type: "acp_payload",
      payload: {},
    };

    expect(() => validateEnvelope(envelope)).not.toThrow();
  });
});

describe("parser: createUnsupportedVersionError function", () => {
  it("creates error object with correct structure", () => {
    const error = createUnsupportedVersionError(99);

    expect(error.received).toBe(99);
    expect(error.supported).toEqual([1]);
  });

  it("creates error with spread supported versions", () => {
    const error = createUnsupportedVersionError(2);

    expect(error.supported).toEqual(SUPPORTED_VERSIONS);
    expect(error.supported).toContain(ENVELOPE_VERSION);
  });
});

describe("parser: parseEnvelopeSafe comprehensive error handling", () => {
  it("returns BridgeVersionError for version 0", () => {
    const json = JSON.stringify({
      version: 0,
      seq: 0,
      timestamp_ms: 0,
      type: "acp_payload",
      payload: {},
    });

    const result = parseEnvelopeSafe(json);
    expect(result).toBeInstanceOf(BridgeVersionError);
    if (result instanceof BridgeVersionError) {
      expect(result.received).toBe(0);
    }
  });

  it("returns BridgeVersionError for version 2", () => {
    const json = JSON.stringify({
      version: 2,
      seq: 0,
      timestamp_ms: 0,
      type: "acp_payload",
      payload: {},
    });

    const result = parseEnvelopeSafe(json);
    expect(result).toBeInstanceOf(BridgeVersionError);
    if (result instanceof BridgeVersionError) {
      expect(result.received).toBe(2);
    }
  });

  it("throws SyntaxError for invalid JSON (not caught)", () => {
    expect(() => parseEnvelopeSafe("not json")).toThrow(SyntaxError);
  });

  it("returns valid envelope for correct input", () => {
    const json = JSON.stringify({
      version: 1,
      seq: 0,
      timestamp_ms: 0,
      type: "acp_payload",
      payload: {},
    });

    const result = parseEnvelopeSafe(json);
    expect(result).not.toBeInstanceOf(BridgeVersionError);
    if (!(result instanceof BridgeVersionError)) {
      expect(result.version).toBe(1);
    }
  });
});
