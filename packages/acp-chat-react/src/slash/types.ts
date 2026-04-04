import type { ReactNode } from "react";

export interface SlashCommand {
  id: string;
  name: string;
  description: string;
  icon?: ReactNode;
}

export interface SlashSuggestionProps {
  commands: SlashCommand[];
  selectedIndex: number;
  onSelect: (command: SlashCommand) => void;
  /**
   * Optional callback fired when a command is selected.
   * Allows consumers to handle command selection for custom behavior.
   * @param command - The selected slash command
   */
  onSelectCommand?: (command: SlashCommand) => void;
  /**
   * Optional callback fired when the suggestions menu is closed.
   * Allows consumers to handle menu closure for custom behavior.
   */
  onClose?: () => void;
  anchorElement: HTMLElement | null;
  open: boolean;
}

export interface SlashTriggerProps {
  children: ReactNode;
  onSlashOpen: () => void;
  onSlashClose: () => void;
}

export interface UseSlashCommandsOptions {
  commands: SlashCommand[];
  onSelect: (command: SlashCommand) => void;
}

export interface UseSlashCommandsReturn {
  isOpen: boolean;
  selectedIndex: number;
  filteredCommands: SlashCommand[];
  handleSlashKey: () => void;
  handleKeyDown: (event: React.KeyboardEvent) => boolean;
  handleSelect: (command: SlashCommand) => void;
  handleClose: () => void;
  setAnchorElement: (element: HTMLElement | null) => void;
  anchorElement: HTMLElement | null;
}
