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

export interface ComposerRootProps extends ComposerProps {
  children?: React.ReactNode;
}

function useComposerState(props: ComposerProps) {
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

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (shouldSendOnKeydown(event.key, event.shiftKey, isComposing)) {
        event.preventDefault();
        handleSend();
      }
    },
    [isComposing, handleSend]
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(event.target.value);
    },
    []
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

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  useEffect(() => {
    if (props.autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [props.autoFocus]);

  const rows = Math.min(
    Math.max(value.split("\n").length, props.minRows ?? 1),
    props.maxRows ?? 8
  );

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
    handleSend,
    handleStop,
    handleKeyDown,
    handleChange,
    handleCompositionStart,
    handleCompositionEnd,
    handleFocus,
    handleBlur,
  };
}

export const Composer = memo(function Composer(props: ComposerRootProps) {
  const {
    className = "",
    placeholder = "Type a message...",
  } = props;

  const {
    value,
    textareaRef,
    sendAllowed,
    stopAllowed,
    disabled,
    rows,
    handleSend,
    handleStop,
    handleKeyDown,
    handleChange,
    handleCompositionStart,
    handleCompositionEnd,
    handleFocus,
    handleBlur,
  } = useComposerState(props);

  const buttonState = stopAllowed ? "stop" : "send";
  const isSendDisabled = isSendButtonDisabled(value, disabled);

  return (
    <div
      data-acp-composer
      data-acp-composer-state={buttonState}
      data-acp-composer-disabled={disabled}
      className={`acp-composer ${className}`}
    >
      <div data-acp-composer-input-container className="acp-composer__input-container">
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
        />
      </div>

      <div data-acp-composer-controls className="acp-composer__controls">
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
  );
});

Composer.displayName = "Composer";
