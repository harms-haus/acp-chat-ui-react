import { memo, useCallback } from "react";
import type { NormalizedPermissionRequest, NormalizedToolCall, ToolCallKind } from "@harms-haus/acp-chat-core";

export interface PermissionRequestCardProps {
  request: NormalizedPermissionRequest;
  toolCall?: NormalizedToolCall | undefined;
  onRespond: (optionId: string) => void;
  onCancel?: () => void;
  className?: string;
}

function getButtonVariant(kind: string | undefined): "primary" | "secondary" {
  if (kind?.startsWith("allow_")) {
    return "primary";
  }
  return "secondary";
}

function getKindIcon(kind: ToolCallKind): string {
  switch (kind) {
    case "read":
      return "📖";
    case "write":
      return "✏️";
    case "edit":
      return "📝";
    case "execute":
      return "⚡";
    case "search":
      return "🔍";
    case "glob":
      return "🌐";
    case "grep":
      return "🔎";
    default:
      return "🔧";
  }
}

function getKindLabel(kind: ToolCallKind): string {
  switch (kind) {
    case "read":
      return "Read";
    case "write":
      return "Write";
    case "edit":
      return "Edit";
    case "execute":
      return "Execute";
    case "search":
      return "Search";
    case "glob":
      return "Glob";
    case "grep":
      return "Grep";
    default:
      return "Unknown";
  }
}

function getToolCallDetails(toolCall: NormalizedToolCall): string | null {
  const rawInput = toolCall.rawInput;
  if (!rawInput) return null;

  switch (toolCall.kind) {
    case "read":
    case "write":
    case "edit":
      if (rawInput.filePath) {
        return rawInput.filePath;
      }
      break;
    case "execute":
      if (rawInput.command) {
        return rawInput.command;
      }
      break;
    case "grep":
      if (rawInput.pattern) {
        return `Pattern: ${rawInput.pattern}`;
      }
      break;
    case "search":
    case "glob":
      if (rawInput.filePath) {
        return rawInput.filePath;
      }
      break;
    default:
      break;
  }

  return null;
}

export const PermissionRequestCard = memo(function PermissionRequestCard({
  request,
  toolCall,
  onRespond,
  onCancel,
  className = "",
}: PermissionRequestCardProps) {
  const handleOptionClick = useCallback(
    (optionId: string) => {
      onRespond(optionId);
    },
    [onRespond]
  );

  const handleCancel = useCallback(() => {
    onCancel?.();
  }, [onCancel]);

  const hasToolCall = toolCall !== undefined;
  const kind = hasToolCall ? toolCall.kind : undefined;
  const details = hasToolCall ? getToolCallDetails(toolCall) : null;

  return (
    <div
      data-acp-permission-request={request.requestId}
      data-acp-permission-status={request.status}
      data-acp-tool-call-id={request.toolCallId}
      className={`acp-permission-request ${className}`}
      style={{
        backgroundColor: "var(--acp-permission-request-bg, var(--acp-bg, #fff))",
        border: "1px solid var(--acp-permission-request-border, var(--acp-border, #ccc))",
        borderRadius: "var(--acp-radius-xl, 8px)",
        padding: "var(--acp-spacing-lg, 12px)",
      }}
    >
      <div
        className="acp-permission-request__header"
        style={{
          marginBottom: "var(--acp-spacing-md, 8px)",
        }}
      >
      {hasToolCall ? (
        <>
          <div
            className="acp-permission-request__kind-badge"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--acp-spacing-xs, 2px)",
                padding: "var(--acp-spacing-xs, 2px) var(--acp-spacing-sm, 4px)",
                backgroundColor: "var(--acp-permission-request-badge-bg, var(--acp-surface, #f5f5f5))",
                borderRadius: "var(--acp-radius-sm, 4px)",
                fontSize: "var(--acp-font-size-xs, 11px)",
                color: "var(--acp-permission-request-badge-color, var(--acp-text-muted, #666))",
                marginBottom: "var(--acp-spacing-xs, 2px)",
              }}
            >
              <span data-acp-permission-request-kind-icon>{kind && getKindIcon(kind)}</span>
              <span data-acp-permission-request-kind-label>{kind && getKindLabel(kind)}</span>
          </div>

          {details && (
            <div
              className="acp-permission-request__details"
                style={{
                  color: "var(--acp-text-muted, #666)",
                  fontSize: "var(--acp-font-size-sm, 12px)",
                  marginTop: "var(--acp-spacing-xs, 2px)",
                  fontFamily: "var(--acp-font-mono, monospace)",
                }}
              >
                <span data-acp-permission-request-details>{details}</span>
              </div>
            )}
          </>
      ) : (
        <span
          className="acp-permission-request__label"
          style={{
            color: "var(--acp-permission-request-header-color, var(--acp-text-muted, #666))",
            fontSize: "var(--acp-font-size-sm, 12px)",
          }}
        >
          Permission Request
        </span>
      )}
      </div>

      <div
        className="acp-permission-request__options"
        style={{
          display: "flex",
          gap: "var(--acp-spacing-sm, 4px)",
          flexWrap: "wrap",
        }}
      >
        {request.options.map((option) => {
          const variant = getButtonVariant(option.kind);
          const isPrimary = variant === "primary";

          return (
            <button
              key={option.optionId}
              data-acp-permission-request-option={option.optionId}
              data-acp-permission-request-option-kind={option.kind}
              type="button"
              onClick={() => handleOptionClick(option.optionId)}
              className={`acp-permission-request__button acp-permission-request__button--${variant}`}
              style={{
                padding: "var(--acp-spacing-sm, 4px) var(--acp-spacing-md, 8px)",
                borderRadius: "var(--acp-radius-md, 4px)",
                border: isPrimary
                  ? "1px solid var(--acp-permission-request-button-primary-border, var(--acp-accent, #0066cc))"
                  : "1px solid var(--acp-permission-request-button-secondary-border, var(--acp-border, #ccc))",
                backgroundColor: isPrimary
                  ? "var(--acp-permission-request-button-primary-bg, var(--acp-accent, #0066cc))"
                  : "var(--acp-permission-request-button-secondary-bg, transparent)",
                color: isPrimary
                  ? "var(--acp-permission-request-button-primary-color, #fff)"
                  : "var(--acp-permission-request-button-secondary-color, var(--acp-text, #000))",
                fontSize: "var(--acp-font-size-sm, 12px)",
                cursor: "pointer",
              }}
            >
              {option.name}
            </button>
          );
        })}

        {onCancel && (
          <button
            data-acp-permission-request-cancel
            type="button"
            onClick={handleCancel}
            className="acp-permission-request__button acp-permission-request__button--cancel"
            style={{
              padding: "var(--acp-spacing-sm, 4px) var(--acp-spacing-md, 8px)",
              borderRadius: "var(--acp-radius-md, 4px)",
              border: "1px solid var(--acp-permission-request-button-cancel-border, var(--acp-border, #ccc))",
              backgroundColor: "var(--acp-permission-request-button-cancel-bg, transparent)",
              color: "var(--acp-permission-request-button-cancel-color, var(--acp-text-muted, #666))",
              fontSize: "var(--acp-font-size-sm, 12px)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
});

PermissionRequestCard.displayName = "PermissionRequestCard";
