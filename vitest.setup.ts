import "@testing-library/jest-dom";
import { vi } from "vitest";
import { existsSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Suppress false-positive act(...) warnings from React Testing Library
// These occur when async operations trigger state updates that RTL's waitFor
// already handles correctly. The warnings are noise in test output.
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

const shouldSuppress = (messageStr: string): boolean => {
  // Suppress act(...) warnings from React Testing Library
  if (
    messageStr.includes("not wrapped in act(...)") &&
    messageStr.includes("React state updates")
  ) {
    return true;
  }
  
  // Suppress clipboard fallback warnings in tests (all variants)
  if (
    messageStr.includes("MessageActionBar: Using default clipboard implementation") ||
    messageStr.includes("navigator.clipboard.writeText failed") ||
    messageStr.includes("document.execCommand('copy') fallback failed")
  ) {
    return true;
  }

  // Suppress ResizeObserver unavailable warnings in jsdom
  if (messageStr.includes("ResizeObserver unavailable")) {
    return true;
  }
  
  // Suppress expected error logs from error scenario tests
  // These are intentionally tested error conditions
  if (
    messageStr.includes("[TransportClient] Failed to parse message:")
  ) {
    return true;
  }
  
  return false;
};

const argsToString = (args: any[]): string => {
  return args
    .map((arg) => {
      if (typeof arg === "string") return arg;
      if (arg instanceof Error) return arg.message || arg.toString();
      if (arg && typeof arg === "object" && "message" in arg) return String(arg.message);
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(" ");
};

console.error = (...args: any[]) => {
  const messageStr = argsToString(args);
  
  if (shouldSuppress(messageStr)) {
    return;
  }
  
  originalConsoleError(...args);
};

console.warn = (...args: any[]) => {
  const messageStr = argsToString(args);
  
  if (shouldSuppress(messageStr)) {
    return;
  }
  
  originalConsoleWarn(...args);
};

// Cleanup test artifacts from previous runs
const replayCaptureDir = join(__dirname, "packages/acp-chat-core/fixtures/replay-data/captured");
if (existsSync(replayCaptureDir)) {
  try {
    const entries = readdirSync(replayCaptureDir);
    for (const entry of entries) {
      if (/^\d{13,}$/.test(entry)) {
        const dirPath = join(replayCaptureDir, entry);
        rmSync(dirPath, { recursive: true, force: true });
      }
    }
  } catch (_error) {
    // Silently fail if cleanup encounters issues
  }
}

// Mock canvas for pretext font measurements
// @chenglou/pretext requires a canvas context for measuring text metrics
// Only apply in jsdom environment where HTMLCanvasElement is defined
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = vi.fn((contextType) => {
    if (contextType === "2d") {
      return {
        font: "16px sans-serif",
        measureText: (text: string) => ({
          width: text.length * 8, // Simple approximation: 8px per character
          actualBoundingBoxAscent: 14,
          actualBoundingBoxDescent: 4,
        }),
        fillText: vi.fn(),
        clearRect: vi.fn(),
      };
    }
    return null;
  });

  // Mock HTMLCanvasElement.width and height
  Object.defineProperty(HTMLCanvasElement.prototype, "width", {
    value: 1000,
    writable: true,
  });

  Object.defineProperty(HTMLCanvasElement.prototype, "height", {
    value: 100,
    writable: true,
  });
}

// Mock useVirtualizer from @tanstack/react-virtual to render all items in tests
// This prevents virtualization from hiding items during test rendering
vi.mock("@tanstack/react-virtual", async () => {
  const actual = await vi.importActual("@tanstack/react-virtual");
  return {
    ...actual,
    useVirtualizer: vi.fn((options) => {
      const { count, estimateSize, getItemKey, gap = 0 } = options;
      
      // Generate virtual items for ALL items (no virtualization in tests)
      const virtualItems = Array.from({ length: count }, (_, index) => {
        const size = typeof estimateSize === "function" ? estimateSize(index) : 50;
        const key = getItemKey ? getItemKey(index) : index;
        return {
          index,
          key,
          size,
          start: index * (size + gap),
          measureRef: (_el: HTMLElement | null) => {
            // No-op in tests, but allows the ref to be attached
          },
          get element() {
            return null;
          },
        };
      });

      // Calculate total size based on all items
      const totalSize = virtualItems.reduce((acc, item) => acc + item.size + gap, 0) - gap;

      return {
        getVirtualItems: () => virtualItems,
        getTotalSize: () => totalSize,
        scrollToIndex: vi.fn(),
        scrollToOffset: vi.fn(),
        measureElement: (el: HTMLElement) => {
          // Return a reasonable default height for measured elements
          if (!el) return 50;
          const rect = el.getBoundingClientRect();
          return rect.height || 50;
        },
        options: { ...options },
      };
    }),
  };
});
