import { memo, useState, useMemo, useCallback, useEffect } from "react";
import type { ThoughtStackProps, ThoughtItem } from "./types.js";
import type { NormalizedThought, NormalizedToolCall } from "@acp/chat-core";
import type { Logger } from "../utils/logger.js";
import { noOpLogger } from "../utils/logger.js";

function isThoughtItem(item: ThoughtItem): item is { type: "thought"; id: string; data: NormalizedThought } {
  return item.type === "thought";
}

function isToolCallItem(item: ThoughtItem): item is { type: "tool_call"; id: string; data: NormalizedToolCall } {
  return item.type === "tool_call";
}

function ChevronRight({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function ChevronDown({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function DefaultClosedRenderer({
  isOpen,
  setIsOpen,
  group,
}: {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  group: ThoughtStackProps["group"];
}) {
  const thoughtCount = useMemo(() => {
    return group.items.filter(isThoughtItem).length;
  }, [group.items]);

  const toolCallCount = useMemo(() => {
    return group.items.filter(isToolCallItem).length;
  }, [group.items]);

  const triggerLabel = useMemo(() => {
    const parts: string[] = [];
    if (thoughtCount > 0) parts.push(`${thoughtCount} thought${thoughtCount !== 1 ? "s" : ""}`);
    if (toolCallCount > 0) parts.push(`${toolCallCount} tool call${toolCallCount !== 1 ? "s" : ""}`);
    return parts.join(", ") || "Reasoning";
  }, [thoughtCount, toolCallCount]);

  return (
    <button
      type="button"
      data-acp-thought-trigger
      onClick={() => setIsOpen(!isOpen)}
      className="acp-thought-stack__trigger"
    >
      <span data-acp-thought-trigger-indicator><ChevronRight size={16} /></span>
      <span data-acp-thought-trigger-label>{triggerLabel}</span>
    </button>
  );
}

function ThoughtContent({ thought }: { thought: NormalizedThought }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div data-acp-thought-content className="acp-thought-stack__content">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="acp-thought-stack__expand-btn"
      >
        <span>{isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
        <span className="acp-thought-stack__label">thinking</span>
      </button>
      {isExpanded && (
        <div className="acp-thought-stack__expanded-content">
          {thought.content}
        </div>
      )}
    </div>
  );
}

function ToolCallContent({ toolCall }: { toolCall: NormalizedToolCall }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div data-acp-thought-item-tool-call className="acp-thought-stack__content">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="acp-thought-stack__expand-btn"
      >
        <span>{isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
        <span className="acp-thought-stack__label">{toolCall.title || toolCall.kind}</span>
        {toolCall.rawInput?.filePath && (
          <span className="acp-thought-stack__filepath">{toolCall.rawInput.filePath}</span>
        )}
      </button>
      {isExpanded && toolCall.rawOutput && (
        <div className="acp-thought-stack__expanded-content">
          {toolCall.rawOutput.output}
        </div>
      )}
    </div>
  );
}

function DefaultOpenRenderer({
  isOpen,
  setIsOpen,
  group,
}: {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  group: ThoughtStackProps["group"];
}) {
  return (
    <div data-acp-thought-panel>
      <button
        type="button"
        data-acp-thought-trigger
        onClick={() => setIsOpen(!isOpen)}
        className="acp-thought-stack__trigger acp-thought-stack__trigger--open"
      >
        <span data-acp-thought-trigger-indicator><ChevronDown size={16} /></span>
        <span>Hide reasoning</span>
      </button>
      <div data-acp-thought-items>
        {group.items.map((item) => (
          <div
            key={item.id}
            data-acp-thought-item
            data-acp-thought-item-type={item.type}
            className={`acp-thought-stack__item acp-thought-stack__item--${item.type === "thought" ? "thought" : "tool-call"}`}
          >
            {isThoughtItem(item) ? (
              <ThoughtContent thought={item.data} />
            ) : isToolCallItem(item) ? (
              <ToolCallContent toolCall={item.data} />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export const ThoughtStack = memo(function ThoughtStack({
  group,
  isActive = false,
  defaultOpen = false,
  defaultOpenWhenActive = true,
  defaultOpenWhenIdle = false,
  className = "",
  renderClosed,
  renderOpen,
  logger = noOpLogger,
}: ThoughtStackProps) {
  const [hasBeenActive, setHasBeenActive] = useState(() => isActive);
  const [wasActive, setWasActive] = useState(() => isActive);
  const [isOpen, setIsOpen] = useState(() => {
    if (isActive) return defaultOpenWhenActive;
    return defaultOpen;
  });

  useEffect(() => {
    if (isActive && !hasBeenActive) {
      setHasBeenActive(true);
    }
  }, [isActive, hasBeenActive]);

  useEffect(() => {
    if (isActive !== wasActive) {
      setWasActive(isActive);
      const shouldBeOpen = isActive
        ? defaultOpenWhenActive
        : hasBeenActive && wasActive
          ? defaultOpenWhenIdle
          : defaultOpen;
      if (isOpen !== shouldBeOpen) {
        setIsOpen(shouldBeOpen);
      }
    }
  }, [isActive, wasActive, hasBeenActive, isOpen, defaultOpen, defaultOpenWhenActive, defaultOpenWhenIdle]);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const context = useMemo(
    () => ({
      isOpen,
      setIsOpen,
      toggle,
      items: group.items,
      group,
    }),
    [isOpen, toggle, group]
  );

  return (
    <div
      data-acp-thought-root
      data-acp-thought-group-id={group.id}
      data-acp-thought-active={isActive}
      data-acp-thought-open={isOpen}
      data-acp-thought-item-count={group.items.length}
      className={`acp-thought-stack ${className}`}
    >
      {isOpen
        ? renderOpen?.(context) ?? <DefaultOpenRenderer isOpen={isOpen} setIsOpen={setIsOpen} group={group} />
        : renderClosed?.(context) ?? <DefaultClosedRenderer isOpen={isOpen} setIsOpen={setIsOpen} group={group} />}
    </div>
  );
});

ThoughtStack.displayName = "ThoughtStack";
