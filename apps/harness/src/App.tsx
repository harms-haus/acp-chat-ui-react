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
  SessionList,
  SettingsPanel,
  SettingsSelect,
  SettingsCheckbox,
  SettingsSwitch,
  DEFAULT_ACP_MODES,
  DEFAULT_ACP_MODELS,
  type AcpMode,
  type AcpModel,
  type SettingsRowRenderProps,
  type SessionItem,
  type SettingsPanelProps,
  type SlashCommand,
  type MessageAction,
} from "@acp/chat-react";
import { PACKAGE_VERSION, SessionController, type SessionControllerState, type StartAgentConfig } from "@acp/chat-core";
import { SettingsRow } from "./SettingsRow.js";
import { StandaloneSessionListDemo } from "./StandaloneSessionListDemo.js";

type SessionSource = "replay" | "live" | "demo" | "thought-tool" | "standalone-session-list" | "settings-panel" | "slash-actions";
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

  const demoSessions = [
    {
      sessionId: "demo-session-1",
      cwd: "/home/user/project1",
      title: "Demo Session 1",
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      sessionId: "demo-session-2",
      cwd: "/home/user/project2",
      title: "Demo Session 2",
      updatedAt: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      sessionId: "demo-session-3",
      cwd: "/home/user/project3",
      title: "Demo Session 3",
      updatedAt: new Date(Date.now() - 10800000).toISOString(),
    },
  ];

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
    listSessions: async (cursor?: string, cwd?: string) => {
      if (cursor) {
        return { sessions: [], nextCursor: undefined };
      }
      const filteredSessions = cwd
        ? demoSessions.filter((s) => s.cwd.startsWith(cwd))
        : demoSessions;
      return { sessions: filteredSessions, nextCursor: undefined };
    },
    loadSession: async (sessionId: string, cwd: string) => {
      const session = demoSessions.find((s) => s.sessionId === sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }
      return { sessionId };
    },
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

function createThoughtToolDemoController(
  onMessageSent?: (text: string) => void,
  onStreamingStart?: () => void,
  onStreamingStop?: () => void
): SessionController {
  let sessionId = "thought-tool-demo-" + Date.now();
  let isStreaming = false;
  const handlers: {
    statusChange?: Array<(state: SessionControllerState) => void>;
    sessionUpdate?: Array<(params: unknown) => void>;
  } = { statusChange: [], sessionUpdate: [] };

  const demoSessions = [
    {
      sessionId: "thought-session-1",
      cwd: "/home/user/thought-project",
      title: "Thought Tool Session 1",
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      sessionId: "thought-session-2",
      cwd: "/home/user/analysis",
      title: "Analysis Session",
      updatedAt: new Date(Date.now() - 7200000).toISOString(),
    },
  ];

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
    listSessions: async (cursor?: string, cwd?: string) => {
      if (cursor) {
        return { sessions: [], nextCursor: undefined };
      }
      const filteredSessions = cwd
        ? demoSessions.filter((s) => s.cwd.startsWith(cwd))
        : demoSessions;
      return { sessions: filteredSessions, nextCursor: undefined };
    },
    loadSession: async (sessionId: string, cwd: string) => {
      const session = demoSessions.find((s) => s.sessionId === sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }
      return { sessionId };
    },
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
        const toolCallId = `tool-${Date.now()}`;

        notifySessionUpdate({
          update: {
            sessionUpdate: "agent_thought_chunk",
            turnId,
            role: "agent",
            content: [{ type: "text", text: "I need to analyze this code for bugs" }],
            status: "in_progress",
            timestamp: Date.now(),
          },
        });

        setTimeout(() => {
          notifySessionUpdate({
            update: {
              sessionUpdate: "tool_call",
              turnId,
              role: "agent",
              toolCallId,
              kind: "read",
              title: "Read main.ts",
              status: "pending",
              rawInput: { filePath: "/src/main.ts" },
              timestamp: Date.now(),
            },
          });

          setTimeout(() => {
            notifySessionUpdate({
              update: {
                sessionUpdate: "tool_call_update",
                turnId,
                role: "agent",
                toolCallId,
                kind: "read",
                title: "Read main.ts",
                status: "completed",
                rawInput: { filePath: "/src/main.ts" },
                rawOutput: {
                  output: "function add(a: number, b: number) {\\n  return a + b;\\n}\\n\\nfunction subtract(a, b) {\\n  return a - b;\\n}",
                  metadata: { truncated: false, exit: 0 },
                },
                timestamp: Date.now(),
              },
            });

            notifySessionUpdate({
              update: {
                sessionUpdate: "agent_thought_chunk",
                turnId,
                role: "agent",
                content: [{ type: "text", text: "I see the subtract function is missing type annotations" }],
                status: "in_progress",
                timestamp: Date.now(),
              },
            });

            setTimeout(() => {
              notifySessionUpdate({
                update: {
                  sessionUpdate: "agent_message_chunk",
                  turnId,
                  role: "agent",
                  content: [{ type: "text", text: "I found a bug! The `subtract` function is missing type annotations." }],
                  status: "done",
                  timestamp: Date.now(),
                },
              });
              isStreaming = false;
              onStreamingStop?.();
            }, 500);
          }, 500);
        }, 500);
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

function ThreadPanel({
  store,
  controller,
  renderSettingsRow,
  slashCommands,
  messageActions,
}: {
  store: AcpStore;
  controller: SessionController;
  renderSettingsRow?: (props: SettingsRowRenderProps) => React.ReactNode;
  slashCommands?: SlashCommand[];
  messageActions?: MessageAction[];
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
        <Thread store={store} layout="centered" followScroll={true} messageActions={messageActions} />
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
          placeholder="Type a message... (Enter to send, Shift+Enter for newline, / for commands)"
          {...(renderSettingsRow ? { renderSettingsRow } : {})}
          {...(slashCommands ? { slashCommands } : {})}
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
  command,
  onCommandChange,
  commandArgs,
  onCommandArgsChange,
  commandCwd,
  onCommandCwdChange,
  connectionStatus,
  onLoadReplay,
  onConnectLive,
  onStartDemo,
  onDisconnect,
  controller,
  isConnected,
  store,
}: {
  source: SessionSource;
  onSourceChange: (source: SessionSource) => void;
  replayFile: string;
  onReplayFileChange: (file: string) => void;
  bridgeUrl: string;
  onBridgeUrlChange: (url: string) => void;
  command: string;
  onCommandChange: (cmd: string) => void;
  commandArgs: string;
  onCommandArgsChange: (args: string) => void;
  commandCwd: string;
  onCommandCwdChange: (cwd: string) => void;
  connectionStatus: ConnectionStatus;
  onLoadReplay: () => void;
  onConnectLive: () => void;
  onStartDemo: () => void;
  onDisconnect: () => void;
  controller: SessionController | null;
  isConnected: boolean;
  store: AcpStore;
}) {
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
      <Tabs.Tab data-acp-session-source-tab value="thought-tool" data-selected={source === "thought-tool"}>
        Thought/Tool
      </Tabs.Tab>
      <Tabs.Tab data-acp-session-source-tab value="standalone-session-list" data-selected={source === "standalone-session-list"}>
        SessionList Demo
      </Tabs.Tab>
      <Tabs.Tab data-acp-session-source-tab value="settings-panel" data-selected={source === "settings-panel"}>
        SettingsPanel Demo
      </Tabs.Tab>
      <Tabs.Tab data-acp-session-source-tab value="slash-actions" data-selected={source === "slash-actions"}>
        Slash/Actions Demo
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
          <div style={{ display: "flex", gap: "8px" }}>
            <div style={{ flex: "1 1 0", display: "flex", flexDirection: "column", gap: "4px" }}>
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
            </div>
            <div style={{ flex: "1 1 0", display: "flex", flexDirection: "column", gap: "4px" }}>
              <label htmlFor="command-input" style={{ color: "var(--harness-muted)", fontSize: "12px" }}>
                Command
              </label>
              <input
                id="command-input"
                type="text"
                value={command}
                onChange={(e) => onCommandChange(e.target.value)}
                placeholder="node"
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
            </div>
            <div style={{ flex: "1 1 0", display: "flex", flexDirection: "column", gap: "4px" }}>
              <label htmlFor="command-args-input" style={{ color: "var(--harness-muted)", fontSize: "12px" }}>
                Arguments
              </label>
              <input
                id="command-args-input"
                type="text"
                value={commandArgs}
                onChange={(e) => onCommandArgsChange(e.target.value)}
                placeholder="./dist/server.js"
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
            </div>
            <div style={{ flex: "2 1 0", display: "flex", flexDirection: "column", gap: "4px" }}>
              <label htmlFor="command-cwd-input" style={{ color: "var(--harness-muted)", fontSize: "12px" }}>
                Working Directory
              </label>
              <input
                id="command-cwd-input"
                type="text"
                value={commandCwd}
                onChange={(e) => onCommandCwdChange(e.target.value)}
                placeholder="/path/to/working/dir"
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
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
            <Button
              onClick={isConnected ? onDisconnect : onConnectLive}
              disabled={isConnecting || (!isConnected && !command)}
              style={{
                padding: "8px 16px",
                backgroundColor: isConnected ? "var(--harness-error)" : "var(--harness-accent)",
                borderRadius: "4px",
                fontSize: "14px",
                opacity: isConnecting || (!isConnected && !command) ? 0.6 : 1,
              }}
            >
              {isConnected ? "Disconnect" : isConnecting ? "Connecting..." : "Connect Live"}
            </Button>
          </div>
          <p style={{ color: "var(--harness-muted)", fontSize: "11px", marginTop: "4px" }}>
            Start bridge with: cargo run --manifest-path crates/acp-bridge/Cargo.toml -- dynamic
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

      <Tabs.Panel value="thought-tool">
        <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <p style={{ color: "var(--harness-text)", fontSize: "14px" }}>
            Thought/Tool demo mode simulates agent reasoning with tool calls.
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
              {isConnected ? "Disconnect" : isConnecting ? "Connecting..." : "Start Thought/Tool Demo"}
            </Button>
          </div>
          <p style={{ color: "var(--harness-muted)", fontSize: "11px", marginTop: "4px" }}>
            Simulates agent thoughts and tool calls for Task 9 QA
          </p>
        </div>
      </Tabs.Panel>

      <Tabs.Panel value="standalone-session-list">
        <StandaloneSessionListDemo
          controller={controller}
          isConnected={isConnected}
        />
      </Tabs.Panel>

      <Tabs.Panel value="settings-panel">
        <SettingsPanelDemo
          controller={controller}
          isConnected={isConnected}
        />
      </Tabs.Panel>

      <Tabs.Panel value="slash-actions">
        <SlashActionsDemo
          store={store}
          controller={controller}
          isConnected={isConnected}
        />
      </Tabs.Panel>
    </Tabs.Root>
  );
}

function SettingsPanelDemo({
  controller,
  isConnected,
}: {
  controller: SessionController | null;
  isConnected: boolean;
}) {
  const [selectedModeId, setSelectedModeId] = useState<string | undefined>(undefined);
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(undefined);
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(undefined);
  const [useCustomRender, setUseCustomRender] = useState(false);

  const handleModeChange = useCallback((mode: AcpMode) => {
    setSelectedModeId(mode.id);
    console.log("Mode changed:", mode);
  }, []);

  const handleModelChange = useCallback((model: AcpModel) => {
    setSelectedModelId(model.id);
    console.log("Model changed:", model);
  }, []);

  const handleSessionChange = useCallback((session: SessionItem) => {
    setSelectedSessionId(session.sessionId);
    console.log("Session changed:", session);
  }, []);

  const customRenderSettingsRow = useCallback(
    (props: SettingsRowRenderProps) => (
      <div
        data-acp-settings-row
        data-acp-settings-row-custom
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          padding: "16px",
          backgroundColor: "var(--harness-accent-bg, rgba(0, 102, 204, 0.1))",
          borderRadius: "8px",
          border: "2px dashed var(--harness-accent, #0066cc)",
        }}
      >
        <h4 style={{ margin: 0, fontSize: "14px", color: "var(--harness-accent, #0066cc)" }}>
          Custom Settings Row (Consumer-Provided)
        </h4>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          <SettingsSelect
            data-acp-id="custom-mode"
            value={props.modes.find((m) => m.id === props.selectedModeId) ?? null}
            options={props.modes}
            onChange={props.onModeChange}
            placeholder="Custom mode selector..."
            disabled={props.disabled}
          />
          <SettingsSelect
            data-acp-id="custom-model"
            value={props.models.find((m) => m.id === props.selectedModelId) ?? null}
            options={props.models}
            onChange={props.onModelChange}
            placeholder="Custom model selector..."
            disabled={props.disabled}
          />
        </div>
        <div style={{ fontSize: "12px", color: "var(--harness-muted)" }}>
          Selected: {props.selectedModeId || "none"} / {props.selectedModelId || "none"} /{" "}
          {props.selectedSessionId || "none"}
        </div>
      </div>
    ),
    []
  );

  return (
    <div
      data-acp-settings-panel-demo
      style={{
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "12px",
          backgroundColor: "var(--harness-card-bg)",
          borderRadius: "8px",
          border: "1px solid var(--harness-border)",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={useCustomRender}
            onChange={(e) => setUseCustomRender(e.target.checked)}
          />
          <span>Use custom renderSettingsRow</span>
        </label>
      </div>

      {!isConnected ? (
        <div
          style={{
            padding: "32px",
            textAlign: "center",
            color: "var(--harness-muted)",
            backgroundColor: "var(--harness-card-bg)",
            borderRadius: "8px",
            border: "1px solid var(--harness-border)",
          }}
        >
          Connect to a session source to use SettingsPanel
        </div>
      ) : controller ? (
        <SettingsPanel
          controller={controller}
          selectedModeId={selectedModeId}
          selectedModelId={selectedModelId}
          selectedSessionId={selectedSessionId}
          onModeChange={handleModeChange}
          onModelChange={handleModelChange}
          onSessionChange={handleSessionChange}
          {...(useCustomRender ? { renderSettingsRow: customRenderSettingsRow } : {})}
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

      <div
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
          <li>Toggle between default SettingsPanel and custom renderSettingsRow</li>
          <li>Default: Uses library SettingsSelect components for mode/model/session</li>
          <li>Custom: Consumer-provided settings row with custom layout</li>
          <li>All selections logged to console</li>
        </ul>
      </div>
    </div>
  );
}

function SlashActionsDemo({
  store,
  controller,
  isConnected,
}: {
  store: AcpStore;
  controller: SessionController | null;
  isConnected: boolean;
}) {
  const slashCommands: SlashCommand[] = [
    { id: "help", name: "Help", description: "Show help information" },
    { id: "clear", name: "Clear", description: "Clear the conversation" },
    { id: "mode", name: "Mode", description: "Change agent mode" },
    { id: "model", name: "Model", description: "Change AI model" },
  ];

  const messageActions: MessageAction[] = [
    {
      id: "reply",
      label: "Reply",
      onClick: (msg) => console.log("Reply to:", msg.id),
    },
    {
      id: "forward",
      label: "Forward",
      onClick: (msg) => console.log("Forward:", msg.id),
    },
  ];

  return (
    <div
      data-acp-slash-actions-demo
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        padding: "16px",
      }}
    >
      <div
        style={{
          padding: "12px",
          backgroundColor: "var(--harness-card-bg)",
          borderRadius: "8px",
          border: "1px solid var(--harness-border)",
        }}
      >
        <h4 style={{ margin: "0 0 8px 0", fontSize: "14px" }}>Slash Commands & Message Actions Demo</h4>
        <p style={{ margin: 0, fontSize: "12px", color: "var(--harness-muted)" }}>
          Type / in the composer for slash suggestions. Hover over messages for action buttons.
        </p>
      </div>

      {!isConnected ? (
        <div
          style={{
            padding: "32px",
            textAlign: "center",
            color: "var(--harness-muted)",
            backgroundColor: "var(--harness-card-bg)",
            borderRadius: "8px",
            border: "1px solid var(--harness-border)",
          }}
        >
          Connect to a session source to test slash commands and message actions
        </div>
      ) : controller ? (
        <ThreadPanel
          store={store}
          controller={controller}
          slashCommands={slashCommands}
          messageActions={messageActions}
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
  );
}

function SessionsSidebar({
  controller,
  isConnected,
  onSessionLoaded,
  onSessionLoadError,
}: {
  controller: SessionController | null;
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
        controller={controller}
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

  const [source, setSource] = useState<SessionSource>("replay");
  const [replayFile, setReplayFile] = useState("fixtures/sample-replay.jsonl");
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

  useEffect(() => {
    saveSettings({ bridgeUrl, command, commandArgs, commandCwd });
  }, [bridgeUrl, command, commandArgs, commandCwd]);

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
    setBridgeStatus("disconnected");
    setIsInitialized(false);
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
  }, [disconnect]);

  const handleSourceChange = useCallback((newSource: SessionSource) => {
    const activeModes: SessionSource[] = ["replay", "live", "demo", "settings-panel", "standalone-session-list", "slash-actions"];
    const wasActiveSession = activeModes.includes(source);
    const isActiveSession = activeModes.includes(newSource);
    const isSwitchingToDisconnectedMode = wasActiveSession && !isActiveSession;
    if (connectionStatus !== "disconnected" && isSwitchingToDisconnectedMode) {
      disconnect();
    }
    setSource(newSource);
  }, [connectionStatus, disconnect, source]);

  const handleLoadReplay = useCallback(() => {
    if (connectionStatus === "connected") {
      disconnect();
    } else {
      connectToBridge(bridgeUrl, false);
    }
  }, [connectionStatus, bridgeUrl, connectToBridge, disconnect]);

  const handleConnectLive = useCallback(() => {
    const args = commandArgs.trim() ? commandArgs.trim().split(/\s+/) : [];
    const cwdValue = commandCwd.trim();

    const agentConfig: { command: string; args: string[]; cwd?: string } = {
      command,
      args,
    };
    if (cwdValue) {
      agentConfig.cwd = cwdValue;
    }

    connectToBridge(bridgeUrl, true, agentConfig);
  }, [bridgeUrl, connectToBridge, command, commandArgs, commandCwd]);

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

  const connectToThoughtToolDemo = useCallback(() => {
    if (controllerRef.current || storeRef.current) {
      disconnect();
    }

    setConnectionStatus("connecting");

    const controller = createThoughtToolDemoController();
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
      console.error("Thought/Tool demo error:", error);
      setConnectionStatus("error");
    });

    setActiveStore(store);
    setConnectionStatus("connected");
  }, [disconnect]);

  const handleStartDemo = useCallback(() => {
    if (connectionStatus === "connected") {
      disconnect();
    } else if (source === "thought-tool") {
      connectToThoughtToolDemo();
    } else {
      connectToDemo();
    }
  }, [connectionStatus, source, connectToDemo, connectToThoughtToolDemo, disconnect]);

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
        controller={controllerRef.current}
        isConnected={connectionStatus === "connected" && bridgeStatus === "connected" && isInitialized}
      />
        </aside>

        <div data-acp-shell-content>
      <SessionSourceSelector
        source={source}
        onSourceChange={handleSourceChange}
        replayFile={replayFile}
        onReplayFileChange={setReplayFile}
        bridgeUrl={bridgeUrl}
        onBridgeUrlChange={setBridgeUrl}
        command={command}
        onCommandChange={setCommand}
        commandArgs={commandArgs}
        onCommandArgsChange={setCommandArgs}
        commandCwd={commandCwd}
        onCommandCwdChange={setCommandCwd}
        connectionStatus={connectionStatus}
        onLoadReplay={handleLoadReplay}
        onConnectLive={handleConnectLive}
        onStartDemo={handleStartDemo}
        onDisconnect={disconnect}
        controller={controllerRef.current}
        isConnected={connectionStatus === "connected"}
        store={store}
      />

      <Separator orientation="horizontal" style={{ margin: "16px 0" }} />

      <ThreadPanel
        store={store}
        controller={controllerRef.current ?? createMockController()}
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