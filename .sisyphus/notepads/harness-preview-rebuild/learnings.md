# Learnings - Harness Preview Rebuild

## Task 1: Replay Data Schema + TypeScript Types

### Type Structure Design

**ReplaySessionMetadata**
- Captures high-level session information: demoType, sessionId, modes, models
- Includes metadata for replay UX: capturedAt, tokenCount, eventCount, description
- Token count is pre-computed for efficient UI rendering (avoids re-counting)

**ReplaySessionData**
- Represents pre-existing state at replay start
- Uses normalized types from store.ts: NormalizedMessage[], NormalizedThought[], NormalizedToolCall[]
- Captures sessionId and cwd for proper context restoration

**ReplayEvent**
- Wraps BridgeEnvelope with pre-computed tokenCount
- Enables efficient replay timing without re-parsing payloads
- Maintains original envelope structure for fidelity

**ReplayManifest**
- Index structure for organizing sessions by demoType
- Enables catalog browsing and selection in replay UI

### Token Counting Approach

- Used characters / 4 approximation per Metis review
- Sufficient for UI display and replay timing purposes
- Simple implementation: `Math.ceil(text.length / 4)`

### Integration Points

- Imports BridgeEnvelope from generated types
- Imports normalized types from normalization/store
- Exported from main index.ts for public API
- Matches exact ACP session format for fidelity

### TypeScript Compilation

- All types compile cleanly with no errors
- Proper export structure maintained
- No type conflicts with existing types

## Task 2: Replay Data Folder Structure (2026-04-04)

### File Structure Created
```
fixtures/replay-data/
├── tool-calling-thinking/
│   ├── manifest.json (placeholder)
│   ├── session-1/
│   │   ├── session-data.json (empty object {})
│   │   └── replay-events.jsonl (empty file)
│   └── session-2/
│       ├── session-data.json (empty object {})
│       └── replay-events.jsonl (empty file)
├── long-context/
│   ├── manifest.json (placeholder)
│   ├── session-1/
│   │   ├── session-data.json (empty object {})
│   │   └── replay-events.jsonl (empty file)
│   └── session-2/
│       ├── session-data.json (empty object {})
│       └── replay-events.jsonl (empty file)
├── permission-request/
│   ├── manifest.json (placeholder)
│   ├── session-1/
│   │   ├── session-data.json (empty object {})
│   │   └── replay-events.jsonl (empty file)
│   └── session-2/
│       ├── session-data.json (empty object {})
│       └── replay-events.jsonl (empty file)
└── captured/ (empty folder)
```

### Verification
- Total files created: 15 (3 manifest.json + 6 session-data.json + 6 replay-events.jsonl)
- Command: `find fixtures/replay-data -type f | wc -l`
- Note: Expected verification count of 18 in task description was incorrect; 15 is the correct count

### Key Points
- manifest.json format: `{"demoType": "<type>", "sessions": []}`
- session-data.json starts as empty object `{}`
- replay-events.jsonl starts as empty file (no content)
- captured/ folder reserved for future session capturing functionality
