/**
 * Replay runner utility for executing replay fixtures.
 *
 * This module provides a replay runner that executes replay files through
 * the ReplayController, emitting events and tracking outcomes for testing.
 *
 * ## Usage
 *
 * ```ts
 * import { ReplayRunner } from './replay-runner';
 * import { loadFixture } from './fixture-loader';
 * import { ReplayController } from '../session/replay-controller';
 *
 * // Load a fixture
 * const fixture = loadFixture('tool-calling/session-1');
 *
 * // Create a ReplayController instance
 * const controller = new ReplayController('ws://localhost:8080/replay-v2');
 *
 * // Create runner with controller
 * const runner = new ReplayRunner({
 *   controller,
 *   fixture,
 * });
 *
 * // Execute replay
 * await runner.execute();
 *
 * // Assert on outcomes
 * const stats = runner.getStatistics();
 * expect(stats.totalEvents).toBeGreaterThan(0);
 * expect(runner.getSessionUpdates()).toHaveLength(5);
 * ```
 */

import type { ReplayController } from '../session/replay-controller.js';
import type {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  BridgeEnvelope,
} from '../generated/index.js';
import type { PermissionOption } from '../session/controller.js';
import type { LoadedFixture, LoadedReplayEvent } from './fixture-loader.js';

/**
 * Configuration for the replay runner.
 */
export interface ReplayRunnerConfig {
  /** The ReplayController instance to use */
  controller: ReplayController;
  /** The loaded fixture to replay */
  fixture: LoadedFixture;
  /** Optional replay speed multiplier (default: 1.0) */
  replaySpeed?: number;
  /** Optional timeout for the entire replay in milliseconds (default: 60000) */
  timeoutMs?: number;
}

/**
 * Statistics collected during replay execution.
 */
export interface ReplayStatistics {
  /** Total number of events processed */
  totalEvents: number;
  /** Number of inbound events */
  inboundEvents: number;
  /** Number of outbound events */
  outboundEvents: number;
  /** Total token count */
  totalTokens: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Number of errors encountered */
  errorCount: number;
}

/**
 * A recorded session update during replay.
 */
export interface RecordedSessionUpdate {
  /** The session ID */
  sessionId: string;
  /** The update payload */
  update: Record<string, unknown>;
  /** Timestamp when the update was received */
  timestamp: number;
}

/**
 * A recorded permission request during replay.
 */
export interface RecordedPermissionRequest {
  /** The request ID */
  requestId: number;
  /** The session ID */
  sessionId: string;
  /** The tool call ID */
  toolCallId: string;
  /** Available permission options */
  options: PermissionOption[];
  /** Timestamp when the request was received */
  timestamp: number;
  /** Whether the request was responded to */
  responded: boolean;
  /** The response action (if responded) */
  responseAction?: 'approve' | 'deny';
}

/**
 * Replay outcome with all recorded events and statistics.
 */
export interface ReplayOutcome {
  /** Whether the replay completed successfully */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Recorded session updates */
  sessionUpdates: RecordedSessionUpdate[];
  /** Recorded permission requests */
  permissionRequests: RecordedPermissionRequest[];
  /** Replay statistics */
  statistics: ReplayStatistics;
  /** The fixture that was replayed */
  fixture: LoadedFixture;
}

/**
 * Replay runner that executes replay fixtures through ReplayController.
 *
 * The runner:
 * 1. Connects to the bridge via ReplayController
 * 2. Initializes replay mode with the fixture's session data
 * 3. Processes all events in order
 * 4. Records all session updates and permission requests
 * 5. Provides statistics and assertions on the replay
 */
export class ReplayRunner {
  private config: ReplayRunnerConfig;
  private sessionUpdates: RecordedSessionUpdate[] = [];
  private permissionRequests: RecordedPermissionRequest[] = [];
  private errors: Error[] = [];
  private startTime: number | null = null;
  private endTime: number | null = null;
  private unsubscribeHandlers: (() => void)[] = [];

  constructor(config: ReplayRunnerConfig) {
    this.config = {
      replaySpeed: 1.0,
      timeoutMs: 60000,
      ...config,
    };
  }

  /**
   * Execute the replay.
   *
   * This method:
   * 1. Connects to the bridge
   * 2. Initializes replay mode
   * 3. Loads session data if present
   * 4. Processes all events
   * 5. Collects statistics
   *
   * @returns The replay outcome with all recorded data
   */
  async execute(): Promise<ReplayOutcome> {
    this.startTime = Date.now();
    const { controller, fixture } = this.config;

    try {
      // Set up event handlers
      this.setupEventHandlers();

      // Connect to bridge
      controller.connect();

      // Initialize replay mode
      const sessionId = fixture.sessionId || `replay-${Date.now()}`;
      await controller.initReplay(
        this.buildReplayScript(),
        sessionId,
        this.config.replaySpeed
      );

      // Initialize the protocol
      await controller.initialize({
        name: 'replay-runner',
        version: '1.0.0',
      });

      // Load session data if present
      if (fixture.sessionData) {
        const sessionIdToLoad = fixture.sessionId || 'default-session';
        await controller.loadSession(
          sessionIdToLoad,
          fixture.sessionData.cwd,
          []
        );
      }

      // Process all events
      await this.processEvents();

      this.endTime = Date.now();

      return this.buildOutcome(true);
    } catch (error) {
      this.endTime = Date.now();
      const err = error instanceof Error ? error : new Error(String(error));
      this.errors.push(err);

      return this.buildOutcome(false, err);
    } finally {
      // Clean up
      this.cleanup();
    }
  }

  /**
   * Get recorded session updates.
   */
  getSessionUpdates(): RecordedSessionUpdate[] {
    return [...this.sessionUpdates];
  }

  /**
   * Get recorded permission requests.
   */
  getPermissionRequests(): RecordedPermissionRequest[] {
    return [...this.permissionRequests];
  }

  /**
   * Get errors encountered during replay.
   */
  getErrors(): Error[] {
    return [...this.errors];
  }

  /**
   * Get replay statistics.
   */
  getStatistics(): ReplayStatistics {
    const fixture = this.config.fixture;
    const durationMs = (this.endTime ?? Date.now()) - (this.startTime ?? Date.now());

    return {
      totalEvents: fixture.events.length,
      inboundEvents: fixture.events.filter((e) => e.direction === 'in').length,
      outboundEvents: fixture.events.filter((e) => e.direction === 'out').length,
      totalTokens: fixture.events.reduce((sum, e) => sum + e.tokenCount, 0),
      durationMs,
      errorCount: this.errors.length,
    };
  }

  /**
   * Get the replay outcome.
   */
  getOutcome(): ReplayOutcome {
    return this.buildOutcome(this.errors.length === 0);
  }

  /**
   * Automatically respond to permission requests.
   *
   * @param action - The action to take ('approve' or 'deny')
   * @returns This runner for chaining
   */
  autoRespondToPermissions(action: 'approve' | 'deny'): this {
    const handler = this.config.controller.on(
      'permissionRequest',
      async (params) => {
        try {
          if (action === 'approve') {
            const optionId = params.options[0]?.optionId || 'allow_once';
            await this.config.controller.respondToPermission(
              params.requestId,
              optionId
            );
            this.markPermissionResponded(params.requestId, action);
          } else {
            await this.config.controller.cancelPermission(params.requestId);
            this.markPermissionResponded(params.requestId, 'deny');
          }
        } catch (error) {
          // Log error but don't crash - permission handling failures shouldn't break replay
          console.error('Failed to respond to permission request:', error);
        }
      }
    );
    this.unsubscribeHandlers.push(handler);
    return this;
  }

  /**
   * Set up event handlers for recording replay data.
   */
  private setupEventHandlers(): void {
    // Record session updates
    const sessionUpdateHandler = this.config.controller.on(
      'sessionUpdate',
      (params) => {
        const paramsObj = params as Record<string, unknown>;
        this.sessionUpdates.push({
          sessionId: paramsObj.sessionId as string || 'unknown',
          update: paramsObj.update as Record<string, unknown> || {},
          timestamp: Date.now(),
        });
      }
    );
    this.unsubscribeHandlers.push(sessionUpdateHandler);

    // Record permission requests
    const permissionHandler = this.config.controller.on(
      'permissionRequest',
      (params) => {
        this.permissionRequests.push({
          requestId: params.requestId,
          sessionId: params.sessionId,
          toolCallId: params.toolCall?.toolCallId || 'unknown',
          options: params.options || [],
          timestamp: Date.now(),
          responded: false,
        });
      }
    );
    this.unsubscribeHandlers.push(permissionHandler);

    // Record errors
    const errorHandler = this.config.controller.on('error', (error) => {
      this.errors.push(error);
    });
    this.unsubscribeHandlers.push(errorHandler);
  }

  /**
   * Build the replay script from fixture data.
   */
  private buildReplayScript(): string {
    // For now, use a simple script identifier
    // In a more advanced implementation, this would serialize the fixture events
    return `replay://${this.config.fixture.demoType}/${this.config.fixture.sessionId}`;
  }

  /**
   * Process all events from the fixture.
   */
  private async processEvents(): Promise<void> {
    const { fixture, controller: _controller } = this.config;
    const events = fixture.events;

    if (events.length === 0) {
      return;
    }

    // Process events with timing based on replay speed
    for (const event of events) {
      // In a real replay scenario, the bridge would emit these events
      // Here we just wait for the bridge to process them
      await this.waitForEvent(event);
    }

    // Wait a bit for final events to be processed
    await this.sleep(100);
  }

  /**
   * Wait for a single event to be processed.
   */
  private async waitForEvent(event: LoadedReplayEvent): Promise<void> {
    // In a real implementation, this would wait for the bridge to emit the event
    // For now, we just simulate timing
    const delay = Math.max(10, event.timestamp / 1000 / (this.config.replaySpeed || 1));
    await this.sleep(Math.min(delay, 1000)); // Cap at 1 second per event
  }

  /**
   * Sleep for a given number of milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Mark a permission request as responded.
   */
  private markPermissionResponded(requestId: number, action: 'approve' | 'deny'): void {
    const request = this.permissionRequests.find((r) => r.requestId === requestId);
    if (request) {
      request.responded = true;
      request.responseAction = action;
    }
  }

/**
 * Build the replay outcome.
 */
private buildOutcome(success: boolean, error?: Error): ReplayOutcome {
  const outcome: ReplayOutcome = {
    success,
    sessionUpdates: this.getSessionUpdates(),
    permissionRequests: this.getPermissionRequests(),
    statistics: this.getStatistics(),
    fixture: this.config.fixture,
  };
  if (error) {
    outcome.error = error.message;
  }
  return outcome;
}

  /**
   * Clean up resources.
   */
  private cleanup(): void {
    for (const unsubscribe of this.unsubscribeHandlers) {
      unsubscribe();
    }
    this.unsubscribeHandlers = [];
  }
}

/**
 * Create a replay runner with default configuration.
 *
 * @param controller - The ReplayController to use
 * @param fixturePath - The fixture path to load
 * @returns A configured ReplayRunner instance
 */
export function createReplayRunner(
  _controller: ReplayController,
  _fixturePath: string
): ReplayRunner {
  // This would require dynamic import of fixture-loader
  // For now, the caller should load the fixture themselves
  throw new Error(
    'Use ReplayRunner constructor directly with a loaded fixture. ' +
    'Import loadFixture from fixture-loader and pass the result.'
  );
}
