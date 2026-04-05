import { useState, useCallback, useEffect } from "react";
import { Button } from "@base-ui-components/react/button";
import type { CapturedSession } from "@acp/chat-core";
import type { AcpStore } from "@acp/chat-react";

interface LivePanelProps {
  onConnect: (config: {
    bridgeUrl: string;
    command: string;
    args: string;
    cwd: string;
  }) => void;
  onDisconnect: () => void;
  onCapture?: (session: CapturedSession) => void;
  isConnected: boolean;
  isCapturing: boolean;
  captureInterceptor?: {
    stopCaptureAndExport: (outputDir?: string) => CapturedSession;
    isCapturing: () => boolean;
  } | null;
  store?: AcpStore | null;
}

interface ToastState {
  message: string;
  visible: boolean;
  type: "success" | "error";
}

export function LivePanel({
  onConnect,
  onDisconnect,
  onCapture,
  isConnected,
  isCapturing,
  captureInterceptor,
  store,
}: LivePanelProps) {
  const isLiveModeEnabled = import.meta.env.VITE_ENABLE_LIVE_MODE === "true";

  const [bridgeUrl, setBridgeUrl] = useState("ws://127.0.0.1:8766");

  // Load saved config from localStorage on mount
  const [command, setCommand] = useState(() => {
    try {
      const saved = localStorage.getItem("acp-harness-live-config");
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.command || "";
      }
    } catch (error) {
      // Ignore parsing errors
    }
    return "";
  });

  const [args, setArgs] = useState(() => {
    try {
      const saved = localStorage.getItem("acp-harness-live-config");
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.args || "";
      }
    } catch (error) {
      // Ignore parsing errors
    }
    return "";
  });

  const [cwd, setCwd] = useState(() => {
    try {
      const saved = localStorage.getItem("acp-harness-live-config");
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.cwd || "";
      }
    } catch (error) {
      // Ignore parsing errors
    }
    return "";
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [toast, setToast] = useState<ToastState>({
    message: "",
    visible: false,
    type: "success",
  });

  // Persist connection config to localStorage on changes
  useEffect(() => {
    const config = { command, args, cwd };
    localStorage.setItem("acp-harness-live-config", JSON.stringify(config));
  }, [command, args, cwd]);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, visible: true, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 5000);
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleConnect = useCallback(() => {
    if (!command) return;
    setIsConnecting(true);
    onConnect({ bridgeUrl, command, args, cwd });
    setTimeout(() => setIsConnecting(false), 1000);
  }, [onConnect, bridgeUrl, command, args, cwd]);

  const handleDisconnect = useCallback(() => {
    onDisconnect();
  }, [onDisconnect]);

  const handleCapture = useCallback(() => {
    if (!captureInterceptor || !captureInterceptor.isCapturing()) {
      showToast("No active capture session to export", "error");
      return;
    }

    try {
      const session = captureInterceptor.stopCaptureAndExport();
      const exportPath = `fixtures/replay-data/captured/${session.startTime}/`;
      showToast(`Session exported to: ${exportPath}`, "success");
      onCapture?.(session);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      showToast(`Export failed: ${errorMessage}`, "error");
    }
  }, [captureInterceptor, onCapture, showToast]);

  const handleRecordAndDownload = useCallback(() => {
    if (!store) {
      showToast("No store available", "error");
      return;
    }

    try {
      const sessionState = store.getSessionState();
      const messages = store.getMessages();
      const thoughts = store.getThoughts();
      const toolCalls = store.getToolCalls();
      const permissionRequests = store.getPermissionRequests();
      const timeline = store.getTimeline();

      const sessionData = {
        sessionId: sessionState.sessionId,
        connectionStatus: sessionState.connectionStatus,
        bridgeStatus: sessionState.bridgeStatus,
        initialized: sessionState.initialized,
        capabilities: sessionState.capabilities,
        messages: messages.map(m => ({
          id: m.id,
          role: m.role,
          status: m.status,
          content: m.content,
          contentBlocks: m.contentBlocks,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
          parentMessageId: m.parentMessageId,
          turnId: m.turnId,
        })),
        thoughts: thoughts.map(t => ({
          id: t.id,
          content: t.content,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        })),
        toolCalls: toolCalls.map(tc => ({
          toolCallId: tc.toolCallId,
          kind: tc.kind,
          title: tc.title,
          status: tc.status,
          rawInput: tc.rawInput,
          rawOutput: tc.rawOutput,
          createdAt: tc.createdAt,
          updatedAt: tc.updatedAt,
        })),
        permissionRequests: permissionRequests.map(pr => ({
          requestId: pr.requestId,
          sessionId: pr.sessionId,
          toolCallId: pr.toolCallId,
          options: pr.options,
          status: pr.status,
          selectedOptionId: pr.selectedOptionId,
          createdAt: pr.createdAt,
        })),
        timelineOrder: timeline.map(item => ({
          type: item.type,
          id: item.id,
        })),
        exportedAt: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      showToast("Session recorded and downloaded", "success");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      showToast(`Record & download failed: ${errorMessage}`, "error");
    }
  }, [store, showToast]);

  if (!isLiveModeEnabled) {
    return null;
  }

  const isFormDisabled = isConnected || isConnecting;

  return (
    <div
      data-acp-live-panel
      style={{
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div style={{ display: "flex", gap: "8px" }}>
        <div
          style={{
            flex: "1 1 0",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <label
            htmlFor="bridge-url-input"
            style={{
              color: "var(--harness-muted)",
              fontSize: "12px",
            }}
          >
            Bridge WebSocket URL
          </label>
          <input
            id="bridge-url-input"
            type="text"
            value={bridgeUrl}
            onChange={(e) => setBridgeUrl(e.target.value)}
            placeholder="ws://127.0.0.1:8766"
            disabled={isFormDisabled}
            style={{
              padding: "8px 12px",
              borderRadius: "4px",
              border: "1px solid var(--harness-border)",
              backgroundColor: "var(--harness-card-bg)",
              color: "var(--harness-text)",
              fontSize: "14px",
              opacity: isFormDisabled ? 0.6 : 1,
            }}
          />
        </div>

        <div
          style={{
            flex: "1 1 0",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <label
            htmlFor="command-input"
            style={{
              color: "var(--harness-muted)",
              fontSize: "12px",
            }}
          >
            Command
          </label>
          <input
            id="command-input"
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="node"
            disabled={isFormDisabled}
            style={{
              padding: "8px 12px",
              borderRadius: "4px",
              border: "1px solid var(--harness-border)",
              backgroundColor: "var(--harness-card-bg)",
              color: "var(--harness-text)",
              fontSize: "14px",
              opacity: isFormDisabled ? 0.6 : 1,
            }}
          />
        </div>

        <div
          style={{
            flex: "1 1 0",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <label
            htmlFor="command-args-input"
            style={{
              color: "var(--harness-muted)",
              fontSize: "12px",
            }}
          >
            Arguments
          </label>
          <input
            id="command-args-input"
            type="text"
            value={args}
            onChange={(e) => setArgs(e.target.value)}
            placeholder="./dist/server.js"
            disabled={isFormDisabled}
            style={{
              padding: "8px 12px",
              borderRadius: "4px",
              border: "1px solid var(--harness-border)",
              backgroundColor: "var(--harness-card-bg)",
              color: "var(--harness-text)",
              fontSize: "14px",
              opacity: isFormDisabled ? 0.6 : 1,
            }}
          />
        </div>

        <div
          style={{
            flex: "2 1 0",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <label
            htmlFor="command-cwd-input"
            style={{
              color: "var(--harness-muted)",
              fontSize: "12px",
            }}
          >
            Working Directory
          </label>
          <input
            id="command-cwd-input"
            type="text"
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            placeholder="/path/to/working/dir"
            disabled={isFormDisabled}
            style={{
              padding: "8px 12px",
              borderRadius: "4px",
              border: "1px solid var(--harness-border)",
              backgroundColor: "var(--harness-card-bg)",
              color: "var(--harness-text)",
              fontSize: "14px",
              opacity: isFormDisabled ? 0.6 : 1,
            }}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
        <Button
          onClick={isConnected ? handleDisconnect : handleConnect}
          disabled={isConnecting || (!isConnected && !command)}
          style={{
            padding: "8px 16px",
            backgroundColor: isConnected
              ? "var(--harness-error)"
              : "var(--harness-accent)",
            borderRadius: "4px",
            fontSize: "14px",
            opacity: isConnecting || (!isConnected && !command) ? 0.6 : 1,
            border: "none",
            cursor: isConnecting || (!isConnected && !command) ? "not-allowed" : "pointer",
            color: "var(--harness-text)",
          }}
        >
          {isConnected
            ? "Disconnect"
            : isConnecting
              ? "Connecting..."
              : "Connect Live"}
        </Button>

        <Button
          onClick={handleRecordAndDownload}
          disabled={!isConnected}
          style={{
            padding: "8px 16px",
            backgroundColor: isConnected ? "var(--harness-accent)" : "var(--harness-border)",
            borderRadius: "4px",
            fontSize: "14px",
            border: "none",
            cursor: isConnected ? "pointer" : "not-allowed",
            color: "var(--harness-text)",
            opacity: isConnected ? 1 : 0.6,
          }}
        >
          Record & Download
        </Button>

        <Button
          onClick={handleCapture}
          disabled={!isConnected || !isCapturing}
          style={{
            padding: "8px 16px",
            backgroundColor: isCapturing
              ? "var(--harness-success)"
              : "var(--harness-border)",
            borderRadius: "4px",
            fontSize: "14px",
            opacity: isCapturing ? 1 : 0.6,
            border: "none",
            cursor: isCapturing ? "pointer" : "not-allowed",
            color: "var(--harness-text)",
          }}
        >
          Capture Session
        </Button>
      </div>

      <p
        style={{
          color: "var(--harness-muted)",
          fontSize: "11px",
          marginTop: "4px",
        }}
      >
        Start bridge with: cargo run --manifest-path crates/acp-bridge/Cargo.toml
        -- dynamic
      </p>

      {toast.visible && (
        <button
          type="button"
          onClick={hideToast}
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            padding: "12px 16px",
            borderRadius: "4px",
            backgroundColor:
              toast.type === "success"
                ? "var(--harness-success)"
                : "var(--harness-error)",
            color: "#1a1a2e",
            fontSize: "14px",
            fontWeight: 500,
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
            cursor: "pointer",
            zIndex: 1000,
            animation: "slideIn 0.3s ease-out",
            border: "none",
            textAlign: "left",
          }}
        >
          {toast.message}
          <span
            style={{
              marginLeft: "8px",
              fontSize: "12px",
              opacity: 0.7,
            }}
          >
            (click to dismiss)
          </span>
        </button>
      )}

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

export default LivePanel;
