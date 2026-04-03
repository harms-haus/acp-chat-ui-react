/**
 * Clipboard API Wrapper
 *
 * Provides injectable clipboard functionality with navigator.clipboard
 * and optional fallback to document.execCommand('copy').
 *
 * Error handling includes:
 * - NotAllowedError (user denied permission)
 * - Secure context requirements (HTTPS/localhost only)
 * - SSR environments (no-op)
 * - Fallback for older browsers without navigator.clipboard
 *
 * @see Task 13: Implement Clipboard API Wrapper
 * @see Task 16-17: Thread clipboard through MessageActionBar
 */

import type { ClipboardAPI } from "../types/browser-apis.js";
import { isBrowserEnvironment } from "../index.browser.js";

/**
 * Options for creating clipboard API instances.
 *
 * @property fallback - Whether to use document.execCommand('copy') as fallback
 *   when navigator.clipboard is unavailable or fails. Default: true.
 */
export interface CreateClipboardAPIOptions {
  fallback?: boolean;
}

/**
 * Create a clipboard API implementation with optional fallback.
 *
 * Provides text-to-clipboard functionality with comprehensive error handling:
 * - Primary: navigator.clipboard.writeText (modern browsers, HTTPS/localhost)
 * - Fallback: document.execCommand('copy') (older browsers, HTTP)
 * - SSR: no-op (resolves immediately)
 *
 * @example
 * ```typescript
 * import { createClipboardAPI } from '@acp/chat-react/utils';
 *
 * // Default: with fallback to execCommand
 * const clipboard = createClipboardAPI();
 * await clipboard.writeText('Hello, world!');
 *
 * // No fallback: only navigator.clipboard
 * const strictClipboard = createClipboardAPI({ fallback: false });
 * await strictClipboard.writeText('Hello, world!');
 *
 * // Usage in component
 * function MessageActionBar() {
 *   const clipboard = useMemo(() => createClipboardAPI(), []);
 *
 *   const handleCopy = () => {
 *     clipboard.writeText(message.content)
 *       .catch(err => console.error('Copy failed:', err));
 *   };
 * }
 * ```
 *
 * @param options - Configuration options for clipboard behavior
 * @returns ClipboardAPI instance
 */
export function createClipboardAPI(
  options?: CreateClipboardAPIOptions
): ClipboardAPI {
  const { fallback = true } = options ?? {};

  return {
    async writeText(text: string): Promise<void> {
      // SSR: no-op
      if (!isBrowserEnvironment()) {
        return;
      }

      // Try navigator.clipboard first (modern browsers, HTTPS/localhost)
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(text);
          return;
        } catch (err) {
          // If fallback is disabled, re-throw the error
          if (!fallback) {
            throw err;
          }

          // Log the failure but try fallback
          if (err instanceof Error && err.name === "NotAllowedError") {
            console.warn(
              "[@acp/chat-react] Clipboard write denied by user or secure context requirement, trying fallback"
            );
          } else {
            console.warn(
              "[@acp/chat-react] navigator.clipboard.writeText failed, trying fallback:",
              err
            );
          }
        }
      }

      // Fallback to document.execCommand('copy') for older browsers/HTTP
      if (fallback && typeof document !== "undefined") {
        try {
          const textArea = document.createElement("textarea");
          textArea.value = text;
          textArea.style.position = "fixed"; // Prevent scrolling
          textArea.style.left = "-9999px";
          textArea.style.top = "0";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();

          const successful = document.execCommand("copy");
          document.body.removeChild(textArea);

          if (!successful) {
            console.warn(
              "[@acp/chat-react] document.execCommand('copy') failed"
            );
          }
          return;
        } catch (err) {
          console.warn(
            "[@acp/chat-react] document.execCommand('copy') fallback failed:",
            err
          );
          throw err;
        }
      }

      // No clipboard API available
      console.warn(
        "[@acp/chat-react] Clipboard API unavailable in current environment"
      );
    },
  };
}

/**
 * Default clipboard implementation with fallback enabled.
 *
 * Provides the same functionality as Task 6's defaultClipboard but
 * with additional document.execCommand('copy') fallback for
 * compatibility with older browsers and HTTP contexts.
 *
 * @example
 * ```typescript
 * import { defaultClipboardWithFallback } from '@acp/chat-react/utils';
 *
 * await defaultClipboardWithFallback.writeText('Hello, world!');
 * ```
 */
export const defaultClipboardWithFallback = createClipboardAPI({
  fallback: true,
});

/**
 * Strict clipboard implementation without fallback.
 *
 * Only uses navigator.clipboard.writeText. Fails fast if clipboard
 * API is unavailable. Useful for secure contexts where you want to
 * enforce modern browser requirements.
 *
 * @example
 * ```typescript
 * import { strictClipboard } from '@acp/chat-react/utils';
 *
 * await strictClipboard.writeText('Hello, world!');
 * ```
 */
export const strictClipboard = createClipboardAPI({
  fallback: false,
});
