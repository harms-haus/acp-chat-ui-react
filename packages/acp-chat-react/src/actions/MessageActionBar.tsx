import { memo, useCallback, useState, useEffect } from "react";
import { Menu } from "@base-ui-components/react/menu";
import { Separator } from "@base-ui-components/react/separator";
import type { MessageActionBarProps } from "./types.js";
import { defaultClipboardWithFallback } from "../utils/clipboard.js";

export const MessageActionBar = memo(function MessageActionBar({
  message,
  actions,
  onCopy,
  className = "",
  clipboard: injectedClipboard,
}: MessageActionBarProps) {
  const [isHovered, setIsHovered] = useState(false);

  const clipboard = injectedClipboard ?? defaultClipboardWithFallback;

  useEffect(() => {
    if (injectedClipboard === undefined) {
      console.warn(
        "[@acp/chat-react] MessageActionBar: Using default clipboard implementation. " +
        "For production, consider providing a custom clipboard implementation via the 'clipboard' prop " +
        "to ensure consistent behavior across environments. " +
        "Example: clipboard={strictClipboard} or clipboard={defaultClipboardWithFallback}"
      );
    }
  }, [injectedClipboard]);

  const handleCopy = useCallback(() => {
    const textToCopy = message.content || "";
    clipboard.writeText(textToCopy).catch((err) => {
      console.error("Failed to copy message:", err);
    });
    onCopy?.(message);
  }, [message, onCopy, clipboard]);

  const actionsArray = actions ?? [];
  const copyAction = actionsArray.find((a) => a.id === "copy");
  const customActions = actionsArray.filter((a) => a.id !== "copy");

  return (
    <fieldset
      data-acp-message-action-bar
      data-acp-message-id={message.id}
      className={`acp-message-action-bar ${isHovered ? "acp-message-action-bar--visible" : ""} ${className}`}
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
          className={`acp-message-action-bar__button ${copyAction.disabled ? "acp-message-action-bar__button--disabled" : ""}`}
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
              className="acp-message-action-bar__icon"
            >
              <title>Copy icon</title>
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
          <span className="acp-message-action-bar__label">{copyAction.label}</span>
        </button>
      )}

      {customActions.length > 0 && (
        <>
          <Separator orientation="vertical" className="acp-message-action-bar__separator" />

          <Menu.Root>
            <Menu.Trigger
              data-acp-message-action-menu-trigger
              disabled={false}
              className="acp-message-action-bar__button acp-message-action-bar__button--menu"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
                className="acp-message-action-bar__icon"
              >
                <title>Actions menu</title>
                <circle cx="12" cy="12" r="1" />
                <circle cx="19" cy="12" r="1" />
                <circle cx="5" cy="12" r="1" />
              </svg>
              <span className="acp-message-action-bar__label">Actions</span>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner align="end" side="bottom" sideOffset={4}>
                <Menu.Popup
                  data-acp-message-action-menu
                  className="acp-message-action-bar__menu"
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
                      className={`acp-message-action-bar__menu-item ${action.disabled ? "acp-message-action-bar__menu-item--disabled" : ""}`}
                    >
                      {action.icon && (
                        <span data-acp-message-action-menu-item-icon className="acp-message-action-bar__menu-item-icon">{action.icon}</span>
                      )}
                      <span data-acp-message-action-menu-item-label className="acp-message-action-bar__menu-item-label">{action.label}</span>
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
