/**
 * Transport Interface - Abstracts communication layer for ACP
 * 
 * This interface defines the contract that all transport implementations must follow.
 * Transport implementations handle the actual communication mechanism (WebSocket, stdio, HTTP, etc.)
 * 
 * Core depends on this interface ONLY - never on concrete implementations.
 * This allows the same core logic to work with any transport mechanism.
 */

import type { ACPRequest, ACPResponse, ACPNotification } from '../protocol/types.js';

/**
 * Connection status values.
 * These are transport-level states, not ACP protocol states.
 */
export type ConnectionStatus =
  | 'disconnected'     // Not connected, not trying to connect
  | 'connecting'      // Actively attempting to connect
  | 'connected'       // Successfully connected
  | 'reconnecting'    // Connection lost, attempting to reconnect
  | 'error';          // Error state (may or may not be recoverable)

/**
 * Transport interface for ACP communication.
 * 
 * Implementations must:
 * 1. Handle connection lifecycle (connect/disconnect)
 * 2. Send ACP requests and receive responses
 * 3. Send ACP notifications (one-way)
 * 4. Emit incoming ACP notifications from the agent
 * 5. Emit status changes and errors
 * 
 * @example
 * ```typescript
 * const transport = new WebSocketTransport('ws://localhost:8765');
 * 
 * // Subscribe to events
 * const unsubscribe = transport.onNotification((notification) => {
 *   console.log('Received:', notification);
 * });
 * 
 * // Connect and send requests
 * await transport.connect();
 * const response = await transport.sendRequest({
 *   jsonrpc: '2.0',
 *   id: 1,
 *   method: 'session/new',
 *   params: { sessionId: 'test' }
 * });
 * 
 * // Cleanup
 * unsubscribe();
 * await transport.disconnect();
 * ```
 */
export interface Transport {
  /**
   * Establish connection to the agent.
   * 
   * For WebSocket: opens WebSocket connection
   * For stdio: spawns child process
   * For HTTP: establishes persistent connection if needed
   * 
   * @throws Error if connection fails
   */
  connect(): Promise<void>;
  
  /**
   * Disconnect from the agent.
   * 
   * Should clean up all resources and event handlers.
   * After disconnect, the transport should not be reusable.
   * 
   * @throws Error if disconnect fails
   */
  disconnect(): Promise<void>;
  
  /**
   * Get current connection status.
   * 
   * @returns Current connection status
   */
  getStatus(): ConnectionStatus;
  
  /**
   * Send an ACP request and wait for response.
   * 
   * Implementations must:
   * - Assign a unique ID if not provided
   * - Track pending requests
   * - Match responses to requests by ID
   * - Handle timeouts
   * - Handle connection errors during request
   * 
   * @param request - ACP request object
   * @returns Promise that resolves to the response
   * @throws Error if request fails or times out
   */
  sendRequest<T = unknown>(request: ACPRequest): Promise<ACPResponse<T>>;
  
  /**
   * Send an ACP notification (one-way, no response expected).
   * 
   * Notifications are fire-and-forget messages.
   * Implementations should not expect or wait for a response.
   * 
   * @param notification - ACP notification object
   */
  sendNotification(notification: ACPNotification): void;
  
  /**
   * Subscribe to incoming ACP notifications from the agent.
   * 
   * All session/update notifications and other agent→client
   * notifications are emitted through this handler.
   * 
   * @param handler - Function to call when notification received
   * @returns Unsubscribe function
   */
  onNotification(handler: (notification: ACPNotification) => void): () => void;
  
  /**
   * Subscribe to transport errors.
   * 
   * Errors that should be reported here:
   * - Connection errors
   * - Parse errors
   * - Protocol errors
   * - Timeout errors
   * 
   * Note: ACP-level errors (in response.error) should NOT be emitted here.
   * Those are part of normal request/response flow.
   * 
   * @param handler - Function to call when error occurs
   * @returns Unsubscribe function
   */
  onError(handler: (error: Error) => void): () => void;
  
  /**
   * Subscribe to connection status changes.
   * 
   * Handlers are called whenever the connection status changes.
   * Initial status is 'disconnected'.
   * 
   * @param handler - Function to call when status changes
   * @returns Unsubscribe function
   */
  onStatusChange(handler: (status: ConnectionStatus) => void): () => void;
}

/**
 * Type guard to check if a status is terminal (won't recover automatically).
 */
export function isTerminalStatus(status: ConnectionStatus): boolean {
  return status === 'disconnected' || status === 'error';
}

/**
 * Type guard to check if connected.
 */
export function isConnected(status: ConnectionStatus): boolean {
  return status === 'connected';
}
