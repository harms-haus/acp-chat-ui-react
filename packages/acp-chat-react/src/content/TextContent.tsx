import { memo } from "react";
import type { TextContentProps } from "./types.js";

export const TextContent = memo(function TextContent({
  text,
  className = "",
}: TextContentProps) {
  return (
    <div
      data-acp-content-type="text"
      className={`acp-text-content ${className}`}
    >
      {text}
    </div>
  );
});

TextContent.displayName = "TextContent";
