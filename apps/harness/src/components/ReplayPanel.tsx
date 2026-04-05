import { useState, useCallback, useEffect, useMemo } from "react";
import { Button } from "@base-ui-components/react/button";
import { SettingsSelect } from "@acp/chat-react";
import { ReplayController } from "@acp/chat-core";
import type { ReplayControllerState } from "@acp/chat-core";

type DemoType = "tool-calling-thinking" | "long-context" | "permission-request";

type ConnectionStatus = "disconnected" | "connecting" | "replaying" | "complete" | "error";

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

export function ReplayPanel({ onControllerChange, onStatusChange }: ReplayPanelProps) {
  const [selectedDemoType, setSelectedDemoType] = useState<DemoType | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [controller, setController] = useState<ReplayController | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    onStatusChange?.(connectionStatus);
  }, [connectionStatus, onStatusChange]);

  useEffect(() => {
    onControllerChange?.(controller);
  }, [controller, onControllerChange]);

  const handleStartReplay = useCallback(async () => {
    if (!selectedDemoType) {
      setErrorMessage("Please select a demo type");
      return;
    }

    if (controller) {
      controller.disconnect();
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

      await newController.initialize({
        name: "acp-chat-harness",
        version: "0.0.1",
      });

      await newController.createSession(
        "/",
        [],
        selectedDemoType,
        "session-1",
      );

      setController(newController);
      setConnectionStatus("replaying");
    } catch (err) {
      console.error("Failed to start replay:", err);
      setErrorMessage(err instanceof Error ? err.message : "Failed to start replay");
      setConnectionStatus("error");
      setController(null);
    }
  }, [selectedDemoType, controller]);

  const handleDisconnect = useCallback(() => {
    if (controller) {
      controller.disconnect();
      setController(null);
    }
    setConnectionStatus("disconnected");
    setErrorMessage(null);
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
    </div>
  );
}
