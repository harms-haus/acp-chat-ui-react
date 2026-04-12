# Coverage Guide

Guide to running, interpreting, and maintaining test coverage for ACP Chat React.

## Table of Contents

- [Running Coverage](#running-coverage)
- [Coverage Thresholds](#coverage-thresholds)
- [Understanding Reports](#understanding-reports)
- [HTML Report](#html-report)
- [Coverage Configuration](#coverage-configuration)
- [Best Practices](#best-practices)

---

## Running Coverage

### Quick Start

Run coverage locally with:

```bash
# From project root
pnpm test-react:coverage

# From package directory
cd packages/acp-chat-react
pnpm test:coverage
```

### What Happens

When you run coverage:

1. All tests in `src/**/*.test.ts`, `src/**/*.test.tsx`, `src/**/*.spec.ts`, and `src/**/*.spec.tsx` execute
2. Vitest's v8 coverage provider tracks which lines and branches are executed
3. Reports are generated in multiple formats
4. Thresholds are checked (coverage fails if thresholds not met)

### Expected Output

```
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   82.45 |    76.32 |   88.24 |   82.45 |                   
 src               |     100 |      100 |     100 |     100 |                   
  index.ts         |     100 |      100 |     100 |     100 |                   
 src/components    |   85.67 |    78.45 |   90.12 |   85.67 |                   
  Composer.tsx     |   88.23 |    80.12 |   92.31 |   88.23 | 145-152,201-210   
  MessageCard.tsx  |   83.45 |    76.89 |   88.46 |   83.45 | 89-95,134-142     
-------------------|---------|----------|---------|---------|-------------------
```

---

## Coverage Thresholds

### Required Thresholds

ACP Chat React enforces minimum coverage thresholds:

| Metric | Threshold | Description |
|--------|-----------|-------------|
| **Lines** | 80% | At least 80% of executable lines must be tested |
| **Branches** | 75% | At least 75% of decision branches must be covered |

### Why These Thresholds

**Lines (80%):**
- Ensures most code paths are executed by tests
- Allows some flexibility for edge cases and defensive code
- Industry standard for well-tested codebases

**Branches (75%):**
- Tests decision points (if/else, switch, ternary)
- Lower threshold acknowledges some branches are error handling
- Still requires testing of main logical flows

### What Happens If Thresholds Fail

If coverage falls below thresholds, the test command fails:

```
❌ Coverage threshold not met
  Lines: 78% (required: 80%)
  Branches: 72% (required: 75%)

Test run failed. Increase test coverage before merging.
```

### Fixing Coverage Failures

1. Check the uncovered line numbers in the terminal output
2. Identify which code paths are missing tests
3. Add tests that exercise those paths
4. Re-run coverage to verify improvement

Example:
```
Uncovered Line #s: 145-152,201-210
```

Add tests that hit lines 145-152 and 201-210 in the reported file.

---

## Understanding Reports

### Coverage Metrics Explained

**Lines:**
- Percentage of executable lines that ran during tests
- Counts each line of code (excluding comments, imports)
- Example: 80/100 lines executed = 80%

**Branches:**
- Percentage of decision branches taken during tests
- Counts both sides of if/else, switch cases, ternary operators
- Example: if you have `if (x) { } else { }`, both paths need tests

**Functions:**
- Percentage of functions that were called
- A function is "covered" if it was invoked at least once

**Statements:**
- Similar to lines, but counts individual statements
- Often matches lines percentage in TypeScript/JavaScript

### Reading the Coverage Table

```
File            | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
----------------|---------|----------|---------|---------|-------------------
Composer.tsx    |   88.23 |    80.12 |   92.31 |   88.23 | 145-152,201-210   
```

- **% Stmts**: 88.23% of statements executed
- **% Branch**: 80.12% of branches covered
- **% Funcs**: 92.31% of functions called
- **% Lines**: 88.23% of lines executed
- **Uncovered Line #s**: Lines NOT hit by tests

### Focus on Uncovered Lines

The "Uncovered Line #s" column shows exactly what needs tests:

```
Uncovered Line #s: 145-152,201-210
```

This means:
- Lines 145 through 152 are not tested
- Lines 201 through 210 are not tested
- Write tests that execute these specific lines

---

## HTML Report

### Viewing HTML Report

After running coverage, open the HTML report:

```bash
# Open in default browser
open packages/acp-chat-react/coverage/index.html

# Or navigate in file browser
# File: /packages/acp-chat-react/coverage/index.html
```

### What the HTML Report Shows

The HTML report provides:

1. **Interactive file tree** - Click through directories and files
2. **Color-coded coverage** - Green (high), yellow (medium), red (low)
3. **Line-by-line coverage** - See exactly which lines are covered
4. **Branch coverage** - Visual indicators for if/else branches
5. **Function coverage** - See which functions are called

### Navigating the Report

**Main page:**
- Shows all files with coverage percentages
- Color-coded rows (green = good, red = needs work)
- Click any file to see details

**File detail page:**
- Shows source code with coverage highlighting
- Green lines = executed by tests
- Red lines = NOT executed
- Yellow lines = partially covered (some branches)

**Example:**
```typescript
  140 |   const handleSubmit = () => {
  141 |     if (!value.trim()) {     // ← Green (covered)
  142 |       return;                // ← Red (not covered)
  143 |     }                        // ← Green (covered)
  144 |     onSend(value);           // ← Green (covered)
  145 |   };                         // ← Green (covered)
```

Line 142 is red because the early return path isn't tested.

### Using the HTML Report for Debugging

1. Run `pnpm test-react:coverage`
2. Open `coverage/index.html`
3. Find files with low coverage (red/yellow rows)
4. Click to see line-by-line breakdown
5. Identify untested code paths
6. Write tests targeting those paths
7. Re-run and verify improvement

---

## Coverage Configuration

### vitest.config.ts

Coverage is configured in `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/*.spec.ts", "src/**/*.spec.tsx"],
    globals: true,
    environment: "jsdom",
    setupFiles: ["../../vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      thresholds: {
        lines: 80,
        branches: 75,
      },
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/**/*.spec.ts",
        "src/**/*.spec.tsx",
        "src/test-utils/**",
        "src/**/index.ts",
      ],
    },
  },
});
```

### Configuration Breakdown

**Provider:**
- `v8` - Uses Node's v8 coverage API (accurate, fast)

**Reporters:**
- `text` - Terminal output (shown after tests)
- `json` - Machine-readable format for CI/CD
- `html` - Interactive browser report
- `lcov` - Standard format for coverage services

**Thresholds:**
- `lines: 80` - Minimum 80% line coverage
- `branches: 75` - Minimum 75% branch coverage

**Include:**
- All TypeScript files in `src/`
- Both `.ts` and `.tsx` extensions

**Exclude:**
- Test files themselves (`*.test.ts`, `*.spec.ts`)
- Test utilities (`src/test-utils/**`)
- Barrel exports (`src/**/index.ts`)

### Report Locations

After running coverage:

```
packages/acp-chat-react/coverage/
├── coverage-summary.json    # Summary data
├── coverage-final.json      # Full coverage data
├── index.html               # HTML report (open this)
├── lcov.info                # LCOV format for CI
└── ...                      # Additional HTML assets
```

---

## Best Practices

### What to Test for Coverage

**DO test:**

- ✅ All public component rendering paths
- ✅ User interactions (clicks, keyboard, input)
- ✅ Different prop combinations
- ✅ Edge cases (empty states, loading, errors)
- ✅ Conditional rendering (if/else branches)
- ✅ Event handlers and callbacks
- ✅ State transitions

**DON'T worry about:**

- ❌ 100% coverage (diminishing returns)
- ❌ Test utilities (excluded from coverage)
- ❌ Type-only code (no runtime impact)
- ❌ Re-exported types (barrel files excluded)

### Writing Coverage-Focused Tests

When adding coverage for a new component:

1. **Render with different props**
   - Test each variant, size, state
   - Each prop combination may hit different branches

2. **Test all user interactions**
   - Clicks, keyboard, input changes
   - Each interaction may trigger different code paths

3. **Test conditional logic**
   - If component has `if (disabled)`, test both states
   - If there's a switch, test multiple cases

4. **Test error states**
   - Error boundaries
   - Failed operations
   - Empty data

### Example: Testing Branches

```typescript
// Component has this logic:
if (disabled) {
  return null;
}

if (isLoading) {
  return <Spinner />;
}

return <Button onClick={handleClick} />;

// Test all three branches:
it('returns null when disabled', () => {
  render(<Component disabled={true} />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('shows spinner when loading', () => {
  render(<Component disabled={false} isLoading={true} />);
  expect(screen.getByRole('status')).toBeInTheDocument();
});

it('shows button when ready', () => {
  render(<Component disabled={false} isLoading={false} />);
  expect(screen.getByRole('button')).toBeInTheDocument();
});
```

### CI/CD Integration

Coverage runs automatically in CI:

```yaml
# GitHub Actions example
- name: Run coverage
  run: pnpm test-react:coverage

# Coverage report uploaded as artifact
- name: Upload coverage
  uses: actions/upload-artifact@v4
  with:
    name: coverage-report
    path: packages/acp-chat-react/coverage/
```

### Maintaining Coverage

**Before merging:**
- Run `pnpm test-react:coverage` locally
- Verify thresholds pass
- Check HTML report for new uncovered lines

**When adding features:**
- Write tests alongside implementation
- Check coverage after each new feature
- Don't let uncovered lines accumulate

**When refactoring:**
- Ensure coverage stays the same or improves
- Refactoring shouldn't reduce test coverage
- Update tests if API changes

---

## Troubleshooting

### Coverage Lower After Refactor

If coverage drops after refactoring:

1. Check if new code paths were added
2. Verify tests still match new structure
3. Add tests for any new branches
4. Ensure logic is equivalent to before

### False Low Coverage

Sometimes coverage appears low incorrectly:

- **TypeScript types**: Type-only code has no runtime, ignored
- **Dead code**: Remove code that's never executed
- **Import re-exports**: Barrel files excluded by default

### Tests Pass But Coverage Fails

This means:
- All tests pass ✅
- But not all code is executed ❌
- Add more comprehensive test scenarios

---

## Quick Reference

### Commands

```bash
# Run coverage
pnpm test-react:coverage

# Open HTML report
open packages/acp-chat-react/coverage/index.html
```

### Thresholds

| Metric | Minimum |
|--------|---------|
| Lines | 80% |
| Branches | 75% |

### Report Files

- HTML: `packages/acp-chat-react/coverage/index.html`
- JSON: `packages/acp-chat-react/coverage/coverage-summary.json`
- LCOV: `packages/acp-chat-react/coverage/lcov.info`

### Configuration File

`packages/acp-chat-react/vitest.config.ts`

---

## Related Documentation

- [Component Testing Guide](./component-testing.md) - How to write tests
- [README.md](../README.md) - Package overview
