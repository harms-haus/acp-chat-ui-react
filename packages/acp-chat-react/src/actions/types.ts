import type { ReactNode, MouseEvent } from "react";
import type { NormalizedMessage } from "@harms-haus/acp-chat-core";
import type { ClipboardAPI } from "../types/browser-apis.js";
import { defaultClipboardWithFallback } from "../utils/clipboard.js";

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
  /**
   * Clipboard API implementation for copy operations.
   *
   * Optional. If not provided, defaults to `defaultClipboardWithFallback`
   * which provides navigator.clipboard with fallback to document.execCommand.
   *
   * @example
   * ```tsx
   * import { MessageActionBar, defaultClipboardWithFallback } from '@harms-haus/acp-chat-react';
   *
   * // Use default
   * <MessageActionBar message={message} />
   *
   * // Inject custom implementation
   * const customClipboard = { async writeText(text) { ... } };
   * <MessageActionBar message={message} clipboard={customClipboard} />
   *
   * // Use strict (no fallback)
   * import { strictClipboard } from '@harms-haus/acp-chat-react';
   * <MessageActionBar message={message} clipboard={strictClipboard} />
   * ```
   */
  clipboard?: ClipboardAPI;
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
  /**
   * Clipboard API implementation for copy operations.
   *
   * Optional. If not provided, defaults to `defaultClipboardWithFallback`
   * which provides navigator.clipboard with fallback to document.execCommand.
   */
  clipboard?: ClipboardAPI;
}

export interface UseMessageActionsReturn {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  anchorElement: HTMLElement | null;
  setAnchorElement: (element: HTMLElement | null) => void;
  handleCopy: () => void;
  actions: MessageAction[];
}
