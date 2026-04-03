import type { ReactNode, MouseEvent } from "react";
import type { NormalizedMessage } from "@acp/chat-core";

export interface MessageAction {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: (message: NormalizedMessage, event: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
}

export interface MessageActionBarProps {
  message: NormalizedMessage;
  actions?: MessageAction[] | undefined;
  onCopy?: ((message: NormalizedMessage) => void) | undefined;
  className?: string;
}

export interface MessageActionMenuProps {
  message: NormalizedMessage;
  actions: MessageAction[];
  onCopy?: (message: NormalizedMessage) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorElement: HTMLElement | null;
}

export interface UseMessageActionsOptions {
  message: NormalizedMessage;
  customActions?: MessageAction[];
  onCopy?: (message: NormalizedMessage) => void;
}

export interface UseMessageActionsReturn {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  anchorElement: HTMLElement | null;
  setAnchorElement: (element: HTMLElement | null) => void;
  handleCopy: () => void;
  actions: MessageAction[];
}
