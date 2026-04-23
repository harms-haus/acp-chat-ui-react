/**
 * Transport - Public API
 * 
 * Exports transport interface and utilities.
 * Note: This does NOT export any concrete transport implementations.
 * Implementations are provided by transport-specific packages (e.g., acp-ws-bridge).
 * 
 * This file is intentionally minimal - core only knows about the Transport interface,
 * never about concrete implementations like WebSocket or bridge-specific protocols.
 */

export {
  // Interface and connection status
  type Transport,
  type ConnectionStatus,
  
  // Utilities
  isTerminalStatus,
  isConnected,
} from './transport-interface.js';
