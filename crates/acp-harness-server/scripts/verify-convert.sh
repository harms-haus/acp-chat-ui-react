#!/bin/bash
set -e

SCRIPT_PATH="$1"
OUTPUT_DIR="${2:-/tmp/verify-$(basename "$SCRIPT_PATH" .xml)-$$}"

echo "=== Verifying $SCRIPT_PATH ==="

if [ ! -f "$SCRIPT_PATH" ]; then
    echo "ERROR: Script file not found: $SCRIPT_PATH"
    exit 1
fi

./target/release/acp-bridge convert-script --script "$SCRIPT_PATH" --output "$OUTPUT_DIR" --force

if [ ! -f "$OUTPUT_DIR/replay-events.jsonl" ]; then
    echo "ERROR: replay-events.jsonl not created"
    exit 1
fi
echo "✓ replay-events.jsonl created"

while IFS= read -r line; do
    if ! echo "$line" | python3 -m json.tool > /dev/null 2>&1; then
        echo "ERROR: Invalid JSON"
        exit 1
    fi
done < "$OUTPUT_DIR/replay-events.jsonl"
echo "✓ All lines are valid JSON"

python3 -m json.tool "$OUTPUT_DIR/manifest.json" > /dev/null
echo "✓ manifest.json is valid"

EVENT_COUNT=$(wc -l < "$OUTPUT_DIR/replay-events.jsonl")
echo "✓ Generated $EVENT_COUNT events"

rm -rf "$OUTPUT_DIR"
echo "=== Verification PASSED ==="
