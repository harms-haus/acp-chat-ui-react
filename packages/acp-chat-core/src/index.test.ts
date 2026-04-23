/**
 * Test suite for main package exports.
 */

import { describe, it, expect } from 'vitest';
import * as pkg from './index.js';

describe('@harms-haus/acp-chat-core scaffold', () => {
  it('exports PACKAGE_VERSION', () => {
    expect(pkg.PACKAGE_VERSION).toBeDefined();
    expect(typeof pkg.PACKAGE_VERSION).toBe('string');
  });

  it('exports SessionController', () => {
    expect(pkg.SessionController).toBeDefined();
    expect(typeof pkg.SessionController).toBe('function');
  });

  it('exports FileSystemSubscriptionManager', () => {
    expect(pkg.FileSystemSubscriptionManager).toBeDefined();
    expect(typeof pkg.FileSystemSubscriptionManager).toBe('function');
  });

  it('exports normalization helpers', () => {
    expect(pkg.createNormalizedState).toBeDefined();
    expect(pkg.applySessionUpdate).toBeDefined();
    expect(pkg.getMessages).toBeDefined();
    expect(pkg.getThoughts).toBeDefined();
    expect(pkg.getToolCalls).toBeDefined();
    expect(pkg.getTimeline).toBeDefined();
  });

  it('exports type guards', () => {
    expect(pkg.isSessionUpdateNotification).toBeDefined();
    expect(pkg.isUpdateType).toBeDefined();
  });

  it('exports transport interface', () => {
    expect(pkg.isTerminalStatus).toBeDefined();
    expect(pkg.isConnected).toBeDefined();
  });

  it('exports helper functions', () => {
    expect(pkg.canSend).toBeDefined();
    expect(pkg.canStop).toBeDefined();
    expect(pkg.getButtonState).toBeDefined();
    expect(pkg.startPrompt).toBeDefined();
    expect(pkg.completePrompt).toBeDefined();
  });

  it('exports presets', () => {
    expect(pkg.parseLaunchPreset).toBeDefined();
    expect(pkg.isPresetValid).toBeDefined();
  });
});
