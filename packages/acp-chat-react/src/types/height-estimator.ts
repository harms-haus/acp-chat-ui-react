/**
 * Height Estimator Plugin Interface
 *
 * This module provides TypeScript interfaces for pluggable height estimation.
 * Consumers can provide custom estimators or use the default pretext-based estimator.
 *
 * The estimator system supports:
 * - Sync and async estimation (for estimators that need to load image dimensions)
 * - Content-type detection via `canHandle` predicates
 * - Plugin priority ordering for multiple estimators
 * - Per-item configuration overrides
 *
 * @see Task 4 for DEFAULT_HEIGHT_ESTIMATOR_CONFIG
 * @see Task 7 for the pretext estimator implementation
 * @see Task 9 for VirtualizedThread integration
 */

import type { ThreadItem } from "../thread/types.js";

/**
 * Default configuration for height estimation.
 *
 * These values are derived from the current inline styles in estimateMessageHeight.ts
 * and use the system font stack to match the actual rendered fonts exactly.
 *
 * @remarks
 * - System font stack used instead of 'Inter' to fix the documented font mismatch
 * - Line height (22px) derived from current hardcoded values
 * - Spacing values (headerHeight, contentPadding) preserved from current implementation
 * - Default container width (600px) matches current estimateMessageHeight default
 * - Rich content block height (100px) matches current per-block estimation
 *
 * @example
 * ```typescript
 * import { DEFAULT_HEIGHT_ESTIMATOR_CONFIG, HeightEstimatorConfig } from '@acp/chat-react';
 *
 * // Use default config as-is
 * const config: HeightEstimatorConfig = DEFAULT_HEIGHT_ESTIMATOR_CONFIG;
 *
 * // Or override specific values
 * const customConfig: HeightEstimatorConfig = {
 *   ...DEFAULT_HEIGHT_ESTIMATOR_CONFIG,
 *   fontSize: 16,
 *   lineHeight: 24,
 * };
 * ```
 */
export const DEFAULT_HEIGHT_ESTIMATOR_CONFIG: Readonly<HeightEstimatorConfig> = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSize: 14,
  lineHeight: 22,
  headerHeight: 48,
  contentPadding: 24,
  defaultContainerWidth: 600,
  whiteSpace: 'normal',
  richContentBlockHeight: 100,
  rowGap: 8,
  minHeight: 60,
} as const;

/**
 * Configuration for height estimation.
 *
 * These values control how the estimator calculates heights for different
 * content types. The default config (Task 4) will use the system font stack
 * and values derived from current inline styles.
 *
 * Estimators should use these values to match the actual rendered layout.
 * Font strings must exactly match the CSS font property used in rendering.
 *
 * @example
 * ```typescript
 * const config: HeightEstimatorConfig = {
 *   fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
 *   fontSize: 14,
 *   lineHeight: 22,
 *   headerHeight: 48,
 *   contentPadding: 24,
 *   defaultContainerWidth: 600,
 *   whiteSpace: 'normal',
 *   richContentBlockHeight: 100,
 * };
 * ```
 */
export interface HeightEstimatorConfig {
  /** Font family string matching CSS font-family property. Must match rendered fonts exactly. */
  fontFamily: string;

  /** Font size in pixels. Used to construct the font string for text measurement. */
  fontSize: number;

  /** Line height in pixels. Controls vertical spacing between text lines. */
  lineHeight: number;

  /** Height of message header (avatar, role label, timestamp) in pixels. */
  headerHeight: number;

  /** Horizontal padding inside message content area in pixels. */
  contentPadding: number;

  /** Default container width when actual width is not available. */
  defaultContainerWidth: number;

  /** White-space handling for text layout. 'normal' collapses whitespace, 'pre-wrap' preserves it. */
  whiteSpace?: "normal" | "pre-wrap";

  /** Estimated height for each rich content block (images, resources, tool calls) in pixels. */
  richContentBlockHeight?: number;

  /** Gap between rows in the virtualized list in pixels. */
  rowGap?: number;

  /** Minimum height for any message (fallback for empty content) in pixels. */
  minHeight?: number;
}

/**
 * Prepared text cache entry for reuse across width changes.
 *
 * Pretext's `prepare()` function creates a reusable measurement object.
 * Caching prepared text improves performance during container resize.
 *
 * Estimators may optionally implement preparation caching for efficiency.
 *
 * @example
 * ```typescript
 * // In an estimator implementation
 * const preparedCache = new Map<string, PreparedTextEntry>();
 *
 * function prepareText(text: string, font: string): PreparedTextEntry {
 *   const cached = preparedCache.get(text);
 *   if (cached && cached.font === font) return cached;
 *   const prepared = prepare(text, font, { whiteSpace: 'normal' });
 *   preparedCache.set(text, { prepared, font });
 *   return { prepared, font };
 * }
 * ```
 */
export interface PreparedTextEntry {
  /** The font string used to prepare this text. Used for cache validation. */
  font: string;

  /** White-space option used during preparation. */
  whiteSpace?: "normal" | "pre-wrap";

  /** Timestamp when prepared (for cache eviction). Optional. */
  preparedAt?: number;
}

/**
 * Height estimator implementation.
 *
 * An estimator calculates the pixel height for a thread item given a container width
 * and configuration. Estimators can be sync (return number) or async (return Promise)
 * for cases like image dimension loading.
 *
 * The estimator should handle all `ThreadItem` types:
 * - `"message"`: `NormalizedMessage` with text content or contentBlocks
 * - `"thought_group"`: `ThoughtGroupWithState` with thoughts and tool calls
 *
 * @example
 * ```typescript
 * // Sync estimator
 * const simpleEstimator: HeightEstimator = {
 *   estimate(item, width, config) {
 *     if (item.type === 'message') {
 *       return config.headerHeight + config.minHeight;
 *     }
 *     return 100; // thought_group default
 *   }
 * };
 *
 * // Async estimator (for image-aware estimation)
 * const asyncEstimator: HeightEstimator = {
 *   async estimate(item, width, config) {
 *     if (item.type === 'message' && hasImageBlocks(item.data)) {
 *       const dimensions = await loadImageDimensions(item.data);
 *       return calculateHeightWithImages(dimensions, config);
 *     }
 *     return syncEstimate(item, width, config);
 *   }
 * };
 * ```
 */
export interface HeightEstimator {
  /**
   * Estimate the height for a thread item.
   *
   * @param item - The thread item to estimate (message or thought_group)
   * @param width - Container width in pixels (use config.defaultContainerWidth if unavailable)
   * @param config - Estimation configuration (font, spacing, layout values)
   * @returns Estimated height in pixels, or Promise for async estimators
   */
  estimate(
    item: ThreadItem,
    width: number,
    config: HeightEstimatorConfig
  ): number | Promise<number>;

  /**
   * Optional: Prepare text for caching and reuse.
   *
   * Pretext-based estimators should implement this for efficiency.
   * Called once per unique text, then `layout()` is called on resize.
   *
   * @param text - Text content to prepare
   * @param font - Font string matching config
   * @param options - Preparation options (whiteSpace)
   * @returns Prepared text entry for cache, or null if not supported
   */
  prepareText?(
    text: string,
    font: string,
    options?: { whiteSpace?: "normal" | "pre-wrap" }
  ): PreparedTextEntry | null;

  /**
   * Optional: Layout prepared text at a given width.
   *
   * Called on container resize with cached prepared text.
   * Returns height without re-preparing text content.
   *
   * @param prepared - Previously prepared text entry
   * @param width - Container width in pixels
   * @param lineHeight - Line height in pixels
   * @returns Calculated text height in pixels
   */
  layoutText?(prepared: PreparedTextEntry, width: number, lineHeight: number): number;
}

/**
 * Height estimator plugin for registration and discovery.
 *
 * Plugins enable content-type-specific estimators with priority ordering.
 * The plugin system allows multiple estimators to coexist, with the highest-priority
 * estimator that `canHandle` the item being used.
 *
 * Priority ordering:
 * - Higher priority = preferred estimator
 * - Default priority = 0 (fallback)
 * - Negative priority = explicitly lower priority
 *
 * @example
 * ```typescript
 * // Image-aware estimator plugin
 * const imageEstimatorPlugin: HeightEstimatorPlugin = {
 *   name: 'image-aware-estimator',
 *   priority: 10, // Higher than default
 *   canHandle: (item) => {
 *     return item.type === 'message' && hasImageBlocks(item.data);
 *   },
 *   estimate: async (item, width, config) => {
 *     const dimensions = await loadImageDimensions(item.data);
 *     return calculateHeightWithImages(dimensions, width, config);
 *   }
 * };
 *
 * // Default fallback plugin
 * const defaultPlugin: HeightEstimatorPlugin = {
 *   name: 'default-text-estimator',
 *   priority: 0,
 *   canHandle: () => true, // Handles all items
 *   estimate: (item, width, config) => {
 *     return defaultEstimate(item, width, config);
 *   }
 * };
 *
 * // Plugin selection
 * const plugins = [imageEstimatorPlugin, defaultPlugin];
 * function selectPlugin(item: ThreadItem): HeightEstimatorPlugin {
 *   const matching = plugins.filter(p => p.canHandle(item));
 *   return matching.sort((a, b) => b.priority - a.priority)[0];
 * }
 * ```
 */
export interface HeightEstimatorPlugin {
  /** Unique plugin name for identification and debugging. */
  name: string;

  /**
   * Priority for plugin selection. Higher values are preferred.
   * Default is 0. Use negative values for explicitly lower priority.
   */
  priority: number;

  /**
   * Predicate to determine if this plugin can handle a given item.
   * Used for content-type detection and plugin selection.
   *
   * @param item - Thread item to check
   * @returns True if this plugin should estimate this item's height
   */
  canHandle: (item: ThreadItem) => boolean;

  /**
   * Estimate height for items this plugin can handle.
   * Same signature as HeightEstimator.estimate.
   *
   * @param item - Thread item to estimate
   * @param width - Container width in pixels
   * @param config - Estimation configuration
   * @returns Estimated height or Promise for async
   */
  estimate: (
    item: ThreadItem,
    width: number,
    config: HeightEstimatorConfig
  ) => number | Promise<number>;
}

/**
 * Estimator registry for managing multiple plugins.
 *
 * Consumers can register multiple estimators with different priorities.
 * The registry selects the best estimator for each item based on
 * canHandle predicates and priority ordering.
 *
 * @example
 * ```typescript
 * const registry: HeightEstimatorRegistry = {
 *   plugins: [imagePlugin, toolCallPlugin, defaultPlugin],
 *   selectEstimator: (item) => {
 *     const matching = registry.plugins.filter(p => p.canHandle(item));
 *     if (matching.length === 0) return null;
 *     return matching.sort((a, b) => b.priority - a.priority)[0];
 *   }
 * };
 * ```
 */
export interface HeightEstimatorRegistry {
  /** Registered plugins in priority order (highest first). */
  plugins: HeightEstimatorPlugin[];

  /**
   * Select the best estimator for a given item.
   *
   * @param item - Thread item to find estimator for
   * @returns Best matching plugin, or null if no plugin canHandle
   */
  selectEstimator: (item: ThreadItem) => HeightEstimatorPlugin | null;
}