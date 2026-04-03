import type { AcpStore } from "../store/index.js";
import type { SessionController } from "@acp/chat-core";
import type { SettingsRowRenderProps } from "../settings/types.js";

/**
 * Logger abstraction for Composer error and debug messages.
 *
 * Provides injectable logging to enable:
 * - Custom logging implementations for production (e.g., external logging service)
 * - Silent operation in production when console logging is disabled
 * - Test-friendly mocking of log output
 *
 * @example
 * ```typescript
 * // Browser implementation (default)
 * const browserLogger: Logger = {
 *   error: (...args) => console.error(...args),
 *   warn: (...args) => console.warn(...args),
 *   info: (...args) => console.info(...args),
 *   debug: (...args) => console.debug(...args),
 *   log: (...args) => console.log(...args),
 * };
 *
 * // Silent implementation (production)
 * const silentLogger: Logger = {
 *   error: () => {},
 *   warn: () => {},
 *   info: () => {},
 *   debug: () => {},
 *   log: () => {},
 * };
 *
 * // Usage in component
 * <Composer logger={silentLogger} ... />
 * ```
 */
export interface Logger {
  /** Log error messages */
  error(...args: unknown[]): void;
  /** Log warning messages */
  warn(...args: unknown[]): void;
  /** Log informational messages */
  info(...args: unknown[]): void;
  /** Log debug messages */
  debug(...args: unknown[]): void;
  /** Log general messages */
  log(...args: unknown[]): void;
}

export interface ComposerProps {
  /** The ACP store instance */
  store: AcpStore;
  /** Session controller for sending prompts and canceling */
  controller: SessionController;
  /** Optional CSS class for styling */
  className?: string;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Whether the composer is disabled */
  disabled?: boolean;
  /** Callback when the composer mounts */
  onMount?: () => void;
  /** Callback when the input value changes */
  onValueChange?: (value: string) => void;
  /** Callback when a message is sent */
  onSend?: (text: string) => void;
  /** Callback when streaming is stopped */
  onStop?: () => void;
  /** Auto-focus the input on mount */
  autoFocus?: boolean;
  /** Callback invoked when auto-focus is requested. Use this to override the default textarea focus behavior. If not provided, the textarea will be focused automatically when autoFocus is true. */
  onFocusRequest?: () => void;
  /** Maximum number of rows for the textarea */
  maxRows?: number;
  /** Minimum number of rows for the textarea */
  minRows?: number;
  /** Custom renderer for the session settings row */
  renderSettingsRow?: ((props: SettingsRowRenderProps) => React.ReactNode) | undefined;
  /** Optional logger for error and debug messages. If not provided, uses console methods. Provide a silent logger for production to disable logging. */
  logger?: Logger;
}

export interface ComposerState {
  /** Current input value */
  value: string;
  /** Whether the input is focused */
  isFocused: boolean;
  /** Whether a composition event is active (IME) */
  isComposing: boolean;
  /** Whether streaming is active */
  isStreaming: boolean;
}

export interface ComposerTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onCompositionStart: () => void;
  onCompositionEnd: () => void;
  onFocus: () => void;
  onBlur: () => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  rows?: number;
}

export interface ComposerControlsProps {
  canSend: boolean;
  canStop: boolean;
  isStreaming: boolean;
  onSend: () => void;
  onStop: () => void;
  disabled?: boolean;
}
