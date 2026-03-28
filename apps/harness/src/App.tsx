import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Tabs } from "@base-ui-components/react/tabs";
import { Button } from "@base-ui-components/react/button";
import { Separator } from "@base-ui-components/react/separator";
import {
  AcpStore,
  useSessionState,
  useIsConnected,
  useMessagesCount,
  useStoreVersion,
  Thread,
  Composer,
} from "@acp/chat-react";
import { PACKAGE_VERSION, SessionController, type SessionControllerState } from "@acp/chat-core";

type SessionSource = "replay" | "live" | "demo";
type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

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

function createDemoController(
  onMessageSent?: (text: string) => void,
  onStreamingStart?: () => void,
  onStreamingStop?: () => void
): SessionController {
  let sessionId = "demo-session-" + Date.now();
  let isStreaming = false;
  const handlers: {
    statusChange?: Array<(state: SessionControllerState) => void>;
    sessionUpdate?: Array<(params: unknown) => void>;
  } = { statusChange: [], sessionUpdate: [] };

  const notifyStatusChange = (state: SessionControllerState) => {
    handlers.statusChange?.forEach((h) => { h(state); });
  };

  const notifySessionUpdate = (params: unknown) => {
    handlers.sessionUpdate?.forEach((h) => { h(params); });
  };

  const controller: SessionController = {
    getState: () => ({
      connectionStatus: "connected" as const,
      bridgeStatus: "ready",
      sessionId,
      initialized: true,
      capabilities: {},
    }),
    on: (event: string, handler: unknown) => {
      if (event === "statusChange") {
        handlers.statusChange?.push(handler as (state: SessionControllerState) => void);
      } else if (event === "sessionUpdate") {
        handlers.sessionUpdate?.push(handler as (params: unknown) => void);
      }
      return () => {};
    },
    connect: () => {},
    disconnect: () => {
      notifyStatusChange({
        connectionStatus: "disconnected",
        bridgeStatus: "disconnected",
        sessionId: null,
        initialized: false,
        capabilities: null,
      });
    },
    initialize: async () => ({}),
    createSession: async () => ({ sessionId }),
    sendPrompt: async (sid: string, prompt: string) => {
      onMessageSent?.(prompt);

      notifySessionUpdate({
        update: {
          sessionUpdate: "user_message",
          turnId: `turn-${Date.now()}`,
          role: "user",
          content: [{ type: "text", text: prompt }],
          timestamp: Date.now(),
        },
      });

      setTimeout(() => {
        isStreaming = true;
        onStreamingStart?.();

        const turnId = `agent-turn-${Date.now()}`;
        notifySessionUpdate({
          update: {
            sessionUpdate: "agent_message_chunk",
            turnId,
            role: "agent",
            content: [{ type: "text", text: "This is a demo response. " }],
            status: "in_progress",
            timestamp: Date.now(),
          },
        });

        let chunkCount = 0;
        const interval = setInterval(() => {
          chunkCount++;
          if (chunkCount >= 3) {
            clearInterval(interval);
            notifySessionUpdate({
              update: {
                sessionUpdate: "agent_message_chunk",
                turnId,
                role: "agent",
                content: [{ type: "text", text: "Streaming complete." }],
                status: "done",
                timestamp: Date.now(),
              },
            });
            isStreaming = false;
            onStreamingStop?.();
          } else {
            notifySessionUpdate({
              update: {
                sessionUpdate: "agent_message_chunk",
                turnId,
                role: "agent",
                content: [{ type: "text", text: `Chunk ${chunkCount}. ` }],
                status: "in_progress",
              timestamp: Date.now(),
            },
            });
          }
        }, 1000);
      }, 100);
    },
    cancelPrompt: async () => {
      isStreaming = false;
      onStreamingStop?.();
    },
  } as unknown as SessionController;

  return controller;
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

function ThreadPanel({ store, controller }: { store: AcpStore; controller: SessionController }) {
  return (
    <div
      data-acp-thread-panel
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        border: "1px solid var(--harness-border)",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
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
          controller={controller}
          placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
        />
      </div>
    </div>
  );
}

function SessionSourceSelector({
  source,
  onSourceChange,
  replayFile,
  onReplayFileChange,
  bridgeUrl,
  onBridgeUrlChange,
  connectionStatus,
  onLoadReplay,
  onConnectLive,
  onStartDemo,
  onDisconnect,
}: {
  source: SessionSource;
  onSourceChange: (source: SessionSource) => void;
  replayFile: string;
  onReplayFileChange: (file: string) => void;
  bridgeUrl: string;
  onBridgeUrlChange: (url: string) => void;
  connectionStatus: ConnectionStatus;
  onLoadReplay: () => void;
  onConnectLive: () => void;
  onStartDemo: () => void;
  onDisconnect: () => void;
}) {
  const isConnected = connectionStatus === "connected";
  const isConnecting = connectionStatus === "connecting";

  return (
    <Tabs.Root value={source} onValueChange={(val) => onSourceChange(val as SessionSource)}>
      <Tabs.List data-acp-session-source-tabs>
        <Tabs.Tab data-acp-session-source-tab value="replay" data-selected={source === "replay"}>
          Replay
        </Tabs.Tab>
        <Tabs.Tab data-acp-session-source-tab value="live" data-selected={source === "live"}>
          Live
        </Tabs.Tab>
        <Tabs.Tab data-acp-session-source-tab value="demo" data-selected={source === "demo"}>
          Demo
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="replay">
        <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <label htmlFor="replay-file-input" style={{ color: "var(--harness-muted)", fontSize: "12px" }}>
            Replay File Path (passed to bridge via --replay-file)
          </label>
          <input
            id="replay-file-input"
            type="text"
            value={replayFile}
            onChange={(e) => onReplayFileChange(e.target.value)}
            placeholder="fixtures/sample-replay.jsonl"
            disabled={isConnected || isConnecting}
            style={{
              padding: "8px 12px",
              borderRadius: "4px",
              border: "1px solid var(--harness-border)",
              backgroundColor: "var(--harness-card-bg)",
              color: "var(--harness-text)",
              fontSize: "14px",
              opacity: isConnected || isConnecting ? 0.6 : 1,
            }}
          />
          <div style={{ display: "flex", gap: "8px" }}>
            <Button
              onClick={onLoadReplay}
              disabled={isConnecting}
              style={{
                padding: "8px 16px",
                backgroundColor: isConnected ? "var(--harness-error)" : "var(--harness-accent)",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            >
              {isConnected ? "Disconnect" : isConnecting ? "Connecting..." : "Load Replay"}
            </Button>
          </div>
          <p style={{ color: "var(--harness-muted)", fontSize: "11px", marginTop: "4px" }}>
            Start bridge with: cargo run --manifest-path crates/acp-bridge/Cargo.toml -- replay -f {replayFile}
          </p>
        </div>
      </Tabs.Panel>

      <Tabs.Panel value="live">
        <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <label htmlFor="bridge-url-input" style={{ color: "var(--harness-muted)", fontSize: "12px" }}>
            Bridge WebSocket URL
          </label>
          <input
            id="bridge-url-input"
            type="text"
            value={bridgeUrl}
            onChange={(e) => onBridgeUrlChange(e.target.value)}
            placeholder="ws://127.0.0.1:8765"
            disabled={isConnected || isConnecting}
            style={{
              padding: "8px 12px",
              borderRadius: "4px",
              border: "1px solid var(--harness-border)",
              backgroundColor: "var(--harness-card-bg)",
              color: "var(--harness-text)",
              fontSize: "14px",
              opacity: isConnected || isConnecting ? 0.6 : 1,
            }}
          />
          <div style={{ display: "flex", gap: "8px" }}>
            <Button
              onClick={isConnected ? onDisconnect : onConnectLive}
              disabled={isConnecting}
              style={{
                padding: "8px 16px",
                backgroundColor: isConnected ? "var(--harness-error)" : "var(--harness-accent)",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            >
              {isConnected ? "Disconnect" : isConnecting ? "Connecting..." : "Connect Live"}
            </Button>
          </div>
          <p style={{ color: "var(--harness-muted)", fontSize: "11px", marginTop: "4px" }}>
            Connects to a running ACP bridge at the specified WebSocket URL
          </p>
        </div>
      </Tabs.Panel>

      <Tabs.Panel value="demo">
        <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <p style={{ color: "var(--harness-text)", fontSize: "14px" }}>
            Demo mode simulates a working ACP session for testing the composer.
          </p>
          <div style={{ display: "flex", gap: "8px" }}>
            <Button
              onClick={isConnected ? onDisconnect : onStartDemo}
              disabled={isConnecting}
              style={{
                padding: "8px 16px",
                backgroundColor: isConnected ? "var(--harness-error)" : "var(--harness-accent)",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            >
              {isConnected ? "Disconnect" : isConnecting ? "Connecting..." : "Start Demo"}
            </Button>
          </div>
          <p style={{ color: "var(--harness-muted)", fontSize: "11px", marginTop: "4px" }}>
            Messages are simulated locally for browser QA
          </p>
        </div>
      </Tabs.Panel>
    </Tabs.Root>
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

export default function App() {
  const [source, setSource] = useState<SessionSource>("replay");
  const [replayFile, setReplayFile] = useState("fixtures/sample-replay.jsonl");
  const [bridgeUrl, setBridgeUrl] = useState("ws://127.0.0.1:8765");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");

  const controllerRef = useRef<SessionController | null>(null);
  const storeRef = useRef<AcpStore | null>(null);
  const [activeStore, setActiveStore] = useState<AcpStore | null>(null);

  const stableMockStore = useMemo(() => {
    return new AcpStore(createMockController());
  }, []);

  useEffect(() => {
    return () => {
      stableMockStore.destroy();
    };
  }, [stableMockStore]);

  const disconnect = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.disconnect();
      controllerRef.current = null;
    }
    if (storeRef.current) {
      storeRef.current.destroy();
      storeRef.current = null;
    }
    setActiveStore(null);
    setConnectionStatus("disconnected");
  }, []);

  const connectToBridge = useCallback((url: string, shouldInitialize: boolean) => {
    if (controllerRef.current || storeRef.current) {
      disconnect();
    }

    setConnectionStatus("connecting");

    const controller = new SessionController(url, 30000);
    const store = new AcpStore(controller);

    controllerRef.current = controller;
    storeRef.current = store;

    const unsubStatus = controller.on("statusChange", (state: SessionControllerState) => {
      if (state.connectionStatus === "connected") {
        setConnectionStatus("connected");
        if (shouldInitialize) {
          controller.initialize({
            name: "acp-chat-harness",
            version: "0.0.1",
          }).catch((err: unknown) => {
            console.error("Failed to initialize:", err);
          });
        }
      } else if (state.connectionStatus === "disconnected") {
        setConnectionStatus("disconnected");
      } else if (state.connectionStatus === "connecting" || state.connectionStatus === "reconnecting") {
        setConnectionStatus("connecting");
      }
    });

    const unsubError = controller.on("error", (error: Error) => {
      console.error("Connection error:", error);
      setConnectionStatus("error");
    });

    controller.connect();
    setActiveStore(store);
  }, [disconnect]);

  const handleSourceChange = useCallback((newSource: SessionSource) => {
    if (connectionStatus !== "disconnected") {
      disconnect();
    }
    setSource(newSource);
  }, [connectionStatus, disconnect]);

  const handleLoadReplay = useCallback(() => {
    if (connectionStatus === "connected") {
      disconnect();
    } else {
      connectToBridge(bridgeUrl, false);
    }
  }, [connectionStatus, bridgeUrl, connectToBridge, disconnect]);

  const handleConnectLive = useCallback(() => {
    connectToBridge(bridgeUrl, true);
  }, [bridgeUrl, connectToBridge]);

  const connectToDemo = useCallback(() => {
    if (controllerRef.current || storeRef.current) {
      disconnect();
    }

    setConnectionStatus("connecting");

    const controller = createDemoController();
    const store = new AcpStore(controller);

    controllerRef.current = controller;
    storeRef.current = store;

    const unsubStatus = controller.on("statusChange", (state: SessionControllerState) => {
      if (state.connectionStatus === "connected") {
        setConnectionStatus("connected");
      } else if (state.connectionStatus === "disconnected") {
        setConnectionStatus("disconnected");
      }
    });

    const unsubError = controller.on("error", (error: Error) => {
      console.error("Demo error:", error);
      setConnectionStatus("error");
    });

    setActiveStore(store);
    setConnectionStatus("connected");
  }, [disconnect]);

  const handleStartDemo = useCallback(() => {
    if (connectionStatus === "connected") {
      disconnect();
    } else {
      connectToDemo();
    }
  }, [connectionStatus, connectToDemo, disconnect]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const store = activeStore ?? stableMockStore;

  return (
    <div data-acp-root>
      <ShellHeader />

      <div data-acp-shell-main>
        <div data-acp-shell-content>
        <SessionSourceSelector
          source={source}
          onSourceChange={handleSourceChange}
          replayFile={replayFile}
          onReplayFileChange={setReplayFile}
          bridgeUrl={bridgeUrl}
          onBridgeUrlChange={setBridgeUrl}
          connectionStatus={connectionStatus}
          onLoadReplay={handleLoadReplay}
          onConnectLive={handleConnectLive}
          onStartDemo={handleStartDemo}
          onDisconnect={disconnect}
        />

          <Separator orientation="horizontal" style={{ margin: "16px 0" }} />

          <ThreadPanel store={store} controller={controllerRef.current ?? createMockController()} />
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