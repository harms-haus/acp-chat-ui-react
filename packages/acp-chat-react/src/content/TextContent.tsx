import { memo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
      <Markdown remarkPlugins={[remarkGfm]}>
        {text}
      </Markdown>
    </div>
  );
});

TextContent.displayName = "TextContent";
