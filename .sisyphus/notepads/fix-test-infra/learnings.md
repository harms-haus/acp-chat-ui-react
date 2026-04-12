
# Test Infrastructure Fix - Learnings

## Canvas Mocking for JSDOM

When packages like `@chenglou/pretext` require canvas context for font measurements in JSDOM:

1. **Install canvas package**: `pnpm add -D canvas` provides the native bindings
2. **Mock HTMLCanvasElement.getContext()**: Return a 2D context with measureText()
3. **Conditional application**: Only apply mock when `typeof HTMLCanvasElement !== "undefined"`
   - Prevents errors when setup file runs in node environment
   - Root vitest.config.ts uses `environment: "node"` by default
   - Only jsdom tests (via environmentMatchGlobs) need canvas mock

## Setup File Organization

- Root `vitest.setup.ts` can be imported by package-specific configs
- Use relative paths: `../../vitest.setup.ts` from package subdirectories
- `setupFiles: []` means no setup is applied (needs to be explicitly set)

## Canvas Mock Structure

```typescript
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = vi.fn((contextType) => {
    if (contextType === "2d") {
      return {
        font: "16px sans-serif",
        measureText: (text: string) => ({
          width: text.length * 8, // approximation
          actualBoundingBoxAscent: 14,
          actualBoundingBoxDescent: 4,
        }),
        fillText: vi.fn(),
        clearRect: vi.fn(),
      };
    }
    return null;
  });
}
```

## Common Test Infrastructure Issues

1. **Missing @testing-library/jest-dom**: Install and import in setup
2. **Canvas not available in JSDOM**: Install canvas package + mock context
3. **Setup file not applied**: Check vitest.config.ts `setupFiles` array
4. **Node vs jsdom environment**: Use conditional checks for DOM APIs

