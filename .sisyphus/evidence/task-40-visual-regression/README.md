# Task 40: Visual Regression Tests

## Summary

Set up Playwright visual regression testing for the acp-chat-react library components.

## Setup

### Files Created
- `apps/harness/playwright.config.ts` - Playwright configuration for visual regression
- `apps/harness/tests/visual/components.spec.ts` - Visual regression test suite

### Scripts Added
- `pnpm test:visual` - Run visual regression tests
- `pnpm test:visual:update` - Update baseline screenshots

## Baseline Screenshots

14 baseline screenshots created for the following components:

### Composer (3 states)
- `composer-idle` - Disabled, not connected state
- `composer-connected` - Connected demo state
- `composer-with-text` - With text input

### Thread/VirtualizedThread (2 states)
- `thread-empty` - Empty state
- `thread-populated` - With messages

### MessageCard (2 states)
- `messagecard-user` - User message
- `messagecard-agent` - Agent message

### SettingsPanel (2 states)
- `settingspanel-disconnected` - Disconnected state
- `settingspanel-connected` - Connected state

### SlashSuggestions (2 states)
- `slashsuggestions-open` - Open popover
- `slashsuggestions-selected` - Selected item

### ThoughtStack (2 states)
- `thoughtstack-collapsed` - Collapsed state
- `thoughtstack-expanded` - Expanded state

### ToolCall (1 state)
- `toolcall-in-thoughtstack` - In expanded ThoughtStack

## Configuration

### Tolerance Settings
- `maxDiffPixels: 100-200` - Maximum pixel difference allowed
- `maxDiffPixelRatio: 0.02` - 2% pixel difference ratio
- `threshold: 0.2` - Anti-aliasing threshold

### Browser Settings
- Chromium browser with stable viewport (1280x720)
- Font rendering disabled for consistency
- Auto-screenshot on failure

## Test Count
- 14 visual regression tests
- All tests passing