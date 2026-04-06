

## Task: Update package.json scripts for unified server

### Changes Made
- Removed mode-specific scripts: `dev:bridge-replay` and `dev:bridge-live`
- Added unified script: `dev:bridge` with command `cargo run --manifest-path crates/acp-bridge/Cargo.toml --bin acp-bridge -- --addr 127.0.0.1:8765`
- Port standardized to 8765 for all bridge operations
- Note: `debug` script still references `dev:bridge-live` (will be updated in Task 16)

### Rationale
- Consolidated bridge mode scripts into single entry point
- Unified server binary now handles all modes via flags
- Simplifies development workflow with one bridge command

