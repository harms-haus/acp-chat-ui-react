import { useState, useCallback, useMemo } from "react";
import type { SlashCommand, UseSlashCommandsOptions, UseSlashCommandsReturn } from "./types.js";

export function useSlashCommands(options: UseSlashCommandsOptions): UseSlashCommandsReturn {
  const { commands, onSelect } = options;

  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);

  const filteredCommands = useMemo(() => {
    return commands;
  }, [commands]);

  const handleSlashKey = useCallback(() => {
    setIsOpen(true);
    setSelectedIndex(0);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSelectedIndex(0);
  }, []);

  const handleSelect = useCallback((command: SlashCommand) => {
    onSelect(command);
    handleClose();
  }, [onSelect, handleClose]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent): boolean => {
    if (!isOpen) return false;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : prev
        );
        return true;

      case "ArrowUp":
        event.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        return true;

      case "Enter":
        event.preventDefault();
        if (filteredCommands[selectedIndex]) {
          handleSelect(filteredCommands[selectedIndex]!);
        }
        return true;

      case "Escape":
        event.preventDefault();
        handleClose();
        return true;

      default:
        return false;
    }
  }, [isOpen, filteredCommands, selectedIndex, handleSelect, handleClose]);

  return {
    isOpen,
    selectedIndex,
    filteredCommands,
    handleSlashKey,
    handleKeyDown,
    handleSelect,
    handleClose,
    setAnchorElement,
    anchorElement,
  };
}
