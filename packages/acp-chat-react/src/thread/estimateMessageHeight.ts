import { prepare, layout } from '@chenglou/pretext';
import type { NormalizedMessage } from '@acp/chat-core';

// System font stack to match actual rendered fonts (fixes documented Inter mismatch)
const MESSAGE_FONT = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const LINE_HEIGHT = 22;
const HEADER_HEIGHT = 48;
const CONTENT_PADDING = 24;
const DEFAULT_CONTAINER_WIDTH = 600;
const RICH_CONTENT_BLOCK_HEIGHT = 100;

export function estimateMessageHeight(
  message: NormalizedMessage,
  containerWidth: number = DEFAULT_CONTAINER_WIDTH
): number {
  if (message.content && (!message.contentBlocks || message.contentBlocks.length === 0)) {
    const prepared = prepare(message.content, MESSAGE_FONT);
    const { height } = layout(prepared, containerWidth - CONTENT_PADDING, LINE_HEIGHT);
    return HEADER_HEIGHT + height + CONTENT_PADDING;
  }
  
  if (message.contentBlocks && message.contentBlocks.length > 0) {
    const blocksHeight = message.contentBlocks.length * RICH_CONTENT_BLOCK_HEIGHT;
    return HEADER_HEIGHT + blocksHeight + CONTENT_PADDING;
  }
  
  return HEADER_HEIGHT + 60 + CONTENT_PADDING;
}

export function estimateMessageHeights(
  messages: NormalizedMessage[],
  containerWidth: number = DEFAULT_CONTAINER_WIDTH
): Map<string, number> {
  const heights = new Map<string, number>();
  
  for (const message of messages) {
    heights.set(message.id, estimateMessageHeight(message, containerWidth));
  }
  
  return heights;
}
