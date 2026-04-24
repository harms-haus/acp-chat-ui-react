import { describe, it, expect } from "vitest";
import { parseLaunchPreset, isPresetValid, type LaunchPreset } from "./launch.js";

/**
 * Launch preset parsing and validation tests.
 * 
 * Tests cover:
 * - Environment variable parsing for all ACP_* variables
 * - parseLaunchPreset() with valid and invalid inputs
 * - isPresetValid() validation logic
 * - Edge cases: missing vars, malformed values, defaults
 */

describe("parseLaunchPreset", () => {
    describe("environment variable parsing", () => {
        it("parses ACP_LAUNCH_CMD", () => {
            const preset = parseLaunchPreset({
                ACP_LAUNCH_CMD: "npm run dev",
            });
            expect(preset.launchCmd).toBe("npm run dev");
        });

        it("parses ACP_SESSION_ID", () => {
            const preset = parseLaunchPreset({
                ACP_SESSION_ID: "session-123",
            });
            expect(preset.sessionId).toBe("session-123");
        });

        it("parses ACP_CWD", () => {
            const preset = parseLaunchPreset({
                ACP_CWD: "/workspace/my-project",
            });
            expect(preset.cwd).toBe("/workspace/my-project");
        });

        it("parses ACP_AUTO_CONNECT as true with 'true'", () => {
            const preset = parseLaunchPreset({
                ACP_AUTO_CONNECT: "true",
            });
            expect(preset.autoConnect).toBe(true);
        });

        it("parses ACP_AUTO_CONNECT as true with '1'", () => {
            const preset = parseLaunchPreset({
                ACP_AUTO_CONNECT: "1",
            });
            expect(preset.autoConnect).toBe(true);
        });

        it("parses ACP_AUTO_CONNECT as false with 'false'", () => {
            const preset = parseLaunchPreset({
                ACP_AUTO_CONNECT: "false",
            });
            expect(preset.autoConnect).toBe(false);
        });

        it("parses ACP_AUTO_CONNECT as false with '0'", () => {
            const preset = parseLaunchPreset({
                ACP_AUTO_CONNECT: "0",
            });
            expect(preset.autoConnect).toBe(false);
        });

        it("parses ACP_AUTO_CONNECT as false with invalid values", () => {
            const preset = parseLaunchPreset({
                ACP_AUTO_CONNECT: "invalid",
            });
            expect(preset.autoConnect).toBe(false);
        });

        it("parses ACP_BRIDGE_URL with custom value", () => {
            const preset = parseLaunchPreset({
                ACP_BRIDGE_URL: "ws://custom-host:9999",
            });
            expect(preset.bridgeUrl).toBe("ws://custom-host:9999");
        });

        it("uses default bridge URL when not specified", () => {
            const preset = parseLaunchPreset({});
            expect(preset.bridgeUrl).toBe("ws://127.0.0.1:8765");
        });

        it("parses all environment variables together", () => {
            const preset = parseLaunchPreset({
                ACP_LAUNCH_CMD: "npx @agentclientprotocol/claude",
                ACP_SESSION_ID: "abc-123",
                ACP_CWD: "/home/user/project",
                ACP_AUTO_CONNECT: "true",
                ACP_BRIDGE_URL: "ws://localhost:8765",
            });
            expect(preset).toEqual({
                launchCmd: "npx @agentclientprotocol/claude",
                sessionId: "abc-123",
                cwd: "/home/user/project",
                autoConnect: true,
                bridgeUrl: "ws://localhost:8765",
            });
        });
    });

    describe("default values", () => {
        it("returns null for launchCmd when not specified", () => {
            const preset = parseLaunchPreset({});
            expect(preset.launchCmd).toBeNull();
        });

        it("returns null for sessionId when not specified", () => {
            const preset = parseLaunchPreset({});
            expect(preset.sessionId).toBeNull();
        });

        it("returns null for cwd when not specified", () => {
            const preset = parseLaunchPreset({});
            expect(preset.cwd).toBeNull();
        });

        it("returns false for autoConnect when not specified", () => {
            const preset = parseLaunchPreset({});
            expect(preset.autoConnect).toBe(false);
        });

        it("returns default bridge URL when not specified", () => {
            const preset = parseLaunchPreset({});
            expect(preset.bridgeUrl).toBe("ws://127.0.0.1:8765");
        });

        it("handles empty environment", () => {
            const preset = parseLaunchPreset({});
            expect(preset).toEqual({
                launchCmd: null,
                sessionId: null,
                cwd: null,
                autoConnect: false,
                bridgeUrl: "ws://127.0.0.1:8765",
            });
        });
    });

    describe("edge cases", () => {
        it("handles undefined environment", () => {
            const preset = parseLaunchPreset(undefined as unknown as Record<string, string | undefined>);
            expect(preset.bridgeUrl).toBe("ws://127.0.0.1:8765");
        });

        it("handles empty string values", () => {
            const preset = parseLaunchPreset({
                ACP_LAUNCH_CMD: "",
                ACP_SESSION_ID: "",
                ACP_CWD: "",
            });
            expect(preset.launchCmd).toBe("");
            expect(preset.sessionId).toBe("");
            expect(preset.cwd).toBe("");
        });

        it("handles whitespace values", () => {
            const preset = parseLaunchPreset({
                ACP_LAUNCH_CMD: "  npm run dev  ",
                ACP_CWD: "  /workspace  ",
            });
            expect(preset.launchCmd).toBe("  npm run dev  ");
            expect(preset.cwd).toBe("  /workspace  ");
        });
    });
});

describe("isPresetValid", () => {
    it("returns valid for minimal preset", () => {
        const preset: LaunchPreset = {
            launchCmd: null,
            sessionId: null,
            cwd: null,
            autoConnect: false,
            bridgeUrl: "ws://127.0.0.1:8765",
        };
        expect(isPresetValid(preset)).toEqual({ valid: true });
    });

    it("returns valid for full preset", () => {
        const preset: LaunchPreset = {
            launchCmd: "npx @agentclientprotocol/claude",
            sessionId: "abc-123",
            cwd: "/workspace",
            autoConnect: true,
            bridgeUrl: "ws://localhost:8765",
        };
        expect(isPresetValid(preset)).toEqual({ valid: true });
    });

    it("returns valid for preset with only bridgeUrl", () => {
        const preset: LaunchPreset = {
            launchCmd: null,
            sessionId: null,
            cwd: null,
            autoConnect: false,
            bridgeUrl: "ws://custom:9999",
        };
        expect(isPresetValid(preset)).toEqual({ valid: true });
    });

    it("returns valid for preset with launchCmd only", () => {
        const preset: LaunchPreset = {
            launchCmd: "npx @agentclientprotocol/claude",
            sessionId: null,
            cwd: null,
            autoConnect: false,
            bridgeUrl: "ws://127.0.0.1:8765",
        };
        expect(isPresetValid(preset)).toEqual({ valid: true });
    });
});
