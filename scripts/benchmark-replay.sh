#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

RESULTS_FILE=$(mktemp)
trap 'rm -f "$RESULTS_FILE"; kill "$server_pid" 2>/dev/null || true' EXIT

SCENARIOS=(
    "tool-calling-thinking/session-1"
    "long-context/session-1"
    "permission-request/session-1"
)

if [ $# -gt 0 ]; then
    SCENARIOS=("$@")
fi

echo "=== v2 Replay Performance Benchmark ==="
echo "Target TPS: 65 (token-based timing)"
echo ""

for scenario in "${SCENARIOS[@]}"; do
    demo_type="${scenario%/*}"
    session_id="${scenario#*/}"
    
    echo "----------------------------------------"
    echo "Scenario: $demo_type/$session_id"
    echo "----------------------------------------"
    
  data_path="$ROOT_DIR/fixtures/replay-data/$demo_type/$session_id"
  if [ ! -d "$data_path" ]; then
    echo "ERROR: Replay data not found"
    continue
  fi

  events_file="$data_path/replay-events.jsonl"
  if [ ! -f "$events_file" ]; then
    echo "ERROR: replay-events.jsonl not found at $events_file"
    continue
  fi

  event_count=$(wc -l < "$events_file")
  echo "Event count: $event_count"

  port=$((8765 + RANDOM % 100))
  echo "Starting server on port $port..."

  RUST_LOG=error cargo run --manifest-path crates/acp-bridge/Cargo.toml --bin acp-bridge -- replay-v2 --addr "127.0.0.1:$port" --demo-type "$demo_type" --session-id "$session_id" > /dev/null 2>&1 &
  server_pid=$!
    
    sleep 3
    
    echo "Running client..."
    client_output=$(timeout 45 node "$SCRIPT_DIR/benchmark-client.js" "$port" "$demo_type" "$session_id" "$event_count" 2>&1) || true
    
    kill $server_pid 2>/dev/null || true
    wait $server_pid 2>/dev/null || true
    
    echo "$client_output"
    
    events=$(echo "$client_output" | grep "Events received:" | awk '{print $3}')
    total_time=$(echo "$client_output" | grep "Total time:" | awk '{print $3}')
    tps=$(echo "$client_output" | grep "TPS:" | awk '{print $2}')
    p99=$(echo "$client_output" | grep "p99 latency:" | awk '{print $3}')
    
    echo "$demo_type/$session_id|$events|$event_count|$total_time|$tps|$p99" >> "$RESULTS_FILE"
    echo ""
done

echo "========================================"
echo "SUMMARY"
echo "========================================"
printf "%-40s %10s %12s %10s %12s\n" "Scenario" "Events" "Time(ms)" "TPS" "p99(ms)"
printf "%-40s %10s %12s %10s %12s\n" "----------------------------------------" "----------" "------------" "----------" "------------"

while IFS='|' read -r scenario events event_total time tps p99; do
    printf "%-40s %10s %12s %10s %12s\n" "$scenario" "$events/$event_total" "$time" "$tps" "$p99"
done < "$RESULTS_FILE"
