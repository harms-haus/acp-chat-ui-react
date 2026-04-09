import { describe, it, expect } from "vitest";
import {
  ENVELOPE_VERSION,
  PACKAGE_VERSION,
  SUPPORTED_VERSIONS,
  isSupportedVersion,
} from "./index.js";

describe("@harms-haus/acp-chat-core scaffold", () => {
  it("exports package version", () => {
    expect(PACKAGE_VERSION).toBe("0.0.1");
  });

  it("exports envelope version constant", () => {
    expect(ENVELOPE_VERSION).toBe(1);
  });

  it("exports supported versions", () => {
    expect(SUPPORTED_VERSIONS).toContain(ENVELOPE_VERSION);
  });

  it("exports version validation function", () => {
    expect(isSupportedVersion(1)).toBe(true);
    expect(isSupportedVersion(99)).toBe(false);
  });
});