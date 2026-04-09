import { memo, useMemo } from "react";
import type { ContentBlock } from "@harms-haus/acp-chat-core";
import type { ContentRendererProps } from "./types.js";
import { TextContent } from "./TextContent.js";
import { ResourceContent } from "./ResourceContent.js";
import { ResourceLinkContent } from "./ResourceLinkContent.js";
import { UnsupportedContent } from "./UnsupportedContent.js";

function getBlockStableId(block: ContentBlock, index: number): string {
  const type = block.type;

  if (type === "text") {
    const textHash = block.text.slice(0, 50);
    const textLength = block.text.length;
    return `text-${textHash}-${textLength}`;
  }

  if (type === "resource") {
    const uri = block.resource.uri;
    const mimeType = block.resource.mimeType ?? "unknown";
    const hasContent = block.resource.text ? "text" : block.resource.blob ? "blob" : "empty";
    return `resource-${uri}-${mimeType}-${hasContent}`;
  }

  if (type === "resource_link") {
    const uri = block.resourceLink.uri;
    const mimeType = block.resourceLink.mimeType ?? "unknown";
    return `link-${uri}-${mimeType}`;
  }

  return `unknown-${index}`;
}

export const ContentRenderer = memo(function ContentRenderer({
  blocks,
  className = "",
}: ContentRendererProps) {
  const blocksWithStableIds = useMemo(() => {
    if (!blocks || blocks.length === 0) {
      return [];
    }
    return blocks.map((block, index) => ({
      block,
      stableId: getBlockStableId(block, index),
      index,
    }));
  }, [blocks]);

  if (blocksWithStableIds.length === 0) {
    return null;
  }

  return (
    <div data-acp-content-renderer className={`acp-content-renderer ${className}`}>
      {blocksWithStableIds.map(({ block, stableId, index }) => (
        <div
          key={stableId}
          data-acp-content-block-id={stableId}
          data-acp-content-block-type={block.type}
          data-acp-content-block-index={index}
          className="acp-content-renderer__block"
        >
          {block.type === "text" ? (
            <TextContent text={block.text} />
          ) : block.type === "resource" ? (
            <ResourceContent block={block} />
          ) : block.type === "resource_link" ? (
            <ResourceLinkContent block={block} />
          ) : (
            <UnsupportedContent type={(block as { type: string }).type} />
          )}
        </div>
      ))}
    </div>
  );
});

ContentRenderer.displayName = "ContentRenderer";
