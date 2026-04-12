import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the browser environment check
vi.mock("../index.browser.js", () => ({
  isBrowserEnvironment: vi.fn(),
}));

import { isBrowserEnvironment } from "../index.browser.js";
import {
  defaultClipboard,
  createViewportObserverFactory,
  defaultScheduler,
} from "./browser-apis.js";
import {
  createClipboardAPI,
  defaultClipboardWithFallback,
  strictClipboard,
} from "./clipboard.js";

describe("browser-apis.ts", () => {
  describe("defaultClipboard", () => {
    const originalNavigator = globalThis.navigator;

    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      // Restore original navigator
      Object.defineProperty(globalThis, "navigator", {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    });

    it("should be a no-op in SSR environment", async () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(false);

      await expect(defaultClipboard.writeText("test")).resolves.toBeUndefined();
    });

    it("should warn and resolve when navigator.clipboard is undefined", async () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(true);
      // @ts-expect-error - testing undefined navigator
      delete globalThis.navigator;

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await expect(defaultClipboard.writeText("test")).resolves.toBeUndefined();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Clipboard API unavailable")
      );

      consoleWarnSpy.mockRestore();
    });

    it("should successfully write text using navigator.clipboard", async () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(true);

      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(globalThis, "navigator", {
        value: { clipboard: { writeText: mockWriteText } },
        writable: true,
        configurable: true,
      });

      await defaultClipboard.writeText("Hello, world!");

      expect(mockWriteText).toHaveBeenCalledWith("Hello, world!");
    });

    it("should handle NotAllowedError gracefully", async () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(true);

      const notAllowedError = new Error("Permission denied");
      notAllowedError.name = "NotAllowedError";
      const mockWriteText = vi.fn().mockRejectedValue(notAllowedError);
      Object.defineProperty(globalThis, "navigator", {
        value: { clipboard: { writeText: mockWriteText } },
        writable: true,
        configurable: true,
      });

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await expect(defaultClipboard.writeText("test")).resolves.toBeUndefined();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Clipboard write denied")
      );

      consoleWarnSpy.mockRestore();
    });

    it("should re-throw non-NotAllowedError errors", async () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(true);

      const testError = new Error("Unexpected error");
      const mockWriteText = vi.fn().mockRejectedValue(testError);
      Object.defineProperty(globalThis, "navigator", {
        value: { clipboard: { writeText: mockWriteText } },
        writable: true,
        configurable: true,
      });

      await expect(defaultClipboard.writeText("test")).rejects.toBe(testError);
    });
  });

  describe("createViewportObserverFactory", () => {
    const originalResizeObserver = globalThis.ResizeObserver;

    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      // Restore original ResizeObserver
      if (originalResizeObserver) {
        globalThis.ResizeObserver = originalResizeObserver;
      } else {
        // @ts-expect-error - restoring undefined
        delete globalThis.ResizeObserver;
      }
    });

    it("should return no-op observer in SSR environment", () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(false);

      const factory = createViewportObserverFactory();
      const callback = vi.fn();
      const observer = factory.create(callback);

      expect(observer.observe).toBeDefined();
      expect(observer.unobserve).toBeDefined();
      expect(observer.disconnect).toBeDefined();

      // Should be no-ops
      expect(() => observer.observe({})).not.toThrow();
      expect(() => observer.unobserve({})).not.toThrow();
      expect(() => observer.disconnect()).not.toThrow();
    });

    it("should return no-op observer when ResizeObserver is undefined", () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(true);
      // @ts-expect-error - testing undefined ResizeObserver
      delete globalThis.ResizeObserver;

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const factory = createViewportObserverFactory();
      const callback = vi.fn();
      const observer = factory.create(callback);

      expect(observer.observe).toBeDefined();
      expect(observer.unobserve).toBeDefined();
      expect(observer.disconnect).toBeDefined();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("ResizeObserver unavailable")
      );

      consoleWarnSpy.mockRestore();
    });

    it("should create a working observer with native ResizeObserver", () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(true);

      let capturedCallback: ((entries: any, observer: any) => void) | undefined;
      const mockResizeObserver = vi.fn((callback) => {
        capturedCallback = callback;
        return {
          observe: vi.fn(),
          unobserve: vi.fn(),
          disconnect: vi.fn(),
        };
      });
      globalThis.ResizeObserver = mockResizeObserver as unknown as typeof ResizeObserver;

      const factory = createViewportObserverFactory();
      const callback = vi.fn();
      const observer = factory.create(callback);

      expect(mockResizeObserver).toHaveBeenCalled();
      expect(capturedCallback).toBeDefined();

      // Test that observer methods are defined
      expect(observer.observe).toBeDefined();
      expect(observer.unobserve).toBeDefined();
      expect(observer.disconnect).toBeDefined();
    });

    it("should transform and forward resize entries to callback", () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(true);

      let capturedCallback: ((entries: any, observer: any) => void) | undefined;
      const mockObserve = vi.fn();
      const mockUnobserve = vi.fn();
      const mockDisconnect = vi.fn();

      const mockResizeObserver = vi.fn((callback) => {
        capturedCallback = callback;
        return {
          observe: mockObserve,
          unobserve: mockUnobserve,
          disconnect: mockDisconnect,
        };
      });
      globalThis.ResizeObserver = mockResizeObserver as unknown as typeof ResizeObserver;

      const factory = createViewportObserverFactory();
      const callback = vi.fn();
      const observer = factory.create(callback);

      // Simulate a resize event
      const mockTarget = { id: "test-element" };
      const mockEntry = {
        contentRect: { x: 0, y: 0, width: 100, height: 200 },
        target: mockTarget,
      };

      if (capturedCallback) {
        capturedCallback([mockEntry], {
          observe: (target: unknown) => observer.observe(target),
          unobserve: (target: unknown) => observer.unobserve(target),
          disconnect: () => observer.disconnect(),
        });
      }

      expect(callback).toHaveBeenCalledTimes(1);
      const call0 = callback.mock.calls[0];
      expect(call0).toBeDefined();
      const [entries, observerApi] = call0!;
      expect(entries).toHaveLength(1);
      expect(entries[0].contentRect).toEqual({
        x: 0,
        y: 0,
        width: 100,
        height: 200,
      });
      expect(entries[0].target).toBe(mockTarget);
      expect(observerApi.observe).toBeDefined();
      expect(observerApi.unobserve).toBeDefined();
      expect(observerApi.disconnect).toBeDefined();
    });
  });

  describe("defaultScheduler", () => {
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;

    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      // Restore originals
      if (originalRequestAnimationFrame) {
        globalThis.requestAnimationFrame = originalRequestAnimationFrame;
      } else {
        // @ts-expect-error - restoring undefined
        delete globalThis.requestAnimationFrame;
      }

      if (originalCancelAnimationFrame) {
        globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
      } else {
        // @ts-expect-error - restoring undefined
        delete globalThis.cancelAnimationFrame;
      }

      if (originalSetTimeout) {
        globalThis.setTimeout = originalSetTimeout;
      } else {
        // @ts-expect-error - restoring undefined
        delete globalThis.setTimeout;
      }

      if (originalClearTimeout) {
        globalThis.clearTimeout = originalClearTimeout;
      } else {
        // @ts-expect-error - restoring undefined
        delete globalThis.clearTimeout;
      }
    });

    it("should return 0 for requestAnimationFrame in SSR environment", () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(false);

      const callback = vi.fn();
      const result = defaultScheduler.requestAnimationFrame(callback);

      expect(result).toBe(0);
      expect(callback).not.toHaveBeenCalled();
    });

    it("should return 0 and warn when requestAnimationFrame is undefined", () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(true);
      // @ts-expect-error - testing undefined
      delete globalThis.requestAnimationFrame;

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const callback = vi.fn();
      const result = defaultScheduler.requestAnimationFrame(callback);

      expect(result).toBe(0);
      expect(callback).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("requestAnimationFrame unavailable")
      );

      consoleWarnSpy.mockRestore();
    });

    it("should call requestAnimationFrame in browser environment", () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(true);

      const mockRaf = vi.fn((cb) => {
        cb(performance.now());
        return 1;
      });
      globalThis.requestAnimationFrame = mockRaf;

      const callback = vi.fn();
      const result = defaultScheduler.requestAnimationFrame(callback);

      expect(result).toBe(1);
      expect(mockRaf).toHaveBeenCalled();
      expect(callback).toHaveBeenCalled();
    });

    it("should be a no-op for cancelAnimationFrame in SSR environment", () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(false);

      expect(() => defaultScheduler.cancelAnimationFrame(1)).not.toThrow();
    });

    it("should be a no-op when cancelAnimationFrame is undefined", () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(true);
      // @ts-expect-error - testing undefined
      delete globalThis.cancelAnimationFrame;

      expect(() => defaultScheduler.cancelAnimationFrame(1)).not.toThrow();
    });

    it("should be a no-op for cancelAnimationFrame with id 0", () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(true);
      globalThis.cancelAnimationFrame = vi.fn();

      defaultScheduler.cancelAnimationFrame(0);

      expect(globalThis.cancelAnimationFrame).not.toHaveBeenCalled();
    });

    it("should call cancelAnimationFrame for non-zero id", () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(true);
      const mockCancel = vi.fn();
      globalThis.cancelAnimationFrame = mockCancel;

      defaultScheduler.cancelAnimationFrame(5);

      expect(mockCancel).toHaveBeenCalledWith(5);
    });

    it("should return 0 for setTimeout in SSR environment", () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(false);

      const callback = vi.fn();
      const result = defaultScheduler.setTimeout(callback, 100);

      expect(result).toBe(0);
      expect(callback).not.toHaveBeenCalled();
    });

    it("should return 0 and warn when setTimeout is undefined", () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(true);
      // @ts-expect-error - testing undefined
      delete globalThis.setTimeout;

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const callback = vi.fn();
      const result = defaultScheduler.setTimeout(callback, 100);

      expect(result).toBe(0);
      expect(callback).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("setTimeout unavailable")
      );

      consoleWarnSpy.mockRestore();
    });

    it("should call setTimeout in browser environment", () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(true);

      let capturedCallback: (() => void) | undefined;
      const mockSetTimeout = vi.fn((cb, _ms) => {
        capturedCallback = cb;
        return 1 as any;
      });
      globalThis.setTimeout = mockSetTimeout as any;

      const callback = vi.fn();
      const result = defaultScheduler.setTimeout(callback, 100);

      expect(result).toBe(1);
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 100);

      // Manually trigger the callback to verify it's the right one
      if (capturedCallback) {
        capturedCallback();
      }
      expect(callback).toHaveBeenCalled();
    });

    it("should be a no-op for clearTimeout in SSR environment", () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(false);

      expect(() => defaultScheduler.clearTimeout(1)).not.toThrow();
    });

    it("should be a no-op when clearTimeout is undefined", () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(true);
      // @ts-expect-error - testing undefined
      delete globalThis.clearTimeout;

      expect(() => defaultScheduler.clearTimeout(1)).not.toThrow();
    });

    it("should be a no-op for clearTimeout with id 0", () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(true);
      globalThis.clearTimeout = vi.fn();

      defaultScheduler.clearTimeout(0);

      expect(globalThis.clearTimeout).not.toHaveBeenCalled();
    });

    it("should call clearTimeout for non-zero id", () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(true);
      const mockClear = vi.fn();
      globalThis.clearTimeout = mockClear;

      defaultScheduler.clearTimeout(5);

      expect(mockClear).toHaveBeenCalledWith(5);
    });
  });
});

describe("clipboard.ts", () => {
  const originalNavigator = globalThis.navigator;
  const originalDocument = globalThis.document;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original navigator
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });

    // Restore original document
    Object.defineProperty(globalThis, "document", {
      value: originalDocument,
      writable: true,
      configurable: true,
    });
  });

  describe("createClipboardAPI", () => {
    it("should create a clipboard API with default fallback enabled", () => {
      const clipboard = createClipboardAPI();

      expect(clipboard.writeText).toBeDefined();
      expect(typeof clipboard.writeText).toBe("function");
    });

    it("should create a clipboard API with fallback explicitly enabled", () => {
      const clipboard = createClipboardAPI({ fallback: true });

      expect(clipboard.writeText).toBeDefined();
    });

    it("should create a clipboard API with fallback disabled", () => {
      const clipboard = createClipboardAPI({ fallback: false });

      expect(clipboard.writeText).toBeDefined();
    });

    it("should be a no-op in SSR environment", async () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(false);

      const clipboard = createClipboardAPI();

      await expect(clipboard.writeText("test")).resolves.toBeUndefined();
    });

    it("should use navigator.clipboard when available", async () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(true);

      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(globalThis, "navigator", {
        value: { clipboard: { writeText: mockWriteText } },
        writable: true,
        configurable: true,
      });

      const clipboard = createClipboardAPI();
      await clipboard.writeText("Hello!");

      expect(mockWriteText).toHaveBeenCalledWith("Hello!");
    });

    it("should re-throw errors when fallback is disabled", async () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(true);

      const testError = new Error("Clipboard error");
      const mockWriteText = vi.fn().mockRejectedValue(testError);
      Object.defineProperty(globalThis, "navigator", {
        value: { clipboard: { writeText: mockWriteText } },
        writable: true,
        configurable: true,
      });

      const clipboard = createClipboardAPI({ fallback: false });

      await expect(clipboard.writeText("test")).rejects.toBe(testError);
    });

    it("should fall back to execCommand when navigator.clipboard fails", async () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(true);

      const mockWriteText = vi.fn().mockRejectedValue(new Error("NotAllowedError"));
      const mockExecCommand = vi.fn().mockReturnValue(true);
      const mockAppendChild = vi.fn();
      const mockRemoveChild = vi.fn();
      const mockCreateElement = vi.fn().mockReturnValue({
        value: "",
        style: {},
        focus: vi.fn(),
        select: vi.fn(),
      });

      Object.defineProperty(globalThis, "navigator", {
        value: { clipboard: { writeText: mockWriteText } },
        writable: true,
        configurable: true,
      });

      Object.defineProperty(globalThis, "document", {
        value: {
          createElement: mockCreateElement,
          body: {
            appendChild: mockAppendChild,
            removeChild: mockRemoveChild,
          },
          execCommand: mockExecCommand,
        },
        writable: true,
        configurable: true,
      });

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const clipboard = createClipboardAPI({ fallback: true });
      await clipboard.writeText("test");

      expect(consoleWarnSpy).toHaveBeenCalled();
      const firstCall = consoleWarnSpy.mock.calls[0];
      expect(firstCall).toBeDefined();
      expect(firstCall![0]).toContain("navigator.clipboard.writeText failed, trying fallback:");
      expect(mockExecCommand).toHaveBeenCalledWith("copy");

      consoleWarnSpy.mockRestore();
    });

    it("should handle execCommand returning false", async () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(true);

      const mockWriteText = vi.fn().mockRejectedValue(new Error("NotAllowedError"));
      const mockExecCommand = vi.fn().mockReturnValue(false);
      const mockCreateElement = vi.fn().mockReturnValue({
        value: "",
        style: {},
        focus: vi.fn(),
        select: vi.fn(),
      });

      Object.defineProperty(globalThis, "navigator", {
        value: { clipboard: { writeText: mockWriteText } },
        writable: true,
        configurable: true,
      });

      Object.defineProperty(globalThis, "document", {
        value: {
          createElement: mockCreateElement,
          body: {
            appendChild: vi.fn(),
            removeChild: vi.fn(),
          },
          execCommand: mockExecCommand,
        },
        writable: true,
        configurable: true,
      });

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const clipboard = createClipboardAPI({ fallback: true });
      await clipboard.writeText("test");

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("execCommand('copy') failed")
      );

      consoleWarnSpy.mockRestore();
    });

    it("should throw when both navigator.clipboard and execCommand fail", async () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(true);

      const mockWriteText = vi.fn().mockRejectedValue(new Error("NotAllowedError"));
      const mockExecCommand = vi.fn().mockImplementation(() => {
        throw new Error("execCommand failed");
      });
      const mockCreateElement = vi.fn().mockReturnValue({
        value: "",
        style: {},
        focus: vi.fn(),
        select: vi.fn(),
      });

      Object.defineProperty(globalThis, "navigator", {
        value: { clipboard: { writeText: mockWriteText } },
        writable: true,
        configurable: true,
      });

      Object.defineProperty(globalThis, "document", {
        value: {
          createElement: mockCreateElement,
          body: {
            appendChild: vi.fn(),
            removeChild: vi.fn(),
          },
          execCommand: mockExecCommand,
        },
        writable: true,
        configurable: true,
      });

      const clipboard = createClipboardAPI({ fallback: true });

      await expect(clipboard.writeText("test")).rejects.toThrow("execCommand failed");
    });

    it("should warn when clipboard API is completely unavailable", async () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(true);

      Object.defineProperty(globalThis, "navigator", {
        value: {},
        writable: true,
        configurable: true,
      });

      Object.defineProperty(globalThis, "document", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const clipboard = createClipboardAPI({ fallback: true });
      await clipboard.writeText("test");

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Clipboard API unavailable")
      );

      consoleWarnSpy.mockRestore();
    });

    it("should handle NotAllowedError with specific warning message", async () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(true);

      const notAllowedError = new Error("Permission denied");
      notAllowedError.name = "NotAllowedError";
      const mockWriteText = vi.fn().mockRejectedValue(notAllowedError);

      Object.defineProperty(globalThis, "navigator", {
        value: { clipboard: { writeText: mockWriteText } },
        writable: true,
        configurable: true,
      });

      const mockTextArea = {
        value: "",
        style: {},
        focus: vi.fn(),
        select: vi.fn(),
      };
      const mockCreateElement = vi.fn().mockReturnValue(mockTextArea);
      const mockExecCommand = vi.fn().mockReturnValue(true);
      const mockAppendChild = vi.fn();
      const mockRemoveChild = vi.fn();

      Object.defineProperty(globalThis, "document", {
        value: {
          createElement: mockCreateElement,
          body: {
            appendChild: mockAppendChild,
            removeChild: mockRemoveChild,
          },
          execCommand: mockExecCommand,
        },
        writable: true,
        configurable: true,
      });

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const clipboard = createClipboardAPI({ fallback: true });
      await clipboard.writeText("test");

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Clipboard write denied by user or secure context requirement")
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe("defaultClipboardWithFallback", () => {
    it("should be created with fallback enabled", () => {
      expect(defaultClipboardWithFallback.writeText).toBeDefined();
      expect(typeof defaultClipboardWithFallback.writeText).toBe("function");
    });

    it("should use navigator.clipboard when available", async () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(true);

      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(globalThis, "navigator", {
        value: { clipboard: { writeText: mockWriteText } },
        writable: true,
        configurable: true,
      });

      await defaultClipboardWithFallback.writeText("test");

      expect(mockWriteText).toHaveBeenCalledWith("test");
    });
  });

  describe("strictClipboard", () => {
    it("should be created with fallback disabled", () => {
      expect(strictClipboard.writeText).toBeDefined();
      expect(typeof strictClipboard.writeText).toBe("function");
    });

    it("should throw errors instead of falling back", async () => {
      vi.mocked(isBrowserEnvironment).mockReturnValue(true);

      const testError = new Error("Strict mode error");
      const mockWriteText = vi.fn().mockRejectedValue(testError);
      Object.defineProperty(globalThis, "navigator", {
        value: { clipboard: { writeText: mockWriteText } },
        writable: true,
        configurable: true,
      });

      await expect(strictClipboard.writeText("test")).rejects.toBe(testError);
    });
  });
});
