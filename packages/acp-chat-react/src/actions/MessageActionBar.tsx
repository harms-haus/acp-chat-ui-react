import { memo, useCallback, useState } from "react";
import { Menu } from "@base-ui-components/react/menu";
import { Separator } from "@base-ui-components/react/separator";
import type { MessageActionBarProps } from "./types.js";

export const MessageActionBar = memo(function MessageActionBar({
  message,
  actions,
  onCopy,
  className = "",
}: MessageActionBarProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleCopy = useCallback(() => {
    const textToCopy = message.content || "";
    navigator.clipboard.writeText(textToCopy).catch((err) => {
      console.error("Failed to copy message:", err);
    });
    onCopy?.(message);
  }, [message, onCopy]);

  const actionsArray = actions ?? [];
  const copyAction = actionsArray.find((a) => a.id === "copy");
  const customActions = actionsArray.filter((a) => a.id !== "copy");

  return (
    <fieldset
      data-acp-message-action-bar
      data-acp-message-id={message.id}
      className={`acp-message-action-bar ${className}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        opacity: isHovered ? 1 : 0,
        transition: "opacity 0.15s ease",
        border: "none",
        margin: 0,
        padding: 0,
        minWidth: 0,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
  {copyAction && (
    <button
      type="button"
      data-acp-message-action
      data-acp-message-action-id="copy"
      onClick={handleCopy}
      disabled={copyAction.disabled === true}
      style={{
        padding: "4px 8px",
        fontSize: "12px",
        borderRadius: "4px",
        backgroundColor: "transparent",
        border: "1px solid var(--acp-border, #ccc)",
        color: "var(--acp-text, #000)",
        cursor: copyAction.disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        gap: "4px",
      }}
    >
      {copyAction.icon || (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <title>Copy icon</title>
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
      <span>{copyAction.label}</span>
    </button>
  )}

      {customActions.length > 0 && (
        <>
          <Separator orientation="vertical" style={{ height: "16px", margin: "0 4px" }} />

          <Menu.Root>
            <Menu.Trigger
              data-acp-message-action-menu-trigger
              disabled={false}
              style={{
                padding: "4px 8px",
                fontSize: "12px",
                borderRadius: "4px",
                backgroundColor: "transparent",
                border: "1px solid var(--acp-border, #ccc)",
                color: "var(--acp-text, #000)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <title>Actions menu</title>
                <circle cx="12" cy="12" r="1" />
                <circle cx="19" cy="12" r="1" />
                <circle cx="5" cy="12" r="1" />
              </svg>
              <span>Actions</span>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner align="end" side="bottom" sideOffset={4}>
                <Menu.Popup
                  data-acp-message-action-menu
                  style={{
                    backgroundColor: "var(--acp-bg, #fff)",
                    border: "1px solid var(--acp-border, #ccc)",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                    minWidth: "150px",
                    zIndex: 1000,
                  }}
                >
                  {customActions.map((action) => (
                    <Menu.Item
                      key={action.id}
                      data-acp-message-action-menu-item
                      data-acp-message-action-menu-item-id={action.id}
                      disabled={action.disabled === true}
                      onClick={(event) => {
                        action.onClick(message, event as unknown as React.MouseEvent<HTMLButtonElement>);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        width: "100%",
                        padding: "8px 12px",
                        border: "none",
                        background: "transparent",
                        cursor: action.disabled ? "not-allowed" : "pointer",
                        textAlign: "left",
                        fontSize: "13px",
                        color: action.disabled
                          ? "var(--acp-text-muted, #999)"
                          : "var(--acp-text, #000)",
                        opacity: action.disabled ? 0.5 : 1,
                        transition: "background-color 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!action.disabled) {
                          (e.currentTarget as HTMLDivElement).style.backgroundColor =
                            "var(--acp-bg-hover, #f0f0f0)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent";
                      }}
                    >
                      {action.icon && (
                        <span data-acp-message-action-menu-item-icon>{action.icon}</span>
                      )}
                      <span data-acp-message-action-menu-item-label>{action.label}</span>
                    </Menu.Item>
                  ))}
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </>
      )}
    </fieldset>
  );
});

MessageActionBar.displayName = "MessageActionBar";
