/**
 * Replay data schema and TypeScript types for ACP chat replay functionality.
 * 
 * Note: These types are stored in core, but the actual envelope data is
 * a wire-format concern. The ws-bridge package handles the conversion.
 */

import type {
  ACPNotification,
  ACPResponse,
} from '../protocol/types';
import type {
  NormalizedMessage,
  NormalizedThought,
  NormalizedToolCall,
} from '../normalization/store';

/**
 * A generic replay event that can contain any wire-format data.
 * The actual envelope format is defined by the transport layer (ws-bridge).
 * Core only cares about the extracted ACP notification.
 */
export interface ReplayEvent {
  /** The raw event data as received from transport layer */
  raw: unknown;
  /** Pre-computed estimated token count for this event */
  tokenCount: number;
}

/**
 * Typed replay event with extracted ACP notification.
 * Used when the transport layer has already extracted the ACP payload.
 */
export interface ACPReplayEvent {
  /** The ACP notification or response */
  acpEvent: ACPNotification | ACPResponse<unknown>;
  /** Pre-computed estimated token count for this event */
  tokenCount: number;
}

/**
 * Metadata describing a replay session.
 */
export interface ReplaySessionMetadata {
  /** The type of demo this replay represents (e.g., 'feature-demo', 'bug-reproduction') */
  demoType: string;
  /** Unique identifier for the session */
  sessionId: string;
  /** List of modes active during the session */
  modes: string[];
  /** List of models used during the session */
  models: string[];
  /** Unix timestamp in milliseconds when the session was captured */
  capturedAt: number;
  /** Estimated total token count for the session */
  tokenCount: number;
  /** Total number of events in the session */
  eventCount: number;
  /** Human-readable description of what the replay demonstrates */
  description: string;
}

/**
 * Pre-existing session state captured at the start of a replay.
 * This represents the initial state before replay events begin.
 */
export interface ReplaySessionData {
  /** Array of messages that existed at session start */
  messages: NormalizedMessage[];
  /** Array of thoughts that existed at session start */
  thoughts: NormalizedThought[];
  /** Array of tool calls that existed at session start */
  toolCalls: NormalizedToolCall[];
  /** The session ID */
  sessionId: string;
  /** The working directory for the session */
  cwd: string;
}

/**
 * Manifest index for organizing replay sessions by demo type.
 */
export interface ReplayManifest {
  /** The demo type this manifest represents */
  demoType: string;
  /** Array of session metadata entries */
  sessions: ReplaySessionMetadata[];
}

/**
 * Estimates token count for a given text string.
 *
 * Uses a simple approximation: characters / 4.
 * This is sufficient for UI display purposes and replay timing.
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}
