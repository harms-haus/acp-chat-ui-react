/**
 * Launch preset configuration for ACP Chat Core.
 * 
 * This module provides environment-based configuration for connecting
 * to ACP agents. Core only handles generic connection config - 
 * mode-specific logic (proxy, replay, live) lives in harness-ui.
 */

// Type declaration for Node.js process (available at runtime, not in DOM lib)
declare const process: { env: Record<string, string | undefined> } | undefined;

export interface LaunchPreset {
    /** Command to launch the agent (e.g., "npx @agentclientprotocol/claude") */
    launchCmd: string | null;
    /** Pre-existing session ID to load */
    sessionId: string | null;
    /** Working directory for the session */
    cwd: string | null;
    /** Whether to auto-connect on initialization */
    autoConnect: boolean;
    /** WebSocket URL for bridge connection */
    bridgeUrl: string;
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

/**
 * Parse launch preset from environment variables.
 * 
 * Supported environment variables:
 * - ACP_LAUNCH_CMD: Command to launch the agent
 * - ACP_SESSION_ID: Pre-existing session ID to load
 * - ACP_CWD: Working directory for the session
 * - ACP_AUTO_CONNECT: Whether to auto-connect (true/1)
 * - ACP_BRIDGE_URL: WebSocket URL for bridge connection
 * 
 * @param envOverride - Optional environment override for testing
 * @returns Parsed launch preset
 */
export function parseLaunchPreset(envOverride?: Record<string, string | undefined>): LaunchPreset {
    const env = envOverride ?? getEnvVarAsRecord();
    
    const launchCmd = env.ACP_LAUNCH_CMD ?? null;
    const sessionId = env.ACP_SESSION_ID ?? null;
    const cwd = env.ACP_CWD ?? null;
    const autoConnectRaw = env.ACP_AUTO_CONNECT ?? null;
    const bridgeUrl = env.ACP_BRIDGE_URL ?? BRIDGE_URL_DEFAULT;

    const autoConnect = autoConnectRaw === "true" || autoConnectRaw === "1";

    return {
        launchCmd,
        sessionId,
        cwd,
        autoConnect,
        bridgeUrl,
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

/**
 * Validate a launch preset.
 * 
 * @param preset - The preset to validate
 * @returns Validation result with optional error reason
 */
export function isPresetValid(_preset: LaunchPreset): { valid: boolean; reason?: string } {
    // Basic validation - all fields are optional
    // Specific mode validation (proxy/replay/live) is handled by harness-ui
    return { valid: true };
}
