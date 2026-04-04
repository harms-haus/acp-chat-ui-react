# Migration Guide: Headless Conversion

This guide covers migrating from inline styles to the headless CSS variable architecture in `@acp/chat-react`.

## Overview

The headless conversion transforms `@acp/chat-react` from inline style-based styling to a CSS variable-driven architecture. This enables complete visual customization while preserving all existing functionality.

### Two-Phase Approach

**Phase 1: Non-Breaking Changes** (Additive)
- Type surfaces for CSS variables, height estimator, and browser API abstractions
- Injectable props for customization (heightEstimator, clipboard, scheduler, callbacks)
- CSS class hooks alongside existing inline styles
- All changes are backward compatible

**Phase 2: Breaking Changes** (Inline Style Removal)
- Inline styles removed from components
- CSS classes replace inline styles
- Consumers must provide CSS for styling
- `data-acp-*` selectors preserved as test hooks

## Upgrade Steps

### 1. Update Dependencies

```bash
pnpm update @acp/chat-react
```

### 2. Add CSS to Your Application

Create or update your CSS file with component styles. Reference `apps/harness/src/styles.css` for complete examples.

```css
/* Your application's CSS */
:root {
  /* Theme overrides (optional) */
  --acp-bg: #1a1a1a;
  --acp-text: #e0e0e0;
  --acp-accent: #6366f1;
  --acp-border: #333;
  --acp-text-muted: #808080;
  --acp-bg-hover: #2a2a2a;
}

/* Copy component styles from harness styles.css */
.acp-composer { ... }
.acp-thread { ... }
.acp-settings-panel { ... }
/* etc. */
```

### 3. Verify Tests Still Pass

All `data-acp-*` selectors remain unchanged:

```typescript
// Tests continue to work without modification
const sendButton = screen.getByTestId('acp-send-button');
const message = screen.getByTestId('acp-message');
```

## CSS Variable Reference

### Color Variables

| Variable | Fallback | Usage |
|----------|----------|-------|
| `--acp-bg` | `#fff` | Primary background (containers, inputs, panels) |
| `--acp-bg-hover` | `#f0f0f0` | Hover state background |
| `--acp-text` | `#000` | Primary text color |
| `--acp-text-muted` | `#666` | Muted/secondary text (action bar, slash suggestions) |
| `--acp-muted` | `#666` | Muted text (settings components) |
| `--acp-color-muted` | `#666` | Muted text (thread placeholders) |
| `--acp-border` | `#ccc` | Primary border color |
| `--acp-accent` | `#0066cc` | Interactive color (buttons, active states) |
| `--acp-color-user-bg` | `#e3f2fd` | User message background |
| `--acp-color-agent-bg` | `#f5f5f5` | Agent message background |

### Spacing Variables (Canonical Tokens)

| Variable | Fallback | Usage |
|----------|----------|-------|
| `--acp-spacing-xs` | `2px` | Minimal gaps |
| `--acp-spacing-sm` | `4px` | Small gaps (action bar, separators) |
| `--acp-spacing-md` | `8px` | Medium gaps (composer controls) |
| `--acp-spacing-lg` | `12px` | Large gaps (settings row, panel padding) |
| `--acp-spacing-xl` | `16px` | Extra-large gaps (tab padding) |

### Typography Variables (Canonical Tokens)

| Variable | Fallback | Usage |
|----------|----------|-------|
| `--acp-font-size-xs` | `11px` | Timestamps, metadata |
| `--acp-font-size-sm` | `12px` | Labels, descriptions |
| `--acp-font-size-md` | `13px` | Session rows, select inputs |
| `--acp-font-size-lg` | `14px` | Primary content text |
| `--acp-line-height` | `1.5` | Standard line height |
| `--acp-line-height-condensed` | `1.4` | Compact line height |

### Layout Variables (Canonical Tokens)

| Variable | Fallback | Usage |
|----------|----------|-------|
| `--acp-radius-sm` | `3px` | Checkbox indicator |
| `--acp-radius-md` | `4px` | Buttons, select inputs |
| `--acp-radius-lg` | `6px` | Session list rows |
| `--acp-radius-xl` | `8px` | Composer textarea, panels |
| `--acp-radius-full` | `12px` | Switch track, thumb |
| `--acp-separator-height` | `24px` | Vertical separators |

### Component-Specific Variables

**MessageCard:**
| Variable | Fallback |
|----------|----------|
| `--acp-message-header-gap` | `8px` |
| `--acp-message-content-margin-top` | `8px` |
| `--acp-message-text-line-height` | `1.5` |

**ThoughtStack:**
| Variable | Fallback |
|----------|----------|
| `--acp-thought-trigger-gap` | `8px` |
| `--acp-thought-trigger-padding` | `4px 8px` |
| `--acp-thought-trigger-font-size` | `14px` |
| `--acp-thought-expand-gap` | `4px` |
| `--acp-thought-expand-padding` | `2px 0` |
| `--acp-thought-expand-font-size` | `13px` |
| `--acp-thought-label-font-weight` | `600` |
| `--acp-thought-filepath-opacity` | `0.7` |

**Thread:**
| Variable | Fallback |
|----------|----------|
| `--acp-thread-row-gap` | `8px` |

## Component Migration Examples

### Composer

**Before (v0.x - inline styles):**
Inline styles were embedded in the component.

**After (v1.0 - CSS classes):**

```tsx
import { Composer } from '@acp/chat-react';

// No changes to usage - styles now come from CSS
<Composer
  store={store}
  controller={controller}
  placeholder="Type a message..."
  className="my-custom-composer" // Optional additional class
/>
```

**CSS classes added:**
- `.acp-composer` - Root container
- `.acp-composer__textarea` - Input field
- `.acp-composer__controls` - Button container
- `.acp-composer__button--send` - Send button
- `.acp-composer__button--stop` - Stop button

**New injectable prop:**
```tsx
// Optional: Custom logger
<Composer
  store={store}
  controller={controller}
  logger={{
    error: (...args) => console.error(...args),
    warn: () => {}, // Silent in production
    info: () => {},
    debug: () => {},
    log: () => {},
  }}
/>
```

### VirtualizedThread

**Before (v0.x):**
```tsx
<VirtualizedThread
  items={items}
  renderItem={renderItem}
  // Inline styles handled internally
/>
```

**After (v1.0):**
```tsx
import {
  VirtualizedThread,
  createPretextEstimator,
  DEFAULT_HEIGHT_ESTIMATOR_CONFIG,
  createViewportObserverFactory,
  defaultScheduler,
} from '@acp/chat-react';

<VirtualizedThread
  items={items}
  renderItem={renderItem}
  // Optional: Custom height estimator
  heightEstimator={createPretextEstimator({
    ...DEFAULT_HEIGHT_ESTIMATOR_CONFIG,
    fontSize: 16, // Custom font size
  })}
  // Optional: SSR-safe browser API overrides
  viewportObserverFactory={createViewportObserverFactory()}
  scheduler={defaultScheduler}
  // Optional: Callbacks for monitoring
  onHeightRecalculated={(heights) => console.log('Heights:', heights)}
  onContainerResize={(width) => console.log('Width:', width)}
  onScroll={(state) => console.log('Scroll:', state)}
  onReachBottom={() => console.log('Reached bottom')}
/>
```

**New props:**
| Prop | Type | Default |
|------|------|---------|
| `heightEstimator` | `HeightEstimator` | Pretext-based estimator |
| `viewportObserverFactory` | `ViewportObserverFactory` | Native ResizeObserver |
| `scheduler` | `Scheduler` | Native RAF/setTimeout |
| `onHeightRecalculated` | `(heights: Map<string, number>) => void` | - |
| `onContainerResize` | `(width: number) => void` | - |
| `onContentChange` | `(messageId: string) => void` | - |
| `onScroll` | `(state: ScrollState) => void` | - |
| `onReachBottom` | `() => void` | - |
| `onItemsRendered` | `(count: number) => void` | - |

### MessageCard

**Before (v0.x):**
```tsx
<MessageCard message={message} />
```

**After (v1.0):**
```tsx
import { MessageCard, createClipboardAPI } from '@acp/chat-react';

<MessageCard
  message={message}
  // Optional: Custom actions
  actions={[
    { id: 'copy', label: 'Copy', icon: <CopyIcon /> },
    { id: 'retry', label: 'Retry', icon: <RetryIcon /> },
  ]}
  // Optional: Custom clipboard handler
  onCopy={(msg) => {
    createClipboardAPI().writeText(msg.content);
  }}
  // Optional: Custom logger
  logger={silentLogger}
/>
```

**CSS classes added:**
- `.acp-message` - Root container
- `.acp-message--user` / `.acp-message--agent` - Role modifiers
- `.acp-message--status-{status}` - Status modifiers
- `.acp-message__header` - Header flex container
- `.acp-message__actions` - Actions container
- `.acp-message__role-label` - Role label
- `.acp-message__content` - Content wrapper
- `.acp-message__text` - Text content

### SettingsPanel

**Before (v0.x):**
Inline styles for all settings elements.

**After (v1.0):**
```tsx
<SettingsPanel
  controller={controller}
  // Optional: Custom row renderer
  renderSettingsRow={(props) => (
    <div className="my-settings-row">
      <CustomSelect value={props.selectedMode} />
    </div>
  )}
/>
```

**CSS classes added:**
- `.acp-settings-panel` - Root container
- `.acp-settings-row` - Row container
- `.acp-settings-row--disabled` - Disabled state
- `.acp-settings__separator` - Separator
- `.acp-settings__mode-value` - Mode value text
- `.acp-settings__error` - Error banner

**Sub-components (SettingsSelect, SettingsSwitch, SettingsCheckbox):**
All sub-components follow BEM naming: `.acp-settings-{component}__{element}--{modifier}`

### SlashSuggestions

**Before (v0.x):**
Inline styles for popover and items.

**After (v1.0):**
```tsx
<SlashSuggestions
  commands={commands}
  selectedIndex={selectedIndex}
  onSelect={handleSelect}
  // New: Optional callback when command is selected
  onSelectCommand={(command) => {
    console.log('Selected:', command.id);
  }}
  onClose={handleClose}
  anchorElement={textareaRef.current}
  open={isOpen}
/>
```

**CSS classes added:**
- `.acp-slash-popover` - Popover container
- `.acp-slash-header` - Header bar
- `.acp-slash-list` - List container
- `.acp-slash-item` - Command item
- `.acp-slash-item--selected` - Selected state
- `.acp-slash-item-icon` - Icon wrapper
- `.acp-slash-item-content` - Content container
- `.acp-slash-item-name` - Command name
- `.acp-slash-item-description` - Description text

### ThoughtStack

**Before (v0.x):**
Inline styles for trigger, items, and expanded content.

**After (v1.0):**
```tsx
<ThoughtStack
  group={thoughtGroup}
  isActive={isActive}
  // Optional: Custom renderers
  renderClosed={(context) => <CustomCollapsedView {...context} />}
  renderOpen={(context) => <CustomExpandedView {...context} />}
  // Optional: Custom logger
  logger={silentLogger}
/>
```

**CSS classes added:**
- `.acp-thought-stack` - Root container
- `.acp-thought-stack__trigger` - Trigger button
- `.acp-thought-stack__trigger--open` - Open state
- `.acp-thought-stack__content` - Content wrapper
- `.acp-thought-stack__item` - Item container
- `.acp-thought-stack__item--thought` - Thought item
- `.acp-thought-stack__item--tool-call` - Tool call item
- `.acp-thought-stack__expand-btn` - Expand button
- `.acp-thought-stack__label` - Label text
- `.acp-thought-stack__filepath` - File path
- `.acp-thought-stack__expanded-content` - Expanded content

### ToolCall

**Before (v0.x):**
Already using CSS classes (no inline styles).

**After (v1.0):**
```tsx
<ToolCall
  toolCall={toolCall}
  // Optional: Controlled expansion
  isExpanded={isExpanded}
  onToggle={() => setIsExpanded(!isExpanded)}
  // Optional: Custom logger
  logger={silentLogger}
/>
```

**CSS classes (unchanged):**
- `.acp-tool-call` - Root container
- `.acp-tool-call__header` - Header section
- `.acp-tool-call__trigger` - Collapsible trigger
- `.acp-tool-call__status-icon` - Status indicator
- `.acp-tool-call__kind` / `.acp-tool-call__title` - Labels
- `.acp-tool-call__details` - Details panel
- `.acp-tool-call__input` / `.acp-tool-call__output` - Content areas

## Injectable Props Reference

### HeightEstimator

Custom height estimation for virtualized thread items.

```tsx
import type { HeightEstimator, HeightEstimatorConfig } from '@acp/chat-react';

const customEstimator: HeightEstimator = {
  estimate(item, width, config) {
    if (item.type === 'message') {
      // Custom logic for messages
      return calculateHeight(item.data, width);
    }
    return 100; // Default for thought groups
  },
  // Optional: Cache prepared text for resize efficiency
  prepareText(text, font, options) {
    return { font, whiteSpace: options?.whiteSpace };
  },
  layoutText(prepared, width, lineHeight) {
    return calculateTextHeight(prepared, width, lineHeight);
  },
};
```

### ClipboardAPI

Custom clipboard implementation for copy operations.

```tsx
import type { ClipboardAPI } from '@acp/chat-react';

// Browser implementation
const browserClipboard: ClipboardAPI = {
  async writeText(text) {
    await navigator.clipboard.writeText(text);
  },
};

// SSR/test implementation (no-op)
const noOpClipboard: ClipboardAPI = {
  writeText: () => Promise.resolve(),
};

// Usage
<MessageCard onCopy={(msg) => clipboard.writeText(msg.content)} />
```

### Scheduler

Custom animation frame and timeout scheduling.

```tsx
import type { Scheduler } from '@acp/chat-react';

// Browser implementation
const browserScheduler: Scheduler = {
  requestAnimationFrame: (cb) => requestAnimationFrame(cb),
  cancelAnimationFrame: (id) => cancelAnimationFrame(id),
  setTimeout: (cb, ms) => setTimeout(cb, ms),
  clearTimeout: (id) => clearTimeout(id),
};

// SSR/test implementation
const noOpScheduler: Scheduler = {
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
  setTimeout: () => 0,
  clearTimeout: () => {},
};
```

### ViewportObserverFactory

Custom viewport resize observation.

```tsx
import type { ViewportObserverFactory } from '@acp/chat-react';

const customFactory: ViewportObserverFactory = {
  create(callback, options) {
    const ro = new ResizeObserver((entries) => callback(entries, observer));
    return {
      observe: (target) => ro.observe(target),
      unobserve: (target) => ro.unobserve(target),
      disconnect: () => ro.disconnect(),
    };
  },
};
```

### Logger

Custom logging for error and debug messages.

```tsx
import type { Logger } from '@acp/chat-react';

// Console logger (development)
const consoleLogger: Logger = {
  error: (...args) => console.error(...args),
  warn: (...args) => console.warn(...args),
  info: (...args) => console.info(...args),
  debug: (...args) => console.debug(...args),
  log: (...args) => console.log(...args),
};

// Silent logger (production)
const silentLogger: Logger = {
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
  log: () => {},
};

// Usage
<Composer logger={silentLogger} />
<MessageCard logger={silentLogger} />
```

## Breaking vs Non-Breaking Changes

### Non-Breaking (Phase 1)

| Change | Impact |
|--------|--------|
| Type surfaces (`AcpCssVariables`, `HeightEstimator`, `ClipboardAPI`, etc.) | Additive - new types for type-safe customization |
| CSS classes (`acp-*`) | Additive - parallel to inline styles |
| Injectable props | Additive - optional with defaults |
| `data-acp-*` attributes | Preserved - unchanged |

### Breaking (Phase 2)

| Change | Impact | Migration |
|--------|--------|-----------|
| Inline style removal | Styles no longer embedded | Add CSS from harness styles.css |
| CSS variable ownership | Variables must be defined by consumer | Define variables in application CSS |
| Default styling | No default visual styling | Provide CSS classes |

## Test Selector Preservation

All `data-acp-*` selectors remain unchanged and are **test hooks only**:

```typescript
// Do NOT use data attributes for styling
// These are preserved for test targeting only

// Correct: Use CSS classes for styling
const styles = `.acp-composer__textarea { border: 1px solid #ccc; }`;

// Correct: Use data attributes for tests
const button = screen.getByTestId('acp-send-button');

// Incorrect: Using data attributes for styling
const styles = `[data-acp-send-button] { ... }`; // NOT recommended
```

## Complete Selector Reference

| Selector | Element |
|----------|---------|
| `data-acp-root` | Root container |
| `data-acp-message` | Message item |
| `data-acp-message-id` | Message identifier |
| `data-acp-message-role` | Message role (user/agent) |
| `data-acp-message-status` | Message status |
| `data-acp-thought` | Thought block |
| `data-acp-tool-call` | Tool call item |
| `data-acp-composer` | Composer container |
| `data-acp-composer-input` | Input field |
| `data-acp-send-button` | Send button |
| `data-acp-stop-button` | Stop button |
| `data-acp-thread` | Thread container |
| `data-acp-settings-panel` | Settings panel |
| `data-acp-slash-popover` | Slash suggestions popover |
| `data-acp-slash-item` | Slash command item |

## Codemod Instructions

Currently, no automated codemod is available. Manual migration steps:

1. Add CSS file to your application
2. Override CSS variables for theme customization
3. Update any code that relied on inline styles being present
4. Verify tests pass with unchanged `data-acp-*` selectors

Future codemod may be provided for automated CSS extraction.

## Troubleshooting

### Styles Not Appearing

Ensure CSS file is imported and component classes are defined:

```tsx
// Import your CSS
import './styles.css';

// Verify classes in CSS
.acp-composer__textarea { /* styles */ }
```

### Variable Overrides Not Working

Define variables at appropriate scope:

```css
/* Global scope */
:root {
  --acp-bg: #1a1a1a;
}

/* Component scope */
.my-chat-container {
  --acp-bg: #ffffff;
}
```

### Height Estimation Inaccurate

Customize height estimator config:

```tsx
import { createPretextEstimator, DEFAULT_HEIGHT_ESTIMATOR_CONFIG } from '@acp/chat-react';

const estimator = createPretextEstimator({
  ...DEFAULT_HEIGHT_ESTIMATOR_CONFIG,
  fontSize: 16, // Match your actual font
  lineHeight: 24,
  fontFamily: 'Your Custom Font, sans-serif',
});
```

## Related Documentation

- [CSS-VARIABLES.md](./CSS-VARIABLES.md) - Complete CSS variable contract
- [README.md](./README.md) - Selector conventions and usage