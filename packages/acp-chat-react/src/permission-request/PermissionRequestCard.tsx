import { memo, useCallback } from "react";
import type { NormalizedPermissionRequest } from "@acp/chat-core";

export interface PermissionRequestCardProps {
  request: NormalizedPermissionRequest;
  onRespond: (optionId: string) => void;
  onCancel?: () => void;
  className?: string;
}

function getButtonVariant(kind: string): "primary" | "secondary" {
  if (kind.startsWith("allow_")) {
    return "primary";
  }
  return "secondary";
}

export const PermissionRequestCard = memo(function PermissionRequestCard({
  request,
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
        <span
          className="acp-permission-request__label"
          style={{
            color: "var(--acp-permission-request-header-color, var(--acp-text-muted, #666))",
            fontSize: "var(--acp-font-size-sm, 12px)",
          }}
        >
          Permission Request
        </span>
        <div
          className="acp-permission-request__tool-call"
          style={{
            color: "var(--acp-text, #000)",
            fontSize: "var(--acp-font-size-md, 13px)",
            marginTop: "var(--acp-spacing-xs, 2px)",
          }}
        >
          <span data-acp-permission-request-tool-call-id>{request.toolCallId}</span>
        </div>
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
