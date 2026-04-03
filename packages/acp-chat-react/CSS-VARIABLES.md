# CSS Variables Contract

This document defines the canonical `--acp-*` CSS variable contract for styling `@acp/chat-react` components. Variables are derived from current inline style usage and preserve existing fallback semantics.

## Overview

The library currently embeds CSS variables with fallback values directly in inline styles. This contract documents those variables for consumers who wish to override them. The library is transitioning from inline styles to CSS variable-based styling without changing existing `data-acp-*` selectors or class hooks.

**Key principle**: Override these variables in your application's CSS to customize the visual appearance. Fallback values are current defaults if no override is provided.

## Variable Categories

### 1. Colors

#### Background Colors

| Variable | Fallback | Usage |
|----------|----------|-------|
| `--acp-bg` | `#fff` | Primary background color for containers, inputs, panels, and cards |
| `--acp-bg-hover` | `#f0f0f0` | Hover state background for interactive elements |
| `--acp-color-user-bg` | `#e3f2fd` | User message background (placeholder rendering) |
| `--acp-color-agent-bg` | `#f5f5f5` | Agent message background (placeholder rendering) |

#### Text Colors

| Variable | Fallback | Usage |
|----------|----------|-------|
| `--acp-text` | `#000` | Primary text color |
| `--acp-text-muted` | `#666` or `#999` | Muted/secondary text color (see notes on variants) |
| `--acp-muted` | `#666` | Alternative muted text color (settings components) |
| `--acp-color-muted` | `#666` | Muted text in thread/message placeholders |

#### Border Colors

| Variable | Fallback | Usage |
|----------|----------|-------|
| `--acp-border` | `#ccc` or `#eee` | Primary border color (variants for different contexts) |

#### Accent Colors

| Variable | Fallback | Usage |
|----------|----------|-------|
| `--acp-accent` | `#0066cc` | Accent/interactive color for buttons, active states, selections, and focus indicators |

**Notes on naming inconsistencies**:
- `--acp-text-muted` appears in action bar and slash suggestions with fallback `#666` or `#999`
- `--acp-muted` appears in settings components with fallback `#666`
- `--acp-color-muted` appears in thread placeholders with fallback `#666`
These all serve similar purposes (muted/secondary text). Set all three when overriding until normalization.

### 2. Spacing

The following spacing values are derived from repeated inline style usage across components. These are **canonical tokens** candidates for future CSS variable extraction—they are not yet implemented as `var(--acp-*)` in the source code but represent the consistent spacing scale used throughout.

| Canonical Token | Value | Usage Context |
|-----------------|-------|---------------|
| `--acp-spacing-xs` | `2px` | Minimal gaps (label-description spacing) |
| `--acp-spacing-sm` | `4px` | Small gaps (action bar, separators, internal button padding) |
| `--acp-spacing-md` | `8px` | Medium gaps (composer controls, message headers, button padding) |
| `--acp-spacing-lg` | `12px` | Large gaps (settings row, panel padding, session list items) |
| `--acp-spacing-xl` | `16px` | Extra-large gaps (tab padding, separator margins, message placeholder padding) |

**Derived from inline values in**:
- `Composer.tsx`: padding `12px`, gap `8px`
- `SettingsPanel.tsx`: gap `12px`, padding `8px 12px`
- `MessageActionBar.tsx`: gap `4px`, padding `4px 8px`, `8px 12px`
- `SlashSuggestions.tsx`: padding `8px 12px`, `4px 0`, gap `8px`
- `ThoughtStack.tsx`: gap `4px`, `8px`, padding `2px 0`, `4px 8px`
- `SessionList.tsx`: padding `10px 12px`, gap `4px`
- `VirtualizedThread.tsx`: row gap default `8`, padding default `16` (via `VirtualizedThreadLayoutOptions`)

**Note**: These are transitional canonical values derived from current inline styles. They will be implemented as CSS variables during the headless conversion. Consumers can pre-adopt these values in custom CSS for consistency.

### 3. Typography

Typography values derived from inline style usage. These are **canonical tokens** candidates for future CSS variable extraction.

| Canonical Token | Value | Usage Context |
|-----------------|-------|---------------|
| `--acp-font-size-xs` | `11px` | Small timestamps, secondary metadata (session list) |
| `--acp-font-size-sm` | `12px` | Labels, descriptions, small UI text (action bar, slash suggestions, settings labels) |
| `--acp-font-size-md` | `13px` | Medium text (session rows, action bar, settings select) |
| `--acp-font-size-lg` | `14px` | Primary content text (composer, tabs, switches, checkboxes, message content) |
| `--acp-line-height` | `1.5` | Standard line height for body text (composer textarea) |
| `--acp-line-height-condensed` | `1.4` | Condensed line height for compact content (session list rows) |

**Derived from inline values in**:
- `Composer.tsx`: fontSize `14px`, lineHeight `1.5`
- `SettingsTabs.tsx`: fontSize `14px`
- `SettingsSwitch.tsx`: fontSize `14px` (label), `12px` (description)
- `SettingsCheckbox.tsx`: fontSize `14px` (label), `12px` (description)
- `SettingsSelect.tsx`: fontSize `13px`
- `SessionList.tsx`: fontSize `13px`, lineHeight `1.4`, fontSize `11px` (secondary)
- `MessageActionBar.tsx`: fontSize `12px`, `13px`
- `SlashSuggestions.tsx`: fontSize `12px` (header), `14px` (item name), `12px` (description)
- `ThoughtStack.tsx`: fontSize `14px` (trigger), `13px` (item), `12px` (metadata)

**Note**: These are transitional canonical values. They will be implemented as CSS variables during the headless conversion.

### 4. Layout

Layout values for borders, radii, dimensions derived from inline style usage. These are **canonical tokens** candidates for future CSS variable extraction.

| Canonical Token | Value | Usage Context |
|-----------------|-------|---------------|
| `--acp-radius-sm` | `3px` | Small radius (checkbox indicator) |
| `--acp-radius-md` | `4px` | Medium radius (action buttons, select inputs, checkbox container) |
| `--acp-radius-lg` | `6px` | Large radius (session list rows) |
| `--acp-radius-xl` | `8px` | Extra-large radius (composer textarea, panels, slash popover, action menu) |
| `--acp-radius-full` | `12px` or `50%` | Fully rounded (switch track, switch thumb, checkbox check mark) |
| `--acp-separator-height` | `16px` or `24px` | Vertical separator heights in settings/action bar |

**Derived from inline values in**:
- `Composer.tsx`: borderRadius `8px`
- `MessageActionBar.tsx`: borderRadius `4px` (buttons), `8px` (menu container), separator height `16px`
- `SlashSuggestions.tsx`: borderRadius `8px`
- `SettingsSelect.tsx`: borderRadius `4px`
- `SettingsCheckbox.tsx`: borderRadius `3px` (container), check mark uses inherited radius
- `SettingsSwitch.tsx`: borderRadius `12px` (track), `50%` (thumb)
- `SessionList.tsx`: borderRadius `6px`
- `SettingsPanel.tsx`: separator height `24px`

**Note**: These are transitional canonical values. They will be implemented as CSS variables during the headless conversion.

## Usage Example

Override variables in your application's CSS:

```css
:root {
  /* Colors */
  --acp-bg: #1a1a1a;
  --acp-text: #e0e0e0;
  --acp-border: #333;
  --acp-accent: #6366f1;
  --acp-text-muted: #808080;
  --acp-muted: #808080;
  --acp-color-muted: #808080;
  --acp-bg-hover: #2a2a2a;
  --acp-color-user-bg: #2563eb20;
  --acp-color-agent-bg: #1e293b;

  /* Spacing (pre-adopt canonical tokens) */
  --acp-spacing-xs: 2px;
  --acp-spacing-sm: 4px;
  --acp-spacing-md: 8px;
  --acp-spacing-lg: 12px;
  --acp-spacing-xl: 16px;

  /* Typography (pre-adopt canonical tokens) */
  --acp-font-size-xs: 11px;
  --acp-font-size-sm: 12px;
  --acp-font-size-md: 13px;
  --acp-font-size-lg: 14px;
  --acp-line-height: 1.5;
  --acp-line-height-condensed: 1.4;

  /* Layout (pre-adopt canonical tokens) */
  --acp-radius-sm: 3px;
  --acp-radius-md: 4px;
  --acp-radius-lg: 6px;
  --acp-radius-xl: 8px;
  --acp-radius-full: 12px;
}
```

Apply at any scope (global `:root`, component-level, or theme-specific class).

## Styling Hooks

### CSS Classes

BEM-style class naming: `acp-{component}__{element}--{modifier}`

Key classes:
- `acp-composer__textarea` - Composer input field
- `acp-composer__controls` - Composer button container
- `acp-composer__button--send` - Send button
- `acp-composer__button--stop` - Stop button
- `acp-settings-row` - Settings row container
- `acp-thread__viewport` - Thread scroll viewport
- `acp-message__header` - Message header
- `acp-message__content` - Message content container
- `acp-tool-call__header` - Tool call header
- `acp-tool-call__details` - Tool call details panel
- `acp-slash-popover` - Slash command popover

These classes remain available for styling and are preserved during the headless conversion.

### Data Attributes

`data-acp-*` attributes for test targeting. Use CSS variables or classes for styling, not data attributes.

Key data attributes:
- `data-acp-root` - Root container
- `data-acp-message` - Message item
- `data-acp-message-id` - Message identifier
- `data-acp-message-role` - Message role (user/agent)
- `data-acp-message-status` - Message status
- `data-acp-thought` - Thought block
- `data-acp-tool-call` - Tool call item
- `data-acp-composer` - Composer container
- `data-acp-composer-input` - Input field
- `data-acp-send-button` - Send button
- `data-acp-stop-button` - Stop button
- `data-acp-thread` - Thread container
- `data-acp-settings-panel` - Settings panel
- `data-acp-slash-popover` - Slash suggestions popover

See `README.md` for complete selector convention.

## Transition Status

**Current state**: Color variables embedded in inline styles with fallbacks. Spacing, typography, and layout values exist as inline styles but not yet as CSS variables.

**Transition plan**:
1. Inline styles removed from components
2. CSS variables with fallbacks defined in central stylesheet
3. Consumers override variables in their CSS
4. Existing class and data hooks unchanged

**Preserved**: All `data-acp-*` selectors, all `acp-*` class names, current fallback values.

**Changed**: Inline styles → CSS variables; variable ownership → consumer CSS.

## Implementation Files

Variables currently used in:
- `src/composer/Composer.tsx`
- `src/thread/VirtualizedThread.tsx`
- `src/thread/Thread.tsx`
- `src/thread/MessagePlaceholder.tsx`
- `src/settings/SettingsPanel.tsx`
- `src/settings/SettingsTabs.tsx`
- `src/settings/SettingsSwitch.tsx`
- `src/settings/SettingsCheckbox.tsx`
- `src/settings/SettingsSelect.tsx`
- `src/slash/SlashSuggestions.tsx`
- `src/actions/MessageActionBar.tsx`
- `src/message/MessageCard.tsx`
- `src/session-list/SessionList.tsx`
- `src/thought/ThoughtStack.tsx`

This list expands as transition progresses.