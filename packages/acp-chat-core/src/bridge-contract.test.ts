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
} from "./index.js";
import type { BridgeEnvelope, BridgeStatus } from "./generated/index.js";

type BridgeStatusEnvelope = BridgeEnvelope & { type: "bridge_status" };
type StderrEnvelope = BridgeEnvelope & { type: "stderr" };
type ProcessExitEnvelope = BridgeEnvelope & { type: "process_exit" };
type ReplayMetadataEnvelope = BridgeEnvelope & { type: "replay_metadata" };

function isBridgeStatusEnvelope(env: BridgeEnvelope): env is BridgeStatusEnvelope {
  return env.type === "bridge_status";
}

function isStderrEnvelope(env: BridgeEnvelope): env is StderrEnvelope {
  return env.type === "stderr";
}

function isProcessExitEnvelope(env: BridgeEnvelope): env is ProcessExitEnvelope {
  return env.type === "process_exit";
}

function isReplayMetadataEnvelope(env: BridgeEnvelope): env is ReplayMetadataEnvelope {
  return env.type === "replay_metadata";
}

describe("bridge-contract: version constants", () => {
  it("exports current envelope version as 1", () => {
    expect(ENVELOPE_VERSION).toBe(1);
  });

  it("exports supported versions containing current version", () => {
    expect(SUPPORTED_VERSIONS).toContain(ENVELOPE_VERSION);
  });
});

describe("bridge-contract: version validation", () => {
  it("accepts supported version", () => {
    expect(isSupportedVersion(1)).toBe(true);
  });

  it("rejects unsupported version", () => {
    expect(isSupportedVersion(99)).toBe(false);
    expect(isSupportedVersion(0)).toBe(false);
    expect(isSupportedVersion(2)).toBe(false);
  });
});

describe("bridge-contract: BridgeVersionError", () => {
  it("creates typed error with version info", () => {
    const error = new BridgeVersionError({
      received: 99,
      supported: [1],
    });

    expect(error.name).toBe("BridgeVersionError");
    expect(error.received).toBe(99);
    expect(error.supported).toEqual([1]);
    expect(error.message).toContain("99");
    expect(error.message.toLowerCase()).toContain("unsupported");
  });

  it("is instance of Error", () => {
    const error = new BridgeVersionError({
      received: 99,
      supported: [1],
    });
    expect(error).toBeInstanceOf(Error);
  });
});

describe("bridge-contract: envelope parsing", () => {
  it("parses valid envelope with acp_payload", () => {
    const json = JSON.stringify({
      version: 1,
      seq: 0,
      timestamp_ms: 1234567890,
      type: "acp_payload",
      payload: { jsonrpc: "2.0", method: "test" },
    });

    const envelope = parseEnvelope(json);

    expect(envelope.version).toBe(1);
    expect(envelope.seq).toBe(0);
    expect(envelope.timestamp_ms).toBe(1234567890);
    expect(envelope.type).toBe("acp_payload");
  });

  it("parses valid envelope with bridge_status", () => {
    const json = JSON.stringify({
      version: 1,
      seq: 0,
      timestamp_ms: 0,
      type: "bridge_status",
      status: "connected",
    });

    const envelope = parseEnvelope(json);

    expect(envelope.type).toBe("bridge_status");
    if (isBridgeStatusEnvelope(envelope)) {
      expect(envelope.status).toBe("connected");
    }
  });

  it("parses valid envelope with stderr", () => {
    const json = JSON.stringify({
      version: 1,
      seq: 0,
      timestamp_ms: 0,
      type: "stderr",
      line: "error output",
    });

    const envelope = parseEnvelope(json);

    expect(envelope.type).toBe("stderr");
    if (isStderrEnvelope(envelope)) {
      expect(envelope.line).toBe("error output");
    }
  });

  it("parses valid envelope with process_exit", () => {
    const json = JSON.stringify({
      version: 1,
      seq: 0,
      timestamp_ms: 0,
      type: "process_exit",
      code: 0,
      signal: null,
    });

    const envelope = parseEnvelope(json);

    expect(envelope.type).toBe("process_exit");
    if (isProcessExitEnvelope(envelope)) {
      expect(envelope.code).toBe(0);
      expect(envelope.signal).toBeNull();
    }
  });

  it("parses valid envelope with replay_metadata", () => {
    const json = JSON.stringify({
      version: 1,
      seq: 0,
      timestamp_ms: 0,
      type: "replay_metadata",
      captured_at_ms: 1700000000000,
      total_envelopes: 100,
      description: "Test session",
    });

    const envelope = parseEnvelope(json);

    expect(envelope.type).toBe("replay_metadata");
    if (isReplayMetadataEnvelope(envelope)) {
      expect(envelope.captured_at_ms).toBe(1700000000000);
      expect(envelope.total_envelopes).toBe(100);
      expect(envelope.description).toBe("Test session");
    }
  });
});

describe("bridge-contract: version rejection", () => {
  it("throws BridgeVersionError for unsupported version", () => {
    const json = JSON.stringify({
      version: 99,
      seq: 0,
      timestamp_ms: 0,
      type: "bridge_status",
      status: "connected",
    });

    expect(() => parseEnvelope(json)).toThrow(BridgeVersionError);
  });

  it("throws BridgeVersionError with correct version info", () => {
    const json = JSON.stringify({
      version: 99,
      seq: 0,
      timestamp_ms: 0,
      type: "bridge_status",
      status: "connected",
    });

    try {
      parseEnvelope(json);
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(BridgeVersionError);
      const versionError = error as BridgeVersionError;
      expect(versionError.received).toBe(99);
      expect(versionError.supported).toContain(1);
    }
  });

  it("parseEnvelopeSafe returns error for unsupported version", () => {
    const json = JSON.stringify({
      version: 99,
      seq: 0,
      timestamp_ms: 0,
      type: "bridge_status",
      status: "connected",
    });

    const result = parseEnvelopeSafe(json);

    expect(result).toBeInstanceOf(BridgeVersionError);
    if (result instanceof BridgeVersionError) {
      expect(result.received).toBe(99);
    }
  });

  it("parseEnvelopeSafe returns envelope for valid version", () => {
    const json = JSON.stringify({
      version: 1,
      seq: 0,
      timestamp_ms: 0,
      type: "bridge_status",
      status: "connected",
    });

    const result = parseEnvelopeSafe(json);

    expect(result).not.toBeInstanceOf(BridgeVersionError);
    if (!(result instanceof BridgeVersionError)) {
      expect(result.version).toBe(1);
    }
  });

  it("validateEnvelope throws for unsupported version", () => {
    const envelope: BridgeStatusEnvelope = {
      version: 99,
      seq: 0,
      timestamp_ms: 0,
      type: "bridge_status",
      status: "connected",
    };

    expect(() => validateEnvelope(envelope)).toThrow(BridgeVersionError);
  });

  it("validateEnvelope does not throw for supported version", () => {
    const envelope: BridgeStatusEnvelope = {
      version: 1,
      seq: 0,
      timestamp_ms: 0,
      type: "bridge_status",
      status: "connected",
    };

    expect(() => validateEnvelope(envelope)).not.toThrow();
  });
});

describe("bridge-contract: error factory", () => {
  it("creates UnsupportedVersionError object", () => {
    const error = createUnsupportedVersionError(99);

    expect(error.received).toBe(99);
    expect(error.supported).toEqual([1]);
  });
});

describe("bridge-contract: parity with Rust types", () => {
  it("matches BridgeStatus variants", () => {
    const statuses: BridgeStatus[] = [
      "starting",
      "connected",
      "reconnecting",
      "disconnected",
      "error",
    ];

    for (const status of statuses) {
      const json = JSON.stringify({
        version: 1,
        seq: 0,
        timestamp_ms: 0,
        type: "bridge_status",
        status,
      });

      const envelope = parseEnvelope(json);
      expect(envelope.type).toBe("bridge_status");
      if (isBridgeStatusEnvelope(envelope)) {
        expect(envelope.status).toBe(status);
      }
    }
  });

  it("matches all message types", () => {
    const messageTypes = [
      "acp_payload",
      "bridge_status",
      "stderr",
      "process_exit",
      "replay_metadata",
    ] as const;

    for (const msgType of messageTypes) {
      const base = {
        version: 1,
        seq: 0,
        timestamp_ms: 0,
        type: msgType,
      };

      let json: string;
      switch (msgType) {
        case "acp_payload":
          json = JSON.stringify({ ...base, payload: {} });
          break;
        case "bridge_status":
          json = JSON.stringify({ ...base, status: "connected" });
          break;
        case "stderr":
          json = JSON.stringify({ ...base, line: "test" });
          break;
        case "process_exit":
          json = JSON.stringify({ ...base, code: 0, signal: null });
          break;
        case "replay_metadata":
          json = JSON.stringify({
            ...base,
            captured_at_ms: 0,
            total_envelopes: 0,
            description: null,
          });
          break;
      }

      const envelope = parseEnvelope(json);
      expect(envelope.type).toBe(msgType);
    }
  });
});