import { useState, useCallback } from "react";
import { Button } from "@base-ui-components/react/button";
import { Separator } from "@base-ui-components/react/separator";
import {
  SessionList,
  SettingsSelect,
  SettingsCheckbox,
  SettingsSwitch,
  type SessionItem,
  type AcpMode,
} from "@acp/chat-react";
import type { SessionController } from "@acp/chat-core";

const DEMO_MODES: AcpMode[] = [
  { id: "all", name: "All Sessions", description: "Show all sessions" },
  { id: "recent", name: "Recent", description: "Sessions from last 24 hours" },
  { id: "active", name: "Active", description: "Currently active sessions" },
];

interface StandaloneSessionListDemoProps {
  controller: SessionController | null;
  isConnected: boolean;
}

export function StandaloneSessionListDemo({
  controller,
  isConnected,
}: StandaloneSessionListDemoProps) {
  const [selectedMode, setSelectedMode] = useState<AcpMode | null>(DEMO_MODES[0] ?? null);
  const [showDetails, setShowDetails] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastLoadedSession, setLastLoadedSession] = useState<SessionItem | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleSessionLoaded = useCallback((session: SessionItem) => {
    setLastLoadedSession(session);
    setLoadError(null);
  }, []);

  const handleSessionLoadError = useCallback((error: Error) => {
    setLoadError(error.message);
    setLastLoadedSession(null);
  }, []);

  const handleSessionSelect = useCallback((session: SessionItem) => {
    console.log("Selected session:", session);
  }, []);

  return (
    <div
      data-acp-standalone-session-list-demo
      style={{
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div
        data-acp-demo-controls
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          padding: "16px",
          backgroundColor: "var(--harness-card-bg)",
          borderRadius: "8px",
          border: "1px solid var(--harness-border)",
        }}
      >
        <h3 style={{ fontSize: "14px", margin: 0 }}>Standalone SessionList Demo</h3>
        <p style={{ fontSize: "12px", color: "var(--harness-muted)", margin: 0 }}>
          This demonstrates SessionList mounted standalone without a packaged shell wrapper.
        </p>

        <Separator orientation="horizontal" />

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            alignItems: "center",
          }}
        >
          <SettingsSelect
            data-acp-id="demo-mode"
            value={selectedMode}
            options={DEMO_MODES}
            onChange={setSelectedMode}
            placeholder="Select filter mode..."
            disabled={!isConnected}
          />

          <SettingsCheckbox
            data-acp-id="show-details"
            checked={showDetails}
            onChange={setShowDetails}
            label="Show details"
            description="Display session metadata"
            disabled={!isConnected}
          />

          <SettingsSwitch
            data-acp-id="auto-refresh"
            checked={autoRefresh}
            onChange={setAutoRefresh}
            label="Auto-refresh"
            description="Automatically refresh session list"
            disabled={!isConnected}
          />
        </div>

        {lastLoadedSession && (
          <div
            data-acp-demo-loaded-session
            style={{
              padding: "12px",
              backgroundColor: "var(--harness-success-bg, rgba(0, 128, 0, 0.1))",
              borderRadius: "4px",
              fontSize: "13px",
            }}
          >
            <strong>Last loaded:</strong> {lastLoadedSession.title || lastLoadedSession.sessionId}
            <br />
            <span style={{ color: "var(--harness-muted)", fontSize: "12px" }}>
              {lastLoadedSession.cwd}
            </span>
          </div>
        )}

        {loadError && (
          <div
            data-acp-demo-load-error
            style={{
              padding: "12px",
              backgroundColor: "var(--harness-error-bg, rgba(255, 0, 0, 0.1))",
              borderRadius: "4px",
              fontSize: "13px",
              color: "var(--harness-error)",
            }}
          >
            <strong>Error:</strong> {loadError}
          </div>
        )}
      </div>

      <div
        data-acp-demo-session-list-container
        style={{
          border: "1px solid var(--harness-border)",
          borderRadius: "8px",
          overflow: "hidden",
          minHeight: "300px",
        }}
      >
        {!isConnected ? (
          <div
            style={{
              padding: "32px",
              textAlign: "center",
              color: "var(--harness-muted)",
            }}
          >
            Connect to a session source to view sessions
          </div>
        ) : controller ? (
          <SessionList
            controller={controller}
            autoFetch={true}
            onSessionSelect={handleSessionSelect}
            onSessionLoaded={handleSessionLoaded}
            onSessionLoadError={handleSessionLoadError}
      {...(showDetails
        ? {}
        : {
          renderSessionItem: ({
            session,
            isSelected,
            isLoading,
            onLoad,
          }: {
            session: SessionItem;
            isSelected: boolean;
            isLoading: boolean;
            onSelect: () => void;
            onLoad: () => void;
          }) => {
            const formattedDate = session.updatedAt
              ? (() => {
                  const date = new Date(session.updatedAt);
                  const now = new Date();
                  const isToday = date.toDateString() === now.toDateString();
                  const timeStr = date.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  }).toLowerCase().replace(" am", "a").replace(" pm", "p").replace(" ", "");
                  if (isToday) return timeStr;
                  const datePart = date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });
                  return `${datePart}, ${timeStr}`;
                })()
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
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "none",
                  background: isSelected ? "rgba(74, 158, 255, 0.1)" : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  borderRadius: "6px",
                  transition: "background-color 0.15s ease",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--harness-text)" }}>
                    {session.title || session.sessionId}
                  </div>
                  {formattedDate && (
                    <div style={{ fontSize: "11px", color: "var(--harness-muted)" }}>
                      {formattedDate}
                    </div>
                  )}
                </div>
              </button>
            );
          },
        })}
          />
        ) : (
          <div
            style={{
              padding: "32px",
              textAlign: "center",
              color: "var(--harness-muted)",
            }}
          >
            No controller available
          </div>
        )}
      </div>

      <div
        data-acp-demo-info
        style={{
          padding: "12px",
          backgroundColor: "var(--harness-card-bg)",
          borderRadius: "4px",
          fontSize: "12px",
          color: "var(--harness-muted)",
        }}
      >
        <strong>Demo features:</strong>
        <ul style={{ margin: "8px 0 0 0", paddingLeft: "16px" }}>
          <li>SessionList works standalone without shell wrapper</li>
          <li>Custom renderSessionItem for simplified view</li>
          <li>SettingsSelect, SettingsCheckbox, SettingsSwitch from library</li>
          <li>Callbacks for session selection, load success, and load error</li>
        </ul>
      </div>
    </div>
  );
}
