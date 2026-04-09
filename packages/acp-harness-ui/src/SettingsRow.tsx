import { Combobox } from "@base-ui-components/react/combobox";
import { Tooltip } from "@base-ui-components/react/tooltip";
import type { AcpMode, AcpModel, SessionItem } from "@acp/chat-react";

interface SettingsRowProps {
  modes: AcpMode[];
  models: AcpModel[];
  sessions: SessionItem[];
  selectedModeId: string | undefined;
  selectedModelId: string | undefined;
  selectedSessionId: string | undefined;
  onModeChange: (mode: AcpMode) => void;
  onModelChange: (model: AcpModel) => void;
  onSessionChange: (session: SessionItem) => void;
  disabled: boolean;
}

export function SettingsRow({
  modes,
  models,
  sessions,
  selectedModeId,
  selectedModelId,
  selectedSessionId,
  onModeChange,
  onModelChange,
  onSessionChange,
  disabled,
}: SettingsRowProps) {
  const selectedMode = modes.find((m) => m.id === selectedModeId);
  const selectedModel = models.find((m) => m.id === selectedModelId);
  const selectedSession = sessions.find((s) => s.sessionId === selectedSessionId);

  return (
    <div
      data-acp-settings-row
      style={{
        display: "flex",
        gap: "12px",
        alignItems: "center",
        padding: "8px 12px",
        borderTop: "1px solid var(--harness-border)",
        backgroundColor: "var(--harness-card-bg)",
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? "none" : "auto",
      }}
    >
      <Combobox.Root
        value={selectedModeId ?? ""}
        onValueChange={(value) => {
          const mode = modes.find((m) => m.id === value);
          if (mode) onModeChange(mode);
        }}
      >
        <Combobox.Trigger
          data-acp-settings-mode-trigger
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "6px 10px",
            borderRadius: "4px",
            border: "1px solid var(--harness-border)",
            backgroundColor: "var(--harness-bg)",
            color: "var(--harness-text)",
            fontSize: "13px",
            cursor: "pointer",
            minWidth: "120px",
          }}
        >
          <Combobox.Input
            data-acp-settings-mode-input
            placeholder="Select mode..."
            style={{
              border: "none",
              background: "transparent",
              color: "inherit",
              fontSize: "inherit",
              width: "100%",
              outline: "none",
            }}
          />
          <Combobox.Icon>▼</Combobox.Icon>
        </Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup
              data-acp-settings-mode-popup
              style={{
                backgroundColor: "var(--harness-card-bg)",
                border: "1px solid var(--harness-border)",
                borderRadius: "4px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                maxHeight: "200px",
                overflow: "auto",
              }}
            >
              <Combobox.List>
                {modes.map((mode) => (
                  <Tooltip.Root key={mode.id}>
                    <Tooltip.Trigger render={
                      <Combobox.Item
                        data-acp-settings-mode-item
                        value={mode.id}
                        style={{
                          padding: "8px 12px",
                          cursor: "pointer",
                          fontSize: "13px",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <Combobox.ItemIndicator>✓</Combobox.ItemIndicator>
                        {mode.name}
                      </Combobox.Item>
                    } />
                    {mode.description && (
                      <Tooltip.Portal>
                        <Tooltip.Positioner>
                          <Tooltip.Popup
                            style={{
                              backgroundColor: "var(--harness-text)",
                              color: "var(--harness-bg)",
                              padding: "6px 10px",
                              borderRadius: "4px",
                              fontSize: "12px",
                              maxWidth: "200px",
                            }}
                          >
                            {mode.description}
                          </Tooltip.Popup>
                        </Tooltip.Positioner>
                      </Tooltip.Portal>
                    )}
                  </Tooltip.Root>
                ))}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>

      <Combobox.Root
        value={selectedModelId ?? ""}
        onValueChange={(value) => {
          const model = models.find((m) => m.id === value);
          if (model) onModelChange(model);
        }}
      >
        <Combobox.Trigger
          data-acp-settings-model-trigger
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "6px 10px",
            borderRadius: "4px",
            border: "1px solid var(--harness-border)",
            backgroundColor: "var(--harness-bg)",
            color: "var(--harness-text)",
            fontSize: "13px",
            cursor: "pointer",
            minWidth: "120px",
          }}
        >
          <Combobox.Input
            data-acp-settings-model-input
            placeholder="Select model..."
            style={{
              border: "none",
              background: "transparent",
              color: "inherit",
              fontSize: "inherit",
              width: "100%",
              outline: "none",
            }}
          />
          <Combobox.Icon>▼</Combobox.Icon>
        </Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup
              data-acp-settings-model-popup
              style={{
                backgroundColor: "var(--harness-card-bg)",
                border: "1px solid var(--harness-border)",
                borderRadius: "4px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                maxHeight: "200px",
                overflow: "auto",
              }}
            >
              <Combobox.List>
                {models.map((model) => (
                  <Tooltip.Root key={model.id}>
                    <Tooltip.Trigger render={
                      <Combobox.Item
                        data-acp-settings-model-item
                        value={model.id}
                        style={{
                          padding: "8px 12px",
                          cursor: "pointer",
                          fontSize: "13px",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <Combobox.ItemIndicator>✓</Combobox.ItemIndicator>
                        {model.name}
                      </Combobox.Item>
                    } />
                    {model.description && (
                      <Tooltip.Portal>
                        <Tooltip.Positioner>
                          <Tooltip.Popup
                            style={{
                              backgroundColor: "var(--harness-text)",
                              color: "var(--harness-bg)",
                              padding: "6px 10px",
                              borderRadius: "4px",
                              fontSize: "12px",
                              maxWidth: "200px",
                            }}
                          >
                            {model.description}
                          </Tooltip.Popup>
                        </Tooltip.Positioner>
                      </Tooltip.Portal>
                    )}
                  </Tooltip.Root>
                ))}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>

      <Combobox.Root
        value={selectedSessionId ?? ""}
        onValueChange={(value) => {
          const session = sessions.find((s) => s.sessionId === value);
          if (session) onSessionChange(session);
        }}
      >
        <Combobox.Trigger
          data-acp-settings-session-trigger
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "6px 10px",
            borderRadius: "4px",
            border: "1px solid var(--harness-border)",
            backgroundColor: "var(--harness-bg)",
            color: "var(--harness-text)",
            fontSize: "13px",
            cursor: "pointer",
            minWidth: "150px",
          }}
        >
          <Combobox.Input
            data-acp-settings-session-input
            placeholder="Select session..."
            style={{
              border: "none",
              background: "transparent",
              color: "inherit",
              fontSize: "inherit",
              width: "100%",
              outline: "none",
            }}
          />
          <Combobox.Icon>▼</Combobox.Icon>
        </Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup
              data-acp-settings-session-popup
              style={{
                backgroundColor: "var(--harness-card-bg)",
                border: "1px solid var(--harness-border)",
                borderRadius: "4px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                maxHeight: "200px",
                overflow: "auto",
                minWidth: "250px",
              }}
            >
              <Combobox.List>
                {sessions.length === 0 && (
                  <Combobox.Empty
                    style={{
                      padding: "12px",
                      color: "var(--harness-muted)",
                      fontSize: "13px",
                      textAlign: "center",
                    }}
                  >
                    No sessions available
                  </Combobox.Empty>
                )}
                {sessions.map((session) => (
                  <Tooltip.Root key={session.sessionId}>
                    <Tooltip.Trigger render={
                      <Combobox.Item
                        data-acp-settings-session-item
                        value={session.sessionId}
                        style={{
                          padding: "8px 12px",
                          cursor: "pointer",
                          fontSize: "13px",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <Combobox.ItemIndicator>✓</Combobox.ItemIndicator>
                        {session.title || session.sessionId}
                      </Combobox.Item>
                    } />
                    {session.cwd && (
                      <Tooltip.Portal>
                        <Tooltip.Positioner>
                          <Tooltip.Popup
                            style={{
                              backgroundColor: "var(--harness-text)",
                              color: "var(--harness-bg)",
                              padding: "6px 10px",
                              borderRadius: "4px",
                              fontSize: "12px",
                              maxWidth: "250px",
                            }}
                          >
                            {session.cwd}
                          </Tooltip.Popup>
                        </Tooltip.Positioner>
                      </Tooltip.Portal>
                    )}
                  </Tooltip.Root>
                ))}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>

      {selectedMode && (
        <span
          data-acp-settings-mode-value
          style={{
            fontSize: "12px",
            color: "var(--harness-muted)",
            marginLeft: "auto",
          }}
        >
          {selectedMode.name}
        </span>
      )}
    </div>
  );
}
