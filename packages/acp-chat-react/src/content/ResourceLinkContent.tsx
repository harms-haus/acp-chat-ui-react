import { memo, useMemo } from "react";
import type { ResourceLinkContentProps } from "./types.js";

export const ResourceLinkContent = memo(function ResourceLinkContent({
  block,
  className = "",
}: ResourceLinkContentProps) {
  // Type assertion to ensure TypeScript uses the correct type
  const resourceLink = (block as unknown as import("@harms-haus/acp-chat-core").ResourceLinkContentBlock).resourceLink;
  const displayMimeType = useMemo(
    () => resourceLink.mimeType ?? "unknown",
    [resourceLink.mimeType]
  );

  return (
    <div
      data-acp-content-type="resource_link"
      className={`acp-resource-link-content ${className}`}
    >
      <a
        href={resourceLink.uri}
        className="acp-resource-link__link"
        target="_blank"
        rel="noopener noreferrer"
        title={`Open resource: ${resourceLink.uri}`}
      >
        <span className="acp-resource-link__icon" aria-hidden="true">
          🔗
        </span>
        <span className="acp-resource-link__uri">{resourceLink.uri}</span>
        <span className="acp-resource-link__mime">{displayMimeType}</span>
        <span className="acp-resource-link__arrow" aria-hidden="true">
          →
        </span>
      </a>
    </div>
  );
});

ResourceLinkContent.displayName = "ResourceLinkContent";
