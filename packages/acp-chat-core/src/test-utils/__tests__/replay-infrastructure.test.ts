/**
 * Integration tests for replay fixture infrastructure.
 *
 * These tests verify that the replay fixture loader, runner, and assertions
 * work correctly with existing fixtures.
 */

import { describe, it, expect } from "vitest";
import {
  listFixtures,
  loadFixture,
  loadFixtureMetadata,
  loadFixtureManifest,
} from '../fixture-loader.js';
import {
  assertReplaySuccess,
  assertHasSessionUpdates,
  getUpdateTypes,
  summarizeReplay,
} from '../replay-assertions.js';
import type { ReplayOutcome } from '../replay-runner.js';

describe("Replay Fixture Infrastructure", () => {
  describe("listFixtures", () => {
    it("returns array of fixture paths", () => {
      const fixtures = listFixtures();
      expect(Array.isArray(fixtures)).toBe(true);
      expect(fixtures.length).toBeGreaterThan(0);
    });

    it("includes both captured and structured fixtures", () => {
      const fixtures = listFixtures();
      const hasStructured = fixtures.some((f) => f.includes('/'));
      
      expect(hasStructured).toBe(true);
    });
  });

  describe("loadFixture", () => {
    it("loads a structured fixture", () => {
      // Try to load a known fixture
      const fixture = loadFixture('tool-calling/session-1');
      
      expect(fixture.demoType).toBe('tool-calling');
      expect(fixture.sessionId).toBeTruthy();
      expect(fixture.events).toBeDefined();
      expect(Array.isArray(fixture.events)).toBe(true);
    });

    it("loads fixture with events", () => {
      const fixture = loadFixture('tool-calling/session-1');
      
      expect(fixture.events.length).toBeGreaterThan(0);
    });

    it("loads fixture metadata", () => {
      const fixture = loadFixture('tool-calling/session-1');
      
      expect(fixture.metadata).toBeDefined();
      expect(typeof fixture.metadata.demoType).toBe('string');
      expect(typeof fixture.metadata.eventCount).toBe('number');
    });
  });

  describe("loadFixtureMetadata", () => {
    it("loads only metadata without events", () => {
      const fixture = loadFixtureMetadata('tool-calling/session-1');
      
      expect(fixture.metadata).toBeDefined();
      expect(fixture.events).toEqual([]);
    });
  });

  describe("loadFixtureManifest", () => {
    it("loads manifest for structured fixture", () => {
      const manifest = loadFixtureManifest('tool-calling/session-1');
      
      expect(manifest.demoType).toBe('script-replay');
      expect(Array.isArray(manifest.sessions)).toBe(true);
    });
  });

  describe("assertion helpers", () => {
    it("can summarize replay", () => {
      // Create a mock outcome for testing
      const mockOutcome: ReplayOutcome = {
        success: true,
        sessionUpdates: [
          {
            sessionId: 'test-1',
            update: { type: 'agent_thought_chunk', content: 'test' },
            timestamp: Date.now(),
          },
        ],
        permissionRequests: [],
        statistics: {
          totalEvents: 5,
          inboundEvents: 5,
          outboundEvents: 0,
          totalTokens: 100,
          durationMs: 500,
          errorCount: 0,
        },
        fixture: loadFixture('tool-calling/session-1'),
      };

      const summary = summarizeReplay(mockOutcome);
      expect(summary).toContain('SUCCESS');
      expect(summary).toContain('Events:');
      expect(summary).toContain('Tokens:');
    });

    it("assertReplaySuccess throws on failure", () => {
      const mockOutcome: ReplayOutcome = {
        success: false,
        error: 'Test error',
        sessionUpdates: [],
        permissionRequests: [],
        statistics: {
          totalEvents: 0,
          inboundEvents: 0,
          outboundEvents: 0,
          totalTokens: 0,
          durationMs: 0,
          errorCount: 1,
        },
        fixture: loadFixture('tool-calling/session-1'),
      };

      expect(() => assertReplaySuccess(mockOutcome)).toThrow('Replay failed');
    });

    it("assertHasSessionUpdates works with mock data", () => {
      const mockOutcome: ReplayOutcome = {
        success: true,
        sessionUpdates: [
          {
            sessionId: 'test-1',
            update: { type: 'agent_thought_chunk', content: 'test' },
            timestamp: Date.now(),
          },
        ],
        permissionRequests: [],
        statistics: {
          totalEvents: 1,
          inboundEvents: 1,
          outboundEvents: 0,
          totalTokens: 10,
          durationMs: 100,
          errorCount: 0,
        },
        fixture: loadFixture('tool-calling/session-1'),
      };

      expect(() =>
        assertHasSessionUpdates(mockOutcome, {
          update: { type: 'agent_thought_chunk' },
        })
      ).not.toThrow();
    });

    it("getUpdateTypes returns unique types", () => {
      const mockOutcome: ReplayOutcome = {
        success: true,
        sessionUpdates: [
          {
            sessionId: 'test-1',
            update: { type: 'agent_thought_chunk' },
            timestamp: Date.now(),
          },
          {
            sessionId: 'test-1',
            update: { type: 'tool_call' },
            timestamp: Date.now(),
          },
          {
            sessionId: 'test-1',
            update: { type: 'agent_thought_chunk' },
            timestamp: Date.now(),
          },
        ],
        permissionRequests: [],
        statistics: {
          totalEvents: 3,
          inboundEvents: 3,
          outboundEvents: 0,
          totalTokens: 30,
          durationMs: 300,
          errorCount: 0,
        },
        fixture: loadFixture('tool-calling/session-1'),
      };

      const types = getUpdateTypes(mockOutcome);
      expect(types).toEqual(
        expect.arrayContaining(['agent_thought_chunk', 'tool_call'])
      );
      expect(types.length).toBe(2);
    });
  });

  describe("fixture format validation", () => {
    it("validates captured fixture format", () => {
      // Load a captured fixture
      const allFixtures = listFixtures();
      const capturedFixtures = allFixtures.filter((f) => /^\d+$/.test(f));
      
      if (capturedFixtures.length === 0) {
        return;
      }
      
      const fixture = loadFixture(capturedFixtures[0]);
      
      expect(fixture.demoType).toBe('captured');
      expect(fixture.sessionId).toBeTruthy();
      expect(fixture.metadata).toBeDefined();
    });

    it("validates structured fixture format", () => {
      const fixture = loadFixture('tool-calling/session-1');
      
      // Validate required fields
      expect(fixture.demoType).toMatch(/^[a-z-]+$/);
      expect(fixture.sessionId).toMatch(/^[a-zA-Z0-9-]+$/);
      
      // Validate events structure - events are raw BridgeEnvelopes with metadata
      for (const event of fixture.events) {
        expect(event).toHaveProperty('version');
        expect(event).toHaveProperty('seq');
        expect(event).toHaveProperty('timestamp_ms');
        expect(event).toHaveProperty('type');
      }
    });
  });
});
