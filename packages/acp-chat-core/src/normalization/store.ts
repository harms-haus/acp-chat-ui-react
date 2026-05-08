export type MessageRole = "user" | "agent";

export type MessageStatus = "streaming" | "completed" | "cancelled" | "error";

export type ThoughtStatus = "streaming" | "completed" | "cancelled" | "error";

export type ContentBlockType = "text" | "resource" | "resource_link";

export interface TextContentBlock {
  type: "text";
  text: string;
}

export interface ResourceContentBlock {
  type: "resource";
  resource: {
    uri: string;
    mimeType?: string | null;
    text?: string;
    blob?: string;
  };
}

export interface ResourceLinkContentBlock {
  type: "resource_link";
  resourceLink: {
    uri: string;
    mimeType?: string | null;
  };
}

export type ContentBlock = TextContentBlock | ResourceContentBlock | ResourceLinkContentBlock;

export interface NormalizedMessage {
  id: string;
  role: MessageRole;
  status: MessageStatus;
  content: string;
  contentBlocks: ContentBlock[];
  createdAt?: number;
  updatedAt?: number;
  parentMessageId?: string;
  turnId?: string;
}

export interface NormalizedThought {
  id: string;
  content: string;
  turnId?: string;
  status?: ThoughtStatus;
  createdAt?: number;
  updatedAt?: number;
}

export type ToolCallKind = "read" | "search" | "edit" | "write" | "execute" | "glob" | "grep" | "unknown";

export type ToolCallStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";

export interface NormalizedToolCall {
  toolCallId: string;
  kind: ToolCallKind;
  title: string;
  status?: ToolCallStatus;
  rawInput?: {
    filePath?: string;
    command?: string;
    pattern?: string;
    [key: string]: unknown;
  };
  rawOutput?: {
    metadata: {
      loaded?: string[];
      preview?: string;
      truncated: boolean;
      exit?: number;
    };
    output: string;
  };
  createdAt?: number;
  updatedAt?: number;
}

export type PermissionRequestStatus = "pending" | "approved" | "denied" | "cancelled";

export interface NormalizedPermissionRequest {
  requestId: number;
  sessionId: string;
  toolCallId: string;
  options: Array<{
    optionId: string;
    name: string;
    kind: string;
  }>;
  status: PermissionRequestStatus;
  selectedOptionId?: string;
  createdAt: number;
}

export type TimelineItem =
  | { type: "message"; id: string; data: NormalizedMessage }
  | { type: "thought"; id: string; data: NormalizedThought }
  | { type: "tool_call"; id: string; data: NormalizedToolCall }
  | { type: "permission_request"; id: number; data: NormalizedPermissionRequest };

export type TimelineItemType = "message" | "thought" | "tool_call" | "permission_request";

export interface NormalizedState {
  messages: Map<string, NormalizedMessage>;
  thoughts: Map<string, NormalizedThought>;
  toolCalls: Map<string, NormalizedToolCall>;
  permissionRequests: Map<number, NormalizedPermissionRequest>;
  timelineOrder: Array<{ type: TimelineItemType; id: string | number }>;
  turnIdToMessageId: Map<string, string>;
  /** Tracks the ID of the currently streaming message per role when no turnId is provided. */
  activeStreamingMessage: Map<string, string>;
}

export interface SessionUpdateParams {
    sessionId?: string;
    update?: {
        type?: string;
        sessionUpdate?: string;
        [key: string]: unknown;
    };
}

interface AgentMessageChunk {
  type?: string;
  sessionUpdate?: string;
  turnId?: string;
  role?: string;
  content?: Array<{ type: string; text: string }> | { type: string; text: string };
  status?: string;
  timestamp?: number;
}

interface UserMessage {
  type?: string;
  sessionUpdate?: string;
  turnId?: string;
  role?: string;
  content?: Array<{ type: string; text: string }> | { type: string; text: string };
  timestamp?: number;
}

interface ToolCallUpdate {
  type?: string;
  sessionUpdate?: string;
  toolCallId?: string;
  kind?: string;
  title?: string;
  status?: string;
  rawInput?: {
    filePath?: string;
    command?: string;
    pattern?: string;
    [key: string]: unknown;
  };
  rawOutput?: {
    metadata?: {
      loaded?: string[];
      preview?: string;
      truncated?: boolean;
      exit?: number;
    };
    output?: string;
  };
  timestamp?: number;
}

interface PermissionRequestUpdate {
  type?: string;
  sessionUpdate?: string;
  requestId?: number;
  sessionId?: string;
  toolCallId?: string;
  options?: Array<{
    optionId: string;
    name: string;
    kind: string;
  }>;
  status?: string;
  selectedOptionId?: string;
  timestamp?: number;
}

type AcpUpdate = AgentMessageChunk | UserMessage | ToolCallUpdate | PermissionRequestUpdate | { type?: string; sessionUpdate?: string; [key: string]: unknown };

export function createNormalizedState(): NormalizedState {
  return {
    messages: new Map(),
    thoughts: new Map(),
    toolCalls: new Map(),
    permissionRequests: new Map(),
    timelineOrder: [],
    turnIdToMessageId: new Map(),
    activeStreamingMessage: new Map(),
  };
}

function getUpdateType(update: AcpUpdate): string | undefined {
    return update.sessionUpdate ?? update.type;
}

export function applySessionUpdate(state: NormalizedState, params: SessionUpdateParams): NormalizedMessage | NormalizedThought | NormalizedToolCall | NormalizedPermissionRequest | null {
  if (!params.update) {
    return null;
  }

  const update = params.update as AcpUpdate;
  const updateType = getUpdateType(update);

  switch (updateType) {
    case "agent_message_chunk": {
      return applyAgentMessageChunk(state, update as AgentMessageChunk);
    }
    case "agent_thought_chunk": {
      return applyAgentThoughtChunk(state, update as AgentMessageChunk);
    }
    case "user_message_chunk":
    case "user_message": {
      return applyUserMessage(state, update as UserMessage);
    }
    case "tool_call": {
      return applyToolCall(state, update as ToolCallUpdate);
    }
    case "tool_call_update": {
      return applyToolCallUpdate(state, update as ToolCallUpdate);
    }
    case "permission_request": {
      return applyPermissionRequest(state, update as PermissionRequestUpdate);
    }
    default:
      return null;
  }
}

function getTimestamp(update: AgentMessageChunk | UserMessage): number | undefined {
  if (update.timestamp && typeof update.timestamp === "number") {
    return update.timestamp;
  }
  return undefined;
}

function applyAgentMessageChunk(state: NormalizedState, update: AgentMessageChunk): NormalizedMessage | null {
  const turnId = update.turnId ?? (update as Record<string, unknown>)["turn_id"] as string | undefined;
  const extractedContent = extractText(update.content);
  const newContentBlocks = extractContentBlocks(update.content);
  const timestamp = getTimestamp(update);
  const isDone = update.status === "done";

  // When no turnId, use active streaming message tracker per role
  let existingId: string | undefined;
  if (turnId) {
    existingId = state.turnIdToMessageId.get(turnId);
  } else {
    existingId = state.activeStreamingMessage.get("agent");
    // Clear user's active message when agent starts responding (turn boundary)
    state.activeStreamingMessage.delete("user");
  }

  if (existingId) {
    const existing = state.messages.get(existingId);
    if (existing) {
      const updated: NormalizedMessage = {
        ...existing,
        content: existing.content + extractedContent,
        contentBlocks: mergeContentBlocks(existing.contentBlocks, newContentBlocks),
        status: mapChunkStatus(update.status),
      };
      if (timestamp !== undefined) {
        updated.updatedAt = timestamp;
      }
      state.messages.set(existingId, updated);
      // Clear active stream when turn completes
      if (isDone && !turnId) {
        state.activeStreamingMessage.delete("agent");
      }
      return updated;
    }
  }

  const id = generateMessageId();
  const message: NormalizedMessage = {
    id,
    role: "agent",
    status: mapChunkStatus(update.status),
    content: extractedContent,
    contentBlocks: newContentBlocks,
  };
  if (turnId) {
    message.turnId = turnId;
    state.turnIdToMessageId.set(turnId, id);
  } else if (!isDone) {
    state.activeStreamingMessage.set("agent", id);
  }
  if (timestamp !== undefined) {
    message.createdAt = timestamp;
    message.updatedAt = timestamp;
  }

  state.messages.set(id, message);
  state.timelineOrder.push({ type: "message", id });

  return message;
}

function mapChunkStatus(status: string | undefined): MessageStatus {
 switch (status) {
 case "in_progress":
 return "streaming";
 case "done":
 return "completed";
 case "cancelled":
 return "cancelled";
 case "error":
 return "error";
 default:
 return "completed";
 }
 }

function mapThoughtStatus(status: string | undefined): ThoughtStatus {
  switch (status) {
    case "in_progress":
      return "streaming";
    case "done":
      return "completed";
    case "cancelled":
      return "cancelled";
    case "error":
      return "error";
    default:
      return "streaming";
  }
}

function applyUserMessage(state: NormalizedState, update: UserMessage): NormalizedMessage | null {
  const turnId = update.turnId ?? (update as Record<string, unknown>)["turn_id"] as string | undefined;
  const extractedContent = extractText(update.content);
  const newContentBlocks = extractContentBlocks(update.content);
  const timestamp = getTimestamp(update);
  const isDone = (update as Record<string, unknown>).status === "done";

  // When no turnId, use active streaming message tracker per role
  let existingId: string | undefined;
  if (turnId) {
    existingId = state.turnIdToMessageId.get(turnId);
  } else {
    existingId = state.activeStreamingMessage.get("user");
    // Clear agent's active message when user starts a new turn (turn boundary)
    state.activeStreamingMessage.delete("agent");
  }

  if (existingId) {
    const existing = state.messages.get(existingId);
    if (existing) {
      const updated: NormalizedMessage = {
        ...existing,
        content: existing.content + extractedContent,
        contentBlocks: mergeContentBlocks(existing.contentBlocks, newContentBlocks),
        status: "completed",
      };
      if (timestamp !== undefined) {
        updated.updatedAt = timestamp;
      }
      state.messages.set(existingId, updated);
      if (!turnId) {
        state.activeStreamingMessage.delete("user");
      }
      return updated;
    }
  }

  const id = generateMessageId();
  const message: NormalizedMessage = {
    id,
    role: "user",
    status: isDone ? "completed" : "streaming",
    content: extractedContent,
    contentBlocks: newContentBlocks,
    ...(turnId ? { turnId } : {}),
  };
  if (timestamp !== undefined) {
    message.createdAt = timestamp;
    message.updatedAt = timestamp;
  }

  state.messages.set(id, message);
  state.timelineOrder.push({ type: "message", id });

  if (turnId) {
    state.turnIdToMessageId.set(turnId, id);
  } else if (!isDone) {
    state.activeStreamingMessage.set("user", id);
  }

  return message;
}

function applyAgentThoughtChunk(state: NormalizedState, update: AgentMessageChunk): NormalizedThought {
  const extractedContent = extractText(update.content);
  const timestamp = getTimestamp(update);
  const turnId = update.turnId;

  if (turnId) {
    const existingEntry = Array.from(state.thoughts.entries()).find(([_, t]) => t.turnId === turnId);
    if (existingEntry) {
      const [existingId, existingThought] = existingEntry;
      const updatedThought: NormalizedThought = {
        ...existingThought,
        content: existingThought.content + extractedContent,
        ...(timestamp !== undefined && { updatedAt: timestamp }),
      };

      if (update.status) {
        updatedThought.status = mapThoughtStatus(update.status);
      } else if (existingThought.status === undefined) {
        updatedThought.status = "streaming";
      }

      state.thoughts.set(existingId, updatedThought);
      return updatedThought;
    }
  }

  if (turnId) {
    const previousStreaming = Array.from(state.thoughts.entries()).find(
      ([_, t]) => t.turnId !== undefined && t.turnId !== turnId && t.status === "streaming"
    );
    if (previousStreaming) {
      const [prevId, prevThought] = previousStreaming;
      state.thoughts.set(prevId, { ...prevThought, status: "completed" });
    }
  }

  const id = generateThoughtId();
  const thought: NormalizedThought = {
    id,
    content: extractedContent,
    status: "streaming",
    ...(turnId && { turnId }),
  };
  if (timestamp !== undefined) {
    thought.createdAt = timestamp;
    thought.updatedAt = timestamp;
  }

  state.thoughts.set(id, thought);
  state.timelineOrder.push({ type: "thought", id });
  return thought;
}

function extractText(content: unknown): string {
  if (!content) return "";

  if (Array.isArray(content)) {
    return content
      .filter((c): c is { type: string; text?: string } => c.type === "text" && typeof c.text === "string")
      .map((c) => c.text)
      .join("");
  }

  if (typeof content === "object" && content !== null) {
    const c = content as { type?: string; text?: string };
    if (c.type === "text" && typeof c.text === "string") {
      return c.text;
    }
  }

  return "";
}

function extractContentBlocks(content: unknown): ContentBlock[] {
  if (!content) return [];

  const blocks: ContentBlock[] = [];

  if (Array.isArray(content)) {
    for (const item of content) {
      if (typeof item === "object" && item !== null) {
        const block = parseContentBlock(item as Record<string, unknown>);
        if (block) blocks.push(block);
      }
    }
  } else if (typeof content === "object" && content !== null) {
    const block = parseContentBlock(content as Record<string, unknown>);
    if (block) blocks.push(block);
  }

  return blocks;
}

function parseContentBlock(item: Record<string, unknown>): ContentBlock | null {
  const type = item.type as string;

  if (type === "text" && typeof item.text === "string") {
    return { type: "text", text: item.text };
  }

  if (type === "resource" && typeof item.resource === "object" && item.resource !== null) {
    const resource = item.resource as Record<string, unknown>;
    const result: ResourceContentBlock = {
      type: "resource",
      resource: {
        uri: typeof resource.uri === "string" ? resource.uri : "",
      },
    };
    if (typeof resource.mimeType === "string") {
      result.resource.mimeType = resource.mimeType;
    } else {
      result.resource.mimeType = null;
    }
    if (typeof resource.text === "string") {
      result.resource.text = resource.text;
    }
    if (typeof resource.blob === "string") {
      result.resource.blob = resource.blob;
    }
    return result;
  }

  if (type === "resource_link" && typeof item.resourceLink === "object" && item.resourceLink !== null) {
    const resourceLink = item.resourceLink as Record<string, unknown>;
    return {
      type: "resource_link",
      resourceLink: {
        uri: typeof resourceLink.uri === "string" ? resourceLink.uri : "",
        mimeType: typeof resourceLink.mimeType === "string" ? resourceLink.mimeType : null,
      },
    };
  }

  return null;
}

function mergeContentBlocks(existing: ContentBlock[], incoming: ContentBlock[]): ContentBlock[] {
  const merged: ContentBlock[] = [...existing];

  for (const block of incoming) {
    if (block.type === "text") {
      const lastBlock = merged[merged.length - 1];
      if (lastBlock?.type === "text") {
        merged[merged.length - 1] = { type: "text", text: lastBlock.text + block.text };
      } else {
        merged.push(block);
      }
    } else {
      merged.push(block);
    }
  }

  return merged;
}

function generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateThoughtId(): string {
  return `thought_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateToolCallId(): string {
  return `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function mapToolCallKind(kind: string | undefined): ToolCallKind {
  switch (kind) {
    case "read":
    case "search":
    case "edit":
    case "write":
    case "execute":
    case "glob":
    case "grep":
      return kind;
    default:
      return "unknown";
  }
}

function mapToolCallStatus(status: string | undefined): ToolCallStatus {
  switch (status) {
    case "pending":
      return "pending";
    case "in_progress":
      return "in_progress";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return "pending";
  }
}

function mapPermissionRequestStatus(status: string | undefined): PermissionRequestStatus {
  switch (status) {
    case "approved":
      return "approved";
    case "denied":
      return "denied";
    case "cancelled":
      return "cancelled";
    case "pending":
    default:
      return "pending";
  }
}

function applyToolCall(state: NormalizedState, update: ToolCallUpdate): NormalizedToolCall | null {
  const toolCallId = update.toolCallId ?? generateToolCallId();
  const timestamp = getTimestamp(update);

  const existing = state.toolCalls.get(toolCallId);
  if (existing) {
    const updated: NormalizedToolCall = {
      ...existing,
      kind: update.kind ? mapToolCallKind(update.kind) : existing.kind,
      title: update.title ?? existing.title,
      ...(update.status ? { status: mapToolCallStatus(update.status) } : {}),
    };
    if (update.rawInput !== undefined) {
      updated.rawInput = update.rawInput;
    }
  if (update.rawOutput !== undefined) {
    const metadata = {
      truncated: update.rawOutput.metadata?.truncated ?? false,
    } as NonNullable<NormalizedToolCall["rawOutput"]>["metadata"];
    if (update.rawOutput.metadata?.loaded !== undefined) {
      metadata.loaded = update.rawOutput.metadata.loaded;
    }
    if (update.rawOutput.metadata?.preview !== undefined) {
      metadata.preview = update.rawOutput.metadata.preview;
    }
    if (update.rawOutput.metadata?.exit !== undefined) {
      metadata.exit = update.rawOutput.metadata.exit;
    }
    updated.rawOutput = {
      metadata,
      output: update.rawOutput.output ?? "",
    };
  }
    if (timestamp !== undefined) {
      updated.updatedAt = timestamp;
    }
    state.toolCalls.set(toolCallId, updated);
    return updated;
  }

  const toolCall: NormalizedToolCall = {
    toolCallId,
    kind: mapToolCallKind(update.kind),
    title: update.title ?? toolCallId,
    ...(update.status ? { status: mapToolCallStatus(update.status) } : {}),
  };
  if (update.rawInput !== undefined) {
    toolCall.rawInput = update.rawInput;
  }
  if (update.rawOutput !== undefined) {
    const metadata = {
      truncated: update.rawOutput.metadata?.truncated ?? false,
    } as NonNullable<NormalizedToolCall["rawOutput"]>["metadata"];
    if (update.rawOutput.metadata?.loaded !== undefined) {
      metadata.loaded = update.rawOutput.metadata.loaded;
    }
    if (update.rawOutput.metadata?.preview !== undefined) {
      metadata.preview = update.rawOutput.metadata.preview;
    }
    if (update.rawOutput.metadata?.exit !== undefined) {
      metadata.exit = update.rawOutput.metadata.exit;
    }
    toolCall.rawOutput = {
      metadata,
      output: update.rawOutput.output ?? "",
    };
  }
  if (timestamp !== undefined) {
    toolCall.createdAt = timestamp;
    toolCall.updatedAt = timestamp;
  }

  state.toolCalls.set(toolCallId, toolCall);
  state.timelineOrder.push({ type: "tool_call", id: toolCallId });
  return toolCall;
}

function applyToolCallUpdate(state: NormalizedState, update: ToolCallUpdate): NormalizedToolCall | null {
  return applyToolCall(state, update);
}

function applyPermissionRequest(state: NormalizedState, update: PermissionRequestUpdate): NormalizedPermissionRequest | null {
  if (update.requestId === undefined) {
    return null;
  }

  const requestId = update.requestId;
  const timestamp = update.timestamp ?? Date.now();

  const existing = state.permissionRequests.get(requestId);
  if (existing) {
    const updated: NormalizedPermissionRequest = {
      ...existing,
      status: update.status ? mapPermissionRequestStatus(update.status) : existing.status,
      ...(update.options !== undefined && { options: update.options }),
      ...(update.selectedOptionId !== undefined && { selectedOptionId: update.selectedOptionId }),
    };
    state.permissionRequests.set(requestId, updated);
    return updated;
  }

  const permissionRequest: NormalizedPermissionRequest = {
    requestId,
    sessionId: update.sessionId ?? "",
    toolCallId: update.toolCallId ?? "",
    options: update.options ?? [],
    status: mapPermissionRequestStatus(update.status),
    ...(update.selectedOptionId !== undefined && { selectedOptionId: update.selectedOptionId }),
    createdAt: timestamp,
  };

  state.permissionRequests.set(requestId, permissionRequest);
  state.timelineOrder.push({ type: "permission_request", id: requestId });
  return permissionRequest;
}

export function getMessages(state: NormalizedState): NormalizedMessage[] {
    return state.timelineOrder
        .filter((item) => item.type === "message")
        .map((item) => state.messages.get(item.id as string)!)
        .filter(Boolean);
}

export function getMessage(state: NormalizedState, id: string): NormalizedMessage | undefined {
    return state.messages.get(id);
}

export function getMessagesByTurn(state: NormalizedState, turnId: string): NormalizedMessage | undefined {
  const messageId = state.turnIdToMessageId.get(turnId);
  return messageId ? state.messages.get(messageId) : undefined;
}

export function getThoughts(state: NormalizedState): NormalizedThought[] {
  return Array.from(state.thoughts.values());
}

export function getToolCalls(state: NormalizedState): NormalizedToolCall[] {
  return Array.from(state.toolCalls.values());
}

export function getToolCall(state: NormalizedState, toolCallId: string): NormalizedToolCall | undefined {
  return state.toolCalls.get(toolCallId);
}

export function getTimeline(state: NormalizedState): TimelineItem[] {
  return state.timelineOrder
    .map((item) => {
      if (item.type === "message") {
        const msg = state.messages.get(item.id as string);
        return msg ? { type: "message" as const, id: item.id as string, data: msg } : null;
      } else if (item.type === "thought") {
        const thought = state.thoughts.get(item.id as string);
        return thought ? { type: "thought" as const, id: item.id as string, data: thought } : null;
      } else if (item.type === "tool_call") {
        const toolCall = state.toolCalls.get(item.id as string);
        return toolCall ? { type: "tool_call" as const, id: item.id as string, data: toolCall } : null;
      } else if (item.type === "permission_request") {
        const permissionRequest = state.permissionRequests.get(item.id as number);
        return permissionRequest ? { type: "permission_request" as const, id: item.id as number, data: permissionRequest } : null;
      }
      return null;
    })
    .filter((item): item is TimelineItem => item !== null);
}

export function getPermissionRequests(state: NormalizedState): NormalizedPermissionRequest[] {
  return Array.from(state.permissionRequests.values());
}

export function getPendingPermissionRequests(state: NormalizedState): NormalizedPermissionRequest[] {
  return Array.from(state.permissionRequests.values()).filter((req) => req.status === "pending");
}

export function getPermissionRequest(state: NormalizedState, requestId: number): NormalizedPermissionRequest | undefined {
  return state.permissionRequests.get(requestId);
}

export function updatePermissionRequestStatus(
  state: NormalizedState,
  requestId: number,
  status: PermissionRequestStatus,
  selectedOptionId?: string
): NormalizedPermissionRequest | undefined {
  const permissionRequest = state.permissionRequests.get(requestId);
  if (!permissionRequest) {
    return undefined;
  }

  const updated: NormalizedPermissionRequest = {
    ...permissionRequest,
    status,
    ...(selectedOptionId !== undefined && { selectedOptionId }),
  };

  state.permissionRequests.set(requestId, updated);
  return updated;
}