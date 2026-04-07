import { useSyncExternalStore, useRef } from "react";
import type { SessionController } from "@acp/chat-core";

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
    let unsubscribe: () => void;
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
      if (updateType === "agent_thought_chunk") {
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

  constructor(sessionController: SessionController) {
    this.sessionController = sessionController;
  }

  subscribe(onStoreChange: () => void): () => void {
    const unsubscribeSessionUpdate = this.sessionController.on("sessionUpdate", (params: unknown) => {
      const update = params as { sessionId?: string; update?: Record<string, unknown> };
      const updateType = update.update?.type ?? update.update?.sessionUpdate;

      // Track thought lifecycle
      if (updateType === "agent_thought_chunk") {
        const thoughtUpdate = update.update as { thoughtId?: string; status?: string };
        if (thoughtUpdate.thoughtId) {
          this.activeThoughts.add(thoughtUpdate.thoughtId);
          onStoreChange();
        }
      }

      // Track tool call lifecycle
      if (updateType === "tool_call" || updateType === "tool_call_update") {
        const toolCallUpdate = update.update as { toolCallId?: string; status?: string };
        if (toolCallUpdate.toolCallId) {
          if (toolCallUpdate.status === "completed") {
            this.activeToolCalls.delete(toolCallUpdate.toolCallId);
          } else {
            this.activeToolCalls.add(toolCallUpdate.toolCallId);
          }
          onStoreChange();
        }
      }
    });

    // Clear active items on session clearing
    const unsubscribeClearing = this.sessionController.on("sessionClearing", () => {
      this.activeThoughts.clear();
      this.activeToolCalls.clear();
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
    return {
      activeThoughts: Array.from(this.activeThoughts),
      activeToolCalls: Array.from(this.activeToolCalls),
    };
  }

  getServerSnapshot(): { activeThoughts: string[]; activeToolCalls: string[] } {
    return { activeThoughts: [], activeToolCalls: [] };
  }
}

// Global subscription managers (lazy initialized)
let chatEventSubscription: ChatEventSubscription | undefined;
let thoughtEventSubscription: ThoughtEventSubscription | undefined;
let toolCallEventSubscription: ToolCallEventSubscription | undefined;
let activeItemsSubscription: ActiveItemsSubscription | undefined;

function getChatEventSubscription(controller: SessionController): ChatEventSubscription {
  if (!chatEventSubscription) {
    chatEventSubscription = new ChatEventSubscription(controller);
  }
  return chatEventSubscription;
}

function getThoughtEventSubscription(controller: SessionController): ThoughtEventSubscription {
  if (!thoughtEventSubscription) {
    thoughtEventSubscription = new ThoughtEventSubscription(controller);
  }
  return thoughtEventSubscription;
}

function getToolCallEventSubscription(controller: SessionController): ToolCallEventSubscription {
  if (!toolCallEventSubscription) {
    toolCallEventSubscription = new ToolCallEventSubscription(controller);
  }
  return toolCallEventSubscription;
}

function getActiveItemsSubscription(controller: SessionController): ActiveItemsSubscription {
  if (!activeItemsSubscription) {
    activeItemsSubscription = new ActiveItemsSubscription(controller);
  }
  return activeItemsSubscription;
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
  const eventsRef = useRef<ChatEvent<T, ChatEventPayloads[T]>[]>([]);

  const subscribe = (onStoreChange: () => void) => {
    return subscription.subscribe(onStoreChange, eventType);
  };

  const getSnapshot = (): ChatEvent<T, ChatEventPayloads[T]>[] => {
    const events = subscription.getEvents(eventType) as ChatEvent<T, ChatEventPayloads[T]>[];
    eventsRef.current = events;
    return events;
  };

  const getServerSnapshot = (): ChatEvent<T, ChatEventPayloads[T]>[] => {
    return subscription.getServerSnapshot() as ChatEvent<T, ChatEventPayloads[T]>[];
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
  controller: SessionController,
  thoughtId: string
): ChatEvent<"sessionUpdate", unknown>[] {
  const subscription = getThoughtEventSubscription(controller);
  const eventsRef = useRef<ChatEvent<"sessionUpdate", unknown>[]>([]);

  const subscribe = (onStoreChange: () => void) => {
    return subscription.subscribe(onStoreChange, thoughtId);
  };

  const getSnapshot = () => {
    const events = subscription.getEvents(thoughtId);
    eventsRef.current = events;
    return events;
  };

  const getServerSnapshot = () => {
    return subscription.getServerSnapshot();
  };

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Subscribe to tool call events for a specific tool call
 *
 * @param controller - SessionController instance
 * @param toolCallId - ID of the tool call to track
 * @returns Array of events for the specified tool call
 */
export function useToolCallEvents(
  controller: SessionController,
  toolCallId: string
): ChatEvent<"sessionUpdate", unknown>[] {
  const subscription = getToolCallEventSubscription(controller);
  const eventsRef = useRef<ChatEvent<"sessionUpdate", unknown>[]>([]);

  const subscribe = (onStoreChange: () => void) => {
    return subscription.subscribe(onStoreChange, toolCallId);
  };

  const getSnapshot = () => {
    const events = subscription.getEvents(toolCallId);
    eventsRef.current = events;
    return events;
  };

  const getServerSnapshot = () => {
    return subscription.getServerSnapshot();
  };

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Get currently active thoughts and tool calls
 *
 * @param controller - SessionController instance
 * @returns Object containing arrays of active thought IDs and tool call IDs
 */
export function useActiveItems(
  controller: SessionController
): {
  activeThoughts: string[];
  activeToolCalls: string[];
} {
  const subscription = getActiveItemsSubscription(controller);
  const itemsRef = useRef<{ activeThoughts: string[]; activeToolCalls: string[] }>({
    activeThoughts: [],
    activeToolCalls: [],
  });

  const subscribe = (onStoreChange: () => void) => {
    return subscription.subscribe(onStoreChange);
  };

  const getSnapshot = () => {
    const items = subscription.getActiveItems();
    itemsRef.current = items;
    return items;
  };

  const getServerSnapshot = () => {
    return subscription.getServerSnapshot();
  };

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
