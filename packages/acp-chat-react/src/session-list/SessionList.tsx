import { useState, useCallback, useEffect, memo } from "react";
import { Button } from "@base-ui-components/react/button";
import { ScrollArea } from "@base-ui-components/react/scroll-area";
import { Separator } from "@base-ui-components/react/separator";
import type { SessionListProps, SessionItem, SessionItemRenderProps } from "./types.js";

interface SessionRowProps {
  session: SessionItem;
  isSelected: boolean;
  isLoading: boolean;
  onSelect: () => void;
  onLoad: () => void;
  loadButtonText: string;
}

const SessionRow = memo(function SessionRow({
  session,
  isSelected,
  isLoading,
  onSelect,
  onLoad,
  loadButtonText,
}: SessionRowProps) {
  const formattedDate = session.updatedAt
    ? new Date(session.updatedAt).toLocaleString()
    : null;

  return (
    <div
      data-acp-session-row
      data-acp-session-id={session.sessionId}
      data-acp-session-selected={isSelected}
      data-acp-session-loading={isLoading}
      className="acp-session-row"
    >
      <button
        type="button"
        data-acp-session-select-button
        onClick={onSelect}
        className="acp-session-row__select"
        aria-pressed={isSelected}
      >
        <div data-acp-session-info className="acp-session-row__info">
          <div data-acp-session-title className="acp-session-row__title">
            {session.title || session.sessionId}
          </div>
          <div data-acp-session-meta className="acp-session-row__meta">
            <span data-acp-session-cwd>{session.cwd}</span>
            {formattedDate && (
              <>
                <Separator orientation="vertical" className="acp-session-row__separator" />
                <span data-acp-session-date>{formattedDate}</span>
              </>
            )}
          </div>
        </div>
      </button>
      <Button
        data-acp-session-load-button
        onClick={onLoad}
        disabled={isLoading}
        className="acp-session-row__load"
        aria-label={`Load session ${session.title || session.sessionId}`}
      >
        {isLoading ? "Loading..." : loadButtonText}
      </Button>
    </div>
  );
});

SessionRow.displayName = "SessionRow";

function DefaultSessionItemRender({
  session,
  isSelected,
  isLoading,
  onSelect,
  onLoad,
}: SessionItemRenderProps) {
  const formattedDate = session.updatedAt
    ? new Date(session.updatedAt).toLocaleString()
    : null;

  return (
    <div
      data-acp-session-row
      data-acp-session-id={session.sessionId}
      data-acp-session-selected={isSelected}
      data-acp-session-loading={isLoading}
    >
      <button type="button" data-acp-session-select-button onClick={onSelect} aria-pressed={isSelected}>
        <div data-acp-session-info>
          <div data-acp-session-title>{session.title || session.sessionId}</div>
          <div data-acp-session-meta>
            <span data-acp-session-cwd>{session.cwd}</span>
            {formattedDate && <span data-acp-session-date>{formattedDate}</span>}
          </div>
        </div>
      </button>
      <Button data-acp-session-load-button onClick={onLoad} disabled={isLoading}>
        {isLoading ? "Loading..." : "Load"}
      </Button>
    </div>
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
  loadButtonText = "Load",
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
                  onSelect={() => handleSelect(session.sessionId)}
                  onLoad={() => handleLoad(session)}
                  loadButtonText={loadButtonText}
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
