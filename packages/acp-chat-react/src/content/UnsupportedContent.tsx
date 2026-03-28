import { memo } from "react";
import type { UnsupportedContentProps } from "./types.js";

export const UnsupportedContent = memo(function UnsupportedContent({
  type,
  className = "",
}: UnsupportedContentProps) {
  return (
    <div
      data-acp-content-type="unsupported"
      data-acp-unsupported-type={type}
      className={`acp-content-unsupported ${className}`}
    >
      <span className="acp-content-unsupported__label">Unknown content type</span>
      <span className="acp-content-unsupported__type">{type}</span>
    </div>
  );
});

UnsupportedContent.displayName = "UnsupportedContent";
