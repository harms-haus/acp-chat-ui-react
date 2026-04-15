import { useState, useCallback, useEffect, useMemo } from "react";
import { Button } from "@base-ui-components/react/button";
import { SettingsSelect } from "@harms-haus/acp-chat-react";
import { ReplayController } from "@harms-haus/acp-chat-core";
import type { ReplayControllerState, PermissionOption } from "@harms-haus/acp-chat-core";
import { SpeedSlider } from "./SpeedSlider";

const DEFAULT_REPLAY_SPEED = 65;
const DEFAULT_BRIDGE_URL = "ws://127.0.0.1:8765";

type ConnectionStatus = "disconnected" | "connecting" | "initializing" | "connected" | "replaying" | "complete" | "error";

interface SessionInfo {
  id: string;
  name: string;
  description: string;
}

interface PermissionRequest {
  requestId: number;
  sessionId: string;
  toolCallId: string;
  options: PermissionOption[];
}

interface ReplayPanelProps {
  onControllerChange?: (controller: ReplayController | null) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
}

function getUserFriendlyReplayError(rawMessage: string): string {
  if (rawMessage.includes("Script not found") || rawMessage.includes("No such file")) {
    return `Replay data not found. Check that the path exists.`;
  }
  if (rawMessage.match(/\bsession not found\b/i)) {
    return `Session not found`;
  }
  if (rawMessage.includes("Failed to initialize")) {
    return `Failed to initialize: ${rawMessage}`;
  }
  return rawMessage;
}

export function ReplayPanel({ onControllerChange, onStatusChange }: ReplayPanelProps) {
  // Connection and path state
  const [replayDataPath, setReplayDataPath] = useState(() => {
    try {
      const saved = localStorage.getItem("acp-harness-replay-config");
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.replayDataPath || "";
      }
    } catch (_error) {
      // Ignore parsing errors
    }
    return "";
  });
  const [bridgeUrl, setBridgeUrl] = useState(() => {
    try {
      const saved = localStorage.getItem("acp-harness-replay-config");
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.bridgeUrl || DEFAULT_BRIDGE_URL;
      }
    } catch (_error) {
      // Ignore parsing errors
    }
    return DEFAULT_BRIDGE_URL;
  });

  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");

  // Capabilities from initialize response
  const [availableSessions, setAvailableSessions] = useState<SessionInfo[]>([]);
  const [availableModes, setAvailableModes] = useState<SessionInfo[]>([]);
  const [availableModels, setAvailableModels] = useState<SessionInfo[]>([]);

  // User selections
  const [selectedSession, setSelectedSession] = useState<SessionInfo | null>(null);
  const [selectedMode, setSelectedMode] = useState<SessionInfo | null>(null);
  const [selectedModel, setSelectedModel] = useState<SessionInfo | null>(null);

  const [controller, setController] = useState<ReplayController | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingPermission, setPendingPermission] = useState<PermissionRequest | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState<number>(() => {
    const saved = localStorage.getItem("replay-speed");
    if (!saved) return DEFAULT_REPLAY_SPEED;
    const parsed = parseInt(saved, 10);
    const initial = Number.isFinite(parsed) && !isNaN(parsed) ? parsed : DEFAULT_REPLAY_SPEED;
    return initial;
  });

  // Persist config to localStorage
  useEffect(() => {
    const config = { replayDataPath, bridgeUrl };
    localStorage.setItem("acp-harness-replay-config", JSON.stringify(config));
  }, [replayDataPath, bridgeUrl]);

  useEffect(() => {
    onStatusChange?.(connectionStatus);
  }, [connectionStatus, onStatusChange]);

  useEffect(() => {
    onControllerChange?.(controller);
  }, [controller, onControllerChange]);

  const handleConnect = useCallback(async () => {
    if (!replayDataPath) return;

    setIsConnecting(true);
    setErrorMessage(null);
    setConnectionStatus("connecting");

    try {
      // Disconnect existing controller if any
      if (controller) {
        await controller.disconnect();
        setController(null);
      }

      const newController = new ReplayController({
        bridgeUrl,
        modes: [],
        models: [],
      });

      // Track previous status to avoid stale closures
      let prevStatus: ConnectionStatus = "connecting";

      newController.on("statusChange", (state: ReplayControllerState) => {
        console.log('[ReplayPanel] statusChange:', state);
        if (state.connectionStatus === "connected") {
          if (prevStatus === "connecting" || prevStatus === "error") {
            setIsConnected(true);
            prevStatus = "connected";
          }
        } else if (state.connectionStatus === "disconnected") {
          setIsConnected(false);
          setConnectionStatus("disconnected");
          prevStatus = "disconnected";
        }
        // Mark as complete only when bridge disconnects after being in replaying state
        if (state.bridgeStatus === "disconnected" && prevStatus === "replaying") {
          setConnectionStatus("complete");
          prevStatus = "complete";
        }
      });

      newController.on("error", (error: Error) => {
        console.error("Replay error:", error);
        setErrorMessage(error.message);
        setConnectionStatus("error");
      });

      newController.on("permissionRequest", (params: any) => {
        console.log("Permission request received:", params);
        setPendingPermission({
          requestId: params.requestId,
          sessionId: params.sessionId,
          toolCallId: params.toolCall.toolCallId,
          options: params.options,
        });
      });

      // Connect to bridge
      newController.connect();

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const checkConnection = () => {
          const state = newController.getState();
          if (state.connectionStatus === "connected") {
            resolve();
          } else if (state.connectionStatus === "error") {
            reject(new Error("Failed to connect to bridge"));
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        setTimeout(() => reject(new Error("Connection timeout")), 10000);
        checkConnection();
      });

      setIsConnected(true);
      setIsInitializing(true);
      setConnectionStatus("initializing");

      // Initialize with _meta.replay.replayDataPath
      const initResult = await newController.initialize({
        name: "acp-harness-ui",
        version: "0.0.1",
      }, replayDataPath);

      // Store capabilities from initialize response
      const capabilities = initResult as {
        sessions?: Array<{ sessionId: string; description?: string }>;
        availableModes?: string[];
        availableModels?: string[];
      };

      if (capabilities.sessions) {
        const sessions: SessionInfo[] = capabilities.sessions.map((s: { sessionId: string; description?: string }) => ({
          id: s.sessionId,
          name: s.description || s.sessionId,
          description: s.description || "",
        }));
        setAvailableSessions(sessions);
        if (sessions.length > 0) {
          setSelectedSession(sessions[0] ?? null);
        }
      }

      if (capabilities.availableModes) {
        const modes: SessionInfo[] = capabilities.availableModes.map((id: string) => ({
          id,
          name: id.charAt(0).toUpperCase() + id.slice(1),
          description: "",
        }));
        setAvailableModes(modes);
        if (modes.length > 0) {
          setSelectedMode(modes[0] ?? null);
        }
      }

      if (capabilities.availableModels) {
        const models: SessionInfo[] = capabilities.availableModels.map((id: string) => ({
          id,
          name: id.charAt(0).toUpperCase() + id.slice(1),
          description: "",
        }));
        setAvailableModels(models);
        if (models.length > 0) {
          setSelectedModel(models[0] ?? null);
        }
      }

      setController(newController);
      setIsInitializing(false);
      setConnectionStatus("connected");
    } catch (err) {
      console.error("Failed to connect:", err);
      const rawMessage = err instanceof Error ? err.message : "Failed to connect";
      const userFriendlyMessage = getUserFriendlyReplayError(rawMessage);
      setErrorMessage(userFriendlyMessage);
      setConnectionStatus("error");
      setIsConnected(false);
      setController(null);
    } finally {
      setIsConnecting(false);
    }
  }, [replayDataPath, bridgeUrl, controller]);

  const handleStartReplay = useCallback(async () => {
    if (!controller || !selectedSession) {
      setErrorMessage("Please connect and select a session first");
      return;
    }

    setConnectionStatus("replaying");
    setErrorMessage(null);

  try {
    // Set replay speed before starting
    controller.setReplaySpeed(replaySpeed);

    // Start replay by sending a dummy prompt - the bridge will stream replay events
    await controller.sendPrompt(selectedSession.id, "");
    } catch (err) {
      console.error("Failed to start replay:", err);
      const rawMessage = err instanceof Error ? err.message : "Failed to start replay";
      const userFriendlyMessage = getUserFriendlyReplayError(rawMessage);
      setErrorMessage(userFriendlyMessage);
      setConnectionStatus("error");
    }
  }, [controller, selectedSession, replaySpeed]);

  const handleDisconnect = useCallback(async () => {
    if (controller) {
      await controller.disconnect();
      setController(null);
    }
    setIsConnected(false);
    setIsInitializing(false);
    setConnectionStatus("disconnected");
    setErrorMessage(null);
    setPendingPermission(null);
    setAvailableSessions([]);
    setAvailableModes([]);
    setAvailableModels([]);
    setSelectedSession(null);
    setSelectedMode(null);
    setSelectedModel(null);
  }, [controller]);

  const handlePermissionResponse = useCallback((optionId: string) => {
    if (controller && pendingPermission) {
      controller.respondToPermission(pendingPermission.requestId, optionId);
      setPendingPermission(null);
    }
  }, [controller, pendingPermission]);

const handleSpeedChange = useCallback((speed: number) => {
  setReplaySpeed(speed);
  localStorage.setItem("replay-speed", String(speed));
  controller?.setReplaySpeed(speed);
}, [controller]);

const statusDisplay = useMemo(() => {
    switch (connectionStatus) {
      case "disconnected":
        return { text: "Disconnected", color: "var(--harness-muted)" };
      case "connecting":
        return { text: "Connecting...", color: "var(--harness-accent)" };
      case "initializing":
        return { text: "Initializing...", color: "var(--harness-accent)" };
      case "connected":
        return { text: "Connected", color: "#22c55e" };
      case "replaying":
        return { text: "Replaying...", color: "var(--harness-accent)" };
      case "complete":
        return { text: "Complete", color: "#22c55e" };
      case "error":
        return { text: "Error", color: "var(--harness-error)" };
      default:
        return { text: "Unknown", color: "var(--harness-muted)" };
    }
  }, [connectionStatus]);

  const isFormDisabled = isConnected || isConnecting || isInitializing;
  const isReplayActive = connectionStatus === "replaying" || connectionStatus === "complete";

  return (
    <div
      data-acp-replay-panel
      style={{
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {/* Connection inputs */}
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
            htmlFor="replay-bridge-url-input"
            style={{
              color: "var(--harness-muted)",
              fontSize: "12px",
            }}
          >
            Bridge WebSocket URL
          </label>
          <input
            id="replay-bridge-url-input"
            type="text"
            value={bridgeUrl}
            onChange={(e) => setBridgeUrl(e.target.value)}
            placeholder="ws://127.0.0.1:8765"
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
            htmlFor="replay-data-path-input"
            style={{
              color: "var(--harness-muted)",
              fontSize: "12px",
            }}
          >
            Replay Data Path
          </label>
          <input
            id="replay-data-path-input"
            type="text"
            value={replayDataPath}
            onChange={(e) => setReplayDataPath(e.target.value)}
            placeholder="fixtures/replay-data/tool-calling-thinking"
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

      {/* Connect/Disconnect button and status */}
      <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
        <Button
          data-acp-replay-connect
          onClick={isConnected ? handleDisconnect : handleConnect}
          disabled={isConnecting || (!isConnected && !replayDataPath)}
          style={{
            padding: "8px 16px",
            backgroundColor: isConnected
              ? "var(--harness-error)"
              : "var(--harness-accent)",
            borderRadius: "4px",
            fontSize: "14px",
            opacity: isConnecting || (!isConnected && !replayDataPath) ? 0.6 : 1,
            border: "none",
            cursor: isConnecting || (!isConnected && !replayDataPath) ? "not-allowed" : "pointer",
            color: "var(--harness-text)",
          }}
        >
          {isConnected
            ? "Disconnect"
            : isInitializing
            ? "Initializing..."
            : isConnecting
            ? "Connecting..."
            : "Connect"}
        </Button>

        <div
          data-acp-replay-status
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 10px",
            backgroundColor: "var(--harness-card-bg)",
            borderRadius: "4px",
            border: "1px solid var(--harness-border)",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ color: "var(--harness-muted)", fontSize: "11px" }}>Status:</span>
          <span
            style={{
              color: statusDisplay.color,
              fontSize: "11px",
              fontWeight: 500,
            }}
          >
            {statusDisplay.text}
          </span>
        </div>
      </div>

      {/* Session/Mode/Model selectors - only show when connected */}
      {isConnected && !isInitializing && (
        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
          {availableSessions.length > 0 && (
            <div style={{ flex: "1 1 0", minWidth: 0 }}>
              <label
                htmlFor="session-select"
                style={{ color: "var(--harness-muted)", fontSize: "11px", display: "block", marginBottom: "4px" }}
              >
                Session
              </label>
              <SettingsSelect
                data-acp-id="replay-session"
                value={selectedSession}
                options={availableSessions}
                onChange={setSelectedSession}
                placeholder="Select session..."
                disabled={isReplayActive}
              />
            </div>
          )}

          {availableModes.length > 0 && (
            <div style={{ flex: "1 1 0", minWidth: 0 }}>
              <label
                htmlFor="mode-select"
                style={{ color: "var(--harness-muted)", fontSize: "11px", display: "block", marginBottom: "4px" }}
              >
                Mode
              </label>
              <SettingsSelect
                data-acp-id="replay-mode"
                value={selectedMode}
                options={availableModes}
                onChange={setSelectedMode}
                placeholder="Select mode..."
                disabled={isReplayActive}
              />
            </div>
          )}

          {availableModels.length > 0 && (
            <div style={{ flex: "1 1 0", minWidth: 0 }}>
              <label
                htmlFor="model-select"
                style={{ color: "var(--harness-muted)", fontSize: "11px", display: "block", marginBottom: "4px" }}
              >
                Model
              </label>
              <SettingsSelect
                data-acp-id="replay-model"
                value={selectedModel}
                options={availableModels}
                onChange={setSelectedModel}
                placeholder="Select model..."
                disabled={isReplayActive}
              />
            </div>
          )}

          <Button
            data-acp-replay-start
            onClick={isReplayActive ? handleDisconnect : handleStartReplay}
            disabled={!selectedSession || isInitializing}
            style={{
              padding: "6px 12px",
              backgroundColor: isReplayActive ? "var(--harness-error)" : "var(--harness-accent)",
              borderRadius: "4px",
              fontSize: "13px",
              whiteSpace: "nowrap",
              opacity: !selectedSession || isInitializing ? 0.6 : 1,
              border: "none",
              cursor: !selectedSession || isInitializing ? "not-allowed" : "pointer",
              color: "var(--harness-text)",
              alignSelf: "flex-end",
            }}
          >
            {isReplayActive ? "Stop" : "Start Replay"}
          </Button>
        </div>
      )}

      <SpeedSlider value={replaySpeed} onChange={handleSpeedChange} />

      {errorMessage && (
        <div
          data-acp-replay-error
          style={{
            padding: "8px 12px",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            borderRadius: "4px",
            border: "1px solid var(--harness-error)",
            color: "var(--harness-error)",
            fontSize: "12px",
          }}
        >
          {errorMessage}
        </div>
      )}

      {pendingPermission && (
        <div
          data-acp-permission-dialog
          style={{
            padding: "16px",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            borderRadius: "4px",
            border: "1px solid var(--harness-accent)",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div style={{ color: "var(--harness-foreground)", fontSize: "13px", fontWeight: 500 }}>
            Permission Request
          </div>
          <div style={{ color: "var(--harness-muted)", fontSize: "11px" }}>
            Tool Call ID: {pendingPermission.toolCallId}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {pendingPermission.options.map((option) => (
              <Button
                key={option.optionId}
                onClick={() => handlePermissionResponse(option.optionId)}
                style={{
                  padding: "8px 12px",
                  backgroundColor: option.kind === "deny" || option.kind === "deny_always"
                    ? "rgba(239, 68, 68, 0.1)"
                    : "rgba(34, 197, 94, 0.1)",
                  border: `1px solid ${option.kind === "deny" || option.kind === "deny_always" ? "var(--harness-error)" : "#22c55e"}`,
                  borderRadius: "4px",
                  color: option.kind === "deny" || option.kind === "deny_always"
                    ? "var(--harness-error)"
                    : "#22c55e",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                {option.name}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
