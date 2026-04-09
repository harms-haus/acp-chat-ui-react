# Wave 3, Tasks 10-12: Learnings

## Build Configuration Pattern
- TypeScript packages need `tsconfig.build.json` for builds (extends `tsconfig.json` with `noEmit: false`)
- Follow existing package patterns (e.g., `acp-chat-core/tsconfig.build.json`)

## Tracing Levels in Rust
- Use `tracing::trace!` for detailed execution flow (connection states, messages)
- Use `tracing::info!` for important state changes
- Use `tracing::error!` for errors
- Pattern: `tracing::trace!("Description: {:?}", variable)`

## Console Logging in TypeScript
- Use `console.trace` for detailed execution flow
- Use consistent prefixes: `[WS]` for WebSocket operations
- Add trace at: connection state changes, messages sent/received, errors

## Verification Checklist
1. Check package exports match requirements
2. Verify build configuration exists and works
3. Count trace statements added (grep is helpful)
4. Run both cargo check and TypeScript builds
5. Save evidence for verification

