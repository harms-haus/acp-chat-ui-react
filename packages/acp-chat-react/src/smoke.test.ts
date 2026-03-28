import { describe, it, expect } from "vitest";
import { PACKAGE_VERSION, AcpStore, createAcpStore } from "./index.js";

describe("acp-chat-react smoke test", () => {
  it("exports PACKAGE_VERSION from core", () => {
    expect(PACKAGE_VERSION).toBe("0.0.1");
  });

  it("exports AcpStore class", () => {
    expect(AcpStore).toBeDefined();
    expect(typeof AcpStore).toBe("function");
  });

  it("exports createAcpStore factory", () => {
    expect(createAcpStore).toBeDefined();
    expect(typeof createAcpStore).toBe("function");
  });
});