/**
 * Browser API Abstraction Interfaces
 *
 * This module provides TypeScript interfaces for injectable browser APIs.
 * Consumers can provide custom implementations for testing or SSR environments.
 *
 * The abstraction layer enables:
 * - Dependency injection for testability (mock browser APIs in tests)
 * - SSR-safe defaults (no-op methods when browser APIs unavailable)
 * - Graceful error handling for clipboard and viewport operations
 *
 * @see Task 6 for default browser API wrappers implementing these interfaces
 * @see Task 16-17 for threading clipboard through MessageActionBar
 */

/**
 * Clipboard API abstraction.
 *
 * Provides text-to-clipboard functionality with error handling.
 * Implementations should handle:
 * - Secure context requirements (navigator.clipboard requires HTTPS/localhost)
 * - NotAllowedError exceptions when clipboard write is denied
 * - SSR environments where navigator.clipboard is undefined
 *
 * @example
 * ```typescript
 * // Browser implementation (Task 6)
 * const browserClipboard: ClipboardAPI = {
 *   async writeText(text) {
 *     try {
 *       await navigator.clipboard.writeText(text);
 *     } catch (err) {
 *       if (err instanceof Error && err.name === 'NotAllowedError') {
 *         console.warn('Clipboard write denied:', err);
 *       } else {
 *         throw err;
 *       }
 *     }
 *   }
 * };
 *
 * // SSR/test implementation (no-op)
 * const noOpClipboard: ClipboardAPI = {
 *   writeText: () => Promise.resolve()
 * };
 *
 * // Usage in component
 * function MessageActionBar({ clipboard }: { clipboard: ClipboardAPI }) {
 *   const handleCopy = () => {
 *     clipboard.writeText(message.content)
 *       .catch(err => console.error('Copy failed:', err));
 *   };
 * }
 * ```
 */
export interface ClipboardAPI {
  /**
   * Write text to the system clipboard.
   *
   * @param text - Text content to copy to clipboard
   * @returns Promise that resolves on success, rejects on error
   *
   * @remarks
   * Browser implementations should:
   * - Catch and log NotAllowedError when user denies permission
   * - Re-throw other errors for consumer handling
   *
   * SSR implementations should:
   * - Return a resolved promise (no-op)
   * - Not throw exceptions
   */
  writeText(text: string): Promise<void>;
}

/**
 * Resize observer entry for viewport size changes.
 *
 * Represents a single resize observation result with content rectangle dimensions.
 *
 * @example
 * ```typescript
 * const entry: ResizeObserverEntry = {
 *   contentRect: {
 *     x: 0,
 *     y: 0,
 *     width: 600,
 *     height: 400,
 *   },
 *   target: documentElement,
 * };
 * ```
 */
export interface ResizeObserverEntry {
  /** The DOMRectReadOnly of the observed element's content box. */
  readonly contentRect: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };

  /** The element being observed. */
  readonly target: unknown;
}

/**
 * Viewport observer callback signature.
 *
 * Called when observed elements change size.
 *
 * @param entries - Array of resize entries for all observed elements
 * @param observer - The viewport observer instance (for disconnect/unobserve)
 *
 * @remarks
 * Consumers should wrap follow-up work in Scheduler.requestAnimationFrame
 * to prevent resize loops (observers triggering layout updates that trigger observers).
 *
 * @example
 * ```typescript
 * const callback: ResizeObserverCallback = (entries, observer) => {
 *   scheduler.requestAnimationFrame(() => {
 *     for (const entry of entries) {
 *       setContainerWidth(entry.contentRect.width);
 *     }
 *   });
 * };
 * ```
 */
export type ResizeObserverCallback = (
  entries: ResizeObserverEntry[],
  observer: ViewportObserver
) => void;

/**
 * Viewport observer options.
 *
 * Optional configuration for viewport observation.
 *
 * @remarks
 * This interface is reserved for future extensions (box options, threshold, etc.).
 * Current implementation uses default ResizeObserver behavior.
 */
export interface ViewportObserverOptions {
  /** Reserved for future box options (content-box, border-box, device-pixel-content-box). */
  readonly box?: "content-box" | "border-box" | "device-pixel-content-box";
}

/**
 * Viewport observer API abstraction.
 *
 * Provides element resize observation functionality with callback pattern.
 * Implementations should handle:
 * - SSR environments where ResizeObserver is undefined
 * - Resize loop prevention (callbacks wrapped in requestAnimationFrame)
 * - Cleanup of observed elements on disconnect
 *
 * @example
 * ```typescript
 * // Browser implementation (Task 6)
 * const browserViewportObserver: ViewportObserverFactory = {
 *   create(callback, options) {
 *     const ro = new ResizeObserver((entries) => callback(entries, {
 *       observe: (target) => ro.observe(target),
 *       unobserve: (target) => ro.unobserve(target),
 *       disconnect: () => ro.disconnect(),
 *     }));
 *     return {
 *       observe: (target) => ro.observe(target),
 *       unobserve: (target) => ro.unobserve(target),
 *       disconnect: () => ro.disconnect(),
 *     };
 *   }
 * };
 *
 * // SSR/test implementation (no-op)
 * const noOpViewportObserver: ViewportObserverFactory = {
 *   create: () => ({
 *     observe: () => {},
 *     unobserve: () => {},
 *     disconnect: () => {},
 *   }),
 * };
 *
 * // Usage in component
 * function VirtualizedThread({ scheduler, viewportObserverFactory }: Props) {
 *   useEffect(() => {
 *     const observer = viewportObserverFactory.create((entries, observer) => {
 *       scheduler.requestAnimationFrame(() => {
 *         setContainerWidth(entries[0].contentRect.width);
 *       });
 *     });
 *
 *     observer.observe(viewportRef.current);
 *     return () => observer.disconnect();
 *   }, [scheduler, viewportObserverFactory]);
 * }
 * ```
 */
export interface ViewportObserver {
  /**
   * Observe an element for resize changes.
   *
   * @param target - Element to observe
   *
   * @remarks
   * Browser implementations should delegate to ResizeObserver.observe().
   * SSR implementations should be no-op (empty function).
   */
  observe(target: unknown): void;

  /**
   * Stop observing a single element.
   *
   * @param target - Element to stop observing
   *
   * @remarks
   * Browser implementations should delegate to ResizeObserver.unobserve().
   * SSR implementations should be no-op (empty function).
   */
  unobserve(target: unknown): void;

  /**
   * Disconnect all observations and stop receiving callbacks.
   *
   * @remarks
   * Browser implementations should delegate to ResizeObserver.disconnect().
   * SSR implementations should be no-op (empty function).
   */
  disconnect(): void;
}

/**
 * Viewport observer factory interface.
 *
 * Factory function for creating viewport observer instances.
 *
 * @param callback - Callback invoked on resize events
 * @param options - Optional observation configuration
 * @returns Configured viewport observer instance
 *
 * @example
 * ```typescript
 * type Props = {
 *   viewportObserverFactory: ViewportObserverFactory;
 * };
 *
 * function Component({ viewportObserverFactory }: Props) {
 *   const observer = useMemo(() =>
 *     viewportObserverFactory.create((entries) => {
 *       // Handle resize
 *     })
 *   , [viewportObserverFactory]);
 * }
 * ```
 */
export interface ViewportObserverFactory {
  create(
    callback: ResizeObserverCallback,
    options?: ViewportObserverOptions
  ): ViewportObserver;
}

/**
 * Animation frame callback signature.
 *
 * Callback invoked by requestAnimationFrame before the next repaint.
 *
 * @param time - Current timestamp in milliseconds (same as performance.now())
 *
 * @example
 * ```typescript
 * const rafCallback: AnimationFrameCallback = (time) => {
 *   const delta = time - lastTime;
 *   updateAnimation(delta);
 *   lastTime = time;
 * };
 * ```
 */
export type AnimationFrameCallback = (time: number) => void;

/**
 * Timeout callback signature.
 *
 * Callback invoked after the specified delay.
 *
 * @example
 * ```typescript
 * const timeoutCallback: TimeoutCallback = () => {
 *   console.log('Timeout fired');
 * };
 * ```
 */
export type TimeoutCallback = () => void;

/**
 * Scheduler API abstraction.
 *
 * Provides animation frame and timeout scheduling with SSR-safe no-ops.
 * Implementations should handle:
 * - SSR environments where requestAnimationFrame/setTimeout are undefined
 * - Cancellation via returned handles
 * - Memory safety (cancel pending callbacks on cleanup)
 *
 * @example
 * ```typescript
 * // Browser implementation (Task 6)
 * const browserScheduler: Scheduler = {
 *   requestAnimationFrame: (callback) => requestAnimationFrame(callback),
 *   cancelAnimationFrame: (id) => cancelAnimationFrame(id),
 *   setTimeout: (callback, ms) => setTimeout(callback, ms),
 *   clearTimeout: (id) => clearTimeout(id),
 * };
 *
 * // SSR/test implementation (no-op)
 * const noOpScheduler: Scheduler = {
 *   requestAnimationFrame: () => 0,
 *   cancelAnimationFrame: () => {},
 *   setTimeout: () => 0,
 *   clearTimeout: () => {},
 * };
 *
 * // Usage in component for scroll throttling
 * function VirtualizedThread({ scheduler }: Props) {
 *   const scrollRafRef = useRef<number>(0);
 *
 *   const handleScroll = useCallback(() => {
 *     if (scrollRafRef.current !== 0) {
 *       scheduler.cancelAnimationFrame(scrollRafRef.current);
 *     }
 *
 *     scrollRafRef.current = scheduler.requestAnimationFrame(() => {
 *       scrollRafRef.current = 0;
 *       checkScrollPosition();
 *     });
 *   }, [scheduler]);
 *
 *   useEffect(() => {
 *     return () => {
 *       if (scrollRafRef.current !== 0) {
 *         scheduler.cancelAnimationFrame(scrollRafRef.current);
 *       }
 *     };
 *   }, [scheduler]);
 * }
 * ```
 */
export interface Scheduler {
  /**
   * Schedule a callback to run before the next repaint.
   *
   * @param callback - Function to invoke before next repaint
   * @returns Handle for canceling the frame request (non-zero integer)
   *
   * @remarks
   * Browser implementations should delegate to requestAnimationFrame.
   * SSR implementations should return a non-zero value (e.g., 0) without scheduling.
   */
  requestAnimationFrame(callback: AnimationFrameCallback): number;

  /**
   * Cancel a previously scheduled animation frame callback.
   *
   * @param id - Handle returned from requestAnimationFrame
   *
   * @remarks
   * Browser implementations should delegate to cancelAnimationFrame.
   * SSR implementations should be no-op (empty function).
   */
  cancelAnimationFrame(id: number): void;

  /**
   * Schedule a callback to run after the specified delay.
   *
   * @param callback - Function to invoke after delay
   * @param ms - Delay in milliseconds
   * @returns Handle for canceling the timeout (non-zero integer)
   *
   * @remarks
   * Browser implementations should delegate to setTimeout.
   * SSR implementations should return a non-zero value (e.g., 0) without scheduling.
   */
  setTimeout(callback: TimeoutCallback, ms: number): number;

  /**
   * Cancel a previously scheduled timeout callback.
   *
   * @param id - Handle returned from setTimeout
   *
   * @remarks
   * Browser implementations should delegate to clearTimeout.
   * SSR implementations should be no-op (empty function).
   */
  clearTimeout(id: number): void;
}
