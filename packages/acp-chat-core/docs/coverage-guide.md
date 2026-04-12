# Coverage Reporting Guide

This guide documents how to run, interpret, and improve test coverage for the `@harms-haus/acp-chat-core` package.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Coverage Commands](#coverage-commands)
- [Configuration](#configuration)
- [Understanding Thresholds](#understanding-thresholds)
- [Interpreting Reports](#interpreting-reports)
- [Improving Coverage](#improving-coverage)
- [CI Integration](#ci-integration)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

```bash
# Run tests with coverage
pnpm vitest run --coverage

# View HTML report
open packages/acp-chat-core/coverage/index.html
```

---

## Coverage Commands

### Basic Commands

```bash
# Run all tests with coverage collection
pnpm vitest run --coverage

# Run tests for acp-chat-core package only
pnpm vitest run --filter=acp-chat-core --coverage

# Run specific test file with coverage
pnpm vitest run packages/acp-chat-core/src/session/controller.test.ts --coverage

# Watch mode with coverage (development)
pnpm vitest --coverage
```

### Report-Specific Commands

Coverage report formats are configured via `coverage.reporter` in `vitest.config.ts`. The `--reporter` CLI flag only affects test output (e.g., verbose), NOT coverage outputs.

```bash
# Generate coverage - all configured formats are generated
pnpm vitest run --coverage

# Change test output format (not coverage)
pnpm vitest run --coverage --reporter=verbose

# Watch mode with coverage (development)
pnpm vitest --coverage
```

To change which coverage reports are generated, edit `vitest.config.ts`:

```typescript
coverage: {
  reporter: ['text', 'json', 'html', 'lcov'], // Add/remove formats here
}
```

### Threshold Enforcement

```bash
# Run tests and fail if coverage thresholds not met
pnpm vitest run --coverage --coverage.thresholds.autoUpdate=false

# Update threshold baselines (use sparingly)
pnpm vitest run --coverage --coverage.thresholds.autoUpdate=true
```

### Combined Workflows

```bash
# Full test suite with coverage and type checking
pnpm check && pnpm vitest run --coverage

# Test specific module with coverage
cd packages/acp-chat-core && pnpm vitest run src/transport/client.test.ts --coverage
```

---

## Configuration

Coverage is configured in `packages/acp-chat-core/vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      thresholds: {
        lines: 80,
        branches: 75,
        functions: 80,
      },
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/**/*.spec.ts",
        "src/**/*.spec.tsx",
      ],
    },
  },
});
```

### Configuration Details

| Property | Value | Purpose |
|----------|-------|---------|
| `provider` | `v8` | Uses Node.js v8 native coverage (faster, more accurate than Istanbul) |
| `reporter` | `text, json, html, lcov` | Generates multiple report formats |
| `thresholds.lines` | `80` | Minimum 80% line coverage required |
| `thresholds.branches` | `75` | Minimum 75% branch coverage required |
| `thresholds.functions` | `80` | Minimum 80% function coverage required |
| `include` | `src/**/*.ts` | Only instrument TypeScript source files |
| `exclude` | `**/*.test.ts, **/*.spec.ts` | Exclude test files from coverage |

### Output Locations

Reports are generated in `packages/acp-chat-core/coverage/`:

```
packages/acp-chat-core/coverage/
├── coverage-summary.json    # JSON summary
├── coverage-final.json      # Detailed JSON coverage
├── index.html               # HTML report (open in browser)
└── lcov.info                # LCOV format for CI tools
```

---

## Understanding Thresholds

### Why These Thresholds?

| Metric | Threshold | Rationale |
|--------|-----------|-----------|
| **Lines** | 80% | Ensures most code is executed by tests. 100% is impractical (boilerplate, type guards). |
| **Branches** | 75% | Tests most conditional paths. Some branches are error-only or edge cases. |
| **Functions** | 80% | Most functions should be called in tests. Private helpers may not need direct testing. |

### What Counts as Covered

**Lines:**
- A line is covered if it's executed during test runs
- Comments, imports, and type-only lines are excluded
- Empty lines don't count

**Branches:**
- Each `if`, `else`, `else if`, `switch case`, ternary `? :`, and logical `&&`, `||` creates branches
- Both true and false paths must be tested for full branch coverage

**Functions:**
- A function is covered if it's called at least once
- Arrow functions, methods, and named functions all count

### What's NOT Covered

```typescript
// Type-only code (no runtime cost)
interface User {
  id: string;
  name: string;
}

// Type annotations
function greet(user: User): string {
  return `Hello, ${user.name}`;
}

// Imports
import { SessionController } from "./session/controller";
```

---

## Interpreting Reports

### Text Report (Terminal Output)

Example:
```
----------|---------|----------|---------|---------|-------------------
File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
----------|---------|----------|---------|---------|-------------------
All files |   82.45 |    76.32 |   81.09 |   83.12 |
----------|---------|----------|---------|---------|-------------------
controller.ts    |   85.20 |    78.50 |   88.24 |   86.11 | 45-48, 102-105
parser.ts        |   95.00 |    92.00 |   90.00 |   94.74 | 23
----------|---------|----------|---------|---------|-------------------
```

**Columns:**
- `% Stmts`: Statement coverage (similar to lines)
- `% Branch`: Branch coverage
- `% Funcs`: Function coverage
- `% Lines`: Line coverage (primary metric)
- `Uncovered Line #s`: Specific lines not covered

**Key Actions:**
- Check if all files meet thresholds (80/75/80)
- Focus on files with low coverage first
- Note uncovered line numbers for targeted test writing

### HTML Report (Browser)

Open `packages/acp-chat-core/coverage/index.html` in your browser.

**Features:**
- **File tree**: Navigate package structure
- **Color coding**:
  - Green: Covered lines
  - Red: Uncovered lines
  - Yellow: Partially covered branches
- **Click to expand**: See uncovered lines inline
- **Search**: Find specific files or functions

**How to Use:**
1. Open `index.html` in browser
2. Click on a file (e.g., `controller.ts`)
3. Review highlighted source code
4. Red lines = write tests for these paths
5. Yellow highlighting = test both branch outcomes

**Example View:**
```typescript
export class SessionController {
  // Green = covered
  async connect(url: string) {
    this.transport = new TransportClient(url);
    await this.transport.connect();
  }

  // Red = NOT covered (write a test!)
  async disconnect() {
    if (this.transport) {
      await this.transport.disconnect();
    }
  }
}
```

### JSON Report

Location: `packages/acp-chat-core/coverage/coverage-summary.json`

```json
{
  "total": {
    "lines": { "total": 1250, "covered": 1025, "pct": 82 },
    "branches": { "total": 340, "covered": 259, "pct": 76.18 },
    "functions": { "total": 180, "covered": 145, "pct": 80.56 }
  },
  "files": {
    "controller.ts": {
      "lines": { "total": 300, "covered": 255, "pct": 85 },
      "branches": { "total": 80, "covered": 62, "pct": 77.5 }
    }
  }
}
```

**Use Cases:**
- Parse in scripts for custom reporting
- Track coverage trends over time
- Integrate with custom dashboards

### LCOV Report

Location: `packages/acp-chat-core/coverage/lcov.info`

**Format:**
```
TN:
SF:src/session/controller.ts
FN:1,SessionController.connect
FN:15,SessionController.disconnect
FNDA:10,SessionController.connect
FNDA:0,SessionController.disconnect
FNF:2
FNH:1
```

**Use Cases:**
- Upload to Codecov, Coveralls, or other CI services
- Generate badges for README
- Historical tracking

---

## Improving Coverage

### Strategy 1: Target Low-Hanging Fruit

Start with files just below thresholds:

```bash
# Read coverage-summary.json and filter entries <80%
cat packages/acp-chat-core/coverage/coverage-summary.json | \
  jq '.total | to_entries[] | select(.value.lines.pct < 80)'

# Or use the text summary output from vitest
pnpm vitest run --coverage --reporter=default 2>&1 | grep -E '<80%'
```

**Quick Wins:**
- Add simple happy-path tests
- Test exported functions first
- Cover error handling paths

### Strategy 2: Focus on Critical Paths

Prioritize core functionality:

1. **Session lifecycle**: `connect`, `disconnect`, `initialize`
2. **Prompt handling**: `sendPrompt`, `cancelPrompt`
3. **Event emission**: Status changes, session updates
4. **Error scenarios**: Network failures, parse errors

**Example:**
```typescript
// If this is uncovered (red):
async cancelPrompt(): Promise<void> {
  if (!this.activePrompt) {
    throw new Error("No active prompt");
  }
  await this.transport.send({ method: "session/cancel" });
}

// Write this test:
test("cancelPrompt throws when no active prompt", async () => {
  await expect(controller.cancelPrompt()).rejects.toThrow("No active prompt");
});
```

### Strategy 3: Test Edge Cases

Branch coverage often requires testing edge cases:

```typescript
// Code with multiple branches
function shouldRetry(error: Error): boolean {
  if (error.name === "NetworkError") return true;
  if (error.name === "TimeoutError") return true;
  if (error.message.includes("ECONNREFUSED")) return true;
  return false;
}

// Test ALL branches:
test("retries on NetworkError", () => {
  expect(shouldRetry(new NetworkError())).toBe(true);
});

test("retries on TimeoutError", () => {
  expect(shouldRetry(new TimeoutError())).toBe(true);
});

test("retries on ECONNREFUSED", () => {
  expect(shouldRetry(new Error("ECONNREFUSED"))).toBe(true);
});

test("does not retry on other errors", () => {
  expect(shouldRetry(new Error("Generic"))).toBe(false);
});
```

### Strategy 4: Use Parametrized Tests

Efficient way to cover multiple scenarios:

```typescript
import { describe, it, expect } from "vitest";

describe("parseLaunchPreset", () => {
  const testCases = [
    { env: { ACP_CMD: "node server.js" }, valid: true },
    { env: { ACP_CMD: "" }, valid: false },
    { env: {}, valid: false },
    { env: { ACP_CMD: "npm start", ACP_CWD: "/workspace" }, valid: true },
  ];

  it.each(testCases)("handles env: %j", ({ env, valid }) => {
    const result = parseLaunchPreset(env as any);
    expect(result.isValid).toBe(valid);
  });
});
```

### Strategy 5: Mock External Dependencies

Isolate code under test:

```typescript
import { vi } from "vitest";

// Mock TransportClient
vi.mock("../transport/client", () => ({
  TransportClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn(),
  })),
}));

test("connect initializes transport", async () => {
  const controller = new SessionController();
  await controller.connect("ws://localhost");
  // Test your code, not WebSocket internals
});
```

### What NOT to Do

❌ **Don't chase 100% coverage:**
```typescript
// Don't write tests for obvious getters
test("getId returns id", () => {
  expect(user.getId()).toBe(user.id); // Waste of time
});
```

❌ **Don't test implementation details:**
```typescript
// Don't test private methods directly
test("_validateInput works", () => {
  // This couples test to implementation
});

// DO test public behavior
test("invalid input throws error", () => {
  expect(() => controller.sendPrompt("")).toThrow();
});
```

❌ **Don't ignore failing tests:**
```typescript
// Never do this:
test.skip("should handle network errors", () => {
  // ...
});
```

### Coverage Improvement Checklist

- [ ] Identify files below 80% line coverage
- [ ] Check branch coverage gaps (look for uncovered `if`/`else`)
- [ ] Write tests for exported public APIs first
- [ ] Add error scenario tests
- [ ] Test edge cases (empty input, null values, boundary conditions)
- [ ] Use parametrized tests for efficiency
- [ ] Mock external dependencies (WebSocket, filesystem)
- [ ] Re-run coverage after each batch of tests
- [ ] Update documentation if API changes

---

## CI Integration

### GitHub Actions Example

```yaml
name: Test & Coverage

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"

      - run: pnpm install

      - name: Run tests with coverage
        run: pnpm vitest run --coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: packages/acp-chat-core/coverage/lcov.info
          flags: acp-chat-core
          name: acp-chat-core-coverage
          fail_ci_if_error: false  # Don't fail PR on upload issues
```

### Threshold Enforcement in CI

Add to `vitest.config.ts`:

```typescript
coverage: {
  thresholds: {
    lines: 80,
    branches: 75,
    functions: 80,
    // Auto-update thresholds (use with caution)
    autoUpdate: false,
  },
}
```

### Coverage Badges

Add to README.md:

```markdown
[![Coverage](https://img.shields.io/badge/coverage-82%25-green.svg)](packages/acp-chat-core/coverage/index.html)
```

Generate dynamic badges with services like:
- [Codecov](https://codecov.io/)
- [Coveralls](https://coveralls.io/)
- [Shields.io](https://shields.io/)

### Monitoring Coverage Trends

Track coverage over time:

```bash
# Extract coverage percentage
coverage=$(cat packages/acp-chat-core/coverage/coverage-summary.json | jq '.total.lines.pct')
echo "Current coverage: $coverage%"

# Compare with previous (store in file)
previous=$(cat .coverage-previous.txt)
if (( $(echo "$coverage < $previous" | bc -l) )); then
  echo "Coverage decreased from $previous% to $coverage%"
  exit 1
fi
echo "$coverage" > .coverage-previous.txt
```

---

## Troubleshooting

### Issue: Coverage Shows 0%

**Causes:**
- Tests not running (check test discovery)
- Wrong `include` pattern in config
- Files excluded by mistake

**Fix:**
```bash
# Verify tests are running
pnpm vitest run --reporter=verbose

# Check config include patterns
grep -A3 "include:" packages/acp-chat-core/vitest.config.ts

# Ensure source files match pattern
ls src/**/*.ts
```

### Issue: Thresholds Not Enforced

**Cause:** Vitest may not fail on threshold violations by default.

**Fix:**
```typescript
// Add to vitest.config.ts
coverage: {
  thresholds: {
    lines: 80,
    branches: 75,
    functions: 80,
    // This makes CI fail on threshold violation
    perFile: true, // Enforce per file, not just overall
  },
}
```

### Issue: Test Files Included in Coverage

**Cause:** `exclude` pattern not matching test files.

**Fix:**
```typescript
coverage: {
  exclude: [
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/*.spec.ts",
    "**/*.spec.tsx",
    "**/__tests__/**",
  ],
}
```

### Issue: HTML Report Not Generating

**Cause:** Reporter not configured or output directory issue.

**Fix:**
```bash
# Ensure html reporter is enabled
pnpm vitest run --coverage --reporter=html

# Check output directory
ls packages/acp-chat-core/coverage/

# Try regenerating
rm -rf packages/acp-chat-core/coverage/
pnpm vitest run --coverage
```

### Issue: Branch Coverage Lower Than Expected

**Common Causes:**
- Untested error paths
- Missing `else` branch tests
- Ternary operators (`condition ? a : b`)
- Logical operators (`&&`, `||`)

**Debug:**
```bash
# View HTML report to see uncovered branches
open packages/acp-chat-core/coverage/index.html

# Look for yellow highlighting (partial branch coverage)
```

**Fix:**
```typescript
// If this has partial coverage:
if (user?.isAdmin) {
  grantAccess();
}

// Test BOTH branches:
test("grants access to admin", () => {
  checkAccess({ isAdmin: true });
  expect(grantAccess).toHaveBeenCalled();
});

test("denies access to non-admin", () => {
  checkAccess({ isAdmin: false });
  expect(grantAccess).not.toHaveBeenCalled();
});

test("handles undefined user", () => {
  checkAccess(undefined);
  expect(grantAccess).not.toHaveBeenCalled();
});
```

---

## Related Documentation

- [Testing Strategy Guide](../TESTING.md) - Overall testing philosophy
- [Unit Testing Patterns](./unit-testing-patterns.md) - How to write unit tests
- [Integration Testing Patterns](./integration-testing-patterns.md) - Replay-based testing
- [Vitest Coverage Docs](https://vitest.dev/guide/coverage.html) - Official documentation

---

**Last Updated:** April 2026  
**Package:** `@harms-haus/acp-chat-core`
