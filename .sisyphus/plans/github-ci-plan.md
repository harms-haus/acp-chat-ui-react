# GitHub Actions CI/CD Plan

## TL;DR

> **Quick Summary**: Design a comprehensive GitHub Actions CI/CD pipeline for a pnpm monorepo that runs all tests (unit, integration, visual regression), validates bundle sizes, performs publish dry-runs with debug info checks, and ensures release readiness.
>
> **Deliverables**: 
> - `.github/workflows/ci.yml` - PR checks workflow
> - `.github/workflows/release.yml` - Release workflow with dry-run validation
> - `scripts/publish-check.ts` - Debug info validation script
> - Updated `package.json` files with proper `files` fields
> - `LICENSE` file (MIT)
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - Multi-job parallel workflow
> **Critical Path**: Setup → Test → Build → Bundle Check → Publish Dry-Run

---

## Context

### Original Request
User wants to design a CI plan for GitHub that:
1. Runs all tests (unit, integration, visual)
2. Performs a dry-run of the publish process
3. Double-checks release files for debug info and other artifacts

### Project Structure
**Monorepo**: pnpm workspace with 5 npm packages + 2 Rust crates

**NPM Packages (3 publishable):**
- `@harms-haus/acp-chat-core` - Framework-agnostic ACP library (tsc build)
- `@harms-haus/acp-chat-react` - React UI components (Vite build)
- `@harms-haus/acp-ws-bridge` - WebSocket bridge (tsc build)

**Private packages:**
- `@harms-haus/acp-harness-ui` - Dev harness with Playwright tests
- `@harms-haus/integration-tests` - Integration tests

**Rust crates:**
- `acp-ws-bridge` - Production WebSocket bridge
- `acp-harness-server` - Harness server

### Testing Infrastructure
- **Unit/Integration**: Vitest v2.1.0 with coverage (80% lines, 75% branches, 80% functions)
- **Visual Regression**: Playwright v1.51.1 (Chrome, 1280x720)
- **Performance**: Custom perf-runner.ts with budget thresholds
- **Bundle**: Custom bundle-check.ts with size budgets (core: 60KB, react: 120KB gzip)

### Build Configuration
- **TypeScript**: v5.7.0, ES2022 target, bundler module resolution
- **acp-chat-core**: `tsc -p tsconfig.build.json` → `dist/`
- **acp-chat-react**: Vite 6.0.0 with vite-plugin-dts → `dist/`
- **acp-ws-bridge**: `tsc -p tsconfig.build.json` → `dist/`

### Publishing Issues Identified
1. **No LICENSE file** - Packages claim MIT but no LICENSE exists
2. **Test files in dist/** - acp-chat-react includes `*.test.d.ts` files
3. **Missing `files` field** - core and ws-bridge lack file filters
4. **No `.npmrc`** - No registry/auth configuration
5. **No `publishConfig`** - No registry specification
6. **workspace:* deps** - Need resolution for publishing

---

## Work Objectives

### Core Objective
Create production-ready GitHub Actions CI/CD workflows that validate the entire development lifecycle from code quality to release readiness, with special focus on detecting debug artifacts in release files.

### Concrete Deliverables
1. **`.github/workflows/ci.yml`** - Comprehensive PR checks workflow
2. **`.github/workflows/release.yml`** - Release validation and dry-run workflow
3. **`scripts/publish-check.ts`** - Script to validate release artifacts
4. **`LICENSE`** - MIT license file at root
5. **Updated `package.json` files** - Add `files` fields and `publishConfig`
6. **`.npmrc`** - NPM registry configuration

### Definition of Done
- [ ] CI runs all tests (unit, integration, visual) on every PR
- [ ] CI validates bundle sizes against budgets
- [ ] CI performs publish dry-run with artifact inspection
- [ ] CI detects debug info in release files (source maps, test files, dev code)
- [ ] CI runs Rust tests for WebSocket bridge
- [ ] Release workflow validates all packages before actual publish

### Must Have
1. Parallel job execution for speed
2. Comprehensive test coverage validation
3. Bundle size enforcement with budgets
4. Publish dry-run with tarball inspection
5. Debug artifact detection (source maps, test files, console.logs)
6. Multi-Node version testing (20.x, 22.x)
7. Rust toolchain for bridge tests

### Must NOT Have (Guardrails)
- NO automatic publishing to npm (manual gate required)
- NO deployment on PR (only on main/release branches)
- NO skipping tests based on file paths (all tests always run)
- NO debug artifacts in published packages

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES - Vitest + Playwright + Custom scripts
- **Automated tests**: YES (Existing) - Tests run via `pnpm test`, `pnpm test:visual`
- **Framework**: Vitest v2.1.0 + Playwright v1.51.1
- **Coverage**: `@vitest/coverage-v8` with thresholds

### QA Policy
Every task MUST include agent-executed QA scenarios. Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

**Verification Methods:**
- **Workflows**: Use `act` tool or validate YAML syntax + GitHub Actions schema
- **Scripts**: Use `bun` or `node --experimental-strip-types` to execute
- **Package validation**: Use `npm pack --dry-run` and inspect tarball

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately - Setup & Dependencies):
├── Task 1: Create .github/workflows directory structure
├── Task 2: Create LICENSE file (MIT)
├── Task 3: Create .npmrc configuration
├── Task 4: Update package.json files with files field
└── Task 5: Create publish-check.ts script

Wave 2 (After Wave 1 - CI Workflow):
├── Task 6: Create ci.yml - Setup job
├── Task 7: Create ci.yml - Test job (unit/integration)
├── Task 8: Create ci.yml - Visual regression job
├── Task 9: Create ci.yml - Bundle check job
└── Task 10: Create ci.yml - Rust test job

Wave 3 (After Wave 2 - Release Workflow & Validation):
├── Task 11: Create release.yml - Dry-run job
├── Task 12: Create release.yml - Publish validation job
└── Task 13: Validate workflows with schema check

Wave FINAL (After ALL tasks):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
└── Task F3: Real manual QA (unspecified-high)
-> Present results -> Get explicit user okay
```

### Dependency Matrix

- **1-5**: - - 6-10, 1
- **6-10**: 1-5 - 11-13, 2
- **11-13**: 6-10 - F1-F3, 3
- **F1-F3**: 11-13 - User okay, 4

### Agent Dispatch Summary

- **1**: **5** - All tasks → `quick` (setup tasks)
- **2**: **5** - T6 → `quick`, T7 → `quick`, T8 → `quick`, T9 → `quick`, T10 → `quick`
- **3**: **3** - T11 → `quick`, T12 → `quick`, T13 → `quick`
- **4**: **3** - All verification → `oracle`, `unspecified-high`

---

## TODOs

- [x] 1. Create .github/workflows directory

  **What to do**:
  - Create `.github/` directory at project root
  - Create `.github/workflows/` subdirectory
  - Verify directory structure is correct

  **Must NOT do**:
  - Create any files inside the directory yet (separate tasks)
  - Change any existing code

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Justification: Simple directory creation task

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 6-13
  - **Blocked By**: None

  **References**:
  - None needed

  **Acceptance Criteria**:
  - [ ] Directory `.github/workflows/` exists
  - [ ] `ls -la .github/workflows` shows empty directory

  **QA Scenarios**:
  ```
  Scenario: Directory structure created
    Tool: Bash
    Preconditions: None
    Steps:
      1. Run: ls -la .github/
      2. Run: ls -la .github/workflows/
    Expected Result: Both directories exist, workflows/ is empty
    Evidence: .sisyphus/evidence/task-1-directory-structure.txt
  ```

  **Commit**: YES
  - Message: `chore(ci): create GitHub workflows directory`
  - Files: `.github/workflows/.gitkeep` (to track empty dir)

---

- [x] 2. Create LICENSE file (MIT)

  **What to do**:
  - Create `LICENSE` file at project root
  - Use standard MIT license text
  - Update copyright year to 2026
  - Update copyright holder to match package.json author

  **Must NOT do**:
  - Use any license other than MIT (already specified in package.json files)
  - Include additional clauses beyond standard MIT

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Justification: File creation with static content

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 12 (publish validation)
  - **Blocked By**: None

  **References**:
  - Pattern: Standard MIT license from https://opensource.org/licenses/MIT
  - Check: `packages/acp-chat-core/package.json` for author field

  **Acceptance Criteria**:
  - [ ] LICENSE file exists at root
  - [ ] File contains valid MIT license text
  - [ ] Copyright year is 2026
  - [ ] Copyright holder matches package.json

  **QA Scenarios**:
  ```
  Scenario: LICENSE file valid
    Tool: Bash
    Preconditions: None
    Steps:
      1. Run: cat LICENSE | head -5
      2. Run: grep -i "mit license" LICENSE
      3. Run: grep "2026" LICENSE
    Expected Result: MIT license text present, year 2026, author matches
    Evidence: .sisyphus/evidence/task-2-license.txt
  ```

  **Commit**: YES
  - Message: `chore: add MIT LICENSE file`
  - Files: `LICENSE`

---

- [x] 3. Create .npmrc configuration

  **What to do**:
  - Create `.npmrc` at project root
  - Configure for npmjs.org registry
  - Enable workspace protocol resolution
  - Set publish access to public for scoped packages

  **Must NOT do**:
  - Include authentication tokens (use GitHub secrets for CI)
  - Set strict engine to false (keep engine checks)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Justification: Configuration file creation

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 11-12
  - **Blocked By**: None

  **References**:
  - Pattern: Standard pnpm monorepo .npmrc
  - See: pnpm documentation for workspace protocol

  **Content**:
  ```ini
  # NPM Registry Configuration
  registry=https://registry.npmjs.org/
  
  # Workspace protocol resolution
  link-workspace-packages=true
  
  # Scoped package access
  access=public
  
  # Save exact versions
  save-exact=true
  
  # Engine checks
  engine-strict=true
  ```

  **Acceptance Criteria**:
  - [ ] .npmrc file exists at root
  - [ ] Registry points to npmjs.org
  - [ ] Workspace linking enabled
  - [ ] Access set to public

  **QA Scenarios**:
  ```
  Scenario: NPM config valid
    Tool: Bash
    Preconditions: None
    Steps:
      1. Run: cat .npmrc
      2. Run: grep "registry=https://registry.npmjs.org" .npmrc
    Expected Result: Registry correctly configured
    Evidence: .sisyphus/evidence/task-3-npmrc.txt
  ```

  **Commit**: YES
  - Message: `chore: add .npmrc configuration`
  - Files: `.npmrc`

---

- [x] 4. Update package.json files with files field

  **What to do**:
  - Update `packages/acp-chat-core/package.json`:
    - Add `"files": ["dist", "LICENSE", "README.md"]`
    - Add `"publishConfig": { "access": "public", "registry": "https://registry.npmjs.org/" }`
  - Update `packages/acp-ws-bridge/package.json`:
    - Add same files and publishConfig
  - Verify `packages/acp-chat-react/package.json` already has files field
  - Keep existing files field in acp-chat-react but verify it excludes test files

  **Must NOT do**:
  - Modify private packages (acp-harness-ui, integration-tests)
  - Remove existing configuration
  - Change version numbers

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Justification: JSON editing for configuration

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 11-12
  - **Blocked By**: Task 2 (LICENSE must exist first)

  **References**:
  - See: `packages/acp-chat-react/package.json` for files pattern reference
  - Pattern: `"files": ["dist", "LICENSE", "README.md"]`

  **Acceptance Criteria**:
  - [ ] acp-chat-core has files field
  - [ ] acp-chat-core has publishConfig
  - [ ] acp-ws-bridge has files field
  - [ ] acp-ws-bridge has publishConfig
  - [ ] acp-chat-react files field excludes tests properly

  **QA Scenarios**:
  ```
  Scenario: Package configs updated
    Tool: Bash
    Preconditions: LICENSE exists
    Steps:
      1. Run: cat packages/acp-chat-core/package.json | jq '.files'
      2. Run: cat packages/acp-ws-bridge/package.json | jq '.files'
      3. Run: cat packages/acp-chat-core/package.json | jq '.publishConfig'
    Expected Result: All fields present and correctly configured
    Evidence: .sisyphus/evidence/task-4-package-json.txt
  ```

  **Commit**: YES
  - Message: `chore: add files and publishConfig to packages`
  - Files: `packages/acp-chat-core/package.json`, `packages/acp-ws-bridge/package.json`

---

---

- [x] 5. Create publish-check.ts script

  **What to do**:
  - Create `scripts/publish-check.ts` script
  - Script validates release artifacts for debug info:
    - Detect source maps (*.js.map, *.d.ts.map) in dist/
    - Detect test files (*.test.*, *.spec.*) in dist/
    - Detect console.log statements in compiled JS
    - Detect development-only code (process.env.NODE_ENV checks for dev)
    - Validate exports match actual dist files
    - Check workspace:* dependencies are resolved
  - Script runs `npm pack --dry-run` and analyzes tarball
  - Returns exit code 0 on success, 1 on failure with detailed report

  **Must NOT do**:
  - Delete or modify any files
  - Actually publish packages
  - Skip validation steps

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Justification: TypeScript script development

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 12
  - **Blocked By**: None

  **Script Features**:
  ```typescript
  interface CheckResult {
    package: string;
    passed: boolean;
    issues: string[];
    tarballContents: string[];
  }
  
  // Checks to implement:
  // 1. Source map detection: *.map files in dist/
  // 2. Test file detection: *.test.*, *.spec.* in dist/
  // 3. Debug code detection: console.log, debugger; statements
  // 4. Dev code detection: process.env.NODE_ENV !== 'production'
  // 5. Export validation: package.json exports point to existing files
  // 6. Workspace deps: ensure no workspace:* in published package
  // 7. License check: LICENSE file included in tarball
  // 8. README check: README.md included
  ```

  **Acceptance Criteria**:
  - [ ] Script exists at scripts/publish-check.ts
  - [ ] Script runs without errors: `bun scripts/publish-check.ts`
  - [ ] Script detects source maps in dist/
  - [ ] Script detects test files in dist/
  - [ ] Script runs npm pack --dry-run for each package
  - [ ] Script outputs detailed report

  **QA Scenarios**:
  ```
  Scenario: Script detects debug artifacts
    Tool: Bash
    Preconditions: dist/ exists with some build artifacts
    Steps:
      1. Run: bun scripts/publish-check.ts
      2. Verify output mentions checking for source maps
      3. Verify output mentions checking for test files
      4. Verify output mentions checking for console.log
    Expected Result: Script runs all checks and reports findings
    Evidence: .sisyphus/evidence/task-5-publish-check.txt
  
  Scenario: Script validates tarball contents
    Tool: Bash
    Preconditions: dist/ exists
    Steps:
      1. Run: bun scripts/publish-check.ts --verbose
      2. Check output includes tarball file listing
      3. Verify LICENSE is mentioned as required file
    Expected Result: Script analyzes npm pack output
    Evidence: .sisyphus/evidence/task-5-tarball-check.txt
  ```

  **Commit**: YES
  - Message: `feat(ci): add publish-check script for release validation`
  - Files: `scripts/publish-check.ts`

---

- [x] 6. Create ci.yml - Setup job

  **What to do**:
  - Create `.github/workflows/ci.yml`
  - Implement setup job that:
    - Runs on ubuntu-latest
    - Uses actions/checkout@v4
    - Sets up pnpm with pnpm/action-setup@v2
    - Sets up Node.js (matrix: 20.x, 22.x) with actions/setup-node@v4
    - Installs dependencies with `pnpm install --frozen-lockfile`
    - Caches pnpm store for performance
    - Outputs Node version and pnpm version

  **Must NOT do**:
  - Run tests in setup job (separate jobs)
  - Use npm or yarn (use pnpm exclusively)
  - Skip lockfile validation

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Justification: GitHub Actions YAML creation

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 2 start)
  - **Parallel Group**: Wave 2
  - **Blocks**: Tasks 7-10
  - **Blocked By**: Task 1

  **Workflow Structure**:
  ```yaml
  name: CI
  on:
    push:
      branches: [main, master]
    pull_request:
      branches: [main, master]
  
  jobs:
    setup:
      runs-on: ubuntu-latest
      strategy:
        matrix:
          node-version: [20.x, 22.x]
      steps:
        - uses: actions/checkout@v4
        - uses: pnpm/action-setup@v2
          with:
            version: 9
        - uses: actions/setup-node@v4
          with:
            node-version: ${{ matrix.node-version }}
            cache: 'pnpm'
        - run: pnpm install --frozen-lockfile
        - run: pnpm --version
  ```

  **Acceptance Criteria**:
  - [ ] ci.yml file exists at .github/workflows/ci.yml
  - [ ] Workflow triggers on push/PR to main/master
  - [ ] Matrix strategy for Node 20.x and 22.x
  - [ ] Uses pnpm with frozen-lockfile
  - [ ] Has setup job defined

  **QA Scenarios**:
  ```
  Scenario: Workflow YAML valid
    Tool: Bash
    Preconditions: None
    Steps:
      1. Run: cat .github/workflows/ci.yml | head -50
      2. Verify YAML syntax with: yq eval '.name' .github/workflows/ci.yml
    Expected Result: Valid YAML, name is "CI"
    Evidence: .sisyphus/evidence/task-6-ci-setup.txt
  ```

  **Commit**: YES
  - Message: `feat(ci): add CI workflow setup job`
  - Files: `.github/workflows/ci.yml`

---

- [x] 7. Create ci.yml - Test job (unit/integration)

  **What to do**:
  - Add test job to ci.yml
  - Depends on setup job
  - Runs Vitest tests: `pnpm test`
  - Runs with coverage: `pnpm test:coverage`
  - Uploads coverage reports to Codecov or as artifacts
  - Fails if coverage thresholds not met (80% lines, 75% branches, 80% functions)
  - Tests all packages: core, react, ws-bridge

  **Must NOT do**:
  - Skip coverage reporting
  - Allow tests to pass below thresholds
  - Run only subset of tests

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Justification: GitHub Actions YAML editing

  **Parallelization**:
  - **Can Run In Parallel**: YES (depends on setup)
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: Task 6

  **Job Configuration**:
  ```yaml
  test:
    needs: setup
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20.x, 22.x]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
      - run: pnpm test:coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
  ```

  **Acceptance Criteria**:
  - [ ] Test job added to ci.yml
  - [ ] Job depends on setup
  - [ ] Runs `pnpm test` and `pnpm test:coverage`
  - [ ] Uploads coverage artifacts
  - [ ] Uses Node matrix (20.x, 22.x)

  **QA Scenarios**:
  ```
  Scenario: Test job defined
    Tool: Bash
    Preconditions: ci.yml exists
    Steps:
      1. Run: yq eval '.jobs.test' .github/workflows/ci.yml
      2. Verify "needs: setup" is present
      3. Verify "pnpm test" in steps
    Expected Result: Test job properly configured
    Evidence: .sisyphus/evidence/task-7-test-job.txt
  ```

  **Commit**: YES (grouped with task 6)
  - Message: `feat(ci): add test job to CI workflow`
  - Files: `.github/workflows/ci.yml`

---

- [x] 8. Create ci.yml - Visual regression job

  **What to do**:
  - Add visual-regression job to ci.yml
  - Depends on setup job
  - Sets up Playwright with `npx playwright install --with-deps`
  - Runs harness-ui tests: `pnpm test:visual`
  - Uploads screenshots on failure as artifacts
  - Uploads test results (junit.xml if available)

  **Must NOT do**:
  - Skip Playwright browser installation
  - Ignore test failures
  - Not upload artifacts on failure

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Justification: GitHub Actions YAML editing

  **Parallelization**:
  - **Can Run In Parallel**: YES (depends on setup)
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: Task 6

  **Job Configuration**:
  ```yaml
  visual-regression:
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: npx playwright install --with-deps
      - run: pnpm --filter @harms-haus/acp-harness-ui test:visual
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: visual-regression-screenshots
          path: packages/acp-harness-ui/test-results/
  ```

  **Acceptance Criteria**:
  - [ ] Visual-regression job added to ci.yml
  - [ ] Installs Playwright browsers
  - [ ] Runs harness-ui visual tests
  - [ ] Uploads artifacts on failure

  **QA Scenarios**:
  ```
  Scenario: Visual regression job defined
    Tool: Bash
    Preconditions: ci.yml exists
    Steps:
      1. Run: yq eval '.jobs.visual-regression' .github/workflows/ci.yml
      2. Verify Playwright install step present
      3. Verify artifact upload on failure
    Expected Result: Visual regression job properly configured
    Evidence: .sisyphus/evidence/task-8-visual-job.txt
  ```

  **Commit**: YES (grouped with task 6)
  - Message: `feat(ci): add visual regression job to CI workflow`
  - Files: `.github/workflows/ci.yml`

---

- [x] 9. Create ci.yml - Bundle check job

  **What to do**:
  - Add bundle-check job to ci.yml
  - Depends on setup job
  - Runs `pnpm bundle:check`
  - Validates bundle sizes against budgets (core: 60KB, react: 120KB gzip)
  - Fails if bundles exceed budgets
  - Outputs bundle size report

  **Must NOT do**:
  - Skip bundle validation
  - Allow oversized bundles
  - Not report bundle sizes

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Justification: GitHub Actions YAML editing

  **Parallelization**:
  - **Can Run In Parallel**: YES (depends on setup)
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: Task 6

  **Job Configuration**:
  ```yaml
  bundle-check:
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm bundle:check
  ```

  **Acceptance Criteria**:
  - [ ] Bundle-check job added to ci.yml
  - [ ] Builds packages before checking
  - [ ] Runs bundle:check script
  - [ ] Fails on budget exceeded

  **QA Scenarios**:
  ```
  Scenario: Bundle check job defined
    Tool: Bash
    Preconditions: ci.yml exists
    Steps:
      1. Run: yq eval '.jobs.bundle-check' .github/workflows/ci.yml
      2. Verify "pnpm build" step present before bundle:check
    Expected Result: Bundle check job properly configured
    Evidence: .sisyphus/evidence/task-9-bundle-job.txt
  ```

  **Commit**: YES (grouped with task 6)
  - Message: `feat(ci): add bundle check job to CI workflow`
  - Files: `.github/workflows/ci.yml`

---

- [x] 10. Create ci.yml - Rust test job

  **What to do**:
  - Add rust-test job to ci.yml
  - Sets up Rust toolchain with actions-rs/toolchain@v1
  - Runs `cargo test` for acp-ws-bridge and acp-harness-server
  - Uses working-directory for each crate
  - Caches Cargo dependencies

  **Must NOT do**:
  - Skip Rust tests
  - Use outdated Rust version
  - Not cache Cargo

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Justification: GitHub Actions YAML editing

  **Parallelization**:
  - **Can Run In Parallel**: YES (depends on setup)
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: Task 6

  **Job Configuration**:
  ```yaml
  rust-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
          override: true
      - uses: actions/cache@v4
        with:
          path: |
            ~/.cargo/registry
            ~/.cargo/git
            target
          key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}
      - name: Test acp-ws-bridge
        working-directory: ./crates/acp-ws-bridge
        run: cargo test
      - name: Test acp-harness-server
        working-directory: ./crates/acp-harness-server
        run: cargo test
  ```

  **Acceptance Criteria**:
  - [ ] Rust-test job added to ci.yml
  - [ ] Sets up stable Rust toolchain
  - [ ] Tests both Rust crates
  - [ ] Caches Cargo dependencies

  **QA Scenarios**:
  ```
  Scenario: Rust test job defined
    Tool: Bash
    Preconditions: ci.yml exists
    Steps:
      1. Run: yq eval '.jobs.rust-test' .github/workflows/ci.yml
      2. Verify Rust toolchain setup present
      3. Verify both crate test steps present
    Expected Result: Rust test job properly configured
    Evidence: .sisyphus/evidence/task-10-rust-job.txt
  ```

  **Commit**: YES (grouped with task 6)
  - Message: `feat(ci): add Rust test job to CI workflow`
  - Files: `.github/workflows/ci.yml`

---

- [ ] 11. Create release.yml - Dry-run job

  **What to do**:
  - Create `.github/workflows/release.yml`
  - Create dry-run job that:
    - Triggers on workflow_dispatch (manual) or push to release/* branches
    - Sets up pnpm and Node.js
    - Installs dependencies
    - Builds all packages: `pnpm build`
    - Runs publish-check.ts script for each package
    - Runs `npm pack --dry-run` for each package
    - Uploads dry-run reports as artifacts
    - Validates workspace:* dependencies are resolved

  **Must NOT do**:
  - Actually publish packages
  - Skip any validation steps
  - Not save artifacts

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Justification: GitHub Actions YAML creation

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 3 start)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 12
  - **Blocked By**: Tasks 1, 5

  **Workflow Structure**:
  ```yaml
  name: Release
  on:
    workflow_dispatch:
      inputs:
        version:
          description: 'Version to release'
          required: true
    push:
      branches: [release/*]
  
  jobs:
    dry-run:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: pnpm/action-setup@v2
          with:
            version: 9
        - uses: actions/setup-node@v4
          with:
            node-version: 20.x
            cache: 'pnpm'
            registry-url: 'https://registry.npmjs.org'
        - run: pnpm install --frozen-lockfile
        - run: pnpm build
        - name: Publish Dry Run - Core
          working-directory: ./packages/acp-chat-core
          run: npm pack --dry-run 2>&1 | tee ../../core-dry-run.log
        - name: Publish Dry Run - React
          working-directory: ./packages/acp-chat-react
          run: npm pack --dry-run 2>&1 | tee ../../react-dry-run.log
        - name: Publish Dry Run - Bridge
          working-directory: ./packages/acp-ws-bridge
          run: npm pack --dry-run 2>&1 | tee ../../bridge-dry-run.log
        - name: Run Publish Checks
          run: bun scripts/publish-check.ts
        - uses: actions/upload-artifact@v4
          with:
            name: dry-run-reports
            path: '*.dry-run.log'
  ```

  **Acceptance Criteria**:
  - [ ] release.yml file exists at .github/workflows/release.yml
  - [ ] Workflow triggers on workflow_dispatch and release/* branches
  - [ ] Has dry-run job defined
  - [ ] Runs npm pack --dry-run for all 3 packages
  - [ ] Runs publish-check.ts script
  - [ ] Uploads dry-run logs as artifacts

  **QA Scenarios**:
  ```
  Scenario: Release workflow YAML valid
    Tool: Bash
    Preconditions: None
    Steps:
      1. Run: cat .github/workflows/release.yml | head -50
      2. Verify YAML syntax with: yq eval '.name' .github/workflows/release.yml
    Expected Result: Valid YAML, name is "Release"
    Evidence: .sisyphus/evidence/task-11-release-setup.txt
  ```

  **Commit**: YES
  - Message: `feat(ci): add release dry-run job`
  - Files: `.github/workflows/release.yml`

---

- [ ] 12. Create release.yml - Publish validation job

  **What to do**:
  - Add publish-validation job to release.yml
  - Depends on dry-run job
  - Comprehensive validation that:
    - Checks all required files exist (LICENSE, README.md)
    - Validates package.json fields (name, version, main, types, files)
    - Verifies exports match actual files in dist/
    - Checks for forbidden files in tarball (source maps, test files)
    - Validates workspace dependencies are resolved
    - Checks bundle sizes (runs bundle:check)
    - Verifies no console.log statements in dist/
  - Creates detailed validation report
  - Fails if any validation check fails
  - Only after this passes can actual publish happen (manual gate)

  **Must NOT do**:
  - Actually publish to npm
  - Skip validation steps
  - Allow validation to pass with warnings only

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Justification: GitHub Actions YAML editing

  **Parallelization**:
  - **Can Run In Parallel**: YES (depends on dry-run)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: Tasks 2, 4, 11

  **Job Configuration**:
  ```yaml
  publish-validation:
    needs: dry-run
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm bundle:check
      - name: Validate Package Files
        run: |
          for pkg in acp-chat-core acp-chat-react acp-ws-bridge; do
            echo "Validating $pkg..."
            test -f packages/$pkg/LICENSE || echo "Missing LICENSE in $pkg"
            test -f packages/$pkg/README.md || echo "Missing README in $pkg"
            test -f packages/$pkg/package.json || echo "Missing package.json in $pkg"
          done
      - name: Run Comprehensive Publish Check
        run: bun scripts/publish-check.ts --strict
      - name: Check for Debug Artifacts
        run: |
          echo "Checking for source maps..."
          find packages/*/dist -name "*.map" -type f && exit 1 || echo "No source maps found"
          echo "Checking for test files..."
          find packages/*/dist -name "*.test.*" -o -name "*.spec.*" | grep . && exit 1 || echo "No test files found"
      - uses: actions/upload-artifact@v4
        with:
          name: validation-report
          path: validation-report.json
  ```

  **Acceptance Criteria**:
  - [ ] Publish-validation job added to release.yml
  - [ ] Job depends on dry-run
  - [ ] Validates all required files
  - [ ] Runs comprehensive publish check
  - [ ] Detects source maps and test files
  - [ ] Creates validation report

  **QA Scenarios**:
  ```
  Scenario: Publish validation job defined
    Tool: Bash
    Preconditions: release.yml exists
    Steps:
      1. Run: yq eval '.jobs.publish-validation' .github/workflows/release.yml
      2. Verify "needs: dry-run" is present
      3. Verify debug artifact checks present
    Expected Result: Publish validation job properly configured
    Evidence: .sisyphus/evidence/task-12-validation-job.txt
  ```

  **Commit**: YES (grouped with task 11)
  - Message: `feat(ci): add publish validation job to release workflow`
  - Files: `.github/workflows/release.yml`

---

- [ ] 13. Validate workflows with schema check

  **What to do**:
  - Validate ci.yml against GitHub Actions schema
  - Validate release.yml against GitHub Actions schema
  - Check for common YAML issues (indentation, syntax)
  - Verify all referenced actions use valid versions
  - Check that all job dependencies exist
  - Ensure no circular dependencies

  **Must NOT do**:
  - Modify workflow files (report issues only)
  - Skip validation

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Justification: YAML validation

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Final verification
  - **Blocked By**: Tasks 6-12

  **Validation Checks**:
  ```bash
  # Check YAML syntax
  yq eval '.name' .github/workflows/ci.yml
  yq eval '.name' .github/workflows/release.yml
  
  # Check job dependencies exist
  yq eval '.jobs | keys' .github/workflows/ci.yml
  yq eval '.jobs | keys' .github/workflows/release.yml
  
  # Verify all 'needs' references exist
  yq eval '.jobs[].needs' .github/workflows/ci.yml | grep -v null
  ```

  **Acceptance Criteria**:
  - [ ] ci.yml passes YAML validation
  - [ ] release.yml passes YAML validation
  - [ ] All job dependencies reference existing jobs
  - [ ] All action versions are valid

  **QA Scenarios**:
  ```
  Scenario: Workflows are valid
    Tool: Bash
    Preconditions: ci.yml and release.yml exist
    Steps:
      1. Run: yq eval '.name' .github/workflows/ci.yml
      2. Run: yq eval '.jobs | keys' .github/workflows/ci.yml
      3. Run: yq eval '.jobs.test.needs' .github/workflows/ci.yml
    Expected Result: All queries return valid data, no errors
    Evidence: .sisyphus/evidence/task-13-validation.txt
  ```

  **Commit**: NO (validation only, no changes)

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search for forbidden patterns. Check all TODOs are complete.
  Output: `Must Have [8/8] | Must NOT Have [5/5] | Tasks [13/13] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Review all created files:
  - ci.yml: valid GitHub Actions syntax, proper job dependencies, correct action versions
  - release.yml: valid syntax, proper triggers, comprehensive validation
  - publish-check.ts: TypeScript compiles, follows project style
  - LICENSE: valid MIT license text
  - .npmrc: valid npm configuration
  - package.json updates: valid JSON, correct fields
  Output: `Workflows [VALID/INVALID] | Scripts [PASS/FAIL] | Config [VALID/INVALID] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Validate workflows can be parsed:
  1. Use `yq` to validate YAML syntax
  2. Check all job references exist
  3. Verify TypeScript script compiles: `bun scripts/publish-check.ts --help`
  4. Check workflow schema with GitHub Actions validator
  5. Verify all files are in correct locations
  Output: `YAML [VALID/INVALID] | TypeScript [COMPILES/FAILS] | Locations [CORRECT/INCORRECT] | VERDICT`

---

## Commit Strategy

- **1**: `chore(ci): create GitHub workflows directory` - `.github/workflows/.gitkeep`
- **2**: `chore: add MIT LICENSE file` - `LICENSE`
- **3**: `chore: add .npmrc configuration` - `.npmrc`
- **4**: `chore: add files and publishConfig to packages` - `packages/*/package.json`
- **5**: `feat(ci): add publish-check script for release validation` - `scripts/publish-check.ts`
- **6-10**: `feat(ci): add comprehensive CI workflow` - `.github/workflows/ci.yml`
- **11-12**: `feat(ci): add release workflow with dry-run` - `.github/workflows/release.yml`

---

## Success Criteria

### Verification Commands
```bash
# Check all files exist
ls -la .github/workflows/ci.yml .github/workflows/release.yml LICENSE .npmrc

# Validate YAML syntax
yq eval '.name' .github/workflows/ci.yml
yq eval '.name' .github/workflows/release.yml

# Check TypeScript script compiles
bun scripts/publish-check.ts --help

# Verify package.json updates
jq '.files' packages/acp-chat-core/package.json
jq '.publishConfig' packages/acp-ws-bridge/package.json

# Test publish dry-run (locally)
cd packages/acp-chat-core && npm pack --dry-run
```

### Final Checklist
- [ ] CI workflow runs on PR/push with all jobs (setup, test, visual, bundle, rust)
- [ ] Release workflow has dry-run and validation jobs
- [ ] publish-check.ts detects source maps, test files, console.logs
- [ ] LICENSE file exists with MIT text
- [ ] .npmrc configured for npmjs.org
- [ ] All publishable packages have files and publishConfig
- [ ] No debug artifacts in release validation
- [ ] All jobs use pnpm with frozen-lockfile
- [ ] Coverage thresholds enforced in CI
- [ ] Bundle budgets enforced in CI
