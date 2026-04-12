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

function _getEnvVar(key: string, fallback: string | null = null): string | null {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
        if (env && env[key] !== undefined) {
            return env[key] ?? fallback;
        }
    } catch {
        // import.meta.env not available (Node.js context)
    }

    try {
        const processEnv = typeof process !== 'undefined' && process.env;
        if (processEnv && processEnv[key] !== undefined) {
            return processEnv[key] ?? fallback;
        }
    } catch {
        // process not available
    }

    return fallback;
}

export function parseLaunchPreset(envOverride?: Record<string, string | undefined>): LaunchPreset {
    const env = envOverride ?? getEnvVarAsRecord();
    
    const launchCmd = env.ACP_LAUNCH_CMD ?? null;
    const sessionId = env.ACP_SESSION_ID ?? null;
    const cwd = env.ACP_CWD ?? null;
    const bridgeModeRaw = env.ACP_BRIDGE_MODE ?? null;
    const autoConnectRaw = env.ACP_AUTO_CONNECT ?? null;
    const bridgeUrl = env.ACP_BRIDGE_URL ?? BRIDGE_URL_DEFAULT;
    const replayFile = env.ACP_REPLAY_FILE ?? null;

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

function getEnvVarAsRecord(): Record<string, string | undefined> {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
        if (env) {
            return env;
        }
    } catch {
        // import.meta.env not available
    }

    try {
        const processEnv = typeof process !== 'undefined' && process.env;
        if (processEnv) {
            return processEnv as Record<string, string | undefined>;
        }
    } catch {
        // process not available
    }

    return {};
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