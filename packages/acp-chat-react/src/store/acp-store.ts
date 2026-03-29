import {
  createNormalizedState,
  applySessionUpdate,
  getMessages,
  getMessage,
  getThoughts,
  getToolCalls,
  getToolCall,
  getTimeline,
  getMessagesByTurn,
  type NormalizedState,
  type NormalizedMessage,
  type NormalizedThought,
  type NormalizedToolCall,
  type TimelineItem,
  type SessionUpdateParams,
} from "@acp/chat-core";
import type { SessionController, SessionControllerState } from "@acp/chat-core";

/**
 * Configuration for the ACP store adapter.
 */
export interface AcpStoreConfig {
  /** Maximum time to wait before flushing React notifications (default: 16ms) */
  notificationCadenceMs?: number;
  /** Whether to enable notification batching (default: true) */
  enableBatching?: boolean;
}

/**
 * Snapshot of the full store state for React consumption.
 * This is the shape returned by useSyncExternalStore.
 */
export interface AcpStoreSnapshot {
  /** Session controller state (connection, initialization status) */
  session: SessionControllerState;
  /** Normalized messages indexed by ID */
  messages: Map<string, NormalizedMessage>;
  /** Normalized thoughts indexed by ID */
  thoughts: Map<string, NormalizedThought>;
  /** Normalized tool calls indexed by ID */
  toolCalls: Map<string, NormalizedToolCall>;
  /** Timeline order (messages, thoughts, tool calls in order) */
  timelineOrder: Array<{ type: "message" | "thought" | "tool_call"; id: string }>;
  /** Turn ID to message ID mapping */
  turnIdToMessageId: Map<string, string>;
  /** Version number incremented on each state change for snapshot stability checks */
  version: number;
}

/**
 * Selector function type for extracting specific data from the store snapshot.
 */
export type SnapshotSelector<T> = (snapshot: AcpStoreSnapshot) => T;

/**
 * Subscriber callback type for React's useSyncExternalStore.
 */
export type StoreSubscriber = () => void;

/**
 * AcpStore wraps the core normalization store and session controller,
 * providing a React-compatible external store with batched notifications.
 *
 * Key design principles:
 * 1. ACP updates are processed IMMEDIATELY - no delay in applying to state
 * 2. React subscriber notifications are batched to render cadence
 * 3. No ACP events are dropped or throttled
 * 4. SSR-safe: server snapshots work without browser APIs
 */
export class AcpStore {
  private normalizedState: NormalizedState;
  private sessionState: SessionControllerState;
  private subscribers: Set<StoreSubscriber> = new Set();
  private version: number = 0;
  private pendingNotification: boolean = false;
  private notificationTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly notificationCadenceMs: number;
  private readonly enableBatching: boolean;
  private unsubscribes: Array<() => void> = [];
  private cachedSnapshot: AcpStoreSnapshot | null = null;
  private cachedSnapshotVersion: number = -1;

  constructor(
    sessionController: SessionController,
    config: AcpStoreConfig = {}
  ) {
    this.normalizedState = createNormalizedState();
    this.sessionState = sessionController.getState();
    this.notificationCadenceMs = config.notificationCadenceMs ?? 16;
    this.enableBatching = config.enableBatching ?? true;

    // Subscribe to session controller events
    // ACP updates are processed IMMEDIATELY; only React notifications are batched
    const unsubStatus = sessionController.on("statusChange", (state) => {
      this.sessionState = state;
      this.scheduleNotification();
    });

    const unsubUpdate = sessionController.on("sessionUpdate", (params) => {
      const p = params as SessionUpdateParams;
      console.log("[AcpStore] sessionUpdate received, sessionId:", p.sessionId, "has update:", !!p.update);
      if (p.update) {
        const update = p.update as Record<string, unknown>;
        console.log("[AcpStore] update keys:", Object.keys(update), "type:", update.type, "sessionUpdate:", update.sessionUpdate);
      }
      const result = applySessionUpdate(this.normalizedState, p);
      console.log("[AcpStore] applySessionUpdate returned:", result ? "item" : "null", "- messages:", this.normalizedState.messages.size, "timeline:", this.normalizedState.timelineOrder.length);
      this.version++;
      this.scheduleNotification();
    });

    const unsubError = sessionController.on("error", (_error) => {
      this.scheduleNotification();
    });

    this.unsubscribes = [unsubStatus, unsubUpdate, unsubError];
  }

  /**
   * Subscribe to store changes. Returns unsubscribe function.
   * This is the subscribe callback for useSyncExternalStore.
   */
  subscribe(callback: StoreSubscriber): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Get the current snapshot. This is the getSnapshot callback for useSyncExternalStore.
   * Returns a new snapshot object each time version changes for stability.
   */
  getSnapshot(): AcpStoreSnapshot {
    if (this.cachedSnapshot !== null && this.cachedSnapshotVersion === this.version) {
      return this.cachedSnapshot;
    }
    
    this.cachedSnapshot = {
      session: { ...this.sessionState },
      messages: new Map(this.normalizedState.messages),
      thoughts: new Map(this.normalizedState.thoughts),
      toolCalls: new Map(this.normalizedState.toolCalls),
      timelineOrder: [...this.normalizedState.timelineOrder],
      turnIdToMessageId: new Map(this.normalizedState.turnIdToMessageId),
      version: this.version,
    };
    this.cachedSnapshotVersion = this.version;
    
    return this.cachedSnapshot;
  }

  /**
   * Server snapshot for SSR. Returns an empty initial state.
   * This is safe to call in Node.js without window/document.
   */
  getServerSnapshot(): AcpStoreSnapshot {
    return {
      session: {
        connectionStatus: "disconnected",
        bridgeStatus: "disconnected",
        sessionId: null,
        initialized: false,
        capabilities: null,
      },
      messages: new Map(),
      thoughts: new Map(),
      toolCalls: new Map(),
      timelineOrder: [],
      turnIdToMessageId: new Map(),
      version: 0,
    };
  }

  /**
   * Schedule a batched notification to React subscribers.
   * Multiple ACP updates within the cadence window result in a single React notification.
   */
  private scheduleNotification(): void {
    if (!this.enableBatching) {
      // No batching - notify immediately
      this.flushNotifications();
      return;
    }

    if (this.pendingNotification) {
      // Already have a pending notification, no need to schedule another
      return;
    }

    this.pendingNotification = true;

    // Use setTimeout for batched notification
    // In browser, this aligns to the JS event loop/render cadence
    // Multiple updates arriving during this window will only trigger one notification
    this.notificationTimeout = setTimeout(() => {
      this.flushNotifications();
    }, this.notificationCadenceMs);
  }

  /**
   * Flush pending notifications to all subscribers.
   */
  private flushNotifications(): void {
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
      this.notificationTimeout = null;
    }
    this.pendingNotification = false;

    // Notify all subscribers
    this.subscribers.forEach((callback) => {
      try {
        callback();
      } catch {
        // Swallow subscriber errors to prevent one bad subscriber from breaking others
      }
    });
  }

  /**
   * Get messages as an array (convenience method).
   */
  getMessages(): NormalizedMessage[] {
    return getMessages(this.normalizedState);
  }

  /**
   * Get a single message by ID.
   */
  getMessage(id: string): NormalizedMessage | undefined {
    return getMessage(this.normalizedState, id);
  }

  /**
   * Get message by turn ID.
   */
  getMessageByTurnId(turnId: string): NormalizedMessage | undefined {
    return getMessagesByTurn(this.normalizedState, turnId);
  }

  /**
   * Get thoughts as an array.
   */
  getThoughts(): NormalizedThought[] {
    return getThoughts(this.normalizedState);
  }

  /**
   * Get tool calls as an array.
   */
  getToolCalls(): NormalizedToolCall[] {
    return getToolCalls(this.normalizedState);
  }

  /**
   * Get a single tool call by ID.
   */
  getToolCall(toolCallId: string): NormalizedToolCall | undefined {
    return getToolCall(this.normalizedState, toolCallId);
  }

  /**
   * Get the timeline (ordered messages, thoughts, tool calls).
   */
  getTimeline(): TimelineItem[] {
    return getTimeline(this.normalizedState);
  }

  /**
   * Get session state.
   */
  getSessionState(): SessionControllerState {
    return { ...this.sessionState };
  }

  /**
   * Get current version for snapshot stability checks.
   */
  getVersion(): number {
    return this.version;
  }

  /**
   * Check if there are pending notifications waiting to be flushed.
   */
  hasPendingNotification(): boolean {
    return this.pendingNotification;
  }

  /**
   * Cleanup - unsubscribe from session controller.
   */
  destroy(): void {
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
      this.notificationTimeout = null;
    }
    this.pendingNotification = false;

    for (const unsub of this.unsubscribes) {
      unsub();
    }
    this.unsubscribes = [];

    this.subscribers.clear();
    this.cachedSnapshot = null;
    this.cachedSnapshotVersion = -1;
  }
}

/**
 * Create an AcpStore instance with a session controller.
 */
export function createAcpStore(
  sessionController: SessionController,
  config?: AcpStoreConfig
): AcpStore {
  return new AcpStore(sessionController, config);
}