import { useState, useCallback, useEffect, useMemo } from "react";
import { Button } from "@base-ui-components/react/button";
import { SettingsSelect } from "@acp/chat-react";
import { ReplayController } from "@acp/chat-core";
import type { ReplayControllerState, PermissionOption } from "@acp/chat-core";
import { SpeedSlider } from "./SpeedSlider";

const DEFAULT_REPLAY_SPEED = 65;

type DemoType = "tool-calling-thinking" | "long-context" | "permission-request";

type ConnectionStatus = "disconnected" | "connecting" | "replaying" | "complete" | "error";

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

const DEMO_TYPES: { id: DemoType; name: string; description: string }[] = [
  {
    id: "tool-calling-thinking",
    name: "Tool Calling/Thinking",
    description: "Agent reasoning with tool calls and thought processes",
  },
  {
    id: "long-context",
    name: "Long Context",
    description: "Sessions with extensive context and message history",
  },
  {
    id: "permission-request",
    name: "Permission Request",
    description: "Agent requesting user permission for actions",
  },
];

const DEFAULT_BRIDGE_URL = "ws://127.0.0.1:8765";

function getUserFriendlyReplayError(rawMessage: string, scriptName: string, sessionId: string): string {
  if (rawMessage.includes("Script not found") || rawMessage.includes("No such file")) {
    return `Script not found: ${scriptName}. Check that the script exists in fixtures/replay-data/`;
  }
  if (rawMessage.match(/\bsession not found\b/i)) {
    return `Session not found: ${sessionId}`;
  }
  if (rawMessage.includes("Failed to initialize")) {
    return `Failed to initialize: ${rawMessage}`;
  }
  return rawMessage;
}

export function ReplayPanel({ onControllerChange, onStatusChange }: ReplayPanelProps) {
  const [selectedDemoType, setSelectedDemoType] = useState<DemoType | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [controller, setController] = useState<ReplayController | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingPermission, setPendingPermission] = useState<PermissionRequest | null>(null);
  const [replaySpeed, setReplaySpeed] = useState<number>(() => {
    const saved = localStorage.getItem("replay-speed");
    if (!saved) return DEFAULT_REPLAY_SPEED;
    const parsed = parseInt(saved, 10);
    const initial = Number.isFinite(parsed) && !isNaN(parsed) ? parsed : DEFAULT_REPLAY_SPEED;
    return initial;
  });

  useEffect(() => {
    onStatusChange?.(connectionStatus);
  }, [connectionStatus, onStatusChange]);

  useEffect(() => {
    onControllerChange?.(controller);
  }, [controller, onControllerChange]);

  const SESSION_ID = "session-1";

  const handleStartReplay = useCallback(async () => {
    if (!selectedDemoType) {
      setErrorMessage("Please select a demo type");
      return;
    }

    if (controller) {
      await controller.disconnect();
      setController(null);
    }

    setConnectionStatus("connecting");
    setErrorMessage(null);

    try {
      const newController = new ReplayController({
        bridgeUrl: DEFAULT_BRIDGE_URL,
        modes: [],
        models: [],
      });

      newController.on("statusChange", (state: ReplayControllerState) => {
        if (state.connectionStatus === "connected") {
          setConnectionStatus("replaying");
        } else if (state.connectionStatus === "disconnected") {
          setConnectionStatus("disconnected");
        }
        if (state.bridgeStatus === "disconnected" && state.connectionStatus === "connected") {
          setConnectionStatus("complete");
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

      newController.connect();

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

      await newController.initReplay(selectedDemoType, SESSION_ID, replaySpeed);

      setController(newController);
      setConnectionStatus("replaying");
    } catch (err) {
      console.error("Failed to start replay:", err);
      const rawMessage = err instanceof Error ? err.message : "Failed to start replay";
      const userFriendlyMessage = getUserFriendlyReplayError(rawMessage, selectedDemoType, SESSION_ID);
      setErrorMessage(userFriendlyMessage);
      setConnectionStatus("error");
      setController(null);
    }
  }, [selectedDemoType, controller, replaySpeed]);

  const handleDisconnect = useCallback(async () => {
    if (controller) {
      await controller.disconnect();
      setController(null);
    }
    setConnectionStatus("disconnected");
    setErrorMessage(null);
    setPendingPermission(null);
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

  const isConnected = connectionStatus === "replaying" || connectionStatus === "complete";
  const isConnecting = connectionStatus === "connecting";

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
      <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
        <div style={{ flex: "1 1 0", minWidth: 0 }}>
          <label
            htmlFor="demo-type-select"
            style={{ color: "var(--harness-muted)", fontSize: "11px", display: "block", marginBottom: "4px" }}
          >
            Demo Type
          </label>
          <SettingsSelect
            data-acp-id="demo-type"
            value={DEMO_TYPES.find((t) => t.id === selectedDemoType) ?? null}
            options={DEMO_TYPES}
            onChange={(type) => setSelectedDemoType(type.id as DemoType)}
            placeholder="Select..."
            disabled={isConnected || isConnecting}
          />
        </div>
        <Button
          data-acp-replay-start
          onClick={isConnected ? handleDisconnect : handleStartReplay}
          disabled={
            isConnecting ||
            (!isConnected && !selectedDemoType)
          }
          style={{
            padding: "6px 12px",
            backgroundColor: isConnected ? "var(--harness-error)" : "var(--harness-accent)",
            borderRadius: "4px",
            fontSize: "13px",
            whiteSpace: "nowrap",
            opacity:
              isConnecting || (!isConnected && !selectedDemoType)
                ? 0.6
                : 1,
          }}
        >
          {isConnected ? "Disconnect" : isConnecting ? "Connecting..." : "Start Replay"}
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
