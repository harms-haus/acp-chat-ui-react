import { memo, useState, useCallback } from "react";
import { Collapsible } from "@base-ui-components/react/collapsible";
import type { ToolCallProps } from "./types.js";
import { noOpLogger } from "../utils/logger.js";

const ToolCallHeader = memo(function ToolCallHeader({
  toolCall,
  isExpanded,
}: {
  toolCall: ToolCallProps["toolCall"];
  isExpanded: boolean;
}) {
  const statusIcon = toolCall.status === "completed" ? "✓" : "○";
  const statusClass = `acp-tool-call__status--${toolCall.status ?? "pending"}`;

  return (
    <div
      data-acp-tool-call-header
      data-acp-tool-call-status={toolCall.status ?? "pending"}
      className="acp-tool-call__header"
    >
      <span data-acp-tool-call-status-icon className={`acp-tool-call__status-icon ${statusClass}`}>
        {statusIcon}
      </span>
      <span data-acp-tool-call-kind className="acp-tool-call__kind">
        {toolCall.kind}
      </span>
      <span data-acp-tool-call-title className="acp-tool-call__title">
        {toolCall.title}
      </span>
      <span data-acp-tool-call-expand-indicator className="acp-tool-call__expand-indicator">
        {isExpanded ? "v" : ">"}
      </span>
    </div>
  );
});

ToolCallHeader.displayName = "ToolCallHeader";

const ToolCallDetails = memo(function ToolCallDetails({
  toolCall,
}: {
  toolCall: ToolCallProps["toolCall"];
}) {
  return (
    <div data-acp-tool-call-details className="acp-tool-call__details">
      {toolCall.rawInput && (
        <div data-acp-tool-call-input className="acp-tool-call__input">
          <h4>Input</h4>
          <pre>{JSON.stringify(toolCall.rawInput, null, 2)}</pre>
        </div>
      )}
      {toolCall.rawOutput?.output && (
        <div data-acp-tool-call-output className="acp-tool-call__output">
          <h4>Output</h4>
          <pre>{toolCall.rawOutput.output}</pre>
        </div>
      )}
      {toolCall.rawOutput?.metadata && (
        <div data-acp-tool-call-metadata className="acp-tool-call__metadata">
          <h4>Metadata</h4>
          <pre>{JSON.stringify(toolCall.rawOutput.metadata, null, 2)}</pre>
        </div>
      )}
    </div>
  );
});

ToolCallDetails.displayName = "ToolCallDetails";

export const ToolCall = memo(function ToolCall({
  toolCall,
  isExpanded: controlledExpanded,
  onToggle,
  className = "",
  logger: _logger = noOpLogger,
}: ToolCallProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = controlledExpanded ?? internalExpanded;

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (controlledExpanded === undefined) {
        setInternalExpanded(open);
      }
      onToggle?.();
    },
    [controlledExpanded, onToggle]
  );

  return (
    <div
      data-acp-tool-call-root
      data-acp-tool-call-id={toolCall.toolCallId}
      data-acp-tool-call-kind={toolCall.kind}
      data-acp-tool-call-status={toolCall.status ?? "pending"}
      data-acp-tool-call-expanded={isExpanded}
      className={`acp-tool-call ${className}`}
    >
      <Collapsible.Root open={isExpanded} onOpenChange={handleOpenChange}>
        <Collapsible.Trigger
          data-acp-tool-call-trigger
          className="acp-tool-call__trigger"
        >
          <ToolCallHeader toolCall={toolCall} isExpanded={isExpanded} />
        </Collapsible.Trigger>

        <Collapsible.Panel
          data-acp-tool-call-panel
          className="acp-tool-call__panel"
        >
          <ToolCallDetails toolCall={toolCall} />
        </Collapsible.Panel>
      </Collapsible.Root>
    </div>
  );
});

ToolCall.displayName = "ToolCall";
