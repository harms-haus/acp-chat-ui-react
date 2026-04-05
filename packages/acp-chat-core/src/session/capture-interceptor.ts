/**
 * Session capture interceptor types, interfaces, and implementation.
 *
 * This module defines the core types for capturing ACP sessions,
 * including the captured session data structure, the interceptor interface,
 * and the default implementation that wraps a SessionController.
 */

import type {
  BridgeEnvelope
} from '../generated/index.js';

import {
  estimateTokenCount
} from '../replay/types.js';

import type {
  ReplaySessionData
} from '../replay/types.js';

import type { SessionController } from './controller.js';

/**
 * A captured ACP session with all events and metadata.
 */
export interface CapturedSession {
  /** The session ID */
  sessionId: string;

  /** Unix timestamp in milliseconds when capture started */
  startTime: number;

  /** Unix timestamp in milliseconds when capture ended, or null if still capturing */
  endTime: number | null;

  /** Array of events captured during the session */
  events: CapturedEvent[];

  /** Pre-existing session state at the start of capture */
  preExistingState: ReplaySessionData | null;

  /** List of modes active during the session */
  modes: string[];

  /** List of models used during the session */
  models: string[];
}

/**
 * A captured event wrapping a BridgeEnvelope with pre-computed metadata.
 * This is a capture-specific version of ReplayEvent.
 */
export interface CapturedEvent {
  /** The original bridge envelope */
  envelope: BridgeEnvelope;

  /** Pre-computed estimated token count for this event */
  tokenCount: number;

  /** Unix timestamp in milliseconds when the event was captured */
  timestamp: number;

  /** Direction of the event: 'in' for inbound, 'out' for outbound */
  direction: 'in' | 'out';
}

/**
 * Interface for a session capture interceptor.
 *
 * The interceptor captures all traffic (inbound and outbound) for a session,
 * collects pre-existing state, and provides methods to export the captured data.
 */
export interface SessionCaptureInterceptor {
  /**
   * Starts capturing events for the specified session.
   *
   * @param sessionId - The session ID to capture
   * @param initialState - Optional pre-existing session state at capture start
   * @throws Error if capture is already active
   */
  startCapture(sessionId: string, initialState?: ReplaySessionData): void;

  /**
   * Stops the current capture session.
   *
   * @throws Error if no capture is active
   */
  stopCapture(): void;

  /**
   * Exports the currently captured session data.
   *
   * If capture is still active, the returned session will have endTime set to null.
   * If capture has been stopped, endTime will be set to the timestamp when stopCapture() was called.
   *
   * @throws Error if no session has been captured
   * @returns The captured session with all events and metadata
   */
  exportCapturedSession(): CapturedSession;

  /**
   * Checks if capture is currently active.
   *
   * @returns true if capture is active, false otherwise
   */
  isCapturing(): boolean;

  /**
   * Gets the ID of the currently captured session.
   *
   * @returns The session ID, or null if not capturing
   */
  getActiveSessionId(): string | null;
}

interface CaptureState {
  sessionId: string;
  startTime: number;
  endTime: number | null;
  events: CapturedEvent[];
  preExistingState: ReplaySessionData | null;
  modes: Set<string>;
  models: Set<string>;
}

/**
 * Default implementation of {@link SessionCaptureInterceptor}.
 *
 * Wraps a {@link SessionController} and registers traffic / sessionUpdate /
 * permission handlers to record every event that flows through the controller
 * while a capture is active.
 *
 * ### Usage
 * ```ts
 * const controller = new SessionController(bridgeUrl);
 * const interceptor = new DefaultSessionCaptureInterceptor(controller);
 *
 * interceptor.startCapture(sessionId, preExistingState);
 * // … user interacts via controller …
 * const captured = interceptor.stopCaptureAndExport();
 * ```
 */
export class DefaultSessionCaptureInterceptor implements SessionCaptureInterceptor {
  private readonly controller: SessionController;
  private capturing = false;
  private state: CaptureState | null = null;

  /** Unsubscribe functions from controller event handlers. */
  private unsubscribers: (() => void)[] = [];

  constructor(controller: SessionController) {
    this.controller = controller;
  }

  startCapture(sessionId: string, initialState?: ReplaySessionData): void {
    if (this.capturing) {
      throw new Error('Capture is already active');
    }

    this.state = {
      sessionId,
      startTime: Date.now(),
      endTime: null,
      events: [],
      preExistingState: initialState ?? null,
      modes: new Set<string>(),
      models: new Set<string>(),
    };
    this.capturing = true;

    const unsubTraffic = this.controller.on('traffic', (direction, data) => {
      if (!this.capturing || !this.state) return;
      this.recordEvent(direction, data);
    });

    const unsubUpdate = this.controller.on('sessionUpdate', (params) => {
      if (!this.capturing || !this.state) return;
      this.extractMetadata(params);
    });

    this.unsubscribers = [unsubTraffic, unsubUpdate];
  }

  stopCapture(): void {
    if (!this.capturing || !this.state) {
      throw new Error('No capture is active');
    }

    this.state.endTime = Date.now();
    this.capturing = false;

    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
  }

  exportCapturedSession(): CapturedSession {
    if (!this.state) {
      throw new Error('No session has been captured');
    }

    return {
      sessionId: this.state.sessionId,
      startTime: this.state.startTime,
      endTime: this.state.endTime,
      events: [...this.state.events],
      preExistingState: this.state.preExistingState,
      modes: [...this.state.modes],
      models: [...this.state.models],
    };
  }

  isCapturing(): boolean {
    return this.capturing;
  }

  getActiveSessionId(): string | null {
    return this.state?.sessionId ?? null;
  }

  /**
   * Stops capture (if active) and returns the captured session data.
   * Also writes the capture to `fixtures/replay-data/captured/{timestamp}/`.
   *
   * @param outputDir - Root directory for captured sessions.
   *   Defaults to `fixtures/replay-data/captured`.
   * @returns The captured session with all events and metadata.
   */
  stopCaptureAndExport(outputDir = 'fixtures/replay-data/captured'): CapturedSession {
    if (this.capturing) {
      this.stopCapture();
    }
    const session = this.exportCapturedSession();
    this.writeToFiles(session, outputDir);
    return session;
  }

  private recordEvent(direction: 'in' | 'out', data: unknown): void {
    if (!this.state) return;

    const envelope = data as BridgeEnvelope;
    const tokenCount = estimateTokenCount(JSON.stringify(data));

    this.state.events.push({
      envelope,
      tokenCount,
      timestamp: Date.now(),
      direction,
    });
  }

  private extractMetadata(params: unknown): void {
    if (!this.state) return;

    try {
      const obj = params as Record<string, unknown> | null | undefined;
      if (!obj || typeof obj !== 'object') return;

      const update = (obj.update ?? obj) as Record<string, unknown>;
      if (!update || typeof update !== 'object') return;

      if (typeof update.mode === 'string') {
        this.state.modes.add(update.mode);
      }

      const model = update.model ?? (update.metadata as Record<string, unknown> | undefined)?.model;
      if (typeof model === 'string') {
        this.state.models.add(model);
      }
    } catch {
      // best-effort: never fail capture for metadata extraction errors
    }
  }

  private writeToFiles(session: CapturedSession, outputDir: string): void {
    let fs: typeof import('fs');
    let path: typeof import('path');
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      fs = require('fs');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      path = require('path');
    } catch {
      return;
    }

    const dir = path.join(outputDir, String(session.startTime));
    fs.mkdirSync(dir, { recursive: true });

    const sessionData = {
      sessionId: session.sessionId,
      startTime: session.startTime,
      endTime: session.endTime,
      preExistingState: session.preExistingState,
      modes: session.modes,
      models: session.models,
      eventCount: session.events.length,
      totalTokenCount: session.events.reduce((sum, e) => sum + e.tokenCount, 0),
    };
    fs.writeFileSync(path.join(dir, 'session-data.json'), JSON.stringify(sessionData, null, 2), 'utf-8');

    const lines = session.events.map((e) =>
      JSON.stringify({
        envelope: e.envelope,
        tokenCount: e.tokenCount,
        timestamp: e.timestamp,
        direction: e.direction,
      }),
    );
    fs.writeFileSync(path.join(dir, 'replay-events.jsonl'), lines.join('\n') + '\n', 'utf-8');
  }
}
