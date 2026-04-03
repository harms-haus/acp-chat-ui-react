/**
 * Viewport Observer Utility
 *
 * This module provides a simplified viewport observer wrapper for element
 * resize observation with proper cleanup semantics and SSR guards.
 *
 * @remarks
 * This is a convenience wrapper around `createViewportObserverFactory` that
 * combines the factory + create pattern into a single function call.
 *
 * @see Task 6: Browser API Default Implementations
 * @see Task 14: Simplified Viewport Observer Wrapper
 */

import type {
  ResizeObserverCallback,
  ViewportObserver,
} from "../types/browser-apis.js";
import { createViewportObserverFactory } from "./browser-apis.js";

/**
 * Create a viewport observer for element resize observation.
 *
 * Provides a simplified API for observing element size changes with proper
 * cleanup (disconnect on unmount) and SSR safety.
 *
 * @param callback - Callback invoked when observed elements resize. Receives
 *                  resize entries and the observer instance for cleanup.
 *
 * @returns ViewportObserver instance with observe, unobserve, and disconnect methods
 *
 * @example
 * ```typescript
 * import { createViewportObserver } from '@acp/chat-react/utils';
 *
 * function Component() {
 *   const containerRef = useRef<HTMLDivElement>(null);
 *
 *   useEffect(() => {
 *     if (!containerRef.current) return;
 *
 *     const observer = createViewportObserver((entries) => {
 *       // Handle resize
 *       const { width } = entries[0].contentRect;
 *       console.log('Container width:', width);
 *     });
 *
 *     observer.observe(containerRef.current);
 *
 *     return () => observer.disconnect();
 *   }, []);
 *
 *   return <div ref={containerRef} />;
 * }
 * ```
 *
 * @remarks
 * - SSR-safe: Returns a no-op observer when ResizeObserver is unavailable
 * - Cleanup: Always call disconnect() on unmount to prevent memory leaks
 * - Resize loop prevention: Wrap follow-up work in requestAnimationFrame
 */
export function createViewportObserver(
  callback: ResizeObserverCallback
): ViewportObserver {
  const factory = createViewportObserverFactory();
  return factory.create(callback);
}
