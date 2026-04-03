import { useState, useCallback, useEffect, memo } from "react";
import { Button } from "@base-ui-components/react/button";
import { ScrollArea } from "@base-ui-components/react/scroll-area";
import type { SessionListProps, SessionItem, SessionItemRenderProps } from "./types.js";

function formatSessionDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).toLowerCase().replace(" am", "a").replace(" pm", "p").replace(" ", "");

  if (isToday) {
    return timeStr;
  }

  const datePart = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return `${datePart}, ${timeStr}`;
}

interface SessionRowProps {
  session: SessionItem;
  isSelected: boolean;
  isLoading: boolean;
  onLoad: () => void;
}

const SessionRow = memo(function SessionRow({
  session,
  isSelected,
  isLoading,
  onLoad,
}: SessionRowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const formattedDate = session.updatedAt
    ? formatSessionDate(session.updatedAt)
    : null;

  return (
    <button
      type="button"
      data-acp-session-row
      data-acp-session-id={session.sessionId}
      data-acp-session-selected={isSelected}
      data-acp-session-loading={isLoading}
      onClick={onLoad}
      title={session.cwd}
      disabled={isLoading}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: "100%",
        padding: "10px 12px",
        border: "none",
        background: isSelected 
          ? "rgba(74, 158, 255, 0.1)" 
          : isHovered 
            ? "rgba(255, 255, 255, 0.05)"
            : "transparent",
        cursor: isLoading ? "default" : "pointer",
        textAlign: "left",
        borderRadius: "6px",
        transition: "background-color 0.15s ease",
        color: "inherit",
        font: "inherit",
        opacity: isLoading ? 0.7 : 1,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <div style={{
          fontSize: "13px",
          fontWeight: 500,
          lineHeight: 1.4,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {session.title || session.sessionId}
        </div>
        {formattedDate && (
          <div style={{ fontSize: "11px", opacity: 0.7 }}>
            {formattedDate}
          </div>
        )}
      </div>
    </button>
  );
});

SessionRow.displayName = "SessionRow";

function DefaultSessionItemRender({
  session,
  isSelected,
  isLoading,
  onLoad,
  onSelect: _onSelect,
}: SessionItemRenderProps) {
  const [isHovered, setIsHovered] = useState(false);
  const formattedDate = session.updatedAt
    ? formatSessionDate(session.updatedAt)
    : null;

  return (
    <button
      type="button"
      data-acp-session-row
      data-acp-session-id={session.sessionId}
      data-acp-session-selected={isSelected}
      data-acp-session-loading={isLoading}
      onClick={onLoad}
      title={session.cwd}
      disabled={isLoading}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: "100%",
        padding: "10px 12px",
        border: "none",
        background: isSelected 
          ? "rgba(74, 158, 255, 0.1)" 
          : isHovered 
            ? "rgba(255, 255, 255, 0.05)"
            : "transparent",
        cursor: isLoading ? "default" : "pointer",
        textAlign: "left",
        borderRadius: "6px",
        transition: "background-color 0.15s ease",
        color: "inherit",
        font: "inherit",
        opacity: isLoading ? 0.7 : 1,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <div style={{
          fontSize: "13px",
          fontWeight: 500,
          lineHeight: 1.4,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {session.title || session.sessionId}
        </div>
        {formattedDate && (
          <div style={{ fontSize: "11px", opacity: 0.7 }}>
            {formattedDate}
          </div>
        )}
      </div>
    </button>
  );
}

function SessionListInner({
  controller,
  cwd,
  onSessionSelect,
  onSessionLoaded,
  onSessionLoadError,
  className = "",
  renderSessionItem,
  autoFetch = true,
  emptyText = "No sessions found",
  loadingText = "Loading sessions...",
  style,
}: SessionListProps) {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);

  const fetchSessions = useCallback(
    async (cursor?: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await controller.listSessions(cursor, cwd);
        setSessions((prevSessions) =>
          cursor ? [...prevSessions, ...result.sessions] : result.sessions
        );
        setHasMore(!!result.nextCursor);
        setNextCursor(result.nextCursor);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch sessions";
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [controller, cwd]
  );

  const selectSession = useCallback(
    (sessionId: string) => {
      setSelectedSessionId(sessionId);
      const session = sessions.find((s) => s.sessionId === sessionId);
      if (session) {
        onSessionSelect?.(session);
      }
    },
    [sessions, onSessionSelect]
  );

  const loadSession = useCallback(
    async (session: SessionItem) => {
      setIsLoadingSession(true);
      setError(null);

      try {
        await controller.loadSession(session.sessionId, session.cwd);
        onSessionLoaded?.(session);
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to load session");
        setError(error.message);
        onSessionLoadError?.(error, session);
      } finally {
        setIsLoadingSession(false);
      }
    },
    [controller, onSessionLoaded, onSessionLoadError]
  );

  const handleLoadMore = useCallback(() => {
    if (nextCursor && !isLoading) {
      fetchSessions(nextCursor);
    }
  }, [nextCursor, isLoading, fetchSessions]);

  useEffect(() => {
    if (autoFetch) {
      fetchSessions();
    }
  }, [autoFetch, fetchSessions]);

  const handleSelect = useCallback(
    (sessionId: string) => {
      selectSession(sessionId);
    },
    [selectSession]
  );

  const handleLoad = useCallback(
    (session: SessionItem) => {
      loadSession(session);
    },
    [loadSession]
  );

  if (isLoading && sessions.length === 0) {
    return (
      <div data-acp-session-list data-acp-session-list-loading className={className} style={style}>
        <div data-acp-session-list-empty>{loadingText}</div>
      </div>
    );
  }

  if (error && sessions.length === 0) {
    return (
      <div data-acp-session-list data-acp-session-list-error className={className} style={style}>
        <div data-acp-session-list-error-message>{error}</div>
        <Button onClick={() => fetchSessions()} disabled={isLoading}>
          Retry
        </Button>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div data-acp-session-list data-acp-session-list-empty className={className} style={style}>
        <div data-acp-session-list-empty-message>{emptyText}</div>
      </div>
    );
  }

  return (
    <div data-acp-session-list className={className} style={style}>
      {error && (
        <div data-acp-session-list-error-banner>
          {error}
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}

      <ScrollArea.Root data-acp-session-list-scroll>
        <ScrollArea.Viewport data-acp-session-list-viewport>
          <div data-acp-session-list-content>
            {sessions.map((session) => {
              const isSelected = selectedSessionId === session.sessionId;

              if (renderSessionItem) {
                return (
                  <div key={session.sessionId}>
                    {renderSessionItem({
                      session,
                      isSelected,
                      isLoading: isLoadingSession && isSelected,
                      onSelect: () => handleSelect(session.sessionId),
                      onLoad: () => handleLoad(session),
                    })}
                  </div>
                );
              }

    return (
      <SessionRow
        key={session.sessionId}
        session={session}
        isSelected={isSelected}
        isLoading={isLoadingSession && isSelected}
        onLoad={() => handleLoad(session)}
      />
    );
            })}

            {hasMore && (
              <div data-acp-session-list-load-more>
                <Button onClick={handleLoadMore} disabled={isLoading}>
                  {isLoading ? "Loading..." : "Load More"}
                </Button>
              </div>
            )}
          </div>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar data-acp-session-list-scrollbar orientation="vertical">
          <ScrollArea.Thumb data-acp-session-list-thumb />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  );
}

export const SessionList = memo(function SessionList(props: SessionListProps) {
  const { controller, className = "", style } = props;
  const isSupported = typeof controller.listSessions === "function" && typeof controller.loadSession === "function";

  if (!isSupported) {
    return (
      <div data-acp-session-list data-acp-session-list-unsupported className={className} style={style}>
        <div data-acp-session-list-unsupported-message>
          Session list is not available with the current connection type.
        </div>
      </div>
    );
  }

  return <SessionListInner {...props} />;
});

SessionList.displayName = "SessionList";
