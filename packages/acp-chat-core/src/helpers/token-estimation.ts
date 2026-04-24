/**
 * Token estimation utilities.
 * 
 * Simple approximation for UI display and replay timing purposes.
 * Uses characters / 4 as a rough estimate.
 */

/**
 * Estimates token count for a given text string.
 *
 * Uses a simple approximation: characters / 4.
 * This is sufficient for UI display purposes and replay timing.
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Default delay for zero-token events (minimal overhead)
 */
export const ZERO_TOKEN_DELAY_MS = 15;

/**
 * Default tokens per second for replay timing
 */
export const DEFAULT_TPS = 65;

/**
 * Burst threshold - events with more tokens than this are split into chunks
 */
export const BURST_THRESHOLD = 100;

/**
 * Chunk size for splitting large bursts
 */
export const CHUNK_SIZE = 10;

/**
 * Calculate delay in milliseconds for a given token count.
 *
 * @param tokenCount - Number of tokens
 * @param tps - Tokens per second (default: 65)
 * @returns Delay in milliseconds
 */
export function calculateTokenDelay(tokenCount: number, tps: number = DEFAULT_TPS): number {
  if (tokenCount <= 0) {
    return ZERO_TOKEN_DELAY_MS;
  }
  return (tokenCount / tps) * 1000;
}

/**
 * Determine if an event should be split into chunks based on token count.
 *
 * @param tokenCount - Number of tokens
 * @returns true if the event should be split
 */
export function shouldSplitBurst(tokenCount: number): boolean {
  return tokenCount > BURST_THRESHOLD;
}

/**
 * Calculate the number of chunks needed for a burst event.
 *
 * @param tokenCount - Number of tokens
 * @param chunkSize - Tokens per chunk (default: 10)
 * @returns Number of chunks
 */
export function calculateChunkCount(tokenCount: number, chunkSize: number = CHUNK_SIZE): number {
  return Math.ceil(tokenCount / chunkSize);
}
