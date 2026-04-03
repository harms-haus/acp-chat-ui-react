/**
 * Example Height Estimator Implementations
 *
 * This module provides ready-to-use example implementations for custom height estimators.
 * Consumers can copy these patterns and modify them for their specific use cases.
 *
 * @see Task 3 for the HeightEstimator interface definition
 * @see Task 7 for the default pretext estimator implementation
 * @see Task 4 for DEFAULT_HEIGHT_ESTIMATOR_CONFIG
 *
 * @module examples/height-estimators
 */

import type {
  ThreadItem,
} from "../thread/types.js";
import type {
  HeightEstimator,
  HeightEstimatorConfig,
} from "../types/height-estimator.js";

/**
 * Simple Fixed Height Estimator
 *
 * A synchronous estimator that returns fixed height values based on item type.
 * This is the simplest possible estimator and is useful for:
 * - Quick prototyping before implementing accurate estimation
 * - Threads with uniform message heights
 * - Performance-critical scenarios where estimation speed is prioritized over accuracy
 * - Learning the estimator interface before building more complex estimators
 *
 * Trade-offs:
 * - Very fast (O(1) constant time)
 * - Low accuracy (may over-allocate or under-allocate space)
 * - Can cause scroll jitter if actual heights vary significantly
 * - Not suitable for threads with variable content (long/short messages, images, etc.)
 *
 * @example
 * ```typescript
 * import { SimpleFixedHeightEstimator } from '@acp/chat-react';
 * import { DEFAULT_HEIGHT_ESTIMATOR_CONFIG } from '@acp/chat-react';
 *
 * // Use default fixed heights
 * const estimator = new SimpleFixedHeightEstimator();
 *
 * // Or customize fixed heights
 * const customEstimator = new SimpleFixedHeightEstimator({
 *   messageHeight: 200,  // Taller for your app's messages
 *   thoughtGroupHeight: 150,
 * });
 *
 * // Use with VirtualizedThread
 * <VirtualizedThread
 *   items={threadItems}
 *   renderItem={renderItem}
 *   estimatedRowHeight={200}
 *   heightEstimator={customEstimator}
 * />
 * ```
 */
export class SimpleFixedHeightEstimator implements HeightEstimator {
  private messageHeight: number;
  private thoughtGroupHeight: number;

  /**
   * Create a fixed height estimator.
   *
   * @param options - Fixed height options for each item type
   */
  constructor(options?: {
    /** Fixed height for message items (default: 120px) */
    messageHeight?: number;
    /** Fixed height for thought_group items (default: 80px) */
    thoughtGroupHeight?: number;
  }) {
    this.messageHeight = options?.messageHeight ?? 120;
    this.thoughtGroupHeight = options?.thoughtGroupHeight ?? 80;
  }

  /**
   * Estimate height for a thread item.
   *
   * This is a synchronous estimator that returns a fixed value based on item type.
   * The config parameter is ignored since this estimator doesn't measure content.
   *
   * @param item - The thread item to estimate
   * @param _width - Container width (ignored in this estimator)
   * @param _config - Estimation config (ignored in this estimator)
   * @returns Fixed height based on item type
   */
  estimate(
    item: ThreadItem,
    _width: number,
    _config: HeightEstimatorConfig
  ): number {
    if (item.type === "message") {
      return this.messageHeight;
    }
    if (item.type === "thought_group") {
      return this.thoughtGroupHeight;
    }
    // Fallback for any unknown types
    return 100;
  }
}

/**
 * Async Image-Aware Height Estimator
 *
 * An asynchronous estimator that waits for image dimensions to be loaded before
 * estimating height. This estimator provides accurate measurements for threads
 * containing images or other media with variable dimensions.
 *
 * Use cases:
 * - Threads with images, charts, or visual content
 * - Accurate estimation required for smooth scrolling
 * - Content with rich media blocks (resources, images)
 *
 * How it works:
 * 1. First pass: Returns a reasonable estimate based on text length
 * 2. Loads image dimensions from resource blocks using Image API
 * 3. Re-calculates height once image dimensions are known
 * 4. Returns accurate height accounting for both text and images
 *
 * Trade-offs:
 * - More accurate than simple estimators
 * - Slower initial estimation (requires loading image metadata)
 * - Requires network access to load image dimensions
 * - May cause re-renders as images load
 * - More complex implementation
 *
 * Implementation notes:
 * - Uses browser's Image API to load dimensions without full image download
 * - Falls back to text-based estimation if image loading fails
 * - Caches image dimensions to avoid re-loading
 * - Scales images to fit container width while maintaining aspect ratio
 *
 * @example
 * ```typescript
 * import { AsyncImageAwareEstimator } from '@acp/chat-react';
 * import { DEFAULT_HEIGHT_ESTIMATOR_CONFIG } from '@acp/chat-react';
 *
 * // Create async estimator with default config
 * const estimator = new AsyncImageAwareEstimator(DEFAULT_HEIGHT_ESTIMATOR_CONFIG);
 *
 * // Use with VirtualizedThread
 * // Note: Component must handle Promise returns from estimate()
 * <VirtualizedThread
 *   items={threadItems}
 *   renderItem={renderItem}
 *   estimatedRowHeight={200}
 *   heightEstimator={estimator}
 * />
 * ```
 *
 * @example
 * ```typescript
 * // Custom config with larger image buffer
 * const customConfig = {
 *   ...DEFAULT_HEIGHT_ESTIMATOR_CONFIG,
 *   richContentBlockHeight: 200,  // More space for images
 * };
 * const estimator = new AsyncImageAwareEstimator(customConfig);
 * ```
 */
export class AsyncImageAwareEstimator implements HeightEstimator {
  private config: HeightEstimatorConfig;
  private imageDimensionCache: Map<string, { width: number; height: number }>;

  /**
   * Create an async image-aware estimator.
   *
   * @param config - Height estimation configuration
   */
  constructor(config: HeightEstimatorConfig) {
    this.config = config;
    this.imageDimensionCache = new Map();
  }

  /**
   * Estimate height for a thread item.
   *
   * This estimator loads image dimensions asynchronously and returns a Promise.
   * For messages without images, it returns a synchronous text-based estimate.
   *
   * @param item - The thread item to estimate
   * @param width - Container width in pixels
   * @param config - Estimation configuration
   * @returns Estimated height in pixels (async for images, sync for text-only)
   */
  async estimate(
    item: ThreadItem,
    width: number,
    config: HeightEstimatorConfig
  ): Promise<number> {
    if (item.type === "message") {
      return this.estimateMessage(item.data, width, config);
    }
    if (item.type === "thought_group") {
      return this.estimateThoughtGroup(width, config);
    }
    return 100;
  }

  /**
   * Estimate height for a message item.
   *
   * Handles both text-only messages and messages with image/resource blocks.
   * For messages with images, loads dimensions and calculates accurate height.
   *
   * @param message - NormalizedMessage to estimate
   * @param width - Container width in pixels
   * @param config - Estimation configuration
   * @returns Estimated height in pixels
   */
  private async estimateMessage(
    message: any, // NormalizedMessage
    width: number,
    config: HeightEstimatorConfig
  ): Promise<number> {
    // Base height from header
    let height = config.headerHeight;

    // Check for resource blocks (images, media)
    const hasResources = message.contentBlocks?.some(
      (block: any) => block.type === "resource" || block.type === "resource_link"
    );

    if (hasResources) {
      // Load image dimensions for resource blocks
      const imageHeights = await this.loadImageDimensions(message.contentBlocks, width, config);
      height += imageHeights.totalHeight;

      // Add text height if present
      if (message.content) {
        height += this.estimateTextHeight(message.content, width, config);
      }
    } else if (message.content) {
      // Text-only message: estimate based on content length
      height += this.estimateTextHeight(message.content, width, config);
    } else {
      // Empty message: use minimum height
      height += config.minHeight ?? 60;
    }

    // Add bottom padding
    height += config.contentPadding;

    return height;
  }

  /**
   * Estimate height for a thought group.
   *
   * Thought groups typically contain thoughts and tool calls.
   * This is a simplified estimation based on item count.
   *
   * @param width - Container width in pixels (unused in this simplified version)
   * @param config - Estimation configuration
   * @returns Estimated height in pixels
   */
  private estimateThoughtGroup(width: number, config: HeightEstimatorConfig): number {
    // Simplified: use fixed height for thought groups
    // A more accurate estimator would count thoughts and tool calls
    return config.headerHeight + (config.minHeight ?? 60);
  }

  /**
   * Estimate text height based on content length.
   *
   * This is a simplified text estimation that approximates line count based on
   * character count and average characters per line.
   *
   * @param text - Text content to estimate
   * @param width - Container width in pixels
   * @param config - Estimation configuration
   * @returns Estimated text height in pixels
   */
  private estimateTextHeight(
    text: string,
    width: number,
    config: HeightEstimatorConfig
  ): number {
    // Approximate: average ~50 characters per line at 600px width with 14px font
    const effectiveWidth = width > 0 ? width : config.defaultContainerWidth;
    const avgCharsPerLine = Math.floor(effectiveWidth / (config.fontSize * 0.6));
    const lineCount = Math.ceil(text.length / avgCharsPerLine);
    return lineCount * config.lineHeight;
  }

  /**
   * Load image dimensions for resource blocks.
   *
   * Uses browser Image API to load dimensions without downloading full images.
   * Dimensions are cached to avoid re-loading the same images.
   *
   * @param contentBlocks - Array of content blocks to process
   * @param width - Container width in pixels
   * @param config - Estimation configuration
   * @returns Object with totalHeight and individual block heights
   */
  private async loadImageDimensions(
    contentBlocks: any[],
    width: number,
    config: HeightEstimatorConfig
  ): Promise<{ totalHeight: number; blockHeights: number[] }> {
    const blockHeights: number[] = [];
    const effectiveWidth = width > 0 ? width : config.defaultContainerWidth;

    for (const block of contentBlocks) {
      if (block.type === "resource" || block.type === "resource_link") {
        const uri = block.resource?.uri || block.resourceLink?.uri;
        if (!uri) continue;

        // Check cache first
        if (this.imageDimensionCache.has(uri)) {
          const cached = this.imageDimensionCache.get(uri)!;
          const scaledHeight = this.scaleImageToWidth(cached.width, cached.height, effectiveWidth);
          blockHeights.push(scaledHeight);
          continue;
        }

        // Load image dimensions
        try {
          const dimensions = await this.loadImageDimensionsFromUri(uri);
          this.imageDimensionCache.set(uri, dimensions);
          const scaledHeight = this.scaleImageToWidth(dimensions.width, dimensions.height, effectiveWidth);
          blockHeights.push(scaledHeight);
        } catch (error) {
          // Fall back to default block height if loading fails
          blockHeights.push(config.richContentBlockHeight || 100);
        }
      }
    }

    // Add spacing between blocks
    const totalHeight = blockHeights.reduce((sum, height, index) => {
      if (index > 0) {
        sum += config.rowGap || 0;
      }
      return sum + height;
    }, 0);

    return { totalHeight, blockHeights };
  }

  /**
   * Load image dimensions from a URI.
   *
   * Creates an Image element and waits for it to load to get dimensions.
   *
   * @param uri - Image URI to load
   * @returns Promise resolving to image dimensions
   */
  private loadImageDimensionsFromUri(uri: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      if (typeof window === "undefined" || typeof Image === "undefined") {
        // SSR or no Image API: return default dimensions
        resolve({ width: 600, height: 400 });
        return;
      }

      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        reject(new Error(`Failed to load image dimensions for: ${uri}`));
      };
      img.src = uri;
    });
  }

  /**
   * Scale image height to fit container width while maintaining aspect ratio.
   *
   * @param imageWidth - Original image width
   * @param imageHeight - Original image height
   * @param containerWidth - Target container width
   * @returns Scaled height in pixels
   */
  private scaleImageToWidth(
    imageWidth: number,
    imageHeight: number,
    containerWidth: number
  ): number {
    const aspectRatio = imageWidth / imageHeight;
    return Math.round(containerWidth / aspectRatio);
  }
}
