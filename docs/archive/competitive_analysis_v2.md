# depxray v2.0 → v3.0 — Competitive Analysis vs. Rev-dep & Ecosystem

> **Context**: depxray has now shipped all v1.x/v2.0 features from the original roadmap. This analysis compares the current implementation against **rev-dep** (the Go-based high-speed tool, 233⭐) and the broader 2026 competitive landscape to identify the next set of improvements.

---

## Updated Competitive Landscape (June 2026)

| Tool | ⭐ Stars | Language | Key Positioning | Speed |
| :--- | :--- | :--- | :--- | :--- |
| **madge** | ~10.1k | Node.js | Quick visualization + Graphviz | Moderate |
| **dependency-cruiser** | ~6.7k | Node.js | Architecture rule engine, CI | Moderate |
| **knip** | ~5k+ | Node.js | Unused code/deps/exports linter | Moderate |
| **rev-dep** | ~233 | **Go** | High-speed CI gatekeeper, 10 config checks | **~500ms for 500k LoC** |
| **Fallow** | ~New | **Rust** | Dead code + complexity + AI agent skills | **Sub-second (Rust/Oxc)** |
| **depxray** | New | Node.js | Browser-first explorer + MCP + AI-native | Moderate |

### The Landscape Has Shifted

Since the v1.0 roadmap, two important trends have emerged:

1. **Speed is now table stakes** — Rev-dep (Go) and Fallow (Rust) prove that Node.js-based analysis is becoming the "slow" option. Both can audit 500k+ LoC codebases in under a second.

2. **AI-agent integration is exploding** — Fallow has an MCP server, Agent Skills, and structured SARIF/CodeClimate output. depxray's MCP server is good but needs to expand its tool surface.

3. **Autofix is the new standard** — Both rev-dep and Knip support `--fix` flags that automatically remove unused exports, orphan files, and fix import conventions. depxray has zero autofix capabilities.

---

## What depxray v2.0 Does Better Than Everyone

> [!TIP]
> These are your **unmatched** strengths. No competitor combines all of these.

| Feature | depxray | rev-dep | Fallow | knip | madge |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Interactive browser UI (3-panel, force graph) | ✅ Best | ❌ CLI only | ❌ CLI only | ❌ CLI only | ❌ Static images |
| File tree + graph + inline source code | ✅ | ❌ | ❌ | ❌ | ❌ |
| Static HTML export (shareable) | ✅ | ❌ | ❌ | ❌ | ❌ |
| MCP server for AI agents | ✅ | ❌ | ✅ | ❌ | ❌ |
| Watch mode with live browser updates | ✅ | ❌ | ❌ | ❌ | ❌ |
| Graph diffing (snapshots or git refs) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Per-file complexity metrics (LOC, cyclomatic) | ✅ | ❌ | ✅ | ❌ | ❌ |
| Plugin/hook system | ✅ | ❌ | ❌ | ✅ (150+ plugins) | ❌ |
| Mermaid/DOT export | ✅ | ❌ | ❌ | ❌ | ✅ (Graphviz) |
| Markdown health report | ✅ | ❌ | ❌ | ❌ | ❌ |

**Your unique combo**: `Interactive browser explorer + force-directed graph + inline source code + MCP server + watch mode + graph diffing + health reports` — **nobody else has this stack.**

---

## Feature Gap Analysis: What Rev-dep Has That depxray Doesn't

> [!IMPORTANT]
> Rev-dep has 10 config-based checks. depxray currently has 3 (circular, orphans, architecture rules). These gaps are what enterprise users notice.

### 🔴 Critical Gaps (Rev-dep has, depxray doesn't)

| # | Feature | Rev-dep | depxray v2.0 | Impact |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **Unused exports detection** | ✅ (with autofix) | ❌ | 🔴 High — This is the #1 most demanded cleanup feature |
| 2 | **Autofix for any check** | ✅ (orphans, exports, import conventions) | ❌ | 🔴 High — "detect AND fix" is the 2026 standard |
| 3 | **Missing node_modules detection** | ✅ | ❌ | 🔴 High — imported but not in package.json (different from "unlisted") |
| 4 | **DevDeps used in production detection** | ✅ | ❌ | 🟡 Medium — catches devDependencies accidentally used in prod code |
| 5 | **Restricted imports (entry-point scoped)** | ✅ | Partial (global rules only) | 🟡 Medium — rev-dep can restrict per-entry-point, not just globally |
| 6 | **Import convention enforcement** | ✅ (with autofix) | ❌ | 🟡 Medium — enforce relative-internal, absolute-external patterns |
| 7 | **Unresolved imports detection** | ✅ | ❌ | 🟡 Medium — imports that fail to resolve to actual files |
| 8 | **Entry-point discovery** (`entry-points` cmd) | ✅ | ❌ | 🟡 Medium — automatically finds files nothing imports |
| 9 | **Entry-point → file tracing** (`files` cmd) | ✅ | ❌ | 🟡 Medium — "show all files this entry point pulls in" |
| 10 | **Reverse resolution** (`resolve` cmd) | ✅ | Partial (`inspect`) | 🟡 Medium — "which entry points depend on this file?" |
| 11 | **package.json `exports`/`imports` map resolution** | ✅ | ❌ | 🟡 Medium — modern Node.js uses `exports` field |
| 12 | **node_modules disk size analysis** | ✅ (`dirs-size`) | ❌ | 🟢 Low |

### What Fallow Has That depxray Doesn't

| Feature | Fallow | depxray v2.0 |
| :--- | :--- | :--- |
| Unused exports detection | ✅ | ❌ |
| Duplicate code detection (clones) | ✅ | ❌ |
| Boundary violations | ✅ | ✅ (architecture rules) |
| SARIF / CodeClimate output | ✅ | ❌ |
| VS Code extension with CodeLens | ✅ | ❌ |
| Agent Skills (autonomous cleanup) | ✅ | ❌ |
| Runtime evidence (hot/cold paths) | ✅ (paid) | ❌ |

---

## Proposed Improvements — Prioritized Roadmap v3.0

### 🏆 Tier 1: Critical Feature Parity + Unique Value (v2.1 – v2.3)

These close the biggest gaps while leveraging depxray's unique browser UI.

---

#### FEATURE 1: Unused Exports Detection 🔴

**Why**: This is the single most impactful missing feature. Rev-dep, Knip, and Fallow all have it. "Which functions/types/components am I exporting that nobody uses?" is the #1 question developers ask.

**What to build**:
- For each scanned file, parse all `export` declarations (named, default, re-exports)
- Cross-reference against all `import` statements across the entire graph
- Report exports that are never imported anywhere
- Exclude entry point files (configurable)
- Flag type-only exports separately (`export type`)

**CLI integration**:
- `depxray scan --mode dependencies --unused-exports --json` → includes `unusedExports` per file
- `depxray scan --mode dependencies --unused-exports` → prints unused export summary to stderr

**Browser UI integration**:
- In the `SelectionPanel`, show unused exports list for the selected file
- In `FileTreeView`, add a badge/indicator for files with unused exports
- In `ForceGraphView`, color nodes with unused exports differently
- Add "Unused exports" filter toggle in `ExplorerToolbar`

**Acceptance criteria**:
- [ ] Detects unused named exports, default exports, re-exports, and type exports
- [ ] Excludes configurable entry point files
- [ ] JSON output includes `unusedExports: string[]` per node
- [ ] Browser UI shows unused exports in file details
- [ ] Unit tests with barrel file and re-export scenarios

---

#### FEATURE 2: Autofix System 🔴

**Why**: Both rev-dep and Knip support `--fix`. "Detect and fix" is the 2026 standard. Without autofix, depxray is a "read-only" tool.

**What to build**:
- `depxray scan --fix` flag that auto-applies safe fixes
- Phase 1 fixes:
  - **Remove unused exports**: Delete unused export statements from source files
  - **Remove orphan files**: Delete files with zero incoming edges (with confirmation)
- Phase 2 fixes:
  - **Fix import conventions**: Normalize import paths (relative ↔ absolute)
  - **Remove unused npm deps**: Remove from `package.json`

**Safety mechanisms**:
- `--fix --dry-run` → show what would be changed without modifying files
- `--fix` requires explicit confirmation unless `--yes` is passed
- Always output a summary of changes made

**Acceptance criteria**:
- [ ] `--fix --dry-run` shows planned changes without modifying files
- [ ] `--fix` removes unused exports from source files
- [ ] `--fix` can delete orphan files with confirmation prompt
- [ ] Changes are summarized to stderr after applying
- [ ] Unit tests for each fix operation

---

#### FEATURE 3: Unresolved Imports Detection 🔴

**Why**: Rev-dep catches imports that don't resolve to any file. depxray currently silently ignores them. This is critical for catching typos, deleted files, and broken refactors.

**What to build**:
- During `resolveImports()`, collect imports where `resolvedPath === null`
- Exclude external packages (`node_modules`) and known asset extensions (`.css`, `.svg`, etc.)
- Report as `unresolvedImports: { file: string, importSpecifier: string, line: number }[]` in scan output

**CLI integration**:
- Include in `--json` output by default
- Add `--unresolved` flag to print unresolved imports to stderr
- Show count in `report` output

**Browser UI integration**:
- Show unresolved imports with ⚠️ warning icon in `SelectionPanel`
- Badge on files with unresolved imports in file tree

**Acceptance criteria**:
- [ ] Unresolved imports collected during scan (already partially done via `ScanError`)
- [ ] Differentiate between "parse error" and "unresolved import"
- [ ] JSON output includes `unresolvedImports` array
- [ ] Browser UI highlights files with unresolved imports
- [ ] Correctly ignores external packages and asset imports

---

#### FEATURE 4: DevDependencies Used in Production Detection 🟡→🔴

**Why**: Rev-dep's `devDepsUsageOnProdDetection` catches when production code accidentally imports devDependencies. This causes runtime crashes when deployed.

**What to build**:
- Require entry points to be classified as `prod` or `dev` (via config or CLI flag)
- Build the dependency tree from production entry points only
- Check if any file in the prod tree imports from `devDependencies`
- Support `--ignore-type-imports` (type-only imports from devDeps are usually safe)

**Config integration**:
```js
// depxray.config.js
export default {
  prodEntryPoints: ['src/main.tsx', 'src/server.ts'],
  devEntryPoints: ['**/*.test.*', 'scripts/**'],
};
```

**Acceptance criteria**:
- [ ] Config supports `prodEntryPoints` and `devEntryPoints`
- [ ] Scans prod entry point tree and flags devDep imports
- [ ] `--ignore-type-imports` flag for TypeScript type-only imports
- [ ] JSON output includes `devDepsInProd: { file, module }[]`

---

#### FEATURE 5: Entry-Point Analysis Commands 🟡

**Why**: Rev-dep's `entry-points`, `files`, and `resolve` commands are its exploratory toolkit. depxray has `inspect` but lacks entry-point-centric analysis.

**What to build**:

**`depxray entry-points [dir]`** — Discover all entry point files (files with no incoming imports):
- Same as orphan detection, but framed positively as "entry points"
- Allows `--exclude` patterns for framework entry points

**`depxray trace <file> [dir]`** — Trace which entry points depend on a given file:
- Build reverse dependency tree from the file
- Show all paths from entry points to the target file
- `--compact` flag for summary-only output
- This is rev-dep's `resolve --file` equivalent

**`depxray tree <entry-point> [dir]`** — Show all files an entry point imports (transitive):
- Build forward dependency tree from the entry point
- Show the full import chain with depth indentation
- `--json` for machine output

**Acceptance criteria**:
- [ ] `depxray entry-points` lists all files with inDegree === 0
- [ ] `depxray trace src/utils/math.ts` shows which entry points use this file
- [ ] `depxray tree src/index.ts` shows the full transitive import tree
- [ ] All three commands support `--json` and `--format text`

---

### 🥈 Tier 2: Deepening the Advantage (v2.4 – v2.6)

These features leverage depxray's unique browser UI — things rev-dep can never do.

---

#### FEATURE 6: Import Convention Enforcement 🟡

**Why**: Rev-dep enforces "relative-internal, absolute-external" import patterns with autofix. This reduces inconsistency across teams.

**What to build**:
- Config rule: `importConventions` in `depxray.config.js`
- Detect violations (e.g., relative imports that should be aliases, or absolute imports within the same domain)
- `--fix` autofix support to rewrite import paths

---

#### FEATURE 7: package.json `exports`/`imports` Map Resolution 🟡

**Why**: Modern Node.js packages use `exports` field instead of `main`. Rev-dep fully resolves these. depxray currently ignores them for cross-package imports in monorepos.

**What to build**:
- When resolving imports to workspace packages, check the target's `package.json` `exports` field
- Support conditional exports (`import`, `require`, `default`)
- Support wildcard subpath patterns
- Respect `imports` field for package-local aliases (Node.js `#imports`)

---

#### FEATURE 8: CI/CD Exit Codes for All Checks 🟡

**Why**: Rev-dep's `config run` exits non-zero when any check fails. depxray only exits non-zero for `--validate` (architecture rules). CI needs exit codes for ALL checks.

**What to build**:
- `depxray check [dir]` — new command that runs all configured checks in one pass:
  - Circular dependencies → fail if any found
  - Orphan files → fail if any found
  - Unused exports → fail if any found
  - Architecture rule violations → fail on error severity
  - Unresolved imports → fail if any found
  - DevDeps in prod → fail if any found
- Exit code 1 on any failure, 0 if all clean
- `--format json` for CI parsing

---

#### FEATURE 9: SARIF Output Format 🟢

**Why**: Fallow outputs SARIF (Static Analysis Results Interchange Format) which integrates with GitHub Code Scanning, VS Code Problem panel, and other tools.

**What to build**:
- `--format sarif` flag that outputs SARIF JSON
- Each finding (circular dep, orphan, unused export, rule violation) becomes a SARIF `result`
- Compatible with GitHub's code scanning upload

---

#### FEATURE 10: Restricted Imports (Entry-Point Scoped) 🟢

**Why**: Rev-dep's `restrictedImportsDetection` can block specific imports from specific entry points. depxray's architecture rules are global. Entry-point scoping is more powerful.

**What to build**:
- Extend architecture rules to scope by entry point:
```js
rules: [{
  entryPoints: ['src/server.ts'],
  deny: { files: ['**/*.tsx'], modules: ['react'] },
  message: 'Server code cannot import React components',
}]
```

---

### 🥉 Tier 3: Next-Gen Differentiators (v3.0)

These would make depxray truly next-gen — things no one else has.

---

#### FEATURE 11: VS Code Extension 🟢

**Why**: Fallow has one. Knip has one. This brings depxray analysis into the editor.

**What to build**:
- CodeLens showing import/dependent count above files
- Inline warnings for unused exports, circular deps
- "Open in depxray" command to launch browser UI for current file
- Tree view sidebar showing dependency chain

---

#### FEATURE 12: Dependency Impact Analysis 🟢

**Why**: No one does this well. Answer: "If I change this file, what could break?"

**What to build**:
- `depxray impact <file>` — show all files that transitively depend on this file
- Combine with complexity metrics: highlight "high-impact + high-complexity" files
- Browser UI: click a file → see its "blast radius" highlighted in the force graph
- MCP tool: `analyze_impact` for AI agents to assess change risk

---

## Positioning Strategy: Where depxray Wins

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  Speed-focused CI tools         │  Interactive exploration tools     │
│  ──────────────────────         │  ────────────────────────────      │
│  rev-dep (Go, 500ms)            │  depxray (Browser UI + MCP)       │
│  Fallow (Rust, sub-second)      │                                    │
│  knip (Node.js, moderate)       │  ← NO COMPETITION HERE            │
│                                  │                                    │
│  They are FAST but BLIND.       │  You are VISUAL and INTELLIGENT.  │
│  CLI output only.                │  Force graph + code viewer +       │
│  No interactive exploration.     │  file tree + watch mode +          │
│  No browser UI.                  │  MCP server + health reports.      │
│                                  │                                    │
└──────────────────────────────────────────────────────────────────────┘
```

### Don't compete on speed. Compete on insight.

Rev-dep is 10-200x faster because it's written in Go. You can't match that with Node.js. But rev-dep gives you **text in a terminal**. depxray gives you an **interactive visual intelligence layer**.

### Your tagline evolution:

> **v1.0**: *"X-ray vision for your JavaScript codebase"*
> **v2.0**: *"See, explore, and fix your codebase — in your browser, in your terminal, in your AI agent"*
> **v3.0**: *"The codebase intelligence platform for humans and AI agents"*

---

## Recommended Roadmap

| Version | Features | Theme |
| :--- | :--- | :--- |
| **v2.1** | Unused exports detection + Unresolved imports | *"Find dead code"* |
| **v2.2** | Autofix system + DevDeps in prod detection | *"Fix it automatically"* |
| **v2.3** | Entry-point commands (entry-points, trace, tree) | *"Explore deeper"* |
| **v2.4** | Import conventions + exports map resolution | *"Modern JS support"* |
| **v2.5** | CI check command + SARIF output | *"CI/CD native"* |
| **v3.0** | VS Code extension + Impact analysis + Restricted imports | *"Full intelligence"* |

---

## Open Questions

> [!IMPORTANT]
> These decisions will shape the v3.0 strategy:

1. **Performance**: Should depxray add an optional Rust/Go compiled binary for the scan step (like Fallow uses Oxc parser instead of Babel)? This would dramatically improve speed for large repos. The browser UI and MCP would stay in Node.js.

2. **Autofix priority**: Which autofix capabilities matter most to you? Unused exports removal? Orphan file deletion? Import path normalization?

3. **Entry-point analysis**: Rev-dep's `resolve --file` is extremely useful for debugging "why is this file included?" Should this be a CLI command, a browser UI feature, or both?

4. **VS Code extension**: This is significant work. Is it worth prioritizing over other features?

5. **SARIF output**: Is GitHub Code Scanning integration important for your users?
