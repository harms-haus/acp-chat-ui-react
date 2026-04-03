# @acp/chat-react

React components for ACP chat UI.

## Selector Convention

All interactive elements use `data-acp-*` attributes for reliable test targeting:

| Selector | Element |
|----------|---------|
| `data-acp-root` | Root container |
| `data-acp-message` | Message item |
| `data-acp-thought` | Thought block |
| `data-acp-tool-call` | Tool call item |
| `data-acp-input` | Input field |
| `data-acp-send` | Send button |

Use these selectors in tests instead of CSS classes or DOM structure.

## Styling

The library uses CSS variables for styling customization. See [CSS-VARIABLES.md](./CSS-VARIABLES.md) for the complete styling contract.

Key points:
- Override `--acp-*` variables in your application's CSS to customize appearance
- Fallback values are preserved as defaults
- CSS classes (`acp-*`) and data attributes (`data-acp-*`) remain available as styling and test hooks

## Dependency Policy

Base UI (`@base-ui-components/react`) is the only allowed generic primitive library.
Do not add alternative primitive libraries (Radix, MUI, etc).