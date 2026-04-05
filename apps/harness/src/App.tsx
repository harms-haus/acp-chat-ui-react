import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Separator } from "@base-ui-components/react/separator";
import {
  AcpStore,
  useSessionState,
  useIsConnected,
  useMessagesCount,
  useStoreVersion,
  Thread,
  Composer,
  SessionList,
  type SettingsRowRenderProps,
  type SessionItem,
} from "@acp/chat-react";
import {
  PACKAGE_VERSION,
  SessionController,
  type SessionControllerState,
  type StartAgentConfig,
  ReplayController,
  type SessionCaptureInterceptor,
} from "@acp/chat-core";
import { SettingsRow } from "./SettingsRow.js";
import { ReplayPanel } from "./components/ReplayPanel.js";
import { LivePanel } from "./components/LivePanel.js";

type SessionSource = "replay" | "live";
type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";
type PanelTab = "replay" | "live";

interface PerfMetrics {
  renderCount: number;
  lastRenderTime: number;
  avgRenderTime: number;
  messageCount: number;
  version: number;
}

function createMockController(): SessionController {
  return {
    getState: () => ({
      connectionStatus: "disconnected",
      bridgeStatus: "disconnected",
      sessionId: null,
      initialized: false,
      capabilities: null,
    }),
    on: () => () => {},
  } as unknown as SessionController;
}

function DiagnosticsPanel({ store }: { store: AcpStore }) {
  const session = useSessionState(store);
  const isConnected = useIsConnected(store);
  const version = useStoreVersion(store);

  return (
    <div data-acp-diagnostics-panel>
      <div data-acp-diagnostic-row>
        <span data-acp-diagnostic-label>Status</span>
        <span data-acp-diagnostic-value data-status={isConnected ? "good" : "warning"}>
          {session.connectionStatus}
        </span>
      </div>
      <Separator />
      <div data-acp-diagnostic-row>
        <span data-acp-diagnostic-label>Bridge Status</span>
        <span data-acp-diagnostic-value>{session.bridgeStatus}</span>
      </div>
      <Separator />
      <div data-acp-diagnostic-row>
        <span data-acp-diagnostic-label>Session ID</span>
        <span data-acp-diagnostic-value>{session.sessionId ?? "None"}</span>
      </div>
      <Separator />
      <div data-acp-diagnostic-row>
        <span data-acp-diagnostic-label>Initialized</span>
        <span data-acp-diagnostic-value data-status={session.initialized ? "good" : "warning"}>
          {session.initialized ? "Yes" : "No"}
        </span>
      </div>
      <Separator />
      <div data-acp-diagnostic-row>
        <span data-acp-diagnostic-label>Store Version</span>
        <span data-acp-diagnostic-value>{version}</span>
      </div>
    </div>
  );
}

function PerfDisplay({ store }: { store: AcpStore }) {
  const [metrics, setMetrics] = useState<PerfMetrics>({
    renderCount: 0,
    lastRenderTime: 0,
    avgRenderTime: 0,
    messageCount: 0,
    version: 0,
  });

  const messageCount = useMessagesCount(store);
  const version = useStoreVersion(store);

  useEffect(() => {
    const now = performance.now();
    setMetrics((prev) => {
      const newCount = prev.renderCount + 1;
      const totalTime = prev.avgRenderTime * prev.renderCount + (now - prev.lastRenderTime);
      return {
        renderCount: newCount,
        lastRenderTime: now,
        avgRenderTime: totalTime / newCount,
        messageCount,
        version,
      };
    });
  }, [version, messageCount]);

  return (
    <div data-acp-perf-panel>
      <div data-acp-perf-metric>
        <span data-acp-perf-metric-label>Messages</span>
        <span data-acp-perf-metric-value data-status="good">{metrics.messageCount}</span>
      </div>
      <div data-acp-perf-metric>
        <span data-acp-perf-metric-label>Render Count</span>
        <span data-acp-perf-metric-value>{metrics.renderCount}</span>
      </div>
      <div data-acp-perf-metric>
        <span data-acp-perf-metric-label>Avg Render (ms)</span>
        <span
          data-acp-perf-metric-value
          data-status={metrics.avgRenderTime < 16 ? "good" : metrics.avgRenderTime < 50 ? "warning" : "error"}
        >
          {metrics.avgRenderTime.toFixed(2)}
        </span>
      </div>
      <div data-acp-perf-metric>
        <span data-acp-perf-metric-label>Store Version</span>
        <span data-acp-perf-metric-value>{metrics.version}</span>
      </div>
    </div>
  );
}

function ThreadPanel({
  store,
  controller,
  renderSettingsRow,
}: {
  store: AcpStore;
  controller: SessionController | ReplayController;
  renderSettingsRow?: (props: SettingsRowRenderProps) => React.ReactNode;
}) {
  return (
    <div
      data-acp-thread-panel
      style={{
        flex: "1 1 0",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        border: "1px solid var(--harness-border)",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <div style={{ flex: "1 1 0", minHeight: 0, overflow: "hidden" }}>
        <Thread store={store} layout="centered" followScroll={true} />
      </div>
      <div
        data-acp-composer-panel
        style={{
          borderTop: "1px solid var(--harness-border)",
          padding: "12px",
          backgroundColor: "var(--harness-card-bg)",
        }}
      >
        <Composer
          store={store}
          controller={controller as SessionController}
          placeholder="Type a message... (Enter to send, Shift+Enter for newline, / for commands)"
          {...(renderSettingsRow ? { renderSettingsRow } : {})}
        />
      </div>
    </div>
  );
}

function SessionsSidebar({
  controller,
  isConnected,
  onSessionLoaded,
  onSessionLoadError,
}: {
  controller: SessionController | ReplayController | null;
  isConnected: boolean;
  onSessionLoaded?: (session: SessionItem) => void;
  onSessionLoadError?: (error: Error, session: SessionItem) => void;
}) {
  return (
    <div data-acp-sessions-sidebar style={{ flex: "1 1 0", minHeight: 0, display: "flex", flexDirection: "column" }}>
      <h3 style={{ fontSize: "14px", marginBottom: "12px", flexShrink: 0 }}>Sessions</h3>
      <div style={{ flex: "1 1 0", minHeight: 0, overflow: "auto" }}>
        {!isConnected ? (
          <div style={{ padding: "16px", textAlign: "center", color: "var(--harness-muted)" }}>
            Connect to browse sessions (isConnected=false)
          </div>
        ) : controller ? (
          <SessionList
            controller={controller as SessionController}
            autoFetch={true}
            onSessionLoaded={onSessionLoaded}
            onSessionLoadError={onSessionLoadError}
          />
        ) : (
          <div style={{ padding: "16px", textAlign: "center", color: "var(--harness-muted)" }}>
            No controller available
          </div>
        )}
      </div>
    </div>
  );
}

function ShellHeader() {
  return (
    <header data-acp-shell-header>
      <span data-acp-shell-title>ACP Chat Harness</span>
      <span style={{ color: "var(--harness-muted)", fontSize: "12px" }}>
        v{PACKAGE_VERSION}
      </span>
    </header>
  );
}

const STORAGE_KEY = "acp-harness-settings";

interface HarnessSettings {
  bridgeUrl: string;
  command: string;
  commandArgs: string;
  commandCwd: string;
}

function loadSettings(): HarnessSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore localStorage errors
  }
  return {
    bridgeUrl: "ws://127.0.0.1:8765",
    command: "",
    commandArgs: "",
    commandCwd: "",
  };
}

function saveSettings(settings: HarnessSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore localStorage errors
  }
}

export default function App() {
  const initialSettings = useMemo(() => loadSettings(), []);

  const [activeTab, setActiveTab] = useState<PanelTab>("replay");
  const [source, setSource] = useState<SessionSource>("replay");
  const [bridgeUrl, setBridgeUrl] = useState(initialSettings.bridgeUrl);
  const [command, setCommand] = useState(initialSettings.command);
  const [commandArgs, setCommandArgs] = useState(initialSettings.commandArgs);
  const [commandCwd, setCommandCwd] = useState(initialSettings.commandCwd);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [bridgeStatus, setBridgeStatus] = useState<string>("disconnected");
  const [isInitialized, setIsInitialized] = useState(false);

  const [selectedModeId, setSelectedModeId] = useState<string | undefined>(undefined);
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(undefined);
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(undefined);
  const [availableSessions, setAvailableSessions] = useState<SessionItem[]>([]);

  const controllerRef = useRef<SessionController | null>(null);
  const replayControllerRef = useRef<ReplayController | null>(null);
  const captureInterceptorRef = useRef<SessionCaptureInterceptor | null>(null);
  const storeRef = useRef<AcpStore | null>(null);
  const [activeStore, setActiveStore] = useState<AcpStore | null>(null);

  const [isCapturing, setIsCapturing] = useState(false);

  const stableMockStore = useMemo(() => {
    return new AcpStore(createMockController());
  }, []);

  useEffect(() => {
    return () => {
      stableMockStore.destroy();
    };
  }, [stableMockStore]);

  useEffect(() => {
    saveSettings({ bridgeUrl, command, commandArgs, commandCwd });
  }, [bridgeUrl, command, commandArgs, commandCwd]);

  const disconnect = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.disconnect();
      controllerRef.current = null;
    }
    if (replayControllerRef.current) {
      replayControllerRef.current.disconnect();
      replayControllerRef.current = null;
    }
    if (captureInterceptorRef.current) {
      captureInterceptorRef.current = null;
    }
    if (storeRef.current) {
      storeRef.current.destroy();
      storeRef.current = null;
    }
    setActiveStore(null);
    setConnectionStatus("disconnected");
    setBridgeStatus("disconnected");
    setIsInitialized(false);
    setIsCapturing(false);
  }, []);

  const connectToBridge = useCallback((url: string, shouldInitialize: boolean, agentConfig?: { command: string; args: string[]; cwd?: string }) => {
    if (controllerRef.current || storeRef.current) {
      disconnect();
    }

    setConnectionStatus("connecting");

    const controller = new SessionController(url, 30000);
    const store = new AcpStore(controller);

    controllerRef.current = controller;
    storeRef.current = store;

    const unsubStatus = controller.on("statusChange", (state: SessionControllerState) => {
      setConnectionStatus(state.connectionStatus as ConnectionStatus);
      setBridgeStatus(state.bridgeStatus);
      setIsInitialized(state.initialized);

      if (state.connectionStatus === "connected") {
        if (agentConfig) {
          const startAgentConfig: { command: string; args: string[]; cwd?: string } = {
            command: agentConfig.command,
            args: agentConfig.args,
          };
          if (agentConfig.cwd) {
            startAgentConfig.cwd = agentConfig.cwd;
          }
          controller.startAgent(startAgentConfig).catch((err: unknown) => {
            console.error("Failed to start agent:", err);
          });
        }
        if (shouldInitialize && !state.initialized) {
          controller.initialize({
            name: "acp-chat-harness",
            version: "0.0.1",
          }).catch((err: unknown) => {
            console.error("Failed to initialize:", err);
          });
        }
      }
    });

    const unsubError = controller.on("error", (error: Error) => {
      console.error("Connection error:", error);
      setConnectionStatus("error");
    });

    controller.connect();
    setActiveStore(store);

    return () => {
      unsubStatus();
      unsubError();
    };
  }, [disconnect]);

  const handleSourceChange = useCallback((newSource: SessionSource) => {
    const activeModes: SessionSource[] = ["replay", "live"];
    const wasActiveSession = activeModes.includes(source);
    const isActiveSession = activeModes.includes(newSource);
    const isSwitchingToDisconnectedMode = wasActiveSession && !isActiveSession;
    if (connectionStatus !== "disconnected" && isSwitchingToDisconnectedMode) {
      disconnect();
    }
    setSource(newSource);
  }, [connectionStatus, disconnect, source]);

  const handleReplayControllerChange = useCallback((controller: ReplayController | null) => {
    replayControllerRef.current = controller;

    if (controller) {
      const store = new AcpStore(controller as unknown as SessionController);
      storeRef.current = store;
      setActiveStore(store);

      const unsubStatus = controller.on("statusChange", (state) => {
        setConnectionStatus(state.connectionStatus as ConnectionStatus);
        setBridgeStatus(state.bridgeStatus);
        setIsInitialized(state.initialized);
      });

      const unsubError = controller.on("error", (error: Error) => {
        console.error("Replay controller error:", error);
        setConnectionStatus("error");
      });

      return () => {
        unsubStatus();
        unsubError();
      };
    } else {
      if (storeRef.current) {
        storeRef.current.destroy();
        storeRef.current = null;
      }
      setActiveStore(null);
      setConnectionStatus("disconnected");
      setBridgeStatus("disconnected");
      setIsInitialized(false);
      return undefined;
    }
  }, []);

  const handleReplayStatusChange = useCallback((status: "disconnected" | "connecting" | "replaying" | "complete" | "error") => {
    const statusMap: Record<string, ConnectionStatus> = {
      "disconnected": "disconnected",
      "connecting": "connecting",
      "replaying": "connected",
      "complete": "connected",
      "error": "error",
    };
    setConnectionStatus(statusMap[status] || "disconnected");
  }, []);

  const handleConnectLive = useCallback((config: { bridgeUrl: string; command: string; args: string; cwd: string }) => {
    const args = config.args.trim() ? config.args.trim().split(/\s+/) : [];
    const cwdValue = config.cwd.trim();

    const agentConfig: { command: string; args: string[]; cwd?: string } = {
      command: config.command,
      args,
    };
    if (cwdValue) {
      agentConfig.cwd = cwdValue;
    }

    connectToBridge(config.bridgeUrl, true, agentConfig);
  }, [connectToBridge]);

  const handleDisconnectLive = useCallback(() => {
    disconnect();
  }, [disconnect]);

  const handleCaptureSession = useCallback((session: unknown) => {
    console.log("Captured session:", session);
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const store = activeStore ?? stableMockStore;

  const isLiveModeEnabled = import.meta.env.VITE_ENABLE_LIVE_MODE === "true";

  return (
    <div data-acp-root>
      <ShellHeader />

      <div data-acp-shell-main>
        <aside
          data-acp-sessions-sidebar-container
          style={{
            width: "250px",
            flexShrink: 0,
            borderRight: "1px solid var(--harness-border)",
            padding: "16px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <SessionsSidebar
            controller={controllerRef.current || replayControllerRef.current}
            isConnected={connectionStatus === "connected" && bridgeStatus === "connected" && isInitialized}
          />
        </aside>

      <div data-acp-shell-content>
        {isLiveModeEnabled && (
          <div
            data-acp-panel-tabs
            style={{
              display: "flex",
              borderBottom: "1px solid var(--harness-border)",
              backgroundColor: "var(--harness-card-bg)",
            }}
          >
            <button
              type="button"
              data-acp-tab="replay"
              onClick={() => setActiveTab("replay")}
              style={{
                padding: "10px 20px",
                backgroundColor: activeTab === "replay" ? "var(--harness-bg)" : "transparent",
                border: "none",
                borderBottom: activeTab === "replay" ? "2px solid var(--harness-accent)" : "2px solid transparent",
                color: activeTab === "replay" ? "var(--harness-text)" : "var(--harness-muted)",
                fontSize: "14px",
                fontWeight: activeTab === "replay" ? 500 : 400,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Replay
            </button>
            <button
              type="button"
              data-acp-tab="live"
              onClick={() => setActiveTab("live")}
              style={{
                padding: "10px 20px",
                backgroundColor: activeTab === "live" ? "var(--harness-bg)" : "transparent",
                border: "none",
                borderBottom: activeTab === "live" ? "2px solid var(--harness-accent)" : "2px solid transparent",
                color: activeTab === "live" ? "var(--harness-text)" : "var(--harness-muted)",
                fontSize: "14px",
                fontWeight: activeTab === "live" ? 500 : 400,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Live
            </button>
          </div>
        )}
        {activeTab === "replay" && (
          <ReplayPanel
            onControllerChange={handleReplayControllerChange}
            onStatusChange={handleReplayStatusChange}
          />
        )}

        {isLiveModeEnabled && activeTab === "live" && (
          <LivePanel
            onConnect={handleConnectLive}
            onDisconnect={handleDisconnectLive}
            onCapture={handleCaptureSession}
            isConnected={connectionStatus === "connected"}
            isCapturing={isCapturing}
            captureInterceptor={null}
            store={activeStore}
          />
        )}

        <Separator orientation="horizontal" style={{ margin: "16px 0" }} />

          <ThreadPanel
            store={store}
            controller={controllerRef.current || replayControllerRef.current || createMockController()}
            renderSettingsRow={(props) => (
              <SettingsRow
                modes={props.modes}
                models={props.models}
                sessions={props.sessions}
                selectedModeId={selectedModeId}
                selectedModelId={selectedModelId}
                selectedSessionId={selectedSessionId}
                onModeChange={(mode) => {
                  setSelectedModeId(mode.id);
                  props.onModeChange(mode);
                }}
                onModelChange={(model) => {
                  setSelectedModelId(model.id);
                  props.onModelChange(model);
                }}
                onSessionChange={(session) => {
                  setSelectedSessionId(session.sessionId);
                  props.onSessionChange(session);
                }}
                disabled={props.disabled}
              />
            )}
          />
        </div>

        <aside data-acp-shell-sidebar>
          <h3 style={{ fontSize: "14px", marginBottom: "12px" }}>Diagnostics</h3>
          <DiagnosticsPanel store={store} />

          <Separator orientation="horizontal" style={{ margin: "16px 0" }} />

          <h3 style={{ fontSize: "14px", marginBottom: "12px" }}>Performance</h3>
          <PerfDisplay store={store} />
        </aside>
      </div>
    </div>
  );
}
