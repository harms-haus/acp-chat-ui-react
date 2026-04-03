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
  onClose: () => void;
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
