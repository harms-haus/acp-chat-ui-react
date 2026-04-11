/**
 * Test utilities for loading replay fixtures.
 *
 * This module provides functions to load test fixture data from the fixtures directory.
 * Fixtures are stored in `fixtures/replay-data/captured/{timestamp}/` and contain:
 * - `session-data.json`: CapturedSession metadata
 * - `replay-events.jsonl`: JSONL file with one CapturedEvent per line
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import type {
  CapturedSession,
  CapturedEvent
} from '../session/capture-interceptor.js';

/**
 * Get the fixtures directory path.
 */
function getFixturesDir(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // Go up 4 levels: test-utils -> src -> packages/acp-chat-core -> packages -> workspace root
  return join(__dirname, '../../../../fixtures/replay-data/captured');
}

/**
 * List all available replay fixture directories by timestamp.
 *
 * @returns Array of fixture timestamps
 */
export function listFixtures(): string[] {
  const fixturesDir = getFixturesDir();

  if (!existsSync(fixturesDir)) {
    return [];
  }

  return readdirSync(fixturesDir).filter((name) => {
    const fixturePath = join(fixturesDir, name);
    const sessionDataPath = join(fixturePath, 'session-data.json');
    const eventsPath = join(fixturePath, 'replay-events.jsonl');
    return existsSync(sessionDataPath) && existsSync(eventsPath);
  });
}

/**
 * Load a replay fixture by timestamp name.
 *
 * @param name - The timestamp name of the fixture directory
 * @returns The captured session with all events
 * @throws Error if fixture directory or files are not found
 */
export function loadReplayFixture(name: string): CapturedSession {
  const fixturesDir = getFixturesDir();
  const fixturePath = join(fixturesDir, name);
  const sessionDataPath = join(fixturePath, 'session-data.json');
  const eventsPath = join(fixturePath, 'replay-events.jsonl');

  if (!existsSync(fixturePath)) {
    throw new Error(`Fixture directory not found: ${fixturePath}`);
  }

  if (!existsSync(sessionDataPath)) {
    throw new Error(`Session data file not found: ${sessionDataPath}`);
  }

  if (!existsSync(eventsPath)) {
    throw new Error(`Events file not found: ${eventsPath}`);
  }

  // Load session metadata
  const sessionDataContent = readFileSync(sessionDataPath, 'utf-8');
  let session: CapturedSession;
  try {
    session = JSON.parse(sessionDataContent) as CapturedSession;
  } catch (error) {
    throw new Error(
      `Failed to parse session data at ${sessionDataPath}: ${error}`
    );
  }

  // Load events from JSONL file
  const eventsContent = readFileSync(eventsPath, 'utf-8');
  const events: CapturedEvent[] = eventsContent
    .trim()
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line) as CapturedEvent;
      } catch (error) {
        throw new Error(
          `Failed to parse line ${index + 1} in ${eventsPath}: ${error}`
        );
      }
    });

  return {
    ...session,
    events,
  };
}

/**
 * Load only the session metadata from a replay fixture.
 *
 * @param name - The timestamp name of the fixture directory
 * @returns The captured session metadata (events array will be empty)
 * @throws Error if fixture directory or session-data.json is not found
 */
export function loadReplayFixtureMetadata(name: string): CapturedSession {
  const fixturesDir = getFixturesDir();
  const fixturePath = join(fixturesDir, name);
  const sessionDataPath = join(fixturePath, 'session-data.json');

  if (!existsSync(fixturePath)) {
    throw new Error(`Fixture directory not found: ${fixturePath}`);
  }

  if (!existsSync(sessionDataPath)) {
    throw new Error(`Session data file not found: ${sessionDataPath}`);
  }

  const sessionDataContent = readFileSync(sessionDataPath, 'utf-8');
  let session: CapturedSession;
  try {
    session = JSON.parse(sessionDataContent) as CapturedSession;
  } catch (error) {
    throw new Error(
      `Failed to parse session data at ${sessionDataPath}: ${error}`
    );
  }

  return {
    ...session,
    events: [],
  };
}
