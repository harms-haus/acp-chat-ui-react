import { useState, useCallback, useMemo } from "react";
import type {
  MessageAction,
  UseMessageActionsOptions,
  UseMessageActionsReturn,
} from "./types.js";

export function useMessageActions(options: UseMessageActionsOptions): UseMessageActionsReturn {
  const { message, customActions = [], onCopy } = options;

  const [isOpen, setIsOpen] = useState(false);
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);

  const handleCopy = useCallback(() => {
    const textToCopy = message.content || "";
    navigator.clipboard.writeText(textToCopy).catch((err) => {
      console.error("Failed to copy message:", err);
    });
    onCopy?.(message);
    setIsOpen(false);
  }, [message, onCopy]);

  const copyAction: MessageAction = useMemo(
    () => ({
      id: "copy",
      label: "Copy",
      onClick: handleCopy,
    }),
    [handleCopy]
  );

  const actions = useMemo(() => {
    return [copyAction, ...customActions];
  }, [copyAction, customActions]);

  return {
    isOpen,
    setIsOpen,
    anchorElement,
    setAnchorElement,
    handleCopy,
    actions,
  };
}
