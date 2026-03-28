import { memo, useCallback } from "react";
import type { UpdateListProps } from "./types.js";
import { UpdateRow } from "./UpdateRow.js";

export const UpdateList = memo(function UpdateList({
  updates,
  className = "",
  gap = 8,
}: UpdateListProps) {
  const renderUpdate = useCallback(
    (update: typeof updates[0]) => (
      <UpdateRow
        key={update.id}
        type={update.type}
        title={update.title}
        status={update.status}
        timestamp={update.timestamp}
      />
    ),
    []
  );

  if (updates.length === 0) {
    return (
      <div data-acp-update-list-empty className={`acp-update-list--empty ${className}`}>
        <span className="acp-update-list__empty-text">No updates</span>
      </div>
    );
  }

  return (
    <div
      data-acp-update-list
      className={`acp-update-list ${className}`}
      style={{ display: "flex", flexDirection: "column", gap }}
    >
      {updates.map((update, index) => (
        <div
          key={update.id}
          data-acp-update-wrapper
          data-acp-update-index={index}
        >
          {renderUpdate(update)}
        </div>
      ))}
    </div>
  );
});

UpdateList.displayName = "UpdateList";
