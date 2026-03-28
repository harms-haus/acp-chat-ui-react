import { memo, useMemo } from "react";
import type { UpdateRowProps } from "./types.js";
import { UpdateIndicator } from "./UpdateIndicator.js";

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export const UpdateRow = memo(function UpdateRow({
  type,
  title,
  status = "pending",
  timestamp,
  className = "",
}: UpdateRowProps) {
  const statusClass = useMemo(
    () => `acp-update--status-${status}`,
    [status]
  );

  return (
    <div
      data-acp-update-type={type}
      data-acp-update-status={status}
      className={`acp-update ${statusClass} ${className}`}
    >
      <UpdateIndicator status={status} />
      <div className="acp-update__content">
        <span className="acp-update__type">{type}</span>
        {title && <span className="acp-update__title">{title}</span>}
        {timestamp && (
          <time
            className="acp-update__time"
            dateTime={new Date(timestamp).toISOString()}
          >
            {formatTime(timestamp)}
          </time>
        )}
      </div>
    </div>
  );
});

UpdateRow.displayName = "UpdateRow";
