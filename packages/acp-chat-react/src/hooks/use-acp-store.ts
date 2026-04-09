import { useSyncExternalStore } from "react";
import type { AcpStore, AcpStoreSnapshot, SnapshotSelector } from "../store/index.js";
import type {
  NormalizedMessage,
  NormalizedThought,
  NormalizedToolCall,
  NormalizedPermissionRequest,
  SessionControllerState,
} from "@harms-haus/acp-chat-core";

function useAcpStoreSnapshot(store: AcpStore): AcpStoreSnapshot {
  return useSyncExternalStore(
    store.subscribe.bind(store),
    store.getSnapshot.bind(store),
    store.getServerSnapshot.bind(store)
  );
}

export function useMessages(store: AcpStore): NormalizedMessage[] {
  const snapshot = useAcpStoreSnapshot(store);
  return Array.from(snapshot.messages.values());
}

export function useMessage(store: AcpStore, id: string): NormalizedMessage | undefined {
  const snapshot = useAcpStoreSnapshot(store);
  return snapshot.messages.get(id);
}

export function useMessageByTurnId(store: AcpStore, turnId: string): NormalizedMessage | undefined {
  const snapshot = useAcpStoreSnapshot(store);
  const messageId = snapshot.turnIdToMessageId.get(turnId);
  return messageId ? snapshot.messages.get(messageId) : undefined;
}

export function useThoughts(store: AcpStore): NormalizedThought[] {
  const snapshot = useAcpStoreSnapshot(store);
  return Array.from(snapshot.thoughts.values());
}

export function useToolCalls(store: AcpStore): NormalizedToolCall[] {
  const snapshot = useAcpStoreSnapshot(store);
  return Array.from(snapshot.toolCalls.values());
}

export function useToolCall(store: AcpStore, toolCallId: string): NormalizedToolCall | undefined {
  const snapshot = useAcpStoreSnapshot(store);
  return snapshot.toolCalls.get(toolCallId);
}

export function useTimeline(store: AcpStore): AcpStoreSnapshot["timelineOrder"] {
  const snapshot = useAcpStoreSnapshot(store);
  return snapshot.timelineOrder;
}

export function useSessionState(store: AcpStore): SessionControllerState {
  const snapshot = useAcpStoreSnapshot(store);
  return snapshot.session;
}

export function useIsConnected(store: AcpStore): boolean {
  const snapshot = useAcpStoreSnapshot(store);
  return snapshot.session.connectionStatus === "connected";
}

export function useIsInitialized(store: AcpStore): boolean {
  const snapshot = useAcpStoreSnapshot(store);
  return snapshot.session.initialized;
}

export function useSessionId(store: AcpStore): string | null {
  const snapshot = useAcpStoreSnapshot(store);
  return snapshot.session.sessionId;
}

export function useStoreVersion(store: AcpStore): number {
  const snapshot = useAcpStoreSnapshot(store);
  return snapshot.version;
}

export function useSnapshotSelector<T>(store: AcpStore, selector: SnapshotSelector<T>): T {
  const snapshot = useAcpStoreSnapshot(store);
  return selector(snapshot);
}

export function useTimelineItems(store: AcpStore): Array<{
  type: "message" | "thought" | "tool_call" | "permission_request";
  id: string;
  data: NormalizedMessage | NormalizedThought | NormalizedToolCall | NormalizedPermissionRequest;
}> {
  const snapshot = useAcpStoreSnapshot(store);
  const items: Array<{
    type: "message" | "thought" | "tool_call" | "permission_request";
    id: string;
    data: NormalizedMessage | NormalizedThought | NormalizedToolCall | NormalizedPermissionRequest;
  }> = [];

  for (const item of snapshot.timelineOrder) {
    if (item.type === "message") {
      const msg = snapshot.messages.get(item.id as string);
      if (msg) items.push({ type: "message", id: item.id as string, data: msg });
    } else if (item.type === "thought") {
      const thought = snapshot.thoughts.get(item.id as string);
      if (thought) items.push({ type: "thought", id: item.id as string, data: thought });
    } else if (item.type === "tool_call") {
      const toolCall = snapshot.toolCalls.get(item.id as string);
      if (toolCall) items.push({ type: "tool_call", id: item.id as string, data: toolCall });
    } else if (item.type === "permission_request") {
      const request = snapshot.permissionRequests.get(item.id as number);
      if (request) items.push({ type: "permission_request", id: item.id as string, data: request });
    }
  }

  return items;
}

export function useMessagesCount(store: AcpStore): number {
  const snapshot = useAcpStoreSnapshot(store);
  return snapshot.messages.size;
}

export function useThoughtsCount(store: AcpStore): number {
  const snapshot = useAcpStoreSnapshot(store);
  return snapshot.thoughts.size;
}

export function useToolCallsCount(store: AcpStore): number {
  const snapshot = useAcpStoreSnapshot(store);
  return snapshot.toolCalls.size;
}

export function useActiveStreamingMessage(store: AcpStore): NormalizedMessage | undefined {
  const snapshot = useAcpStoreSnapshot(store);
  for (const msg of snapshot.messages.values()) {
    if (msg.status === "streaming") {
      return msg;
    }
  }
  return undefined;
}

export function usePermissionRequests(store: AcpStore): NormalizedPermissionRequest[] {
  const snapshot = useAcpStoreSnapshot(store);
  return Array.from(snapshot.permissionRequests.values());
}

export function usePendingPermissionRequests(store: AcpStore): NormalizedPermissionRequest[] {
  const snapshot = useAcpStoreSnapshot(store);
  return Array.from(snapshot.permissionRequests.values()).filter(
    (r) => r.status === "pending"
  );
}