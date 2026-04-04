/**
 * Pretext-based height estimator implementation.
 *
 * This module provides the default height estimator using @chenglou/pretext
 * for accurate text measurement. The estimator handles:
 * - Text content estimation using pretext's prepare/layout API
 * - Rich content blocks using configurable fallback heights
 * - Thought group items with thought and tool call items
 *
 * The estimator is configurable via HeightEstimatorConfig to match
 * actual rendered layout (font, spacing, container width).
 *
 * @remarks
 * Pretext's prepare/layout pattern:
 * - `prepare(text, font, options?)` creates a reusable measurement object (call once per unique text)
 * - `layout(prepared, width, lineHeight)` calculates height at a given width (call on resize)
 * - Font string must exactly match the CSS font property used in rendering
 *
 * @see Task 3 for HeightEstimator interface
 * @see Task 4 for DEFAULT_HEIGHT_ESTIMATOR_CONFIG
 * @see Task 9 for VirtualizedThread integration
 */

import { prepare, layout } from '@chenglou/pretext';
import type { ThreadItem } from './types.js';
import type {
  HeightEstimator,
  HeightEstimatorConfig,
  PreparedTextEntry,
} from '../types/height-estimator.js';
import {
  DEFAULT_HEIGHT_ESTIMATOR_CONFIG,
} from '../types/height-estimator.js';

/**
 * Cache for prepared text entries.
 *
 * Keyed by text content to enable reuse across width changes during resize.
 */
type PrepareCache = Map<string, PreparedTextEntry>;

/**
 * Internal state for the pretext estimator.
 */
interface PretextEstimatorState {
  /** Configuration values for estimation */
  config: HeightEstimatorConfig;

  /** Cache of prepared text entries for reuse */
  prepareCache: PrepareCache;

  /** Font string constructed from config (e.g., "14px -apple-system, BlinkMacSystemFont, ...") */
  font: string;
}

/**
 * Create a pretext-based height estimator.
 *
 * @param config - Estimation configuration (defaults to DEFAULT_HEIGHT_ESTIMATOR_CONFIG)
 * @returns A HeightEstimator instance using pretext for text measurement
 *
 * @example
 * ```typescript
 * import { createPretextEstimator } from '@acp/chat-react';
 *
 * // Use default config
 * const estimator = createPretextEstimator();
 *
 * // Override specific config values
 * const customEstimator = createPretextEstimator({
 *   ...DEFAULT_HEIGHT_ESTIMATOR_CONFIG,
 *   fontSize: 16,
 *   lineHeight: 24,
 * });
 * ```
 */
export function createPretextEstimator(
  config: HeightEstimatorConfig = DEFAULT_HEIGHT_ESTIMATOR_CONFIG
): HeightEstimator {
  const state: PretextEstimatorState = {
    config,
    prepareCache: new Map(),
    font: `${config.fontSize}px ${config.fontFamily}`,
  };

  /**
   * Prepare text content for reuse across width changes.
   *
   * Caches prepared text to improve performance during container resize.
   * Cache key is the text content string.
   *
   * @param text - Text content to prepare
   * @param font - Font string matching config
   * @param options - Preparation options (whiteSpace)
   * @returns Prepared text entry, or null if not supported
   */
  function prepareText(
    text: string,
    font: string,
    options?: { whiteSpace?: 'normal' | 'pre-wrap' }
  ): PreparedTextEntry | null {
    const cacheKey = text;

    // Check cache for existing prepared text with matching font
    const cached = state.prepareCache.get(cacheKey);
    if (cached && cached.font === font) {
      return cached;
    }

    // Prepare new text with pretext
    const whiteSpace = options?.whiteSpace ?? state.config.whiteSpace ?? 'normal';
    const prepared = prepare(text, font, { whiteSpace });

    const entry: PreparedTextEntry = {
      font,
      whiteSpace,
      preparedAt: Date.now(),
      prepared,
    };

    state.prepareCache.set(cacheKey, entry);

    return entry;
  }

  /**
   * Layout prepared text at a given width.
   *
   * Calculates height for previously prepared text without re-preparing.
   *
   * @param prepared - Previously prepared text entry
   * @param width - Container width in pixels
   * @param lineHeight - Line height in pixels
   * @returns Calculated text height in pixels
   */
  function layoutText(
    prepared: PreparedTextEntry,
    width: number,
    lineHeight: number
  ): number {
    const { prepared: preparedObj } = prepared;
    if (!preparedObj) {
      return lineHeight;
    }

    const { height } = layout(preparedObj as Parameters<typeof layout>[0], width, lineHeight);
    return height;
  }

  /**
   * Estimate height for a message item.
   *
   * Messages can have:
   * - Text content (message.content)
   * - Rich content blocks (message.contentBlocks)
   * - Both text and blocks
   *
   * Text content uses pretext for accurate measurement.
   * Rich blocks use the configured richContentBlockHeight fallback.
   *
   * @param message - NormalizedMessage to estimate
   * @param containerWidth - Container width in pixels
   * @returns Estimated height in pixels
   */
  function estimateMessageHeight(message: any, containerWidth: number): number {
    const { headerHeight, contentPadding, richContentBlockHeight, minHeight } = state.config;

    // Case 1: Text-only message (no contentBlocks or empty array)
    if (
      message.content &&
      (!message.contentBlocks || message.contentBlocks.length === 0)
    ) {
      const font = `${state.config.fontSize}px ${state.config.fontFamily}`;
      const whiteSpace = state.config.whiteSpace ?? 'normal';

      // Prepare text (uses cache if available)
      const prepared = prepare(message.content, font, { whiteSpace });
      const { height } = layout(
        prepared,
        containerWidth - contentPadding,
        state.config.lineHeight
      );

      return headerHeight + height + contentPadding;
    }

    // Case 2: Message with contentBlocks (rich content)
    if (message.contentBlocks && message.contentBlocks.length > 0) {
      const blocksHeight = message.contentBlocks.length * (richContentBlockHeight ?? 100);

      // If there's also text content, add estimated text height
      if (message.content) {
        const font = `${state.config.fontSize}px ${state.config.fontFamily}`;
        const whiteSpace = state.config.whiteSpace ?? 'normal';

        const prepared = prepare(message.content, font, { whiteSpace });
        const { height } = layout(
          prepared,
          containerWidth - contentPadding,
          state.config.lineHeight
        );

        return headerHeight + height + blocksHeight + contentPadding;
      }

      return headerHeight + blocksHeight + contentPadding;
    }

    // Case 3: Empty message (no content, no blocks)
    return headerHeight + (minHeight ?? 60) + contentPadding;
  }

  /**
   * Estimate height for a thought group item.
   *
   * Thought groups contain thoughts and tool calls. We estimate
   * based on the number of items with a per-item height estimate.
   *
   * @param thoughtGroup - ThoughtGroupWithState to estimate
   * @param _containerWidth - Container width (not used for thought groups currently)
   * @returns Estimated height in pixels
   */
  function estimateThoughtGroupHeight(
    thoughtGroup: any,
    _containerWidth: number
  ): number {
    const items = thoughtGroup.items ?? [];
    const { richContentBlockHeight, minHeight } = state.config;

    // Estimate based on number of thoughts and tool calls
    // Each item gets an estimated height (thought ~ 40px, tool call ~ 100px)
    const thoughtsHeight = items.filter((item: any) => item.type === 'thought').length * 40;
    const toolCallsHeight =
      items.filter((item: any) => item.type === 'tool_call').length *
      (richContentBlockHeight ?? 100);

    const totalHeight = thoughtsHeight + toolCallsHeight;

    // Apply minimum height
    return Math.max(totalHeight, minHeight ?? 60);
  }

  /**
   * Estimate the height for a thread item.
   *
   * @param item - The thread item to estimate (message or thought_group)
   * @param width - Container width in pixels
   * @param config - Estimation configuration (matches state.config)
   * @returns Estimated height in pixels
   */
  function estimate(
    item: ThreadItem,
    width: number,
    config: HeightEstimatorConfig
  ): number {
    // Use provided container width, fall back to config default
    const containerWidth = width || config.defaultContainerWidth;

    if (item.type === 'message') {
      return estimateMessageHeight(item.data, containerWidth);
    }

    if (item.type === 'thought_group') {
      return estimateThoughtGroupHeight(item.data, containerWidth);
    }

    // Unknown item type - return minimum height
    return config.minHeight ?? 60;
  }

  return {
    estimate,
    prepareText,
    layoutText,
  };
}

// Re-export default config for convenience
export { DEFAULT_HEIGHT_ESTIMATOR_CONFIG } from '../types/height-estimator.js';

/**
 * Default estimator instance using DEFAULT_HEIGHT_ESTIMATOR_CONFIG.
 *
 * Convenience export for consumers who don't need custom config.
 *
 * @example
 * ```typescript
 * import { defaultPretextEstimator } from '@acp/chat-react';
 *
 * // Use directly in VirtualizedThread
 * <VirtualizedThread
 *   items={items}
 *   renderItem={renderItem}
 *   heightEstimator={defaultPretextEstimator}
 * />
 * ```
 */
export const defaultPretextEstimator = createPretextEstimator();
