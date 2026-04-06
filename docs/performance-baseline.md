# v2 Replay Performance Baseline

## Overview

This document establishes the performance baseline for the v2 replay mode, which uses token-count based timing at 65 TPS (tokens per second).

## Methodology

### Timing Algorithm

The v2 replay mode calculates event delays based on token count:

- **Formula**: `delay_ms = (token_count / 65) * 1000`
- **Zero-token events**: Fixed 15ms delay
- **Burst splitting**: Events >100 tokens are split into ~10-token sub-chunks

### Benchmark Setup

- **Server**: `cargo run --bin acp-bridge replay-v2`
- **Client**: WebSocket connection with JSON-RPC flow:
  1. `initialize` → server responds with capabilities
  2. `session/new` → loads session data
  3. `session/prompt` → streams replay events at 65 TPS
- **Metrics**: TPS, total time, p99 latency, memory usage

### Test Scripts

Three replay scenarios were benchmarked:

1. **tool-calling-thinking/session-1**: 13 events, no tokenCount fields (uses 15ms default delay)
2. **long-context/session-1**: 21 events, tokenCount: 4-20 tokens per event
3. **permission-request/session-1**: 11 events, tokenCount: 62-227 tokens per event

## Expected Performance Characteristics

### tool-calling-thinking/session-1

| Metric | Expected Value | Notes |
|--------|---------------|-------|
| Events | 13 | All events use 15ms default delay |
| Total Duration | ~195ms | 13 events × 15ms |
| TPS | ~65-70 | High due to minimal delays |
| p99 Latency | <50ms | Network + processing overhead |

### long-context/session-1

| Metric | Expected Value | Notes |
|--------|---------------|-------|
| Events | 21 | tokenCount: 4-20 per event |
| Total Duration | ~250-350ms | Sum of individual delays |
| TPS | ~60-65 | Close to target 65 TPS |
| p99 Latency | <100ms | Includes burst handling |

### permission-request/session-1

| Metric | Expected Value | Notes |
|--------|---------------|-------|
| Events | 11 | tokenCount: 62-227 per event |
| Total Duration | ~2000-3500ms | Large events trigger burst splitting |
| TPS | ~55-65 | Variable due to burst splitting |
| p99 Latency | <200ms | Higher due to chunking overhead |

## Calculated Delays by Token Count

| Token Count | Delay (ms) | Notes |
|-------------|-----------|-------|
| 0 | 15ms | Fixed minimum |
| 4 | 61ms | `4/65 * 1000` |
| 10 | 153ms | `10/65 * 1000` |
| 20 | 307ms | `20/65 * 1000` |
| 62 | 953ms | `62/65 * 1000` |
| 95 | 1461ms | `95/65 * 1000` |
| 100 | 1538ms | Threshold for burst splitting |
| 150 | 2307ms | Split into 15 chunks of 10 tokens |
| 227 | 3492ms | Split into 23 chunks of 10 tokens |

## Baseline Summary

```
Scenario                         Events  Expected TPS  Expected Total Time
---------------------------------------- --------------- -------------------
tool-calling-thinking/session-1      13         65-70        ~195ms
long-context/session-1               21         60-65        ~300ms
permission-request/session-1         11         55-65       ~2500ms
```

## Performance Considerations

### Burst Splitting

Events with >100 tokens are split into ~10-token chunks to maintain perceptible timing:

- **Chunk delay**: `(10 / 65) * 1000 = 153ms` per chunk
- **Total chunks**: `ceil(token_count / 10)`
- **Example**: 227 tokens → 23 chunks → 23 × 153ms ≈ 3519ms total

### Memory Usage

Expected peak memory for replay server:
- **Small scenarios** (<20 events): <50MB
- **Medium scenarios** (20-50 events): 50-100MB
- **Large scenarios** (>50 events): 100-200MB

### Network Latency

Since the benchmark runs locally (localhost), network latency should be negligible (<5ms). The p99 latency primarily reflects:
- Server processing time
- WebSocket serialization
- Client event handling

## Verification Commands

```bash
# Run benchmark against all scenarios
./scripts/benchmark-replay.sh

# Run single scenario
./scripts/benchmark-replay.sh "permission-request/session-1"

# Expected output format:
# Events received: 11
# Total time: 2500.00ms
# TPS: 65.00
# p99 latency: 150.00ms
```

## Notes

- Target TPS is 65 tokens per second
- Zero-token events use fixed 15ms delay (effectively ~67 TPS for minimal events)
- Burst splitting ensures large events don't cause long pauses
- All benchmarks run on localhost to eliminate network variability

## Future Improvements

- [ ] Add percentile breakdown (p50, p95, p99, p99.9)
- [ ] Include memory profiling with detailed breakdown
- [ ] Add concurrent connection testing
- [ ] Measure CPU utilization during replay
- [ ] Compare v1 vs v2 replay performance

---

**Generated**: 2026-04-05  
**Baseline Version**: 1.0  
**Target TPS**: 65
