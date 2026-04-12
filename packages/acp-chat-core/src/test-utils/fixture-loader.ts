/**
 * Fixture loader utility for replay test data.
 *
 * This module provides functions to load and parse replay fixture files
 * from the fixtures directory. Supports both the captured/ format and
 * the structured demo-type format (e.g., tool-calling/, simple-thought/).
 *
 * ## Fixture Format
 *
 * Fixtures are stored in `fixtures/replay-data/` in two formats:
 *
 * ### Captured Format
 * Location: `fixtures/replay-data/captured/{timestamp}/`
 * - `replay-events.jsonl` - JSONL format replay events
 * - `session-data.json` - Session metadata
 *
 * ### Structured Format
 * Location: `fixtures/replay-data/{demoType}/session-{n}/`
 * - `replay-events.jsonl` - JSONL format replay events
 * - `manifest.json` - Manifest with session metadata
 * - `{sessionId}/session-data.json` - Pre-existing session state
 *
 * ## Usage
 *
 * ```ts
 * import { loadFixture, listFixtures, loadFixtureManifest } from './fixture-loader';
 *
 * // List all available fixtures
 * const fixtures = listFixtures();
 *
 * // Load a specific fixture
 * const fixture = loadFixture('tool-calling/session-1');
 *
 * // Load manifest for structured fixtures
 * const manifest = loadFixtureManifest('tool-calling');
 * ```
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import type { BridgeEnvelope } from '../generated/index.js';
import type { ReplaySessionData, ReplaySessionMetadata } from '../replay/types.js';

/**
 * A replay event loaded from a fixture file.
 */
export interface LoadedReplayEvent {
  /** The bridge envelope */
  envelope: BridgeEnvelope;
  /** Pre-computed estimated token count */
  tokenCount: number;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Direction of the event */
  direction: 'in' | 'out';
}

/**
 * A loaded replay fixture with all session data.
 */
export interface LoadedFixture {
  /** The demo type (e.g., 'tool-calling', 'simple-thought') */
  demoType: string;
  /** The session ID */
  sessionId: string;
  /** Session metadata */
  metadata: ReplaySessionMetadata | CapturedSessionMetadata;
  /** Pre-existing session state (may be null) */
  sessionData: ReplaySessionData | null;
  /** Array of replay events in order */
  events: LoadedReplayEvent[];
}

/**
 * Session metadata from captured format.
 */
interface CapturedSessionMetadata {
  sessionId: string;
  startTime: number;
  endTime: number | null;
  preExistingState: ReplaySessionData | null;
  modes: string[];
  models: string[];
  eventCount: number;
  totalTokenCount: number;
}

/**
 * Get the fixtures directory path.
 */
function getFixturesDir(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  return join(__dirname, '../../fixtures/replay-data');
}

/**
 * List all available replay fixture directories.
 *
 * Returns fixture paths in the format:
 * - For captured: timestamp (e.g., '1775883968100')
 * - For structured: '{demoType}/session-{n}' (e.g., 'tool-calling/session-1')
 *
 * @returns Array of fixture paths
 */
export function listFixtures(): string[] {
  const fixturesDir = getFixturesDir();

  if (!existsSync(fixturesDir)) {
    return [];
  }

  const fixtures: string[] = [];

  // Read top-level directories
  const entries = readdirSync(fixturesDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const demoType = entry.name;
    const demoPath = join(fixturesDir, demoType);

    // Check if this is the captured directory
    if (demoType === 'captured') {
      const capturedEntries = readdirSync(demoPath, { withFileTypes: true });
      for (const capturedEntry of capturedEntries) {
        if (capturedEntry.isDirectory()) {
          const timestamp = capturedEntry.name;
          const timestampPath = join(demoPath, timestamp);
          const sessionDataPath = join(timestampPath, 'session-data.json');
          const eventsPath = join(timestampPath, 'replay-events.jsonl');

          if (existsSync(sessionDataPath) && existsSync(eventsPath)) {
            fixtures.push(timestamp);
          }
        }
      }
    } else {
      // Structured format: look for session directories
      const sessionEntries = readdirSync(demoPath, { withFileTypes: true });
      for (const sessionEntry of sessionEntries) {
        if (sessionEntry.isDirectory() && sessionEntry.name.startsWith('session-')) {
          const sessionPath = join(demoPath, sessionEntry.name);
          const eventsPath = join(sessionPath, 'replay-events.jsonl');
          const manifestPath = join(sessionPath, 'manifest.json');

          if (existsSync(eventsPath) || existsSync(manifestPath)) {
            fixtures.push(`${demoType}/${sessionEntry.name}`);
          }
        }
      }
    }
  }

  return fixtures;
}

/**
 * Load a replay fixture by path.
 *
 * @param fixturePath - The fixture path:
 *   - For captured: timestamp (e.g., '1775883968100')
 *   - For structured: '{demoType}/session-{n}' (e.g., 'tool-calling/session-1')
 * @returns The loaded fixture with all session data and events
 * @throws Error if fixture directory or files are not found
 */
export function loadFixture(fixturePath: string): LoadedFixture {
  const fixturesDir = getFixturesDir();

  // Determine if this is a captured or structured fixture
  const isCaptured = /^\d+$/.test(fixturePath);

  const fullPath = isCaptured 
    ? join(fixturesDir, 'captured', fixturePath)
    : join(fixturesDir, fixturePath);

  if (!existsSync(fullPath)) {
    throw new Error(`Fixture directory not found: ${fullPath}`);
  }

  if (isCaptured) {
    return loadCapturedFixture(fixturePath);
  } else {
    return loadStructuredFixture(fixturePath);
  }
}

/**
 * Load a captured format fixture.
 */
function loadCapturedFixture(timestamp: string): LoadedFixture {
  const fixturesDir = getFixturesDir();
  const fixturePath = join(fixturesDir, 'captured', timestamp);
  const sessionDataPath = join(fixturePath, 'session-data.json');
  const eventsPath = join(fixturePath, 'replay-events.jsonl');

  if (!existsSync(sessionDataPath)) {
    throw new Error(`Session data file not found: ${sessionDataPath}`);
  }

  if (!existsSync(eventsPath)) {
    throw new Error(`Events file not found: ${eventsPath}`);
  }

  // Load session metadata
  const sessionDataContent = readFileSync(sessionDataPath, 'utf-8');
  const sessionData: CapturedSessionMetadata = JSON.parse(sessionDataContent);

  // Load events from JSONL file
  const events = loadEventsFromJsonl(eventsPath);

  return {
    demoType: 'captured',
    sessionId: sessionData.sessionId,
    metadata: sessionData,
    sessionData: sessionData.preExistingState,
    events,
  };
}

/**
 * Load a structured format fixture.
 */
function loadStructuredFixture(fixturePath: string): LoadedFixture {
  const fixturesDir = getFixturesDir();
  const fullPath = join(fixturesDir, fixturePath);

  const [demoType, _sessionName] = fixturePath.split('/');
  const eventsPath = join(fullPath, 'replay-events.jsonl');
  const manifestPath = join(fullPath, 'manifest.json');

  // Load manifest if exists
  let manifest: any = null;
  if (existsSync(manifestPath)) {
    const manifestContent = readFileSync(manifestPath, 'utf-8');
    manifest = JSON.parse(manifestContent);
  }

  // Load events
  const events = existsSync(eventsPath) ? loadEventsFromJsonl(eventsPath) : [];

  // Find session data
  let sessionData: ReplaySessionData | null = null;
  let sessionId: string = '';

  // Look for session data in subdirectories
  const sessionEntries = readdirSync(fullPath, { withFileTypes: true });
  for (const entry of sessionEntries) {
    if (entry.isDirectory()) {
      const sessionDataPath = join(fullPath, entry.name, 'session-data.json');
      if (existsSync(sessionDataPath)) {
        const content = readFileSync(sessionDataPath, 'utf-8');
        sessionData = JSON.parse(content) as ReplaySessionData;
        sessionId = sessionData.sessionId;
        break;
      }
    }
  }

  // Extract metadata from manifest
  let metadata: ReplaySessionMetadata;
  if (manifest && Array.isArray(manifest.sessions) && manifest.sessions.length > 0) {
    const sessionMetadata = manifest.sessions.find(
      (s: any) => s.sessionId === sessionId
    ) || manifest.sessions[0];

    metadata = {
      demoType: manifest.demoType || demoType,
      sessionId: sessionId || sessionMetadata.sessionId,
      modes: sessionMetadata.modes || [],
      models: sessionMetadata.models || [],
      capturedAt: sessionMetadata.capturedAt || Date.now(),
      tokenCount: sessionMetadata.tokenCount || 0,
      eventCount: sessionMetadata.eventCount || events.length,
      description: sessionMetadata.description || '',
    };
} else {
  // Create minimal metadata
  metadata = {
    demoType: demoType ?? 'unknown',
    sessionId: sessionId || 'unknown',
      modes: [],
      models: [],
      capturedAt: Date.now(),
      tokenCount: events.reduce((sum, e) => sum + e.tokenCount, 0),
      eventCount: events.length,
      description: '',
    };
  }

  return {
    demoType: demoType ?? 'unknown',
    sessionId: sessionId || 'unknown',
    metadata,
    sessionData,
    events,
  };
}

/**
 * Load events from a JSONL file.
 */
function loadEventsFromJsonl(filePath: string): LoadedReplayEvent[] {
  const eventsContent = readFileSync(filePath, 'utf-8');
  const lines = eventsContent.trim().split('\n').filter((line) => line.length > 0);

  return lines.map((line, index) => {
    try {
      const event = JSON.parse(line) as LoadedReplayEvent;
      return event;
    } catch (error) {
      throw new Error(
        `Failed to parse line ${index + 1} in ${filePath}: ${error}`
      );
    }
  });
}

/**
 * Load only the manifest for a structured fixture.
 * Loads session-level manifests from each session directory.
 *
 * @param demoType - The demo type directory (e.g., 'tool-calling')
 * @returns The manifest with session metadata
 * @throws Error if manifest is not found
 */
export function loadFixtureManifest(demoType: string): {
  demoType: string;
  sessions: ReplaySessionMetadata[];
} {
  const fixturesDir = getFixturesDir();
  const sessionDir = join(fixturesDir, demoType);
  
  // Check if this is a captured fixture (numeric name)
  if (/^\d+$/.test(demoType)) {
    const manifestPath = join(sessionDir, 'manifest.json');
    if (!existsSync(manifestPath)) {
      throw new Error(`Manifest not found: ${manifestPath}`);
    }
    const content = readFileSync(manifestPath, 'utf-8');
    return JSON.parse(content) as {
      demoType: string;
      sessions: ReplaySessionMetadata[];
    };
  }
  
  // For structured fixtures, read from session directory
  const manifestPath = join(sessionDir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`);
  }

  const content = readFileSync(manifestPath, 'utf-8');
  return JSON.parse(content) as {
    demoType: string;
    sessions: ReplaySessionMetadata[];
  };
}

/**
 * Load only session metadata without events.
 *
 * @param fixturePath - The fixture path
 * @returns The fixture with metadata only (events array will be empty)
 */
export function loadFixtureMetadata(fixturePath: string): LoadedFixture {
  const fixture = loadFixture(fixturePath);
  return {
    ...fixture,
    events: [],
  };
}

/**
 * Get the events file path for a fixture.
 *
 * @param fixturePath - The fixture path
 * @returns The absolute path to the replay-events.jsonl file
 * @throws Error if events file is not found
 */
export function getFixtureEventsPath(fixturePath: string): string {
  const fixturesDir = getFixturesDir();
  const isCaptured = /^\d+$/.test(fixturePath);
  
  // Build path with captured subdirectory for captured fixtures
  const eventsPath = join(
    fixturesDir,
    isCaptured ? 'captured' : '',
    fixturePath,
    'replay-events.jsonl'
  );
  
  if (!existsSync(eventsPath)) {
    throw new Error(`Events file not found: ${eventsPath}`);
  }
  return eventsPath;
}
