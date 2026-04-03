import type { NormalizedThought, NormalizedToolCall } from "@acp/chat-core";
import type { ReactNode } from "react";

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
  isActive?: boolean | undefined;
  defaultOpen?: boolean | undefined;
  defaultOpenWhenActive?: boolean | undefined;
  defaultOpenWhenIdle?: boolean | undefined;
  className?: string | undefined;
  renderClosed?: ((context: ThoughtStackRenderContext) => ReactNode) | undefined;
  renderOpen?: ((context: ThoughtStackRenderContext) => ReactNode) | undefined;
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
