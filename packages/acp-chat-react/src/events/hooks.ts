import { useSyncExternalStore, useRef, useMemo, useCallback } from "react";
import type { SessionController } from "@acp/chat-core";

// Stable empty snapshot for server-side rendering to prevent hydration mismatches
const EMPTY_SERVER_SNAPSHOT: { activeThoughts: string[]; activeToolCalls: string[] } = { activeThoughts: [], activeToolCalls: [] };

/**
 * Event types emitted by SessionController
 */
export type ChatEventType =
  | "statusChange"
  | "sessionUpdate"
  | "traffic"
  | "error"
  | "sessionClearing"
  | "permissionRequest";

/**
 * Base event envelope containing event metadata
 */
export interface ChatEvent<T extends ChatEventType, P = unknown> {
  type: T;
  params: P;
  timestamp: number;
}

/**
 * Event payloads for each event type
 */
export interface ChatEventPayloads {
  statusChange: {
    connectionStatus: string;
    bridgeStatus: string;
    sessionId: string | null;
    initialized: boolean;
    capabilities: unknown | null;
  };
  sessionUpdate: {
    sessionId?: string;
    update?: Record<string, unknown>;
  };
  traffic: {
    direction: "in" | "out";
    data: unknown;
  };
  error: {
    message: string;
    name?: string;
    stack?: string;
  };
  sessionClearing: Record<string, never>;
  permissionRequest: {
    sessionId: string;
    toolCallId: string;
    requestId: number;
    options: Array<{
      optionId: string;
      name: string;
      kind: string;
    }>;
  };
}

/**
 * Typed event for specific event types
 */
export type TypedChatEvent<T extends ChatEventType> = ChatEvent<T, ChatEventPayloads[T]>;

/**
 * Internal subscription manager for event tracking
 * Stores latest events and provides snapshot access for useSyncExternalStore
 */
class ChatEventSubscription {
  private latestEvents = new Map<ChatEventType, ChatEvent<ChatEventType, unknown>[]>();
  private maxEventsPerType = 100;
  private sessionController: SessionController;

  constructor(sessionController: SessionController) {
    this.sessionController = sessionController;
  }

  /**
   * Subscribe to events with optional type filter
   */
  subscribe(
    onStoreChange: () => void,
    eventType?: ChatEventType
  ): () => void {
    const handler = (params: unknown) => {
      const event: ChatEvent<ChatEventType, unknown> = {
        type: (eventType ?? "sessionUpdate") as ChatEventType,
        params,
        timestamp: Date.now(),
      };

      // Store the event
      const events = this.latestEvents.get(event.type) ?? [];
      events.push(event);

      // Limit stored events
      if (events.length > this.maxEventsPerType) {
        events.shift();
      }

      this.latestEvents.set(event.type, events);

      // Notify subscribers
      onStoreChange();
    };

    // Type-safe subscription using switch to match SessionController overloads
    let unsubscribe: () => void = () => {};
    const event = eventType ?? "sessionUpdate";
    switch (event) {
      case "statusChange":
        unsubscribe = this.sessionController.on("statusChange", handler as any);
        break;
      case "sessionUpdate":
        unsubscribe = this.sessionController.on("sessionUpdate", handler as any);
        break;
      case "traffic":
        unsubscribe = this.sessionController.on("traffic", handler as any);
        break;
      case "error":
        unsubscribe = this.sessionController.on("error", handler as any);
        break;
      case "sessionClearing":
        unsubscribe = this.sessionController.on("sessionClearing", handler as any);
        break;
      case "permissionRequest":
        unsubscribe = this.sessionController.on("permissionRequest", handler as any);
        break;
      default:
        throw new Error(`Unexpected event type: ${event satisfies never}`);
    }

    return unsubscribe;
  }

  /**
   * Get latest events of a specific type
   */
  getEvents<T extends ChatEventType>(eventType: T): ChatEvent<T, ChatEventPayloads[T]>[] {
    const events = this.latestEvents.get(eventType) ?? [];
    return events as ChatEvent<T, ChatEventPayloads[T]>[];
  }

  /**
   * Get latest event of a specific type
   */
  getLatestEvent<T extends ChatEventType>(eventType: T): ChatEvent<T, ChatEventPayloads[T]> | undefined {
    const events = this.latestEvents.get(eventType) ?? [];
    return events[events.length - 1] as ChatEvent<T, ChatEventPayloads[T]> | undefined;
  }

  /**
   * Get all events (for debugging)
   */
  getAllEvents(): ChatEvent<ChatEventType, unknown>[] {
    return Array.from(this.latestEvents.values()).flat();
  }

  /**
   * Get server snapshot (for SSR compatibility)
   */
  getServerSnapshot(): ChatEvent<ChatEventType, unknown>[] {
    return [];
  }
}

/**
 * Subscription manager for thought-specific events
 */
class ThoughtEventSubscription {
  private latestEvents = new Map<string, ChatEvent<"sessionUpdate", unknown>[]>();
  private maxEventsPerThought = 100;
  private sessionController: SessionController;

  constructor(sessionController: SessionController) {
    this.sessionController = sessionController;
  }

  subscribe(
    onStoreChange: () => void,
    thoughtId: string
  ): () => void {
    const unsubscribe = this.sessionController.on("sessionUpdate", (params: unknown) => {
      const update = params as { sessionId?: string; update?: Record<string, unknown> };
      const updateType = update.update?.type ?? update.update?.sessionUpdate;

      // Only track thought-related events
      if (updateType === "agent_thought_chunk" || updateType === "thought_update") {
        const thoughtUpdate = update.update as { thoughtId?: string };
        const id = thoughtUpdate.thoughtId ?? thoughtId;

        const event: ChatEvent<"sessionUpdate", unknown> = {
          type: "sessionUpdate",
          params,
          timestamp: Date.now(),
        };

        const events = this.latestEvents.get(id) ?? [];
        events.push(event);

        if (events.length > this.maxEventsPerThought) {
          events.shift();
        }

        this.latestEvents.set(id, events);
        onStoreChange();
      }
    });

    return unsubscribe;
  }

  getEvents(thoughtId: string): ChatEvent<"sessionUpdate", unknown>[] {
    return this.latestEvents.get(thoughtId) ?? [];
  }

  getServerSnapshot(): ChatEvent<"sessionUpdate", unknown>[] {
    return [];
  }
}

/**
 * Subscription manager for tool call-specific events
 */
class ToolCallEventSubscription {
  private latestEvents = new Map<string, ChatEvent<"sessionUpdate", unknown>[]>();
  private maxEventsPerToolCall = 100;
  private sessionController: SessionController;

  constructor(sessionController: SessionController) {
    this.sessionController = sessionController;
  }

  subscribe(
    onStoreChange: () => void,
    toolCallId: string
  ): () => void {
    const unsubscribe = this.sessionController.on("sessionUpdate", (params: unknown) => {
      const update = params as { sessionId?: string; update?: Record<string, unknown> };
      const updateType = update.update?.type ?? update.update?.sessionUpdate;

      // Only track tool call-related events
      if (updateType === "tool_call" || updateType === "tool_call_update") {
        const toolCallUpdate = update.update as { toolCallId?: string };
        const id = toolCallUpdate.toolCallId ?? toolCallId;

        const event: ChatEvent<"sessionUpdate", unknown> = {
          type: "sessionUpdate",
          params,
          timestamp: Date.now(),
        };

        const events = this.latestEvents.get(id) ?? [];
        events.push(event);

        if (events.length > this.maxEventsPerToolCall) {
          events.shift();
        }

        this.latestEvents.set(id, events);
        onStoreChange();
      }
    });

    return unsubscribe;
  }

  getEvents(toolCallId: string): ChatEvent<"sessionUpdate", unknown>[] {
    return this.latestEvents.get(toolCallId) ?? [];
  }

  getServerSnapshot(): ChatEvent<"sessionUpdate", unknown>[] {
    return [];
  }
}

/**
 * Subscription manager for tracking active items (thoughts/tools in progress)
 */
class ActiveItemsSubscription {
  private activeThoughts = new Set<string>();
  private activeToolCalls = new Set<string>();
  private sessionController: SessionController;
  private _cachedSnapshot: { activeThoughts: string[]; activeToolCalls: string[] } | null = null;

  constructor(sessionController: SessionController) {
    this.sessionController = sessionController;
  }

  subscribe(onStoreChange: () => void): () => void {
    const unsubscribeSessionUpdate = this.sessionController.on("sessionUpdate", (params: unknown) => {
      const update = params as { sessionId?: string; update?: Record<string, unknown> };
      const updateType = update.update?.type ?? update.update?.sessionUpdate;
      let changed = false;

      // Track thought lifecycle
      if (updateType === "agent_thought_chunk") {
        const thoughtUpdate = update.update as { thoughtId?: string; status?: string };
        if (thoughtUpdate.thoughtId) {
          if (thoughtUpdate.status === "completed" || thoughtUpdate.status === "done") {
            this.activeThoughts.delete(thoughtUpdate.thoughtId);
            changed = true;
          } else {
            this.activeThoughts.add(thoughtUpdate.thoughtId);
            changed = true;
          }
        }
      }

      // Track tool call lifecycle
      if (updateType === "tool_call" || updateType === "tool_call_update") {
        const toolCallUpdate = update.update as { toolCallId?: string; status?: string };
        if (toolCallUpdate.toolCallId) {
          if (toolCallUpdate.status === "completed" || toolCallUpdate.status === "done") {
            this.activeToolCalls.delete(toolCallUpdate.toolCallId);
            changed = true;
          } else {
            this.activeToolCalls.add(toolCallUpdate.toolCallId);
            changed = true;
          }
        }
      }

      // Invalidate cache when data changes
      if (changed) {
        this._cachedSnapshot = null;
        onStoreChange();
      }
    });

    // Clear active items on session clearing
    const unsubscribeClearing = this.sessionController.on("sessionClearing", () => {
      this.activeThoughts.clear();
      this.activeToolCalls.clear();
      this._cachedSnapshot = null;
      onStoreChange();
    });

    return () => {
      unsubscribeSessionUpdate();
      unsubscribeClearing();
    };
  }

  getActiveItems(): {
    activeThoughts: string[];
    activeToolCalls: string[];
  } {
    if (!this._cachedSnapshot) {
      this._cachedSnapshot = {
        activeThoughts: Array.from(this.activeThoughts),
        activeToolCalls: Array.from(this.activeToolCalls),
      };
    }
    return this._cachedSnapshot;
  }

  getServerSnapshot(): { activeThoughts: string[]; activeToolCalls: string[] } {
    return { activeThoughts: [], activeToolCalls: [] };
  }
}

// WeakMap-based subscription managers keyed by SessionController
const chatEventSubscriptions = new WeakMap<SessionController, ChatEventSubscription>();
const thoughtEventSubscriptions = new WeakMap<SessionController, ThoughtEventSubscription>();
const toolCallEventSubscriptions = new WeakMap<SessionController, ToolCallEventSubscription>();
const activeItemsSubscriptions = new WeakMap<SessionController, ActiveItemsSubscription>();

function getChatEventSubscription(controller: SessionController): ChatEventSubscription {
  if (!chatEventSubscriptions.has(controller)) {
    chatEventSubscriptions.set(controller, new ChatEventSubscription(controller));
  }
  return chatEventSubscriptions.get(controller)!;
}

function getThoughtEventSubscription(controller: SessionController): ThoughtEventSubscription {
  if (!thoughtEventSubscriptions.has(controller)) {
    thoughtEventSubscriptions.set(controller, new ThoughtEventSubscription(controller));
  }
  return thoughtEventSubscriptions.get(controller)!;
}

function getToolCallEventSubscription(controller: SessionController): ToolCallEventSubscription {
  if (!toolCallEventSubscriptions.has(controller)) {
    toolCallEventSubscriptions.set(controller, new ToolCallEventSubscription(controller));
  }
  return toolCallEventSubscriptions.get(controller)!;
}

function getActiveItemsSubscription(controller: SessionController): ActiveItemsSubscription {
  if (!activeItemsSubscriptions.has(controller)) {
    activeItemsSubscriptions.set(controller, new ActiveItemsSubscription(controller));
  }
  return activeItemsSubscriptions.get(controller)!;
}

/**
 * Subscribe to specific event types from the SessionController
 *
 * @param controller - SessionController instance
 * @param eventType - Type of event to subscribe to
 * @returns Array of events matching the specified type
 */
export function useChatEvent<T extends ChatEventType>(
  controller: SessionController,
  eventType: T
): ChatEvent<T, ChatEventPayloads[T]>[] {
  const subscription = getChatEventSubscription(controller);
  const lastSnapshotRef = useRef<{ snapshot: ChatEvent<T, ChatEventPayloads[T]>[]; version: number }>({ snapshot: [], version: 0 });

  const subscribe = (onStoreChange: () => void) => {
    return subscription.subscribe(onStoreChange, eventType);
  };

  const getSnapshot = (): ChatEvent<T, ChatEventPayloads[T]>[] => {
    const events = subscription.getEvents(eventType) as ChatEvent<T, ChatEventPayloads[T]>[];
    // Only create new snapshot array if events actually changed
    const lastSnapshot = lastSnapshotRef.current.snapshot;
    const lastTimestamp = lastSnapshot.length > 0 ? lastSnapshot[lastSnapshot.length - 1]?.timestamp : undefined;
    const currentTimestamp = events.length > 0 ? events[events.length - 1]?.timestamp : undefined;
    
    if (events.length !== lastSnapshot.length || currentTimestamp !== lastTimestamp) {
      lastSnapshotRef.current = { snapshot: [...events], version: lastSnapshotRef.current.version + 1 };
    }
    return lastSnapshotRef.current.snapshot;
  };

  const getServerSnapshot = (): ChatEvent<T, ChatEventPayloads[T]>[] => {
    return [];
  };

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Subscribe to thought lifecycle events for a specific thought
 *
 * @param controller - SessionController instance
 * @param thoughtId - ID of the thought to track
 * @returns Array of events for the specified thought
 */
export function useThoughtEvents(
  controller: SessionController | undefined,
  thoughtId: string
): ChatEvent<"sessionUpdate", unknown>[] {
  const emptyRef = useRef<ChatEvent<"sessionUpdate", unknown>[]>([]);
  const lastSnapshotRef = useRef<{ snapshot: ChatEvent<"sessionUpdate", unknown>[]; version: number }>({ snapshot: [], version: 0 });
  
  // Always call hooks unconditionally
  const subscribeFn = useMemo(() => {
    if (!controller) {
      return (_onStoreChange: () => void) => () => {};
    }
    const subscription = getThoughtEventSubscription(controller);
    return (onStoreChange: () => void) => subscription.subscribe(onStoreChange, thoughtId);
  }, [controller, thoughtId]);
  
  const getSnapshotFn = useCallback(() => {
    if (!controller) {
      return emptyRef.current;
    }
    const subscription = getThoughtEventSubscription(controller);
    const events = subscription.getEvents(thoughtId);
    // Only create new snapshot array if events actually changed
    const lastSnapshot = lastSnapshotRef.current.snapshot;
    const lastTimestamp = lastSnapshot.length > 0 ? lastSnapshot[lastSnapshot.length - 1]?.timestamp : undefined;
    const currentTimestamp = events.length > 0 ? events[events.length - 1]?.timestamp : undefined;
    
    if (events.length !== lastSnapshot.length || currentTimestamp !== lastTimestamp) {
      lastSnapshotRef.current = { snapshot: [...events], version: lastSnapshotRef.current.version + 1 };
    }
    return lastSnapshotRef.current.snapshot;
  }, [controller, thoughtId]);
  
  const getServerSnapshotFn = useCallback(() => {
    if (!controller) {
      return [] as ChatEvent<"sessionUpdate", unknown>[];
    }
    return getThoughtEventSubscription(controller).getServerSnapshot();
  }, [controller]);

  return useSyncExternalStore(subscribeFn, getSnapshotFn, getServerSnapshotFn);
}

/**
 * Subscribe to tool call events for a specific tool call
 *
 * @param controller - SessionController instance
 * @param toolCallId - ID of the tool call to track
 * @returns Array of events for the specified tool call
 */
export function useToolCallEvents(
  controller: SessionController | undefined,
  toolCallId: string
): ChatEvent<"sessionUpdate", unknown>[] {
  const emptyRef = useRef<ChatEvent<"sessionUpdate", unknown>[]>([]);
  const lastSnapshotRef = useRef<{ snapshot: ChatEvent<"sessionUpdate", unknown>[]; version: number }>({ snapshot: [], version: 0 });
  
  const subscribeFn = useMemo(() => {
    if (!controller) {
      return (_onStoreChange: () => void) => () => {};
    }
    const subscription = getToolCallEventSubscription(controller);
    return (onStoreChange: () => void) => subscription.subscribe(onStoreChange, toolCallId);
  }, [controller, toolCallId]);
  
  const getSnapshotFn = useCallback(() => {
    if (!controller) {
      return emptyRef.current;
    }
    const subscription = getToolCallEventSubscription(controller);
    const events = subscription.getEvents(toolCallId);
    // Only create new snapshot array if events actually changed
    const lastSnapshot = lastSnapshotRef.current.snapshot;
    const lastTimestamp = lastSnapshot.length > 0 ? lastSnapshot[lastSnapshot.length - 1]?.timestamp : undefined;
    const currentTimestamp = events.length > 0 ? events[events.length - 1]?.timestamp : undefined;
    
    if (events.length !== lastSnapshot.length || currentTimestamp !== lastTimestamp) {
      lastSnapshotRef.current = { snapshot: [...events], version: lastSnapshotRef.current.version + 1 };
    }
    return lastSnapshotRef.current.snapshot;
  }, [controller, toolCallId]);
  
  const getServerSnapshotFn = useCallback(() => {
    if (!controller) {
      return [] as ChatEvent<"sessionUpdate", unknown>[];
    }
    return getToolCallEventSubscription(controller).getServerSnapshot();
  }, [controller]);

  return useSyncExternalStore(subscribeFn, getSnapshotFn, getServerSnapshotFn);
}

/**
 * Get currently active thoughts and tool calls
 *
 * @param controller - SessionController instance
 * @returns Object containing arrays of active thought IDs and tool call IDs
 */
export function useActiveItems(
  controller: SessionController | undefined
): {
  activeThoughts: string[];
  activeToolCalls: string[];
} {
  const emptyRef = useRef<{ activeThoughts: string[]; activeToolCalls: string[] }>({ activeThoughts: [], activeToolCalls: [] });
  
  const subscribeFn = useMemo(() => {
    if (!controller) {
      return (_onStoreChange: () => void) => () => {};
    }
    const subscription = getActiveItemsSubscription(controller);
    return subscription.subscribe.bind(subscription);
  }, [controller]);
  
  const getSnapshotFn = useCallback(() => {
    if (!controller) {
      return emptyRef.current;
    }
    return getActiveItemsSubscription(controller).getActiveItems();
  }, [controller]);
  
  const getServerSnapshotFn = useCallback(() => {
    return EMPTY_SERVER_SNAPSHOT;
  }, []);

  return useSyncExternalStore(subscribeFn, getSnapshotFn, getServerSnapshotFn);
}
