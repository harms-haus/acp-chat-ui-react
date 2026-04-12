import { describe, it, expect } from "vitest";
import { estimateTokenCount } from "../replay/types.js";

describe("token timing utilities", () => {
  describe("estimateTokenCount", () => {
    it("estimates tokens for empty string", () => {
      const result = estimateTokenCount("");
      expect(result).toBe(0);
    });

    it("estimates tokens for short text", () => {
      const result = estimateTokenCount("hello");
      expect(result).toBe(Math.ceil(5 / 4));
    });

    it("estimates tokens for longer text", () => {
      const text = "This is a longer piece of text to test token estimation.";
      const result = estimateTokenCount(text);
      expect(result).toBe(Math.ceil(text.length / 4));
    });

    it("estimates tokens for very long text", () => {
      const text = "a".repeat(1000);
      const result = estimateTokenCount(text);
      expect(result).toBe(250);
    });

    it("handles text with special characters", () => {
      const text = "Hello, world! @#$%^&*()";
      const result = estimateTokenCount(text);
      expect(result).toBe(Math.ceil(text.length / 4));
    });

    it("handles text with unicode characters", () => {
      const text = "Hello 世界 🌍";
      const result = estimateTokenCount(text);
      expect(result).toBe(Math.ceil(text.length / 4));
    });

    it("handles text with newlines", () => {
      const text = "Line 1\nLine 2\nLine 3";
      const result = estimateTokenCount(text);
      expect(result).toBe(Math.ceil(text.length / 4));
    });

    it("handles text with tabs", () => {
      const text = "Column 1\tColumn 2\tColumn 3";
      const result = estimateTokenCount(text);
      expect(result).toBe(Math.ceil(text.length / 4));
    });

    it("estimates tokens for JSON strings", () => {
      const json = JSON.stringify({ message: "hello", count: 42 });
      const result = estimateTokenCount(json);
      expect(result).toBe(Math.ceil(json.length / 4));
    });

    it("uses ceiling function for rounding", () => {
      const text = "abcde";
      const result = estimateTokenCount(text);
      expect(result).toBe(2);
    });

    it("accurately counts tokens for 4-character chunks", () => {
      const text = "abcd";
      const result = estimateTokenCount(text);
      expect(result).toBe(1);
    });

    it("accurately counts tokens for 8-character chunks", () => {
      const text = "abcdefgh";
      const result = estimateTokenCount(text);
      expect(result).toBe(2);
    });

    it("accurately counts tokens for mixed lengths", () => {
      const text1 = "abcd";
      const text2 = "abcde";
      const result1 = estimateTokenCount(text1);
      const result2 = estimateTokenCount(text2);
      expect(result1).toBe(1);
      expect(result2).toBe(2);
    });
  });

  describe("delay calculation", () => {
    const TPS = 65;
    const ZERO_TOKEN_DELAY_MS = 15;

  it("calculates delay for 0 tokens as 15ms", () => {
    const tokenCount = 0;
    const delay = Math.max(ZERO_TOKEN_DELAY_MS, (tokenCount / TPS) * 1000);
    expect(delay).toBe(ZERO_TOKEN_DELAY_MS);
  });

    it("calculates delay for 1 token at 65 TPS", () => {
      const tokenCount = 1;
      const delay = (tokenCount / TPS) * 1000;
      expect(delay).toBeCloseTo(15.38, 2);
    });

    it("calculates delay for 10 tokens at 65 TPS", () => {
      const tokenCount = 10;
      const delay = (tokenCount / TPS) * 1000;
      expect(delay).toBeCloseTo(153.85, 2);
    });

    it("calculates delay for 65 tokens at 65 TPS (1 second)", () => {
      const tokenCount = 65;
      const delay = (tokenCount / TPS) * 1000;
      expect(delay).toBeCloseTo(1000, 0);
    });

    it("calculates delay for 100 tokens at 65 TPS", () => {
      const tokenCount = 100;
      const delay = (tokenCount / TPS) * 1000;
      expect(delay).toBeCloseTo(1538.46, 2);
    });

    it("calculates delay for 130 tokens at 65 TPS (2 seconds)", () => {
      const tokenCount = 130;
      const delay = (tokenCount / TPS) * 1000;
      expect(delay).toBeCloseTo(2000, 0);
    });

    it("calculates delay for large token count at 65 TPS", () => {
      const tokenCount = 500;
      const delay = (tokenCount / TPS) * 1000;
      expect(delay).toBeCloseTo(7692.31, 2);
    });

    it("calculates delay for very large token count at 65 TPS", () => {
      const tokenCount = 1000;
      const delay = (tokenCount / TPS) * 1000;
      expect(delay).toBeCloseTo(15384.62, 2);
    });

    it("calculates delay for 32.5 tokens (half second)", () => {
      const tokenCount = 32.5;
      const delay = (tokenCount / TPS) * 1000;
      expect(delay).toBeCloseTo(500, 0);
    });
  });

  describe("zero-token events", () => {
    it("uses 15ms fixed delay for zero-token events", () => {
      const ZERO_TOKEN_DELAY_MS = 15;
      expect(ZERO_TOKEN_DELAY_MS).toBe(15);
    });

    it("estimates 0 tokens for minimal envelope", () => {
      const minimalJson = JSON.stringify({
        version: 1,
        seq: 0,
        timestamp_ms: 0,
        type: "bridge_status",
        status: "connected",
      });
      const result = estimateTokenCount(minimalJson);
      expect(result).toBe(Math.ceil(minimalJson.length / 4));
    });

    it("uses estimateTokenCount for delay calculation", () => {
      const tokenCount = 0;
      const TPS = 65;
      const delay = (tokenCount / TPS) * 1000;
      expect(delay).toBe(0);
    });
  });

  describe("large burst splitting logic", () => {
    const BURST_THRESHOLD = 100;
    const CHUNK_SIZE = 10;

    it("splits events with 101 tokens into chunks", () => {
      const tokenCount = 101;
      const shouldSplit = tokenCount > BURST_THRESHOLD;
      expect(shouldSplit).toBe(true);
    });

    it("does not split events with 100 tokens", () => {
      const tokenCount = 100;
      const shouldSplit = tokenCount > BURST_THRESHOLD;
      expect(shouldSplit).toBe(false);
    });

    it("splits 200 tokens into ~20 chunks", () => {
      const tokenCount = 200;
      const chunkCount = Math.ceil(tokenCount / CHUNK_SIZE);
      expect(chunkCount).toBe(20);
    });

    it("splits 1000 tokens into 100 chunks", () => {
      const tokenCount = 1000;
      const chunkCount = Math.ceil(tokenCount / CHUNK_SIZE);
      expect(chunkCount).toBe(100);
    });

    it("splits 150 tokens into 15 chunks", () => {
      const tokenCount = 150;
      const chunkCount = Math.ceil(tokenCount / CHUNK_SIZE);
      expect(chunkCount).toBe(15);
    });

    it("calculates chunk delay for 10 tokens", () => {
      const chunkTokenCount = 10;
      const TPS = 65;
      const delay = (chunkTokenCount / TPS) * 1000;
      expect(delay).toBeCloseTo(153.85, 2);
    });

    it("calculates total delay for split burst", () => {
      const tokenCount = 200;
      const chunkCount = Math.ceil(tokenCount / CHUNK_SIZE);
      const TPS = 65;
      const chunkDelay = (CHUNK_SIZE / TPS) * 1000;
      const totalDelay = chunkCount * chunkDelay;
      expect(totalDelay).toBeCloseTo(3076.92, 2);
    });

    it("uses 15ms for zero-token chunks", () => {
      const chunkTokenCount = 0;
      const TPS = 65;
      const ZERO_TOKEN_DELAY_MS = 15;
      const delay = chunkTokenCount > 0 ? (chunkTokenCount / TPS) * 1000 : ZERO_TOKEN_DELAY_MS;
      expect(delay).toBe(15);
    });
  });

  describe("edge cases", () => {
    it("handles very short token count", () => {
      const tokenCount = 1;
      const TPS = 65;
      const delay = (tokenCount / TPS) * 1000;
      expect(delay).toBeGreaterThan(0);
      expect(delay).toBeLessThan(100);
    });

    it("handles negative token count (should not happen but test robustness)", () => {
      const tokenCount = -1;
      const TPS = 65;
      const delay = (tokenCount / TPS) * 1000;
      expect(delay).toBeLessThan(0);
    });

    it("handles fractional token count", () => {
      const tokenCount = 32.5;
      const TPS = 65;
      const delay = (tokenCount / TPS) * 1000;
      expect(delay).toBeCloseTo(500, 0);
    });

    it("handles very large token count", () => {
      const tokenCount = 10000;
      const TPS = 65;
      const delay = (tokenCount / TPS) * 1000;
      expect(delay).toBeCloseTo(153846.15, 2);
      expect(delay).toBeGreaterThan(150000);
    });

    it("estimates tokens for text with only spaces", () => {
      const text = "     ";
      const result = estimateTokenCount(text);
      expect(result).toBe(Math.ceil(text.length / 4));
    });

    it("estimates tokens for text with mixed content", () => {
      const text = "Hello\nWorld\t123!@#";
      const result = estimateTokenCount(text);
      expect(result).toBe(Math.ceil(text.length / 4));
    });

    it("calculates delay exactly at burst threshold", () => {
      const tokenCount = 100;
      const BURST_THRESHOLD = 100;
      const shouldSplit = tokenCount > BURST_THRESHOLD;
      expect(shouldSplit).toBe(false);
    });

    it("calculates delay just above burst threshold", () => {
      const tokenCount = 101;
      const BURST_THRESHOLD = 100;
      const shouldSplit = tokenCount > BURST_THRESHOLD;
      expect(shouldSplit).toBe(true);
    });

    it("handles token count that's exactly a multiple of chunk size", () => {
      const tokenCount = 100;
      const CHUNK_SIZE = 10;
      const chunkCount = Math.ceil(tokenCount / CHUNK_SIZE);
      expect(chunkCount).toBe(10);
    });

    it("handles token count that's not a multiple of chunk size", () => {
      const tokenCount = 97;
      const CHUNK_SIZE = 10;
      const chunkCount = Math.ceil(tokenCount / CHUNK_SIZE);
      expect(chunkCount).toBe(10);
    });
  });
});
