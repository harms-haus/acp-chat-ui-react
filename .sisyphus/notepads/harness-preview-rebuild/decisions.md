# Decisions - Harness Preview Rebuild

## Task 1: Replay Data Schema + TypeScript Types

### Decision 1: Type Export Structure

**Decision**: Export replay types through main index.ts alongside other core types

**Rationale**:
- Maintains consistency with existing package structure
- Provides single entry point for consumers
- Aligns with how normalization, transport, and session types are exported

### Decision 2: ReplayEvent Token Count Pre-computation

**Decision**: Pre-compute tokenCount on ReplayEvent instead of calculating on-demand

**Rationale**:
- Avoids re-parsing envelope payloads during replay
- Improves replay performance
- Matches requirement: "ReplayEvent: BridgeEnvelope wrapper with pre-computed tokenCount"
- Token count is stable (doesn't change after capture)

### Decision 3: Use Normalized Types for SessionData

**Decision**: ReplaySessionData uses existing normalized types (NormalizedMessage, NormalizedThought, NormalizedToolCall)

**Rationale**:
- Leverages existing type definitions from normalization/store
- Avoids duplication and potential drift
- Directly compatible with session normalization pipeline
- Pre-existing state can be loaded directly into NormalizedState

### Decision 4: Token Counting Algorithm

**Decision**: Use simple characters / 4 approximation

**Rationale**:
- Approved by Metis review for this use case
- Sufficient for UI display and replay timing
- No dependency on external tokenization libraries
- Consistent with project's pragmatic approach

### Decision 5: Separation of Concerns

**Decision**: Keep replay types in dedicated replay/ module

**Rationale**:
- Clear separation of replay-specific types from core ACP types
- Easier to maintain as replay functionality evolves
- Prevents polluting core type namespace with replay concerns
- Mirrors existing module structure (normalization/, transport/, session/)
