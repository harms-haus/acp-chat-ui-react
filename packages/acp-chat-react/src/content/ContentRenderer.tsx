import { memo, useMemo } from "react";
import type { ContentBlock } from "@harms-haus/acp-chat-core";
import type { ContentRendererProps } from "./types.js";
import { TextContent } from "./TextContent.js";
import { ResourceContent } from "./ResourceContent.js";
import { ResourceLinkContent } from "./ResourceLinkContent.js";
import { UnsupportedContent } from "./UnsupportedContent.js";

function getBlockStableId(block: ContentBlock, index: number): string {
  if (block.type === "text") {
    const textHash = block.text.slice(0, 50);
    const textLength = block.text.length;
    return `text-${textHash}-${textLength}`;
  }

  if (block.type === "resource") {
    // Type assertion to help TypeScript narrow correctly
    const resBlock = block as unknown as import("@harms-haus/acp-chat-core").ResourceContentBlock;
    const uri = resBlock.resource.uri;
    const mimeType = resBlock.resource.mimeType ?? "unknown";
    const hasContent = resBlock.resource.text ? "text" : resBlock.resource.blob ? "blob" : "empty";
    return `resource-${uri}-${mimeType}-${hasContent}`;
  }

  if (block.type === "resource_link") {
    // Type assertion to help TypeScript narrow correctly
    const linkBlock = block as unknown as import("@harms-haus/acp-chat-core").ResourceLinkContentBlock;
    const uri = linkBlock.resourceLink.uri;
    const mimeType = linkBlock.resourceLink.mimeType ?? "unknown";
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
            <TextContent text={(block as unknown as import("@harms-haus/acp-chat-core").TextContentBlock).text} />
          ) : block.type === "resource" ? (
            <ResourceContent block={block as unknown as import("@harms-haus/acp-chat-core").ResourceContentBlock} />
          ) : block.type === "resource_link" ? (
            <ResourceLinkContent block={block as unknown as import("@harms-haus/acp-chat-core").ResourceLinkContentBlock} />
          ) : (
            <UnsupportedContent type={(block as { type: string }).type} />
          )}
        </div>
      ))}
    </div>
  );
});

ContentRenderer.displayName = "ContentRenderer";
