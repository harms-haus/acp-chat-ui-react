# Issues

- `boulder.json` session tracking was polluted by background subagent session IDs; keep only the active orchestration session in `session_ids`.
- No ESLint config file exists at repo root (`eslint.config.*` search empty), so lint verification should rely on project `check` / TypeScript unless config is introduced by scope.
- `packages/acp-chat-react/src` has existing TS hints in `.tsx` files (unused declarations), but no blocking TS errors from directory diagnostics at session start.
- Plan ordering is non-canonical because Wave 2 tasks were appended after Wave 8 during plan drafting; follow dependency graph, not file order.
