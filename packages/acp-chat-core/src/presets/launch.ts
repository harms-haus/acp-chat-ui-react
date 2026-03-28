export interface LaunchPreset {
    launchCmd: string | null;
    sessionId: string | null;
    cwd: string | null;
    bridgeMode: "proxy" | "replay" | null;
    autoConnect: boolean;
    bridgeUrl: string;
    replayFile: string | null;
}

const BRIDGE_URL_DEFAULT = "ws://127.0.0.1:8765";

function getEnvVar(key: string, fallback: string | null = null): string | null {
    try {
        const env = (import.meta as { env?: Record<string, string | undefined> }).env;
        if (env && env[key] !== undefined) {
            return env[key] ?? fallback;
        }
    } catch {
        // import.meta.env not available
    }
    return fallback;
}

export function parseLaunchPreset(): LaunchPreset {
    const launchCmd = getEnvVar("ACP_LAUNCH_CMD");
    const sessionId = getEnvVar("ACP_SESSION_ID");
    const cwd = getEnvVar("ACP_CWD");
    const bridgeModeRaw = getEnvVar("ACP_BRIDGE_MODE");
    const autoConnectRaw = getEnvVar("ACP_AUTO_CONNECT");
    const bridgeUrl = getEnvVar("ACP_BRIDGE_URL", BRIDGE_URL_DEFAULT) ?? BRIDGE_URL_DEFAULT;
    const replayFile = getEnvVar("ACP_REPLAY_FILE");

    let bridgeMode: "proxy" | "replay" | null = null;
    if (bridgeModeRaw === "proxy" || bridgeModeRaw === "replay") {
        bridgeMode = bridgeModeRaw;
    }

    const autoConnect = autoConnectRaw === "true" || autoConnectRaw === "1";

    return {
        launchCmd,
        sessionId,
        cwd,
        bridgeMode,
        autoConnect,
        bridgeUrl,
        replayFile,
    };
}

export function isPresetValid(preset: LaunchPreset): { valid: boolean; reason?: string } {
    if (preset.bridgeMode === "proxy") {
        if (!preset.launchCmd) {
            return { valid: false, reason: "ACP_LAUNCH_CMD is required for proxy mode" };
        }
    } else if (preset.bridgeMode === "replay") {
        if (!preset.replayFile) {
            return { valid: false, reason: "ACP_REPLAY_FILE is required for replay mode" };
        }
    }

    return { valid: true };
}