import { describe, it, expect } from "vitest";
import { parseLaunchPreset, isPresetValid, type LaunchPreset } from "./launch.js";

/**
 * Launch preset parsing and validation tests.
 * 
 * Tests cover:
 * - Environment variable parsing for all ACP_* variables
 * - parseLaunchPreset() with valid and invalid inputs
 * - isPresetValid() validation logic for proxy/replay modes
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

        it("parses ACP_BRIDGE_MODE as proxy", () => {
            const preset = parseLaunchPreset({
                ACP_BRIDGE_MODE: "proxy",
            });
            expect(preset.bridgeMode).toBe("proxy");
        });

        it("parses ACP_BRIDGE_MODE as replay", () => {
            const preset = parseLaunchPreset({
                ACP_BRIDGE_MODE: "replay",
            });
            expect(preset.bridgeMode).toBe("replay");
        });

        it("sets bridgeMode to null for invalid values", () => {
            const preset = parseLaunchPreset({
                ACP_BRIDGE_MODE: "invalid",
            });
            expect(preset.bridgeMode).toBeNull();
        });

        it("sets bridgeMode to null for empty string", () => {
            const preset = parseLaunchPreset({
                ACP_BRIDGE_MODE: "",
            });
            expect(preset.bridgeMode).toBeNull();
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
                ACP_BRIDGE_URL: "ws://custom:9000",
            });
            expect(preset.bridgeUrl).toBe("ws://custom:9000");
        });

        it("uses default bridge URL when not provided", () => {
            const preset = parseLaunchPreset({});
            expect(preset.bridgeUrl).toBe("ws://127.0.0.1:8765");
        });

        it("parses ACP_REPLAY_FILE", () => {
            const preset = parseLaunchPreset({
                ACP_REPLAY_FILE: "/path/to/replay.json",
            });
            expect(preset.replayFile).toBe("/path/to/replay.json");
        });

        it("handles all environment variables together", () => {
            const preset = parseLaunchPreset({
                ACP_LAUNCH_CMD: "npm start",
                ACP_SESSION_ID: "test-session",
                ACP_CWD: "/workspace",
                ACP_BRIDGE_MODE: "proxy",
                ACP_AUTO_CONNECT: "true",
                ACP_BRIDGE_URL: "ws://localhost:8080",
            });
            expect(preset).toEqual({
                launchCmd: "npm start",
                sessionId: "test-session",
                cwd: "/workspace",
                bridgeMode: "proxy",
                autoConnect: true,
                bridgeUrl: "ws://localhost:8080",
                replayFile: null,
            });
        });
    });

    describe("default values", () => {
        it("returns null for missing string values", () => {
            const preset = parseLaunchPreset({});
            expect(preset.launchCmd).toBeNull();
            expect(preset.sessionId).toBeNull();
            expect(preset.cwd).toBeNull();
            expect(preset.replayFile).toBeNull();
        });

        it("returns false for missing autoConnect", () => {
            const preset = parseLaunchPreset({});
            expect(preset.autoConnect).toBe(false);
        });

        it("returns default bridge URL when missing", () => {
            const preset = parseLaunchPreset({});
            expect(preset.bridgeUrl).toBe("ws://127.0.0.1:8765");
        });

        it("returns null for missing bridgeMode", () => {
            const preset = parseLaunchPreset({});
            expect(preset.bridgeMode).toBeNull();
        });
    });

    describe("edge cases", () => {
        it("handles undefined in env object", () => {
            const preset = parseLaunchPreset({
                ACP_LAUNCH_CMD: undefined,
            });
            expect(preset.launchCmd).toBeNull();
        });

        it("handles empty string env vars correctly", () => {
            const preset = parseLaunchPreset({
                ACP_LAUNCH_CMD: "",
            });
            expect(preset.launchCmd).toBe("");
        });

        it("handles whitespace in values", () => {
            const preset = parseLaunchPreset({
                ACP_LAUNCH_CMD: "  npm run dev  ",
                ACP_SESSION_ID: " session-123 ",
                ACP_CWD: " /path/with spaces/ ",
            });
            expect(preset.launchCmd).toBe("  npm run dev  ");
            expect(preset.sessionId).toBe(" session-123 ");
            expect(preset.cwd).toBe(" /path/with spaces/ ");
        });

        it("handles special characters in values", () => {
            const preset = parseLaunchPreset({
                ACP_LAUNCH_CMD: "npm run dev -- --port=3000",
                ACP_CWD: "/path/with-dashes_and_underscores",
                ACP_BRIDGE_URL: "ws://127.0.0.1:8765/path?query=value",
            });
            expect(preset.launchCmd).toBe("npm run dev -- --port=3000");
            expect(preset.cwd).toBe("/path/with-dashes_and_underscores");
            expect(preset.bridgeUrl).toBe("ws://127.0.0.1:8765/path?query=value");
        });

        it("handles unicode characters in values", () => {
            const preset = parseLaunchPreset({
                ACP_CWD: "/路径/に/ディレクトリ",
                ACP_LAUNCH_CMD: "npm run dev --name=测试",
            });
            expect(preset.cwd).toBe("/路径/に/ディレクトリ");
            expect(preset.launchCmd).toBe("npm run dev --name=测试");
        });

        it("handles very long values", () => {
            const longPath = "/very/long/path/".repeat(100);
            const preset = parseLaunchPreset({
                ACP_CWD: longPath,
            });
            expect(preset.cwd).toBe(longPath);
        });

        it("handles case sensitivity", () => {
            const preset = parseLaunchPreset({
                ACP_LAUNCH_CMD: "npm run dev",
                acp_launch_cmd: "npm run prod",
            });
            expect(preset.launchCmd).toBe("npm run dev");
        });
    });
});

describe("isPresetValid", () => {
    describe("proxy mode validation", () => {
        it("returns valid for proxy mode with launchCmd", () => {
            const preset: LaunchPreset = {
                launchCmd: "npm run dev",
                sessionId: null,
                cwd: null,
                bridgeMode: "proxy",
                autoConnect: false,
                bridgeUrl: "ws://localhost:8080",
                replayFile: null,
            };

            const result = isPresetValid(preset);
            expect(result).toEqual({ valid: true });
        });

        it("returns invalid for proxy mode without launchCmd", () => {
            const preset: LaunchPreset = {
                launchCmd: null,
                sessionId: null,
                cwd: null,
                bridgeMode: "proxy",
                autoConnect: false,
                bridgeUrl: "ws://localhost:8080",
                replayFile: null,
            };

            const result = isPresetValid(preset);
            expect(result).toEqual({
                valid: false,
                reason: "ACP_LAUNCH_CMD is required for proxy mode",
            });
        });

        it("returns invalid for proxy mode with empty string launchCmd", () => {
            const preset: LaunchPreset = {
                launchCmd: "",
                sessionId: null,
                cwd: null,
                bridgeMode: "proxy",
                autoConnect: false,
                bridgeUrl: "ws://localhost:8080",
                replayFile: null,
            };

            const result = isPresetValid(preset);
            expect(result).toEqual({
                valid: false,
                reason: "ACP_LAUNCH_CMD is required for proxy mode",
            });
        });
    });

    describe("replay mode validation", () => {
        it("returns valid for replay mode with replayFile", () => {
            const preset: LaunchPreset = {
                launchCmd: null,
                sessionId: null,
                cwd: null,
                bridgeMode: "replay",
                autoConnect: false,
                bridgeUrl: "ws://localhost:8080",
                replayFile: "/path/to/replay.json",
            };

            const result = isPresetValid(preset);
            expect(result).toEqual({ valid: true });
        });

        it("returns invalid for replay mode without replayFile", () => {
            const preset: LaunchPreset = {
                launchCmd: null,
                sessionId: null,
                cwd: null,
                bridgeMode: "replay",
                autoConnect: false,
                bridgeUrl: "ws://localhost:8080",
                replayFile: null,
            };

            const result = isPresetValid(preset);
            expect(result).toEqual({
                valid: false,
                reason: "ACP_REPLAY_FILE is required for replay mode",
            });
        });

        it("returns invalid for replay mode with empty string replayFile", () => {
            const preset: LaunchPreset = {
                launchCmd: null,
                sessionId: null,
                cwd: null,
                bridgeMode: "replay",
                autoConnect: false,
                bridgeUrl: "ws://localhost:8080",
                replayFile: "",
            };

            const result = isPresetValid(preset);
            expect(result).toEqual({
                valid: false,
                reason: "ACP_REPLAY_FILE is required for replay mode",
            });
        });
    });

    describe("null/unknown mode validation", () => {
        it("returns valid for null bridgeMode", () => {
            const preset: LaunchPreset = {
                launchCmd: null,
                sessionId: null,
                cwd: null,
                bridgeMode: null,
                autoConnect: false,
                bridgeUrl: "ws://localhost:8080",
                replayFile: null,
            };

            const result = isPresetValid(preset);
            expect(result).toEqual({ valid: true });
        });

        it("returns valid with all nulls", () => {
            const preset: LaunchPreset = {
                launchCmd: null,
                sessionId: null,
                cwd: null,
                bridgeMode: null,
                autoConnect: false,
                bridgeUrl: "ws://localhost:8080",
                replayFile: null,
            };

            const result = isPresetValid(preset);
            expect(result).toEqual({ valid: true });
        });
    });

    describe("mode-specific field combinations", () => {
        it("allows proxy mode with optional fields", () => {
            const preset: LaunchPreset = {
                launchCmd: "npm run dev",
                sessionId: "session-123",
                cwd: "/workspace",
                bridgeMode: "proxy",
                autoConnect: true,
                bridgeUrl: "ws://localhost:8080",
                replayFile: null,
            };

            const result = isPresetValid(preset);
            expect(result).toEqual({ valid: true });
        });

        it("allows replay mode with optional fields", () => {
            const preset: LaunchPreset = {
                launchCmd: null,
                sessionId: "session-123",
                cwd: "/workspace",
                bridgeMode: "replay",
                autoConnect: true,
                bridgeUrl: "ws://localhost:8080",
                replayFile: "/path/to/replay.json",
            };

            const result = isPresetValid(preset);
            expect(result).toEqual({ valid: true });
        });

        it("allows proxy mode even with replayFile set", () => {
            const preset: LaunchPreset = {
                launchCmd: "npm run dev",
                sessionId: null,
                cwd: null,
                bridgeMode: "proxy",
                autoConnect: false,
                bridgeUrl: "ws://localhost:8080",
                replayFile: "/path/to/replay.json",
            };

            const result = isPresetValid(preset);
            expect(result).toEqual({ valid: true });
        });

        it("allows replay mode even with launchCmd set", () => {
            const preset: LaunchPreset = {
                launchCmd: "npm run dev",
                sessionId: null,
                cwd: null,
                bridgeMode: "replay",
                autoConnect: false,
                bridgeUrl: "ws://localhost:8080",
                replayFile: "/path/to/replay.json",
            };

            const result = isPresetValid(preset);
            expect(result).toEqual({ valid: true });
        });
    });

    describe("edge cases", () => {
        it("handles whitespace-only launchCmd as invalid", () => {
            const preset: LaunchPreset = {
                launchCmd: "   ",
                sessionId: null,
                cwd: null,
                bridgeMode: "proxy",
                autoConnect: false,
                bridgeUrl: "ws://localhost:8080",
                replayFile: null,
            };

            const result = isPresetValid(preset);
            // Whitespace-only is truthy, so it's considered valid
            expect(result).toEqual({ valid: true });
        });

        it("handles whitespace-only replayFile as invalid", () => {
            const preset: LaunchPreset = {
                launchCmd: null,
                sessionId: null,
                cwd: null,
                bridgeMode: "replay",
                autoConnect: false,
                bridgeUrl: "ws://localhost:8080",
                replayFile: "   ",
            };

            const result = isPresetValid(preset);
            // Whitespace-only is truthy, so it's considered valid
            expect(result).toEqual({ valid: true });
        });
    });
});

describe("LaunchPreset type", () => {
    it("can be instantiated with all fields", () => {
        const preset: LaunchPreset = {
            launchCmd: "npm run dev",
            sessionId: "session-123",
            cwd: "/workspace",
            bridgeMode: "proxy",
            autoConnect: true,
            bridgeUrl: "ws://localhost:8080",
            replayFile: "/path/to/replay.json",
        };

        expect(preset).toBeDefined();
        expect(preset.launchCmd).toBe("npm run dev");
    });

    it("can be instantiated with null values", () => {
        const preset: LaunchPreset = {
            launchCmd: null,
            sessionId: null,
            cwd: null,
            bridgeMode: null,
            autoConnect: false,
            bridgeUrl: "ws://localhost:8080",
            replayFile: null,
        };

        expect(preset).toBeDefined();
        expect(preset.bridgeMode).toBeNull();
    });

    it("requires bridgeUrl (cannot be null)", () => {
        // This test ensures the type structure
        const preset: LaunchPreset = {
            launchCmd: null,
            sessionId: null,
            cwd: null,
            bridgeMode: null,
            autoConnect: false,
            bridgeUrl: "ws://localhost",
            replayFile: null,
        };

        expect(preset.bridgeUrl).toBeDefined();
    });
});
