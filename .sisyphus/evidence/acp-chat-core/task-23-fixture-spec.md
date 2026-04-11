# Task 23: Test Fixture Specification

**Completed:** April 11, 2026  
**Plan:** .sisyphus/plans/acp-chat-core-testing-cleanup.md  
**Task:** Write test fixture specification document

---

## Outcome

Created comprehensive fixture specification document at:
`packages/acp-chat-core/docs/fixture-specification.md`

---

## What Was Documented

### 1. Fixture Directory Structure
- Location: `fixtures/replay-data/captured/{timestamp}/`
- Two files per fixture: `replay-events.jsonl` and `session-data.json`
- Timestamp-based directory naming for uniqueness and sorting

### 2. replay-events.jsonl Format
- **JSONL format**: One JSON object per line
- **Event structure** with four fields:
  - `envelope`: BridgeEnvelope containing protocol message
  - `tokenCount`: Token usage number
  - `timestamp`: Unix timestamp in milliseconds
  - `direction`: "in" or "out"

### 3. BridgeEnvelope Structure
- `version`: Protocol version (currently 1)
- `seq`: Zero-indexed sequence number
- `timestamp_ms`: Event timestamp
- `type`: Message type (currently "acp_payload")
- `payload`: The actual JSON-RPC protocol message

### 4. session-data.json Format
- `sessionId`: Unique session identifier
- `startTime`: Session start timestamp
- `endTime`: Session end timestamp
- `preExistingState`: Optional previous session state
- `modes`: Array of active session modes
- `models`: Array of model names used
- `eventCount`: Total events in fixture
- `totalTokenCount`: Sum of all token counts

### 5. Examples Provided
- Single event fixture example
- Multi-event fixture example with initialize/chat/create flow
- Complete breakdown of each field in example events

### 6. Creation Guide
- **Method 1**: Automatic capture during integration tests
- **Method 2**: Manual creation with step-by-step instructions
- Validation rules for consistency

---

## Files Analyzed

Examined 17 existing fixtures in `fixtures/replay-data/captured/`:
- All use consistent JSONL format
- All contain BridgeEnvelope with acp_payload type
- All session-data.json files follow same structure
- Event counts and token totals properly tracked

---

## Reference Links

- **Specification:** `packages/acp-chat-core/docs/fixture-specification.md`
- **Fixture Location:** `fixtures/replay-data/captured/`
- **Related Docs:** 
  - `packages/acp-chat-core/docs/integration-testing-patterns.md`
  - `packages/acp-chat-core/docs/unit-testing-patterns.md`

---

## Verification

- ✅ Fixture format documented (JSONL)
- ✅ All fields explained (envelope, tokenCount, timestamp, direction)
- ✅ BridgeEnvelope structure documented
- ✅ session-data.json metadata format documented
- ✅ Example fixtures provided (single and multi-event)
- ✅ Creation guide included (automatic and manual methods)
- ✅ Reference document style maintained
