import { memo, useCallback } from "react";
import { Autocomplete } from "@base-ui-components/react/autocomplete";
import type { SlashSuggestionProps } from "./types.js";

export const SlashSuggestions = memo(function SlashSuggestions({
  commands,
  selectedIndex,
  onSelect,
  onSelectCommand,
  onClose,
  anchorElement,
  open,
}: SlashSuggestionProps) {

  const handleValueChange = useCallback((value: string | null) => {
    if (value) {
      const command = commands.find((c) => c.id === value);
      if (command) {
        onSelect(command);
        onSelectCommand?.(command);
      }
    }
  }, [commands, onSelect, onSelectCommand]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      onClose?.();
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
      >
      <div
        data-acp-slash-header
        className="acp-slash-header"
      >
        Commands
      </div>
      <Autocomplete.List
        data-acp-slash-list
        aria-label="Slash commands"
        className="acp-slash-list"
      >
              {commands.map((command, index) => (
          <Autocomplete.Item
            key={command.id}
            value={command.id}
            data-acp-slash-item
            data-acp-slash-item-selected={index === selectedIndex}
            data-acp-slash-item-id={command.id}
            className={`acp-slash-item ${index === selectedIndex ? 'acp-slash-item--selected' : ''}`}
          >
            {command.icon && (
              <span data-acp-slash-item-icon className="acp-slash-item-icon">
                {command.icon}
              </span>
            )}
            <div data-acp-slash-item-content className="acp-slash-item-content">
              <span
                data-acp-slash-item-name
                className="acp-slash-item-name"
              >
                {command.name}
              </span>
              <span
                data-acp-slash-item-description
                className="acp-slash-item-description"
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
