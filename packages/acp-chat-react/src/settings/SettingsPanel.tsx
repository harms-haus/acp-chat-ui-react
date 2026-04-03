import { memo, useCallback, useMemo } from "react";
import { Separator } from "@base-ui-components/react/separator";
import type { SettingsPanelProps, SettingsRowRenderProps, SettingsSelectOption } from "./types.js";
import { useSettings } from "./use-settings.js";
import { SettingsSelect } from "./SettingsSelect.js";
import type { AcpMode, AcpModel } from "./types.js";
import type { SessionItem } from "../session-list/types.js";

interface SessionOption extends SettingsSelectOption {
  sessionId: string;
  cwd: string;
  original: SessionItem;
}

function DefaultSettingsRow({
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
}: SettingsRowRenderProps) {
  const selectedMode = modes.find((m) => m.id === selectedModeId) ?? null;
  const selectedModel = models.find((m) => m.id === selectedModelId) ?? null;
  const selectedSession = sessions.find((s) => s.sessionId === selectedSessionId) ?? null;

  const sessionOptions: SessionOption[] = useMemo(
    () =>
      sessions.map((s) => ({
        id: s.sessionId,
        name: s.title || s.sessionId,
        description: s.cwd,
        sessionId: s.sessionId,
        cwd: s.cwd,
        original: s,
      })),
    [sessions]
  );

  const selectedSessionOption = useMemo(
    () => sessionOptions.find((s) => s.id === selectedSessionId) ?? null,
    [sessionOptions, selectedSessionId]
  );

  const handleModeChange = useCallback(
    (mode: AcpMode) => {
      onModeChange(mode);
    },
    [onModeChange]
  );

  const handleModelChange = useCallback(
    (model: AcpModel) => {
      onModelChange(model);
    },
    [onModelChange]
  );

  const handleSessionOptionChange = useCallback(
    (option: SessionOption) => {
      onSessionChange(option.original);
    },
    [onSessionChange]
  );

  return (
    <div
      data-acp-settings-row
      className="acp-settings-row"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "12px",
        alignItems: "center",
        padding: "8px 12px",
        borderTop: "1px solid var(--acp-border, #ccc)",
        backgroundColor: "var(--acp-bg, #fff)",
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? "none" : "auto",
      }}
    >
      <SettingsSelect
        data-acp-id="mode"
        value={selectedMode}
        options={modes}
        onChange={handleModeChange}
        placeholder="Select mode..."
        disabled={disabled || modes.length === 0}
      />

      <Separator orientation="vertical" style={{ height: "24px" }} />

      <SettingsSelect
        data-acp-id="model"
        value={selectedModel}
        options={models}
        onChange={handleModelChange}
        placeholder="Select model..."
        disabled={disabled || models.length === 0}
      />

      <Separator orientation="vertical" style={{ height: "24px" }} />

      <SettingsSelect
        data-acp-id="session"
        value={selectedSessionOption}
        options={sessionOptions}
        onChange={handleSessionOptionChange}
        placeholder={sessions.length === 0 ? "No sessions" : "Select session..."}
        disabled={disabled || sessions.length === 0}
      />

      {selectedMode && (
        <span
          data-acp-settings-mode-value
          style={{
            fontSize: "12px",
            color: "var(--acp-muted, #666)",
            marginLeft: "auto",
          }}
        >
          {selectedMode.name}
        </span>
      )}
    </div>
  );
}

function SettingsPanelInner({
  controller,
  selectedModeId,
  selectedModelId,
  selectedSessionId,
  onModeChange,
  onModelChange,
  onSessionChange,
  modes: providedModes,
  models: providedModels,
  sessions: providedSessions,
  disabled = false,
  className = "",
  renderSettingsRow,
}: SettingsPanelProps) {
  const { state, actions } = useSettings({
    controller,
    initialModeId: selectedModeId ?? undefined,
    initialModelId: selectedModelId ?? undefined,
    initialSessionId: selectedSessionId ?? undefined,
    modes: providedModes,
    models: providedModels,
    sessions: providedSessions,
  });

  const handleModeChange = (mode: typeof state.modes[number]) => {
    actions.setMode(mode);
    onModeChange?.(mode);
  };

  const handleModelChange = (model: typeof state.models[number]) => {
    actions.setModel(model);
    onModelChange?.(model);
  };

  const handleSessionChange = (session: typeof state.sessions[number]) => {
    actions.setSession(session);
    onSessionChange?.(session);
  };

  const rowProps: SettingsRowRenderProps = {
    modes: state.modes,
    models: state.models,
    sessions: state.sessions,
    selectedModeId: state.selectedMode?.id,
    selectedModelId: state.selectedModel?.id,
    selectedSessionId: state.selectedSession?.sessionId,
    onModeChange: handleModeChange,
    onModelChange: handleModelChange,
    onSessionChange: handleSessionChange,
    disabled: disabled || state.isLoading,
  };

  const SettingsRowComponent = renderSettingsRow ?? DefaultSettingsRow;

  return (
    <div
      data-acp-settings-panel
      data-acp-settings-loading={state.isLoading}
      data-acp-settings-error={!!state.error}
      className={`acp-settings-panel ${className}`}
    >
      {state.error && (
        <div data-acp-settings-error-banner className="acp-settings-error">
          {state.error}
          <button type="button" onClick={actions.clearError} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}
      <SettingsRowComponent {...rowProps} />
    </div>
  );
}

export const SettingsPanel = memo(SettingsPanelInner);
SettingsPanel.displayName = "SettingsPanel";
