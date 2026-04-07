import type { NormalizedThought, NormalizedToolCall, SessionController } from "@acp/chat-core";
import type { ReactNode } from "react";
import type { Logger } from "../utils/logger.js";

export interface ThoughtItem {
  type: "thought" | "tool_call";
  id: string;
  data: NormalizedThought | NormalizedToolCall;
}

export interface ThoughtGroup {
  id: string;
  items: ThoughtItem[];
  startTime: number;
  endTime: number;
}

export interface ThoughtGroupWithState extends ThoughtGroup {
  isActive: boolean;
}

export interface ThoughtStackRenderContext {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggle: () => void;
  items: ThoughtItem[];
  group: ThoughtGroup;
}

export interface ThoughtStackProps {
  group: ThoughtGroup;
  isActive?: boolean;
  controller?: SessionController;
  defaultOpen?: boolean;
  defaultOpenWhenActive?: boolean;
  defaultOpenWhenIdle?: boolean;
  className?: string;
  renderClosed?: ((context: ThoughtStackRenderContext) => ReactNode);
  renderOpen?: ((context: ThoughtStackRenderContext) => ReactNode);
  logger?: Logger;
  expandedItems?: Set<string>;
  onExpansionChange?: (expandedItems: Set<string>) => void;
  onThoughtCreated?: (thoughtId: string, groupId: string) => void;
  onThoughtCompleted?: (thoughtId: string, groupId: string) => void;
  onToolCreated?: (toolId: string, groupId: string) => void;
  onToolCompleted?: (toolId: string, groupId: string) => void;
  onThoughtGroupCompleted?: (groupId: string) => void;
  follow?: boolean;
}

export interface ThoughtItemProps {
  thought: NormalizedThought;
  isLast?: boolean;
}

export interface ThoughtItemRenderProps {
  thought: NormalizedThought;
  index: number;
  total: number;
}

export interface ThoughtContentProps {
  thought: NormalizedThought;
  isExpanded: boolean;
  onExpandChange?: ((expanded: boolean) => void) | undefined;
  onCreated?: () => void;
  onCompleted?: () => void;
  follow?: boolean | undefined;
  controller?: SessionController | undefined;
}

export interface ToolCallContentProps {
  toolCall: NormalizedToolCall;
  isExpanded: boolean;
  onExpandChange?: ((expanded: boolean) => void) | undefined;
  onCreated?: () => void;
  onCompleted?: () => void;
  follow?: boolean | undefined;
  controller?: SessionController | undefined;
}
