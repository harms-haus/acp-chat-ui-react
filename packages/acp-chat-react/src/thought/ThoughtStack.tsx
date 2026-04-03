import { memo, useState, useMemo, useCallback, useEffect } from "react";
import type { ThoughtStackProps, ThoughtItem } from "./types.js";
import type { NormalizedThought, NormalizedToolCall } from "@acp/chat-core";

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
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "4px 8px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontSize: "14px",
        color: "inherit",
      }}
    >
      <span data-acp-thought-trigger-indicator><ChevronRight size={16} /></span>
      <span data-acp-thought-trigger-label>{triggerLabel}</span>
    </button>
  );
}

function ThoughtContent({ thought }: { thought: NormalizedThought }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div data-acp-thought-content style={{ marginBottom: "4px" }}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "2px 0",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: "13px",
          color: "inherit",
        }}
      >
        <span>{isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
        <span style={{ fontWeight: 600 }}>thinking</span>
      </button>
      {isExpanded && (
        <div style={{ marginLeft: "16px", marginTop: "4px", fontSize: "12px", opacity: 0.8 }}>
          {thought.content}
        </div>
      )}
    </div>
  );
}

function ToolCallContent({ toolCall }: { toolCall: NormalizedToolCall }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div data-acp-thought-item-tool-call style={{ marginBottom: "4px" }}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "2px 0",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: "13px",
          color: "inherit",
        }}
      >
        <span>{isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
        <span style={{ fontWeight: 600 }}>{toolCall.title || toolCall.kind}</span>
        {toolCall.rawInput?.filePath && (
          <span style={{ opacity: 0.7 }}>{toolCall.rawInput.filePath}</span>
        )}
      </button>
      {isExpanded && toolCall.rawOutput && (
        <div style={{ marginLeft: "16px", marginTop: "4px", fontSize: "12px", opacity: 0.8 }}>
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
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "4px 8px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: "14px",
          color: "inherit",
          marginBottom: "8px",
        }}
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
