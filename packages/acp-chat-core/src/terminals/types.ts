/**
 * Terminal types and interfaces for ACP terminal event handling.
 *
 * Request/Response types are re-exported from @agentclientprotocol/sdk
 * via protocol/types.ts. This file defines handler function type aliases
 * and the subscription interface that wrap the SDK types into the handler
 * pattern used by this codebase.
 *
 * @see https://agentclientprotocol.com/protocol/terminals
 */

import type {
  CreateTerminalRequest,
  CreateTerminalResponse,
  TerminalOutputRequest,
  TerminalOutputResponse,
  WaitForTerminalExitRequest,
  WaitForTerminalExitResponse,
  KillTerminalRequest,
  KillTerminalResponse,
  ReleaseTerminalRequest,
  ReleaseTerminalResponse,
} from "../protocol/types.js";

export type {
  CreateTerminalRequest,
  CreateTerminalResponse,
  TerminalOutputRequest,
  TerminalOutputResponse,
  WaitForTerminalExitRequest,
  WaitForTerminalExitResponse,
  KillTerminalRequest,
  KillTerminalResponse,
  ReleaseTerminalRequest,
  ReleaseTerminalResponse,
} from "../protocol/types.js";

/**
 * Handler for terminal/create requests from the agent.
 * The handler should create a terminal and return its terminalId.
 */
export type TerminalCreateHandler = (
  request: CreateTerminalRequest,
) => Promise<CreateTerminalResponse | null>;

/**
 * Handler for terminal/output requests from the agent.
 * The handler should return the terminal's buffered output.
 */
export type TerminalOutputHandler = (
  request: TerminalOutputRequest,
) => Promise<TerminalOutputResponse | null>;

/**
 * Handler for terminal/wait_for_exit requests from the agent.
 * The handler should wait for the terminal to exit and return the exit status.
 */
export type TerminalWaitForExitHandler = (
  request: WaitForTerminalExitRequest,
) => Promise<WaitForTerminalExitResponse | null>;

/**
 * Handler for terminal/kill requests from the agent.
 * The handler should terminate the terminal process.
 */
export type TerminalKillHandler = (
  request: KillTerminalRequest,
) => Promise<KillTerminalResponse | null>;

/**
 * Handler for terminal/release requests from the agent.
 * The handler should clean up terminal resources.
 */
export type TerminalReleaseHandler = (
  request: ReleaseTerminalRequest,
) => Promise<ReleaseTerminalResponse | null>;

/**
 * Subscription object returned when subscribing to a terminal operation.
 * Call unsubscribe() to remove the handler.
 */
export interface TerminalSubscription {
  unsubscribe(): void;
}
