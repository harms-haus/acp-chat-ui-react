# Wave 3, Tasks 10-12: Issues

## Missing Build Configuration
- **Issue**: ws-bridge package referenced `tsconfig.build.json` but it didn't exist
- **Resolution**: Created `tsconfig.build.json` following `acp-chat-core` pattern
- **Lesson**: Verify all build files exist before running builds

## LSP Errors (Pre-existing)
- **Issue**: LSP showed many `expected &'static (dyn Callsite + 'static)` errors in Rust files
- **Resolution**: These are pre-existing LSP errors not related to changes (cargo check passes)
- **Lesson**: Trust `cargo check` over LSP for Rust compilation errors

