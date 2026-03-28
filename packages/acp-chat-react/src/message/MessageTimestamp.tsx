import { memo, useMemo } from "react";
import type { MessageTimestampProps } from "./types.js";

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const MessageTimestamp = memo(function MessageTimestamp({
  timestamp,
  className = "",
}: MessageTimestampProps) {
  const formattedTime = useMemo(() => {
    if (!timestamp) return null;
    return formatTime(timestamp);
  }, [timestamp]);

  if (!formattedTime || !timestamp) return null;

  return (
    <time
      data-acp-message-timestamp={timestamp}
      dateTime={new Date(timestamp).toISOString()}
      className={`acp-message__timestamp ${className}`}
    >
      {formattedTime}
    </time>
  );
});

MessageTimestamp.displayName = "MessageTimestamp";
