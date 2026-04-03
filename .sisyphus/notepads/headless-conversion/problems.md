# Problems

- The exact scope of existing inline-style usage is broad and spread across multiple component areas, which raises regression risk when moving layout/styling responsibilities into CSS variables.
- `VirtualizedThread.tsx` couples styling, scrolling, measurement, ResizeObserver, RAF throttling, and imperative APIs in one file; careful incremental extraction is required.
- Pretext integration quality depends on exact font matching and cache invalidation strategy when font settings change.
