import "@testing-library/jest-dom";
import { vi } from "vitest";

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
          measureRef: (el: HTMLElement | null) => {
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
