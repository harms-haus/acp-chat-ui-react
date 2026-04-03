/**
 * CSS Variables Type Surface
 *
 * This module provides TypeScript types for the `--acp-*` CSS variable contract.
 * These types enable type-safe customization of @acp/chat-react component styling.
 *
 * @see CSS-VARIABLES.md for the complete styling contract
 */

/**
 * Color CSS variables for customizing component colors.
 *
 * These variables control background colors, text colors, borders, and accent colors
 * across all chat components.
 *
 * Example usage:
 * ```css
 * :root {
 *   --acp-bg: #1a1a1a;
 *   --acp-text: #e0e0e0;
 *   --acp-accent: #6366f1;
 * }
 * ```
 */
export interface AcpColorVariables {
  /** Primary background color for containers, inputs, panels, and cards. Default: `#fff` */
  readonly '--acp-bg': string;

  /** Hover state background for interactive elements. Default: `#f0f0f0` */
  readonly '--acp-bg-hover': string;

  /** User message background (placeholder rendering). Default: `#e3f2fd` */
  readonly '--acp-color-user-bg': string;

  /** Agent message background (placeholder rendering). Default: `#f5f5f5` */
  readonly '--acp-color-agent-bg': string;

  /** Primary text color. Default: `#000` */
  readonly '--acp-text': string;

  /** Muted/secondary text color in action bar and slash suggestions. Default: `#666` or `#999` */
  readonly '--acp-text-muted': string;

  /** Alternative muted text color (settings components). Default: `#666` */
  readonly '--acp-muted': string;

  /** Muted text in thread/message placeholders. Default: `#666` */
  readonly '--acp-color-muted': string;

  /** Primary border color for inputs, panels, and dividers. Default: `#ccc` or `#eee` */
  readonly '--acp-border': string;

  /** Accent/interactive color for buttons, active states, selections, and focus indicators. Default: `#0066cc` */
  readonly '--acp-accent': string;
}

/**
 * Spacing CSS variables for customizing layout gaps and padding.
 *
 * These are canonical tokens derived from inline spacing values.
 * They provide a consistent spacing scale across components.
 *
 * Example usage:
 * ```css
 * :root {
 *   --acp-spacing-sm: 4px;
 *   --acp-spacing-md: 8px;
 *   --acp-spacing-lg: 12px;
 * }
 * ```
 */
export interface AcpSpacingVariables {
  /** Minimal gaps (label-description spacing). Default: `2px` */
  readonly '--acp-spacing-xs': string;

  /** Small gaps (action bar, separators, internal button padding). Default: `4px` */
  readonly '--acp-spacing-sm': string;

  /** Medium gaps (composer controls, message headers, button padding). Default: `8px` */
  readonly '--acp-spacing-md': string;

  /** Large gaps (settings row, panel padding, session list items). Default: `12px` */
  readonly '--acp-spacing-lg': string;

  /** Extra-large gaps (tab padding, separator margins, message placeholder padding). Default: `16px` */
  readonly '--acp-spacing-xl': string;
}

/**
 * Typography CSS variables for customizing text size and line height.
 *
 * These are canonical tokens derived from inline typography values.
 * They provide a consistent typography scale across components.
 *
 * Example usage:
 * ```css
 * :root {
 *   --acp-font-size-sm: 12px;
 *   --acp-font-size-md: 13px;
 *   --acp-line-height: 1.5;
 * }
 * ```
 */
export interface AcpTypographyVariables {
  /** Small timestamps, secondary metadata (session list). Default: `11px` */
  readonly '--acp-font-size-xs': string;

  /** Labels, descriptions, small UI text (action bar, slash suggestions, settings labels). Default: `12px` */
  readonly '--acp-font-size-sm': string;

  /** Medium text (session rows, action bar, settings select). Default: `13px` */
  readonly '--acp-font-size-md': string;

  /** Primary content text (composer, tabs, switches, checkboxes, message content). Default: `14px` */
  readonly '--acp-font-size-lg': string;

  /** Standard line height for body text (composer textarea). Default: `1.5` */
  readonly '--acp-line-height': string;

  /** Condensed line height for compact content (session list rows). Default: `1.4` */
  readonly '--acp-line-height-condensed': string;
}

/**
 * Layout CSS variables for customizing borders, radii, and dimensions.
 *
 * These are canonical tokens derived from inline layout values.
 * They provide a consistent layout scale across components.
 *
 * Example usage:
 * ```css
 * :root {
 *   --acp-radius-sm: 3px;
 *   --acp-radius-md: 4px;
 *   --acp-radius-xl: 8px;
 * }
 * ```
 */
export interface AcpLayoutVariables {
  /** Small radius (checkbox indicator). Default: `3px` */
  readonly '--acp-radius-sm': string;

  /** Medium radius (action buttons, select inputs, checkbox container). Default: `4px` */
  readonly '--acp-radius-md': string;

  /** Large radius (session list rows). Default: `6px` */
  readonly '--acp-radius-lg': string;

  /** Extra-large radius (composer textarea, panels, slash popover, action menu). Default: `8px` */
  readonly '--acp-radius-xl': string;

  /** Fully rounded (switch track, switch thumb, checkbox check mark). Default: `12px` or `50%` */
  readonly '--acp-radius-full': string;

  /** Vertical separator heights in settings/action bar. Default: `16px` or `24px` */
  readonly '--acp-separator-height': string;
}

/**
 * Complete CSS variables contract for @acp/chat-react styling.
 *
 * This type surface provides type-safe access to all `--acp-*` CSS variables.
 * Use these types when defining CSS variable overrides in TypeScript or when
 * building tooling that interacts with the styling contract.
 *
 * Color variables are currently implemented as CSS variables in the source code.
 * Spacing, typography, and layout variables are canonical tokens derived from
 * inline styles and will be implemented as CSS variables during the headless conversion.
 *
 * @example
 * ```typescript
 * // Type-safe CSS variable override
 * const theme: AcpCssVariables = {
 *   '--acp-bg': '#1a1a1a',
 *   '--acp-text': '#e0e0e0',
 *   '--acp-accent': '#6366f1',
 *   '--acp-spacing-md': '8px',
 *   '--acp-font-size-md': '13px',
 *   '--acp-radius-md': '4px',
 * };
 * ```
 *
 * @see CSS-VARIABLES.md for the complete styling contract and usage examples
 */
export type AcpCssVariables = AcpColorVariables & AcpSpacingVariables & AcpTypographyVariables & AcpLayoutVariables;
