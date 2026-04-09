/**
 * WebSocket polyfill for Node.js integration tests
 *
 * This helper sets up the ws package as a polyfill for the global WebSocket object,
 * allowing @harms-haus/acp-chat-core's TransportClient to work in Node.js environment.
 */

/**
 * Sets up WebSocket polyfill for Node.js environment.
 * Must be called before importing any code that uses WebSocket.
 *
 * @throws {Error} If ws package cannot be imported
 */
export async function setupWebSocketPolyfill(): Promise<void> {
    // Only polyfill if WebSocket is not already available
    if (typeof globalThis.WebSocket === 'undefined') {
        try {
            // Dynamic import of ws package to support both ESM and CJS
            const { WebSocket } = await import('ws');

            // Cast to any to bypass TypeScript incompatibility between ws and DOM WebSocket
            globalThis.WebSocket = WebSocket as any;
        } catch (error) {
            throw new Error(
                `Failed to import ws package for WebSocket polyfill: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}

/**
 * Checks if WebSocket polyfill has been applied.
 *
 * @returns true if globalThis.WebSocket is available
 */
export function isWebSocketPolyfilled(): boolean {
    return typeof globalThis.WebSocket !== 'undefined';
}
