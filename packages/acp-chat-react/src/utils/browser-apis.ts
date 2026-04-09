/**
 * Browser API Default Implementations
 *
 * This module provides default browser API implementations for abstractions
 * defined in @harms-haus/acp-chat-react/types/browser-apis.
 *
 * Implementations include:
 * - SSR-safe guards (no-op methods when browser APIs unavailable)
 * - Error handling for clipboard operations (NotAllowedError, secure context)
 * - Resize observer with cleanup pattern
 * - Animation frame/timeout scheduling with cancellation support
 *
 * These implementations are used as defaults when consumers do not provide
 * custom implementations for testing or SSR environments.
 *
 * @see Task 6: Create Browser API Default Implementations
 * @see Task 16-17: Thread clipboard through MessageActionBar
 */

import type {
  ClipboardAPI,
  ResizeObserverCallback,
  ViewportObserver,
  ViewportObserverFactory,
  Scheduler,
} from "../types/browser-apis.js";
import { isBrowserEnvironment } from "../index.browser.js";

/**
 * Default clipboard implementation using native navigator.clipboard.
 *
 * Provides text-to-clipboard functionality with error handling for:
 * - NotAllowedError (user denied permission)
 * - Secure context requirements (HTTPS/localhost only)
 * - SSR environments (no-op)
 *
 * @example
 * ```typescript
 * import { defaultClipboard } from '@harms-haus/acp-chat-react/utils';
 *
 * async function handleCopy() {
 *   await defaultClipboard.writeText('Hello, world!');
 * }
 * ```
 */
export const defaultClipboard: ClipboardAPI = {
  async writeText(text: string): Promise<void> {
    if (!isBrowserEnvironment()) {
      return;
    }

    if (typeof navigator === "undefined" || !navigator.clipboard) {
      console.warn(
        "[@harms-haus/acp-chat-react] Clipboard API unavailable in current environment"
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      if (err instanceof Error && err.name === "NotAllowedError") {
        console.warn(
          "[@harms-haus/acp-chat-react] Clipboard write denied by user or secure context requirement"
        );
        return;
      }
      // Re-throw unexpected errors for consumer handling
      throw err;
    }
  },
};

/**
 * Create a viewport observer factory using native ResizeObserver.
 *
 * Provides element resize observation functionality with proper cleanup
 * to prevent memory leaks. The factory pattern allows creating multiple
 * observer instances with different callbacks.
 *
 * @example
 * ```typescript
 * import { createViewportObserverFactory } from '@harms-haus/acp-chat-react/utils';
 *
 * const observerFactory = createViewportObserverFactory();
 * const observer = observerFactory.create((entries) => {
 *   console.log('Element resized:', entries[0].contentRect);
 * });
 *
 * observer.observe(myElement);
 * // Later: observer.disconnect();
 * ```
 */
export function createViewportObserverFactory(): ViewportObserverFactory {
  return {
    create(
      callback: ResizeObserverCallback,
      _options?: unknown
    ): ViewportObserver {
      if (!isBrowserEnvironment()) {
        return {
          observe: () => {},
          unobserve: () => {},
          disconnect: () => {},
        };
      }

      if (typeof ResizeObserver === "undefined") {
        console.warn(
          "[@harms-haus/acp-chat-react] ResizeObserver unavailable in current environment"
        );
        return {
          observe: () => {},
          unobserve: () => {},
          disconnect: () => {},
        };
      }

      const ro = new ResizeObserver((entries) => {
        callback(
          entries.map((entry) => ({
            contentRect: {
              x: entry.contentRect.x,
              y: entry.contentRect.y,
              width: entry.contentRect.width,
              height: entry.contentRect.height,
            },
            target: entry.target,
          })),
          {
            observe: (target: unknown) => ro.observe(target as Element),
            unobserve: (target: unknown) => ro.unobserve(target as Element),
            disconnect: () => ro.disconnect(),
          }
        );
      });

      return {
        observe: (target: unknown) => ro.observe(target as Element),
        unobserve: (target: unknown) => ro.unobserve(target as Element),
        disconnect: () => ro.disconnect(),
      };
    },
  };
}

/**
 * Default scheduler using native requestAnimationFrame and setTimeout.
 *
 * Provides animation frame and timeout scheduling with SSR-safe no-ops.
 * In SSR environments, returns non-zero handles without scheduling to
 * maintain cancellation API contract.
 *
 * @example
 * ```typescript
 * import { defaultScheduler } from '@harms-haus/acp-chat-react/utils';
 *
 * function throttleScroll() {
 *   const rafId = defaultScheduler.requestAnimationFrame((time) => {
 *     console.log('Scroll at:', time);
 *   });
 *
 *   // Later: defaultScheduler.cancelAnimationFrame(rafId);
 * }
 * ```
 */
export const defaultScheduler: Scheduler = {
  requestAnimationFrame(callback: (time: number) => void): number {
    if (!isBrowserEnvironment()) {
      return 0; // Return non-zero handle for SSR safety
    }

    if (typeof requestAnimationFrame === "undefined") {
      console.warn(
        "[@harms-haus/acp-chat-react] requestAnimationFrame unavailable in current environment"
      );
      return 0;
    }

    return requestAnimationFrame(callback);
  },

  cancelAnimationFrame(id: number): void {
    if (!isBrowserEnvironment()) {
      return;
    }

    if (typeof cancelAnimationFrame === "undefined") {
      return;
    }

    if (id !== 0) {
      cancelAnimationFrame(id);
    }
  },

  setTimeout(callback: () => void, ms: number): number {
    if (!isBrowserEnvironment()) {
      return 0; // Return non-zero handle for SSR safety
    }

    if (typeof setTimeout === "undefined") {
      console.warn(
        "[@harms-haus/acp-chat-react] setTimeout unavailable in current environment"
      );
      return 0;
    }

      return setTimeout(callback, ms) as unknown as number;
    },

  clearTimeout(id: number): void {
    if (!isBrowserEnvironment()) {
      return;
    }

    if (typeof clearTimeout === "undefined") {
      return;
    }

    if (id !== 0) {
      clearTimeout(id);
    }
  },
};
