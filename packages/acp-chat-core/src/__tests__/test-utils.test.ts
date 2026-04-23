/**
 * Test suite for test-utils exports.
 */

import { describe, it, expect } from 'vitest';
import {
  MockTransport,
  MockSessionController,
  createMockTransport,
  createMockController,
} from '../test-utils/mocks.js';

describe('test-utils exports', () => {
  describe('mock implementations', () => {
    it('exports MockTransport', () => {
      expect(MockTransport).toBeDefined();
    });

    it('exports MockSessionController', () => {
      expect(MockSessionController).toBeDefined();
    });

    it('exports createMockTransport', () => {
      expect(createMockTransport).toBeDefined();
      expect(typeof createMockTransport).toBe('function');
    });

    it('exports createMockController', () => {
      expect(createMockController).toBeDefined();
      expect(typeof createMockController).toBe('function');
    });

    it('createMockTransport creates MockTransport instance', () => {
      const transport = createMockTransport();
      expect(transport).toBeInstanceOf(MockTransport);
    });

    it('createMockController creates MockSessionController instance', () => {
      const controller = createMockController();
      expect(controller).toBeInstanceOf(MockSessionController);
    });
  });
});
