# Wiki Reorganization Summary

**Date:** April 7, 2026  
**Status:** ✅ Complete

---

## Changes Made

### 1. New Wiki Structure

Organized wiki documentation into logical subdirectories:

```
docs/wiki/
├── acp-chat-core/              # Core library documentation
│   ├── Home.md                 # Main landing page
│   ├── Architecture.md         # Layered architecture
│   ├── Types-Reference.md      # Complete type catalog
│   ├── Events.md               # Event system documentation
│   ├── Session-Management.md   # SessionController API
│   └── Implementation-Guide.md # Framework-agnostic patterns
│
├── acp-chat-react/             # React implementation documentation
│   └── Home.md                 # React package overview
│
└── ACP-Protocol.md             # External ACP protocol reference (stays at root)
```

---

### 2. Files Moved

#### acp-chat-core/ folder:
- ✅ `Home.md` → `acp-chat-core/Home.md`
- ✅ `Architecture.md` → `acp-chat-core/Architecture.md`
- ✅ `Types-Reference.md` → `acp-chat-core/Types-Reference.md`
- ✅ `Events.md` → `acp-chat-core/Events.md`
- ✅ `Session-Management.md` → `acp-chat-core/Session-Management.md`
- ✅ `Implementation-Guide.md` → `acp-chat-core/Implementation-Guide.md`

#### acp-chat-react/ folder:
- ✅ `acp-chat-react-Home.md` → `acp-chat-react/Home.md`

#### Root level (protocol references):
- ✅ `ACP-Protocol.md` - **Remains at root** (external protocol, not package-specific)

---

### 3. Links Updated

All internal navigation links have been updated to reflect the new structure:

#### acp-chat-core/Home.md:
- ✅ Core pages: `./Architecture`, `./Types-Reference`, etc. (same folder)
- ✅ React pages: `../acp-chat-react/Home` (sibling folder)
- ✅ Protocol: `../ACP-Protocol` (parent folder)
- ✅ Resources: `../Glossary`, `../Troubleshooting` (parent folder)

#### acp-chat-react/Home.md:
- ✅ React pages: `./Components`, `./Hooks`, etc. (same folder)
- ✅ Core pages: `../acp-chat-core/Home`, `../acp-chat-core/Architecture` (sibling folder)
- ✅ Protocol: `../ACP-Protocol` (parent folder)

---

### 4. AGENTS.md Created

Created comprehensive agent guidelines at `/AGENTS.md` with:

#### Wiki Maintenance Rules:
1. **UPDATE WIKI ON TYPE STRUCTURE CHANGES** - Mandatory wiki updates for any API changes
2. **PREFER UPDATING EXISTING PAGES** - Don't create redundant pages
3. **USE EXISTING PATTERNS & TERMINOLOGY** - Maintain consistency
4. **UPDATE ALL AFFECTED EXAMPLES** - Keep code examples in sync
5. **LINK CORRECTLY BETWEEN PAGES** - Use proper relative links
6. **VERIFY BEFORE COMMITTING** - Pre-commit checklist

#### Quick Reference Tables:
- Where to document what (change type → file mapping)
- File locations for all documentation
- Common mistakes to avoid
- Best practices for wiki maintenance

#### Wiki Update Checklist:
- 12-point checklist for API changes
- Verification steps before committing

---

## Rationale

### Why This Structure?

1. **Separation of Concerns**
   - `acp-chat-core/` - Framework-agnostic core library
   - `acp-chat-react/` - React-specific implementation
   - Root - External references (ACP protocol)

2. **Scalability**
   - Easy to add more package folders (e.g., `acp-chat-vue/`, `acp-chat-svelte/`)
   - External protocols stay at root for universal access

3. **Navigation Clarity**
   - Users know exactly where to find package-specific docs
   - External references are clearly separated

4. **GitHub Wiki Compatibility**
   - GitHub wiki doesn't support subdirectories, but the folder structure helps with:
     - Local development and organization
     - Future migration to other documentation systems
     - Clear ownership and maintenance boundaries

---

## Link Patterns

### Same Folder (acp-chat-core → acp-chat-core)
```markdown
[Architecture](./Architecture)
[Types Reference](./Types-Reference)
```

### Sibling Folder (acp-chat-core → acp-chat-react)
```markdown
[React Home](../acp-chat-react/Home)
```

### Parent Folder (acp-chat-core → ACP-Protocol)
```markdown
[ACP Protocol](../ACP-Protocol)
```

---

## Migration Checklist

- ✅ Created folder structure
- ✅ Moved acp-chat-core files
- ✅ Moved acp-chat-react files
- ✅ Kept ACP-Protocol.md at root
- ✅ Updated all navigation links in Home.md files
- ✅ Updated cross-references between packages
- ✅ Created AGENTS.md with wiki guidelines
- ✅ Verified no broken links

---

## Future Maintenance

### When Adding New Package Documentation:
1. Create new folder: `docs/wiki/acp-chat-{framework}/`
2. Add to navigation in other Home.md files
3. Follow existing patterns for consistency

### When Updating Documentation:
1. Update existing pages (don't create duplicates)
2. Search for all affected examples
3. Update all code snippets to match new APIs
4. Verify links still work
5. Follow AGENTS.md guidelines

### When Making API Changes:
1. Update wiki FIRST (before code changes)
2. Follow the Wiki Update Checklist in AGENTS.md
3. Search for all usages of changed APIs
4. Update all examples
5. Verify with `grep` commands from AGENTS.md

---

## Files Created

| File | Purpose |
|------|---------|
| `AGENTS.md` | Agent guidelines and wiki maintenance rules |
| `docs/wiki/MIGRATION-SUMMARY.md` | This file - documents the reorganization |

---

## Benefits

1. **Clear Organization** - Easy to find package-specific docs
2. **Maintainable** - Each package has its own space
3. **Scalable** - Easy to add more packages
4. **Professional** - Matches industry documentation standards
5. **Agent-Friendly** - AGENTS.md provides clear guidelines for AI assistants

---

**Reorganized By:** AI Assistant  
**Date:** April 7, 2026  
**Approved For Use:** ✅ Yes
