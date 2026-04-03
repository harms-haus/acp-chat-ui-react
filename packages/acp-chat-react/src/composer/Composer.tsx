import { useState, useCallback, useRef, useEffect, memo } from "react";
import { Button } from "@base-ui-components/react/button";
import type { ComposerProps } from "./types.js";
import {
  shouldSendOnKeydown,
  canSend,
  canStop,
  getSendText,
  isSendButtonDisabled,
} from "./composer-logic.js";
import { useSessionState, useActiveStreamingMessage } from "../hooks/index.js";
import { useSettings } from "../settings/use-settings.js";
import type { SettingsRowRenderProps, AcpMode, AcpModel } from "../settings/types.js";
import type { SessionItem } from "../session-list/types.js";
import { useSlashCommands } from "../slash/use-slash-commands.js";
import { SlashSuggestions } from "../slash/SlashSuggestions.js";
import type { SlashCommand } from "../slash/types.js";

export interface ComposerRootProps extends ComposerProps {
  children?: React.ReactNode;
  slashCommands?: SlashCommand[];
}

function useComposerState(props: ComposerProps, slashCommands: SlashCommand[] = []) {
  const { store, controller, disabled = false } = props;
  const session = useSessionState(store);
  const streamingMessage = useActiveStreamingMessage(store);

  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isStreaming = !!streamingMessage;
  const sessionId = session.sessionId;
  const isConnected = session.connectionStatus === "connected";
  const isInitialized = session.initialized;

  const composerState = {
    value,
    disabled: disabled || !isConnected || !isInitialized || !sessionId,
    isStreaming,
    isComposing,
  };

  const sendAllowed = canSend(composerState);
  const stopAllowed = canStop(isStreaming);

  const handleSend = useCallback(async () => {
    if (!sendAllowed || !sessionId) return;

    const text = getSendText(value);
    if (!text) return;

    try {
      await controller.sendPrompt(sessionId, text);
      setValue("");
      props.onSend?.(text);
    } catch (error) {
      console.error("Failed to send prompt:", error);
    }
  }, [sendAllowed, sessionId, value, controller, props.onSend]);

  const handleStop = useCallback(async () => {
    if (!stopAllowed || !sessionId) return;

    try {
      await controller.cancelPrompt(sessionId);
      props.onStop?.();
    } catch (error) {
      console.error("Failed to cancel prompt:", error);
    }
  }, [stopAllowed, sessionId, controller, props.onStop]);

  const handleSlashSelect = useCallback((command: SlashCommand) => {
    setValue((prev) => {
      const lastSlashIndex = prev.lastIndexOf("/");
      if (lastSlashIndex >= 0) {
        return prev.slice(0, lastSlashIndex) + `/${command.id} `;
      }
      return `/${command.id} `;
    });
  }, []);

  const slashState = useSlashCommands({
    commands: slashCommands,
    onSelect: handleSlashSelect,
  });

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (slashState.isOpen) {
        const handled = slashState.handleKeyDown(event);
        if (handled) return;
      }

      if (shouldSendOnKeydown(event.key, event.shiftKey, isComposing)) {
        event.preventDefault();
        handleSend();
      }
    },
    [isComposing, handleSend, slashState]
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = event.target.value;
      setValue(newValue);

      if (newValue.endsWith("/") && slashCommands.length > 0) {
        slashState.handleSlashKey();
        slashState.setAnchorElement(event.target);
      }
    },
    [slashCommands.length, slashState]
  );

  const handleCompositionStart = useCallback(() => {
    setIsComposing(true);
  }, []);

  const handleCompositionEnd = useCallback(() => {
    setIsComposing(false);
  }, []);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback((event: React.FocusEvent<HTMLTextAreaElement>) => {
    setIsFocused(false);
    const relatedTarget = event.relatedTarget as HTMLElement | null;
    const slashPopover = document.querySelector('[data-acp-slash-popover]');
    if (slashPopover && relatedTarget && slashPopover.contains(relatedTarget)) {
      return;
    }
    setTimeout(() => {
      slashState.handleClose();
    }, 200);
  }, [slashState]);

  useEffect(() => {
    if (props.autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [props.autoFocus]);

  const minRows = props.minRows ?? 2;
  const maxRows = props.maxRows ?? 8;
  const lineCount = value.split("\n").length;
  const rows = Math.min(Math.max(lineCount, minRows), maxRows);

  return {
    value,
    setValue,
    isFocused,
    isComposing,
    isStreaming,
    textareaRef,
    sendAllowed,
    stopAllowed,
    disabled: composerState.disabled,
    rows,
    minRows,
    maxRows,
    handleSend,
    handleStop,
    handleKeyDown,
    handleChange,
    handleCompositionStart,
    handleCompositionEnd,
    handleFocus,
    handleBlur,
    slashState,
  };
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
  return (
    <div data-acp-settings-row className="acp-settings-row">
      <span data-acp-settings-label>Settings</span>
      <span data-acp-settings-count>
        {modes.length} modes, {models.length} models, {sessions.length} sessions
      </span>
      {selectedModeId && <span data-acp-settings-selected-mode>Mode: {selectedModeId}</span>}
      {selectedModelId && <span data-acp-settings-selected-model>Model: {selectedModelId}</span>}
      {selectedSessionId && <span data-acp-settings-selected-session>Session: {selectedSessionId}</span>}
      {disabled && <span data-acp-settings-disabled>Disabled</span>}
    </div>
  );
}

export const Composer = memo(function Composer(props: ComposerRootProps) {
  const {
    className = "",
    placeholder = "Type a message...",
    renderSettingsRow,
    controller,
    slashCommands = [],
  } = props;

  const {
    value,
    textareaRef,
    sendAllowed,
    stopAllowed,
    disabled,
    rows,
    minRows,
    maxRows,
    handleSend,
    handleStop,
    handleKeyDown,
    handleChange,
    handleCompositionStart,
    handleCompositionEnd,
    handleFocus,
    handleBlur,
    slashState,
  } = useComposerState(props, slashCommands);

  const buttonState = stopAllowed ? "stop" : "send";
  const isSendDisabled = isSendButtonDisabled(value, disabled);

  const { state: settingsState, actions: settingsActions } = useSettings({
    controller,
  });

  const handleModeChange = useCallback((mode: AcpMode) => {
    settingsActions.setMode(mode);
  }, [settingsActions]);

  const handleModelChange = useCallback((model: AcpModel) => {
    settingsActions.setModel(model);
  }, [settingsActions]);

  const handleSessionChange = useCallback((session: SessionItem) => {
    settingsActions.setSession(session);
  }, [settingsActions]);

  const settingsRowProps: SettingsRowRenderProps = {
    modes: settingsState.modes,
    models: settingsState.models,
    sessions: settingsState.sessions,
    selectedModeId: settingsState.selectedMode?.id,
    selectedModelId: settingsState.selectedModel?.id,
    selectedSessionId: settingsState.selectedSession?.sessionId,
    onModeChange: handleModeChange,
    onModelChange: handleModelChange,
    onSessionChange: handleSessionChange,
    disabled: disabled || settingsState.isLoading,
  };

  const SettingsRowComponent = renderSettingsRow ?? DefaultSettingsRow;

  return (
    <div
      data-acp-composer
      data-acp-composer-state={buttonState}
      data-acp-composer-disabled={disabled}
      data-acp-composer-has-settings={!!renderSettingsRow}
      className={`acp-composer ${className}`}
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        position: "relative",
      }}
    >
      <div
        data-acp-composer-input-container
        className="acp-composer__input-container"
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <textarea
          ref={textareaRef}
          id="acp-composer-textarea"
          name="acp-composer-message"
          data-acp-composer-input
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          className="acp-composer__textarea"
          aria-label="Message input"
          style={{
            width: "100%",
            minHeight: `${minRows * 1.5}em`,
            maxHeight: `${maxRows * 1.5}em`,
            resize: "none",
            padding: "12px",
            paddingRight: "80px",
            fontSize: "14px",
            lineHeight: "1.5",
            border: "1px solid var(--acp-border, #ccc)",
            borderRadius: "8px",
            backgroundColor: "var(--acp-bg, #fff)",
            color: "var(--acp-text, #000)",
          }}
        />
        <div
          data-acp-composer-controls
          className="acp-composer__controls"
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            display: "flex",
            gap: "8px",
          }}
        >
          {buttonState === "send" ? (
            <Button
              data-acp-send-button
              onClick={handleSend}
              disabled={isSendDisabled}
              className="acp-composer__button acp-composer__button--send"
              aria-label="Send message"
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
              <span>Send</span>
            </Button>
          ) : (
            <Button
              data-acp-stop-button
              onClick={handleStop}
              disabled={disabled}
              className="acp-composer__button acp-composer__button--stop"
              aria-label="Stop generation"
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="currentColor"
                aria-hidden="true"
              >
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              <span>Stop</span>
            </Button>
          )}
        </div>
      </div>

      {renderSettingsRow && (
        <div
          data-acp-composer-settings-row
          className="acp-composer__settings-row"
          style={{
            marginTop: "8px",
          }}
        >
          <SettingsRowComponent {...settingsRowProps} />
        </div>
      )}

      <SlashSuggestions
        commands={slashState.filteredCommands}
        selectedIndex={slashState.selectedIndex}
        onSelect={slashState.handleSelect}
        onClose={slashState.handleClose}
        anchorElement={slashState.anchorElement}
        open={slashState.isOpen}
      />
    </div>
  );
});

Composer.displayName = "Composer";
