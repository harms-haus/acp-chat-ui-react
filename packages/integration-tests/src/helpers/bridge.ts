/**
 * Bridge subprocess management for integration tests
 *
 * This module provides utilities for spawning and managing the Rust bridge
 * subprocess during integration tests.
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import { resolve } from 'node:path';

/**
 * Repository root directory - bridge resolves fixture paths relative to CWD
 */
const REPO_ROOT = resolve(__dirname, '../../../..');

/**
 * Spawns the Rust bridge subprocess on the specified port.
 * 
 * @param port - Port number for the bridge to listen on
 * @returns Promise that resolves to ChildProcess when bridge is ready
 * 
 * The function waits for the bridge to log "Bridge listening on 127.0.0.1:${port}"
 * before resolving, ensuring the bridge is fully initialized.
 * 
 * @throws {Error} If bridge fails to start or times out
 */
export async function spawnBridge(port: number): Promise<ChildProcess> {
    return new Promise<ChildProcess>((resolveSpawn, rejectSpawn) => {
        const args = [
            '--addr',
            `127.0.0.1:${port}`,
            '--demo-type',
            'long-context',
            '--session-id',
            'session-1'
        ];

        const bridge = spawn('cargo', [
            'run',
            '--manifest-path',
            'crates/acp-harness-server/Cargo.toml',
            '--',
            ...args
        ], {
            cwd: REPO_ROOT,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, RUST_LOG: 'error' }
        });

        let ready = false;
        let outputBuffer = '';

        const timeout = setTimeout(() => {
            if (!ready) {
                const errorMsg = `Bridge startup timeout after 30s. Output:\n${outputBuffer}`;
                bridge.kill('SIGKILL');
                rejectSpawn(new Error(errorMsg));
            }
        }, 30000);

        const cleanup = () => {
            clearTimeout(timeout);
            bridge.stdout.removeListener('data', onStdout);
            bridge.stderr.removeListener('data', onStderr);
            bridge.removeListener('error', onError);
            bridge.removeListener('exit', onExit);
        };

        const onStdout = (data: Buffer) => {
            const line = data.toString();
            outputBuffer += line;

            // Check for the ready message
            const readyPattern = new RegExp(`(Bridge|Harness server) listening on 127\\.0\\.0\\.1:${port}`);
            if (readyPattern.test(line) && !ready) {
                ready = true;
                cleanup();
                resolveSpawn(bridge);
            }
        };

        const onStderr = (data: Buffer) => {
            outputBuffer += data.toString();
        };

        const onError = (err: Error) => {
            if (!ready) {
                cleanup();
                rejectSpawn(new Error(`Bridge spawn error: ${err.message}\nOutput:\n${outputBuffer}`));
            }
        };

        const onExit = (code: number | null, signal: string | null) => {
            if (!ready) {
                cleanup();
                rejectSpawn(new Error(`Bridge exited with code ${code} signal ${signal} before ready.\nOutput:\n${outputBuffer}`));
            }
        };

        bridge.stdout.on('data', onStdout);
        bridge.stderr.on('data', onStderr);
        bridge.on('error', onError);
        bridge.on('exit', onExit);
    });
}

/**
 * Kills a bridge subprocess and waits for it to exit.
 * 
 * @param process - The ChildProcess to kill
 * @returns Promise that resolves when process has exited
 * 
 * Uses SIGKILL for immediate termination (no graceful shutdown).
 */
export async function killBridge(process: ChildProcess): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        if (process.killed) {
            resolve();
            return;
        }

        const onExit = (_code: number | null, _signal: string | null) => {
            process.removeListener('error', onError);
            resolve();
        };

        const onError = (err: Error) => {
            process.removeListener('exit', onExit);
            reject(err);
        };

        process.once('exit', onExit);
        process.once('error', onError);

        process.kill('SIGKILL');
    });
}

/**
 * Checks if a bridge is ready to accept connections on the specified port.
 * 
 * @param port - Port number to check
 * @returns Promise that resolves to true if bridge is accepting connections
 * 
 * Attempts to establish a WebSocket connection to verify the bridge is ready.
 */
export async function isBridgeReady(port: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}`);
        let resolved = false;

        const cleanup = () => {
            if (!resolved) {
                ws.removeListener('open', onOpen);
                ws.removeListener('error', onError);
            }
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close();
            }
        };

        const onOpen = () => {
            resolved = true;
            cleanup();
            resolve(true);
        };

        const onError = () => {
            resolved = true;
            cleanup();
            resolve(false);
        };

        ws.once('open', onOpen);
        ws.once('error', onError);

        // Timeout after 2 seconds
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                cleanup();
                resolve(false);
            }
        }, 2000);
    });
}

/**
 * Finds an available port starting from the specified port number.
 * 
 * @param startPort - Starting port number to try
 * @returns Promise that resolves to an available port number
 * 
 * Tries ports sequentially (startPort, startPort+1, startPort+2, ...)
 * until an available port is found.
 * 
 * @example
 * const port = await findAvailablePort(9876);
 * // Returns 9876 if available, or 9877, 9878, etc.
 */
export async function findAvailablePort(startPort: number): Promise<number> {
    let port = startPort;
    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
        const ready = await isBridgeReady(port);
        if (!ready) {
            return port;
        }
        port++;
        attempts++;
    }

    throw new Error(
        `Could not find available port after ${maxAttempts} attempts (tried ${startPort}-${startPort + maxAttempts - 1})`
    );
}
