import { memo, useMemo } from "react";
import type { ResourceContentProps } from "./types.js";

export const ResourceContent = memo(function ResourceContent({
  block,
  className = "",
}: ResourceContentProps) {
  const resource = block.resource;
  const hasText = !!resource.text;
  const hasBlob = !!resource.blob;
  const displayMimeType = resource.mimeType ?? "application/octet-stream";

  const blobSize = useMemo(() => {
    if (!resource.blob) return 0;
    return Math.ceil(resource.blob.length * 0.75);
  }, [resource.blob]);

  return (
    <div
      data-acp-content-type="resource"
      className={`acp-resource-content ${className}`}
    >
      <div className="acp-resource__header">
        <span className="acp-resource__icon" aria-hidden="true">
          📄
        </span>
        <span className="acp-resource__uri" title={resource.uri}>
          {resource.uri}
        </span>
        <span className="acp-resource__mime">{displayMimeType}</span>
      </div>

      {hasText && (
        <div className="acp-resource__text">{resource.text}</div>
      )}

      {hasBlob && !hasText && (
        <div className="acp-resource__blob">
          <span className="acp-resource__blob-label">Binary content</span>
          <span className="acp-resource__blob-size">{blobSize} bytes</span>
        </div>
      )}

      {!hasText && !hasBlob && (
        <div className="acp-resource__placeholder">
          <span>Resource content not loaded</span>
        </div>
      )}
    </div>
  );
});

ResourceContent.displayName = "ResourceContent";
