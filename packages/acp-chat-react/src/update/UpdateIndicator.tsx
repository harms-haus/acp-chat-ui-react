import { memo } from "react";
import type { UpdateIndicatorProps } from "./types.js";

export const UpdateIndicator = memo(function UpdateIndicator({
  status,
  className = "",
}: UpdateIndicatorProps) {
  const statusClass = `acp-update--status-${status}`;

  return (
    <div
      data-acp-update-status={status}
      className={`acp-update__indicator ${statusClass} ${className}`}
      aria-hidden="true"
    />
  );
});

UpdateIndicator.displayName = "UpdateIndicator";
