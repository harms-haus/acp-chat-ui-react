import { memo, useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { ThoughtStackProps, ThoughtItem } from "./types.js";
import type { NormalizedThought, NormalizedToolCall, SessionController } from "@acp/chat-core";
import type { Logger } from "../utils/logger.js";
import { noOpLogger } from "../utils/logger.js";

function isThoughtItem(item: ThoughtItem): item is { type: "thought"; id: string; data: NormalizedThought } {
  return item.type === "thought";
}

function isToolCallItem(item: ThoughtItem): item is { type: "tool_call"; id: string; data: NormalizedToolCall } {
  return item.type === "tool_call";
}

function isThoughtExpanded(item: ThoughtItem, expandedItems?: Set<string>): boolean {
  if (!expandedItems) return false;
  return expandedItems.has(item.id);
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

function ThoughtContent({
  thought,
  isExpanded,
  onExpandChange,
  onCreated,
  onCompleted,
  follow = false,
  controller,
}: {
  thought: NormalizedThought;
  isExpanded: boolean;
  onExpandChange?: ((expanded: boolean) => void) | undefined;
  onCreated?: () => void;
  onCompleted?: () => void;
  follow?: boolean;
  controller?: SessionController;
}) {
  const wasCompleted = useRef(false);
  const userHasInteracted = useRef(false);
  const autoExpanded = useRef(false);
  const hasEmittedCreated = useRef(false);
  const [internalExpanded, setInternalExpanded] = useState(false);

  // Check completion status directly from normalized thought
  const isCompleted = thought.status === "completed";

  console.log('[ThoughtContent] Thought status for thought:', thought.id, thought.status);
  console.log('[ThoughtContent] isCompleted:', isCompleted);

  // Use internal state if no parent handler is provided
  const effectiveIsExpanded = onExpandChange ? isExpanded : internalExpanded;
  console.log('[ThoughtContent] State:', {
    thoughtId: thought.id,
    effectiveIsExpanded,
    internalExpanded,
    hasOnExpandChange: !!onExpandChange,
    isExpandedProp: isExpanded
  });
  const handleExpand = useCallback((expanded: boolean) => {
    if (onExpandChange) {
      onExpandChange(expanded);
    } else {
      setInternalExpanded(expanded);
    }
  }, [onExpandChange]);

  useEffect(() => {
    if (follow && thought.status === "streaming" && !hasEmittedCreated.current) {
      hasEmittedCreated.current = true;
      console.log('[ThoughtContent] Created (status-based):', { 
        thoughtId: thought.id, 
        follow, 
        status: thought.status,
        userHasInteracted: userHasInteracted.current,
        willAutoExpand: !userHasInteracted.current
      });
      onCreated?.();
      if (!userHasInteracted.current) {
        console.log('[ThoughtContent] Auto-expanding thought (status-based)');
        handleExpand(true);
        autoExpanded.current = true;
      }
    }
  }, [follow, thought.status, handleExpand, onCreated, thought.id]);

  useEffect(() => {
    console.log('[ThoughtContent] Completion check:', {
      wasCompleted: wasCompleted.current,
      isCompleted,
      hasOnCompleted: !!onCompleted,
      userHasInteracted: userHasInteracted.current,
      autoExpanded: autoExpanded.current,
      effectiveIsExpanded
    });
    if (!wasCompleted.current && isCompleted && onCompleted) {
      wasCompleted.current = true;
      console.log('[ThoughtContent] Thought completed (status-based):', {
        thoughtId: thought.id,
        autoExpanded: autoExpanded.current,
        userInteracted: userHasInteracted.current,
        isExpanded: effectiveIsExpanded
      });
      console.log('[ThoughtContent] Collapse check:', {
        userHasInteracted: userHasInteracted.current,
        autoExpanded: autoExpanded.current,
        effectiveIsExpanded
      });
      if (!userHasInteracted.current && autoExpanded.current && effectiveIsExpanded) {
        console.log('[ThoughtContent] Auto-collapsing thought');
        handleExpand(false);
      }
      onCompleted();
    }
  }, [isCompleted, onCompleted, handleExpand, effectiveIsExpanded, thought.id]);

  const handleClick = useCallback(() => {
    userHasInteracted.current = true;
    handleExpand(!effectiveIsExpanded);
  }, [effectiveIsExpanded, handleExpand]);

  return (
    <div data-acp-thought-content className="acp-thought-stack__content">
      <button
        type="button"
        onClick={handleClick}
        className="acp-thought-stack__expand-btn"
      >
        <span>{effectiveIsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
        <span className="acp-thought-stack__label">thinking</span>
      </button>
      {effectiveIsExpanded && (
        <div className="acp-thought-stack__expanded-content">
          {thought.content}
        </div>
      )}
    </div>
  );
}

function ToolCallContent({
  toolCall,
  isExpanded,
  onExpandChange,
  onCreated,
  onCompleted,
  follow = false,
  controller,
}: {
  toolCall: NormalizedToolCall;
  isExpanded: boolean;
  onExpandChange?: ((expanded: boolean) => void) | undefined;
  onCreated?: () => void;
  onCompleted?: () => void;
  follow?: boolean;
  controller?: SessionController;
}) {
  const wasCompleted = useRef(false);
  const userHasInteracted = useRef(false);
  const autoExpanded = useRef(false);
  const hasEmittedCreated = useRef(false);
  const [internalExpanded, setInternalExpanded] = useState(false);
  
  const isCompleted = toolCall.status === "completed";
  
  // Use internal state if no parent handler is provided
  const effectiveIsExpanded = onExpandChange ? isExpanded : internalExpanded;
  const handleExpand = useCallback((expanded: boolean) => {
    if (onExpandChange) {
      onExpandChange(expanded);
    } else {
      setInternalExpanded(expanded);
    }
  }, [onExpandChange]);

  useEffect(() => {
    if (follow && toolCall.status === "in_progress" && !hasEmittedCreated.current) {
      hasEmittedCreated.current = true;
      console.log('[ToolCallContent] Created (status-based):', { 
        toolId: toolCall.toolCallId, 
        follow, 
        status: toolCall.status,
        willAutoExpand: !userHasInteracted.current 
      });
      onCreated?.();
      if (!userHasInteracted.current) {
        handleExpand(true);
        autoExpanded.current = true;
      }
    }
  }, [follow, toolCall.status, handleExpand, onCreated, toolCall.toolCallId]);

  useEffect(() => {
    if (!wasCompleted.current && isCompleted && onCompleted) {
      wasCompleted.current = true;
      console.log('[ToolCallContent] Tool completed (status-based):', { 
        toolId: toolCall.toolCallId,
        autoExpanded: autoExpanded.current,
        userInteracted: userHasInteracted.current,
        isExpanded: effectiveIsExpanded
      });
      if (!userHasInteracted.current && autoExpanded.current && effectiveIsExpanded) {
        console.log('[ToolCallContent] Auto-collapsing tool');
        handleExpand(false);
      }
      onCompleted();
    }
  }, [isCompleted, onCompleted, handleExpand, effectiveIsExpanded, toolCall.toolCallId]);

  const handleClick = useCallback(() => {
    userHasInteracted.current = true;
    handleExpand(!effectiveIsExpanded);
  }, [effectiveIsExpanded, handleExpand]);

  return (
    <div data-acp-thought-item-tool-call className="acp-thought-stack__content">
      <button
        type="button"
        onClick={handleClick}
        className="acp-thought-stack__expand-btn"
      >
        <span>{effectiveIsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
        <span className="acp-thought-stack__label">{toolCall.title || toolCall.kind}</span>
        {toolCall.rawInput?.filePath && (
          <span className="acp-thought-stack__filepath">{toolCall.rawInput.filePath}</span>
        )}
      </button>
      {effectiveIsExpanded && toolCall.rawOutput && (
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
  expandedItems,
  onExpansionChange,
  onThoughtCreated,
  onThoughtCompleted,
  onToolCreated,
  onToolCompleted,
  follow,
  controller,
}: {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  group: ThoughtStackProps["group"];
  expandedItems?: Set<string> | undefined;
  onExpansionChange?: ((expandedItems: Set<string>) => void) | undefined;
  onThoughtCreated?: ((thoughtId: string, groupId: string) => void) | undefined;
  onThoughtCompleted?: ((thoughtId: string, groupId: string) => void) | undefined;
  onToolCreated?: ((toolId: string, groupId: string) => void) | undefined;
  onToolCompleted?: ((toolId: string, groupId: string) => void) | undefined;
  follow?: boolean;
  controller?: SessionController | undefined;
}) {
  console.log('[DefaultOpenRenderer] Rendering with:', { 
    groupId: group.id, 
    follow, 
    hasOnExpansionChange: !!onExpansionChange,
    itemCount: group.items.length 
  });
  
  // Only create handlers if parent provides onExpansionChange
  const handleThoughtExpand = useCallback((thoughtId: string, expanded: boolean) => {
    if (!onExpansionChange) return;
    const newExpanded = new Set<string>(expandedItems ?? new Set<string>());
    if (expanded) {
      newExpanded.add(thoughtId);
    } else {
      newExpanded.delete(thoughtId);
    }
    onExpansionChange(newExpanded);
  }, [onExpansionChange, expandedItems]);

  const handleToolExpand = useCallback((toolId: string, expanded: boolean) => {
    if (!onExpansionChange) return;
    const newExpanded = new Set<string>(expandedItems ?? new Set<string>());
    if (expanded) {
      newExpanded.add(toolId);
    } else {
      newExpanded.delete(toolId);
    }
    onExpansionChange(newExpanded);
  }, [onExpansionChange, expandedItems]);
  
  // Pass handlers only if onExpansionChange is provided, otherwise children use internal state
  const thoughtExpandHandler = onExpansionChange ? handleThoughtExpand : undefined;
  const toolExpandHandler = onExpansionChange ? handleToolExpand : undefined;

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
              <ThoughtContent
                thought={item.data}
                isExpanded={isThoughtExpanded(item, expandedItems)}
                onExpandChange={thoughtExpandHandler ? ((expanded: boolean) => handleThoughtExpand(item.id, expanded)) : undefined}
                onCreated={() => {
                  console.log('[ThoughtStack] Thought onCreated called for:', item.id);
                  onThoughtCreated?.(item.id, group.id);
                }}
                onCompleted={() => {
                  console.log('[ThoughtStack] Thought onCompleted called for:', item.id);
                  onThoughtCompleted?.(item.id, group.id);
                }}
                follow={follow ?? false}
                {...(controller ? { controller } : {})}
              />
            ) : isToolCallItem(item) ? (
              <ToolCallContent
                toolCall={item.data}
                isExpanded={isThoughtExpanded(item, expandedItems)}
                onExpandChange={(() => {
                  const handler = toolExpandHandler ? ((expanded: boolean) => handleToolExpand(item.id, expanded)) : undefined;
                  console.log('[ThoughtStack] Passing to ToolCallContent:', {
                    toolId: item.id,
                    hasOnExpandChange: !!handler,
                    follow: follow ?? false
                  });
                  return handler;
                })()}
                onCreated={() => {
                  console.log('[ThoughtStack] Tool onCreated called for:', item.id);
                  onToolCreated?.(item.id, group.id);
                }}
                onCompleted={() => {
                  console.log('[ThoughtStack] Tool onCompleted called for:', item.id);
                  onToolCompleted?.(item.id, group.id);
                }}
                follow={follow ?? false}
                {...(controller ? { controller } : {})}
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export const ThoughtStack = memo(function ThoughtStack({
  group,
  defaultOpen = false,
  defaultOpenWhenActive = true,
  defaultOpenWhenIdle = false,
  className = "",
  renderClosed,
  renderOpen,
  logger = noOpLogger,
  expandedItems,
  onExpansionChange,
  onThoughtCreated,
  onThoughtCompleted,
  onToolCreated,
  onToolCompleted,
  onThoughtGroupCompleted,
  follow = false,
  controller,
}: ThoughtStackProps & { controller?: SessionController }) {
  const isActive = useMemo(() => {
    return group.items.some(item => {
      if (item.type === "thought") {
        const thought = item.data as NormalizedThought;
        return thought.status === "streaming";
      } else if (item.type === "tool_call") {
        const toolCall = item.data as NormalizedToolCall;
        return toolCall.status === "in_progress" || toolCall.status === "pending";
      }
      return false;
    });
  }, [group.items]);
  
  const [hasBeenActive, setHasBeenActive] = useState(() => isActive);
  const userHasToggled = useRef(false);
  const [isOpen, setIsOpen] = useState(() => {
    if (isActive) return defaultOpenWhenActive;
    return defaultOpen;
  });

  const seenItemsRef = useRef<Set<string>>(new Set());
  const completedItemsRef = useRef<Set<string>>(new Set());
  const lastGroupIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isActive && !hasBeenActive) {
      setHasBeenActive(true);
    }
  }, [isActive, hasBeenActive]);

  // Auto-open when follow=true and group has items
  useEffect(() => {
    if (follow && group.items.length > 0 && !userHasToggled.current && !isOpen) {
      console.log('[ThoughtStack] Auto-opening container (follow mode, has items):', { 
        groupId: group.id, 
        itemCount: group.items.length,
        follow, 
        userHasToggled: userHasToggled.current 
      });
      setIsOpen(true);
    }
  }, [follow, group.items.length, isOpen, group.id]);

  useEffect(() => {
    if (follow && isActive && !userHasToggled.current && !isOpen) {
      console.log('[ThoughtStack] Auto-opening from isActive effect');
      setIsOpen(true);
    } else if (!follow && isActive && !isOpen) {
      console.log('[ThoughtStack] Setting open state (non-follow mode): true');
      setIsOpen(true);
    }
  }, [isActive, isOpen, follow]);

  // Detect item creation and completion
  useEffect(() => {
    const currentItems = group.items;
    
    // Clear refs when group changes
    if (lastGroupIdRef.current !== group.id) {
      seenItemsRef.current.clear();
      completedItemsRef.current.clear();
      lastGroupIdRef.current = group.id;
    }
    
    // Check for new items (creation)
    for (const item of currentItems) {
      if (!seenItemsRef.current.has(item.id)) {
        seenItemsRef.current.add(item.id);
        if (isThoughtItem(item)) {
          onThoughtCreated?.(item.id, group.id);
        } else if (isToolCallItem(item)) {
          onToolCreated?.(item.id, group.id);
        }
      }
    }

    // Check for completed items
    for (const item of currentItems) {
        if (!completedItemsRef.current.has(item.id)) {
          let isCompleted = false;
          if (isToolCallItem(item)) {
            const status = (item.data as any).status;
            isCompleted = status === "completed";
          } else if (isThoughtItem(item)) {
            const itemIndex = currentItems.findIndex(i => i.id === item.id);
            isCompleted = itemIndex < currentItems.length - 1;
          }

          if (isCompleted) {
            completedItemsRef.current.add(item.id);
            if (isThoughtItem(item)) {
              onThoughtCompleted?.(item.id, group.id);
            } else if (isToolCallItem(item)) {
              onToolCompleted?.(item.id, group.id);
            }
          }
        }
    }

    // Check if entire group is completed
    const allItemsCompleted = currentItems.length > 0 && 
      currentItems.every(item => completedItemsRef.current.has(item.id));
    
    if (allItemsCompleted && !completedItemsRef.current.has(`group-${group.id}`)) {
      completedItemsRef.current.add(`group-${group.id}`);
      onThoughtGroupCompleted?.(group.id);
    }
  }, [group.items, group.id, onThoughtCreated, onThoughtCompleted, onToolCreated, onToolCompleted, onThoughtGroupCompleted]);

  const toggle = useCallback(() => {
    userHasToggled.current = true;
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
        ? renderOpen?.(context) ?? (
            <DefaultOpenRenderer
              isOpen={isOpen}
              setIsOpen={setIsOpen}
              group={group}
              expandedItems={expandedItems}
              onExpansionChange={onExpansionChange}
              onThoughtCreated={onThoughtCreated}
              onThoughtCompleted={onThoughtCompleted}
              onToolCreated={onToolCreated}
              onToolCompleted={onToolCompleted}
              follow={follow}
              controller={controller}
            />
          )
        : renderClosed?.(context) ?? <DefaultClosedRenderer isOpen={isOpen} setIsOpen={setIsOpen} group={group} />}
    </div>
  );
});

ThoughtStack.displayName = "ThoughtStack";
