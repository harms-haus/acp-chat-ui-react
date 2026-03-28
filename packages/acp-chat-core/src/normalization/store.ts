export type MessageRole = "user" | "agent";

export type MessageStatus = "streaming" | "complete" | "cancelled" | "error";

export type ContentBlockType = "text" | "resource" | "resource_link";

export interface TextContentBlock {
  type: "text";
  text: string;
}

export interface ResourceContentBlock {
  type: "resource";
  resource: {
    uri: string;
    mimeType?: string | undefined;
    text?: string | undefined;
    blob?: string | undefined;
  };
}

export interface ResourceLinkContentBlock {
  type: "resource_link";
  resourceLink: {
    uri: string;
    mimeType?: string | undefined;
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
  createdAt?: number;
  updatedAt?: number;
}

export type ToolCallKind = "read" | "search" | "edit" | "write" | "execute" | "glob" | "grep" | "unknown";

export type ToolCallStatus = "pending" | "completed";

export interface NormalizedToolCall {
  toolCallId: string;
  kind: ToolCallKind;
  title: string;
  status: ToolCallStatus;
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

export type TimelineItem =
  | { type: "message"; id: string; data: NormalizedMessage }
  | { type: "thought"; id: string; data: NormalizedThought }
  | { type: "tool_call"; id: string; data: NormalizedToolCall };

export type TimelineItemType = "message" | "thought" | "tool_call";

export interface NormalizedState {
  messages: Map<string, NormalizedMessage>;
  thoughts: Map<string, NormalizedThought>;
  toolCalls: Map<string, NormalizedToolCall>;
  timelineOrder: Array<{ type: TimelineItemType; id: string }>;
  turnIdToMessageId: Map<string, string>;
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

type AcpUpdate = AgentMessageChunk | UserMessage | ToolCallUpdate | { type?: string; sessionUpdate?: string; [key: string]: unknown };

export function createNormalizedState(): NormalizedState {
  return {
    messages: new Map(),
    thoughts: new Map(),
    toolCalls: new Map(),
    timelineOrder: [],
    turnIdToMessageId: new Map(),
  };
}

function getUpdateType(update: AcpUpdate): string | undefined {
    return update.sessionUpdate ?? update.type;
}

export function applySessionUpdate(state: NormalizedState, params: SessionUpdateParams): NormalizedMessage | NormalizedThought | NormalizedToolCall | null {
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

  if (turnId) {
    const existingId = state.turnIdToMessageId.get(turnId);
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
        return updated;
      }
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
  }
  if (timestamp !== undefined) {
    message.createdAt = timestamp;
    message.updatedAt = timestamp;
  }

  state.messages.set(id, message);
  state.timelineOrder.push({ type: "message", id });
  if (turnId) {
    state.turnIdToMessageId.set(turnId, id);
  }

  return message;
}

function mapChunkStatus(status: string | undefined): MessageStatus {
switch (status) {
case "in_progress":
return "streaming";
case "done":
return "complete";
case "cancelled":
return "cancelled";
case "error":
return "error";
default:
return "complete";
}
}

function applyUserMessage(state: NormalizedState, update: UserMessage): NormalizedMessage | null {
  const turnId = update.turnId ?? (update as Record<string, unknown>)["turn_id"] as string | undefined;

  if (turnId) {
    const existingId = state.turnIdToMessageId.get(turnId);
    if (existingId) {
      return state.messages.get(existingId) ?? null;
    }
  }

  const timestamp = getTimestamp(update);
  const id = generateMessageId();
  const message: NormalizedMessage = {
    id,
    role: "user",
    status: "complete",
    content: extractText(update.content),
    contentBlocks: extractContentBlocks(update.content),
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
  }

  return message;
}

function applyAgentThoughtChunk(state: NormalizedState, update: AgentMessageChunk): NormalizedThought {
  const text = extractText(update.content);
  const timestamp = getTimestamp(update);
  const id = generateThoughtId();

  const thought: NormalizedThought = {
    id,
    content: text,
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
    return {
      type: "resource",
      resource: {
        uri: typeof resource.uri === "string" ? resource.uri : "",
        mimeType: typeof resource.mimeType === "string" ? resource.mimeType : undefined,
        text: typeof resource.text === "string" ? resource.text : undefined,
        blob: typeof resource.blob === "string" ? resource.blob : undefined,
      },
    };
  }

  if (type === "resource_link" && typeof item.resourceLink === "object" && item.resourceLink !== null) {
    const resourceLink = item.resourceLink as Record<string, unknown>;
    return {
      type: "resource_link",
      resourceLink: {
        uri: typeof resourceLink.uri === "string" ? resourceLink.uri : "",
        mimeType: typeof resourceLink.mimeType === "string" ? resourceLink.mimeType : undefined,
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
    case "completed":
      return "completed";
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
      status: update.status ? mapToolCallStatus(update.status) : existing.status,
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
    status: mapToolCallStatus(update.status),
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

export function getMessages(state: NormalizedState): NormalizedMessage[] {
    return state.timelineOrder
        .filter((item) => item.type === "message")
        .map((item) => state.messages.get(item.id)!)
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
        const msg = state.messages.get(item.id);
        return msg ? { type: "message" as const, id: item.id, data: msg } : null;
      } else if (item.type === "thought") {
        const thought = state.thoughts.get(item.id);
        return thought ? { type: "thought" as const, id: item.id, data: thought } : null;
      } else if (item.type === "tool_call") {
        const toolCall = state.toolCalls.get(item.id);
        return toolCall ? { type: "tool_call" as const, id: item.id, data: toolCall } : null;
      }
      return null;
    })
    .filter((item): item is TimelineItem => item !== null);
}