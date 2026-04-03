import { memo, useCallback } from "react";
import { Autocomplete } from "@base-ui-components/react/autocomplete";
import type { SlashSuggestionProps, SlashCommand } from "./types.js";

export const SlashSuggestions = memo(function SlashSuggestions({
  commands,
  selectedIndex,
  onSelect,
  onClose,
  anchorElement,
  open,
}: SlashSuggestionProps) {

  const handleValueChange = useCallback((value: string | null) => {
    if (value) {
      const command = commands.find((c) => c.id === value);
      if (command) {
        onSelect(command);
      }
    }
  }, [commands, onSelect]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      onClose();
    }
  }, [onClose]);

  if (!open || commands.length === 0) {
    return null;
  }

  return (
    <Autocomplete.Root
      open={open}
      onOpenChange={handleOpenChange}
      onValueChange={handleValueChange}
    >
      <Autocomplete.Portal>
        <Autocomplete.Positioner
          align="start"
          side="bottom"
          sideOffset={4}
          {...(anchorElement ? { anchor: anchorElement } : {})}
        >
          <Autocomplete.Popup
            data-acp-slash-popover
            className="acp-slash-popover"
            style={{
              backgroundColor: "var(--acp-bg, #fff)",
              border: "1px solid var(--acp-border, #ccc)",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
              minWidth: "200px",
              maxWidth: "300px",
              maxHeight: "300px",
              overflow: "auto",
              zIndex: 1000,
              outline: "none",
            }}
          >
            <div
              data-acp-slash-header
              style={{
                padding: "8px 12px",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--acp-text-muted, #666)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                borderBottom: "1px solid var(--acp-border, #eee)",
              }}
            >
              Commands
            </div>
            <Autocomplete.List
              data-acp-slash-list
              aria-label="Slash commands"
              style={{
                padding: "4px 0",
              }}
            >
              {commands.map((command, index) => (
                <Autocomplete.Item
                  key={command.id}
                  value={command.id}
                  data-acp-slash-item
                  data-acp-slash-item-selected={index === selectedIndex}
                  data-acp-slash-item-id={command.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    width: "100%",
                    padding: "8px 12px",
                    border: "none",
                    background: index === selectedIndex
                      ? "var(--acp-bg-hover, #f0f0f0)"
                      : "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: "14px",
                    color: "var(--acp-text, #000)",
                    transition: "background-color 0.15s ease",
                    outline: "none",
                  }}
                >
                  {command.icon && (
                    <span data-acp-slash-item-icon style={{ flexShrink: 0 }}>
                      {command.icon}
                    </span>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                    <span
                      data-acp-slash-item-name
                      style={{
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {command.name}
                    </span>
                    <span
                      data-acp-slash-item-description
                      style={{
                        fontSize: "12px",
                        color: "var(--acp-text-muted, #666)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {command.description}
                    </span>
                  </div>
                </Autocomplete.Item>
              ))}
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
});

SlashSuggestions.displayName = "SlashSuggestions";
