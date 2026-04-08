# Agent Guidelines - ACP Chat Core & React

This document provides guidelines for AI agents working on the ACP Chat Core and ACP Chat React projects.

---

## 📚 Wiki Documentation

**Location:** `/docs/wiki/`

The wiki documentation is the **single source of truth** for the project's architecture, APIs, and implementation patterns. Keep it accurate and up-to-date.

### Wiki Structure

```
docs/wiki/
├── Home.md                      # Main landing page
├── acp-chat-core-Home.md        # Core library landing page
├── acp-chat-core-Architecture.md # Layered architecture
├── acp-chat-core-Types-Reference.md # Complete type catalog
├── acp-chat-core-Events.md      # Event system documentation
├── acp-chat-core-Session-Management.md # SessionController API
├── acp-chat-core-Implementation-Guide.md # Framework-agnostic patterns
├── acp-chat-react-Home.md       # React package overview
└── ACP-Protocol.md              # External ACP protocol reference
```

**Note:** GitHub wikis require a flat structure (no subdirectories). All files are at the root level with `acp-chat-core-` and `acp-chat-react-` prefixes.

---

## 📝 Wiki Maintenance Rules

### Rule 1: UPDATE WIKI ON TYPE STRUCTURE CHANGES

**CRITICAL:** Any time you make changes to:
- Type definitions (interfaces, types, type aliases)
- Method signatures (parameters, return types)
- Class structures (new methods, removed methods)
- Event types or payloads
- API surface (exports, public methods)

**You MUST update the corresponding wiki documentation BEFORE committing.**

**Example:**
```typescript
// If you change this:
async createSession(cwd: string, mcpServers?: unknown[]): Promise<unknown>

// To this:
async createSession(cwd: string, mcpServers?: unknown[], config?: SessionConfig): Promise<SessionResult>

// You MUST update:
// - acp-chat-core-Types-Reference.md (type definition)
// - acp-chat-core-Session-Management.md (method signature and examples)
// - acp-chat-core-Implementation-Guide.md (usage examples)
```

---

### Rule 2: PREFER UPDATING EXISTING PAGES

**When making changes, prefer updating existing wiki pages over creating new ones.**

**DO:**
- Update existing type definitions in `acp-chat-core-Types-Reference.md`
- Add new methods to existing class documentation in `acp-chat-core-Session-Management.md`
- Update examples in `acp-chat-core-Implementation-Guide.md` to reflect new patterns
- Modify architecture diagrams in `acp-chat-core-Architecture.md` to show new layers

**DON'T:**
- Create `Types-Reference-v2.md` for updated types
- Create `NewMethods.md` for new APIs
- Create separate pages for incremental changes

**Rationale:** Keeping documentation consolidated makes it easier to find and maintain. Users should not need to check multiple pages for related information.

---

### Rule 2: PREFER UPDATING EXISTING PAGES

**When documenting new features, use the same patterns and terminology as existing pages.**

**Examples:**

**Type Documentation Pattern:**
```markdown
### `NewTypeName`

```typescript
interface NewTypeName {
  field: string;
  optionalField?: number;
}
```

**File:** `src/path/to/file.ts`  
**Purpose:** Clear one-sentence description of what this type represents.  
**Relationships:** Links to related types (e.g., "Used by [[ExistingType]]").  
**Exported:** Yes/No (from main index.ts)
```

**Method Documentation Pattern:**
```markdown
#### `methodName()`

```ts
async methodName(param: string): Promise<Result>
```

Description of what the method does.

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `param`   | `string` | required | What this param does |

**Returns:** Description of return value.

**Example:**
```ts
await controller.methodName("value");
```
```

**Follow these patterns exactly** to maintain consistency across the documentation.

---

### Rule 3: UPDATE ALL AFFECTED EXAMPLES

**When you change an API, update ALL code examples that use it.**

**Check these files for examples:**
- `Home.md` (quick start examples)
- `acp-chat-core-Session-Management.md` (usage examples throughout)
- `acp-chat-core-Implementation-Guide.md` (implementation patterns)
- `acp-chat-core-Events.md` (event handling examples)
- `acp-chat-react-Home.md` (React integration examples)

**Example:**
If you change `createSession()` signature:
1. Search for all `createSession(` in wiki files
2. Update each example to match new signature
3. Verify all parameters are included
4. Test that examples would compile/run

---

### Rule 4: LINK CORRECTLY BETWEEN PAGES

**Use relative links that work in GitHub wiki:**

**All pages at root level (flat structure):**
```markdown
[Architecture](./acp-chat-core-Architecture)
[Types Reference](./acp-chat-core-Types-Reference)
[React Home](./acp-chat-react-Home)
[ACP Protocol](./ACP-Protocol)
```

**DON'T use:**
- Absolute paths (`/docs/wiki/Architecture.md`)
- Folder paths (`acp-chat-core/Architecture` ❌)
- `.md` extensions in links (`Architecture.md` ❌, `acp-chat-core-Architecture` ✅)
- Broken links to non-existent pages

---

### Rule 5: VERIFY BEFORE COMMITTING

**Before committing changes that affect the wiki:**

- ✅ **Type signatures match** - Compare wiki with source code
- ✅ **All examples updated** - Search for old usage patterns
- ✅ **Links verified** (no broken references)
- ✅ **Terminology consistent** with existing docs

**Quick checklist:**
```bash
# Search for old API usage in wiki
grep -r "oldMethodName" docs/wiki/

# Verify type exports match index.ts
grep "export type" packages/acp-chat-core/src/index.ts

# Check for broken links (GitHub wiki uses flat structure)
grep "\]\(./NonExistent\)" docs/wiki/*.md
```

---

## 🔍 When to Update Wiki

### MUST Update Wiki:

- ✅ Adding/removing exported types
- ✅ Changing method signatures (params, return types)
- ✅ Adding/removing public APIs
- ✅ Changing event payloads or types
- ✅ Modifying architecture (new layers, components)
- ✅ Adding/removing exports from index.ts
- ✅ Changing behavior that's documented

### DON'T Need Wiki Update:

- ❌ Internal refactoring (no API changes)
- ❌ Bug fixes (behavior unchanged)
- ❌ Performance optimizations
- ❌ Comment/documentation in source code
- ❌ Test changes only

---

## 📖 Quick Reference

### Where to Document What:

| Change Type | Update This File |
|-------------|------------------|
| New type/interface | `acp-chat-core-Types-Reference.md` |
| Changed method signature | `acp-chat-core-Session-Management.md` + examples |
| New event type | `acp-chat-core-Events.md` |
| New component | `acp-chat-react-Components.md` (when created) |
| New hook | `acp-chat-react-Hooks.md` (when created) |
| Architecture change | `acp-chat-core-Architecture.md` |
| Usage pattern change | `acp-chat-core-Implementation-Guide.md` |
| Export change | `acp-chat-core-Types-Reference.md` + all examples |

### File Locations:

| Documentation | Location |
|---------------|----------|
| acp-chat-core wiki | `docs/wiki/` (flat structure, `acp-chat-core-*` prefix) |
| acp-chat-react wiki | `docs/wiki/` (flat structure, `acp-chat-react-*` prefix) |
| ACP Protocol (external) | `docs/wiki/ACP-Protocol.md` |
| This guide | `AGENTS.md` |

---

## 🚨 Common Mistakes to Avoid

### ❌ DON'T: Create redundant pages

**Wrong:**
```
docs/wiki/
├── Types-Reference.md
├── Types-Reference-Updated.md  # ❌ Don't do this
└── NewTypes.md                 # ❌ Don't do this
```

**Right:**
```
docs/wiki/
└── Types-Reference.md          # ✅ Update existing file
```

---

### ❌ DON'T: Leave broken links

**Wrong:**
```markdown
[Old Page](./NonExistentPage)  # ❌ Link goes nowhere
```

**Right:**
```markdown
[Updated Page](./ExistingPage)  # ✅ Link works
```

---

### ❌ DON'T: Use inconsistent terminology

**Wrong:**
```markdown
Page 1: "SessionController creates sessions"
Page 2: "The session controller makes new sessions"  # ❌ Inconsistent
Page 3: "SessionController instantiation"  # ❌ Different term again
```

**Right:**
```markdown
All pages: "SessionController creates sessions"  # ✅ Consistent
```

---

### ❌ DON'T: Forget to update examples

**Wrong:**
```typescript
// Wiki shows old signature:
await controller.createSession("/workspace");

// But actual code is:
await controller.createSession("/workspace", []);  // ❌ Mismatch!
```

**Right:**
```typescript
// Wiki matches actual code:
await controller.createSession("/workspace", []);  # ✅ Matches
```

---

## ✨ Best Practices

### 1. Update Wiki First, Then Code

When making API changes:
1. Update wiki documentation
2. Verify documentation is accurate
3. Then implement code changes
4. Final verification that code matches docs

This ensures documentation is never an afterthought.

### 2. Search Before Creating

Before creating a new wiki page:
1. Search existing pages for similar content
2. Check if the information fits in an existing page
3. Only create new page if truly necessary

### 3. Keep Examples Minimal but Complete

Code examples should be:
- ✅ Minimal - show only what's relevant
- ✅ Complete - would actually compile/run
- ✅ Accurate - matches current API exactly
- ✅ Annotated - explain non-obvious parts

### 4. Link Liberally

Cross-reference related pages:
- Link to type definitions when mentioning types
- Link to method docs when showing usage
- Link to architecture when explaining design
- Link to protocol docs for external specs

---

## 📋 Wiki Update Checklist

Use this checklist when making API changes:

```
[ ] Type definitions updated in acp-chat-core-Types-Reference.md
[ ] Method signatures updated in relevant files
[ ] All code examples updated (search for old usage)
[ ] Return types documented correctly
[ ] Parameters documented with correct types
[ ] Links verified (no broken references)
[ ] Terminology consistent with existing docs
[ ] Architecture diagram updated if needed
[ ] Event types updated in acp-chat-core-Events.md
[ ] Export list updated if changed
[ ] acp-chat-react docs updated if API affects React layer
[ ] Protocol reference updated if external API changed
```

---

## 🔗 Resources

- **Wiki Location:** `/docs/wiki/`
- **Core Docs:** `docs/wiki/acp-chat-core-*.md` (flat structure)
- **React Docs:** `docs/wiki/acp-chat-react-*.md` (flat structure)
- **Protocol Reference:** `docs/wiki/ACP-Protocol.md`
- **Source Code:** `/packages/acp-chat-core/src/`
- **React Source:** `/packages/acp-chat-react/src/`

---

**Last Updated:** April 2026  
**Maintained By:** ACP Chat Core Team
