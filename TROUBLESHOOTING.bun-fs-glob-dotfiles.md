# Bun `node:fs` glob silently skips dot files

Status: **root cause identified** -- upstream issue filed: [oven-sh/bun#28021](https://github.com/oven-sh/bun/issues/28021)

## Symptom

`fs.glob` and `fs.globSync` from `node:fs/promises` / `node:fs` never match dot files (files starting with `.`)
when running on Bun, regardless of pattern.
Wildcard patterns (`*`, `**/*`) and explicit dot patterns (`.*`, `.hidden`) both return empty results for dot entries.

```typescript
import { glob, } from 'node:fs/promises';

// Directory contains: visible, .hidden
for await (const match of glob('/path/*',))
  console.log(match,); // only "visible" -- .hidden is silently skipped

for await (const match of glob('/path/.*',))
  console.log(match,); // no output at all
```

`Bun.Glob` with `dot: true` matches correctly under identical conditions.

## Root cause

Bun's `fs.glob` delegates to `Bun.Glob.scan()` internally.
The bridge function `mapOptions` in `src/js/internal/fs/glob.ts` builds scan options but **never sets `dot: true`**:

```typescript
// src/js/internal/fs/glob.ts, lines 93-103 (Bun v1.3.10)
return {
  cwd: options?.cwd ?? process.cwd(),
  followSymlinks: true,
  onlyFiles: false,
  exclude,
};
// ^^^ no `dot` property -- falls through to Bun.Glob default
```

The native `Bun.Glob` scan implementation in Zig defaults `dot` to `false`:

```zig
// src/bun.js/api/glob.zig, line 70
var out: ScanOpts = .{
    .cwd = null,
    .dot = false,
    // ...
};
```

Since `mapOptions` never overrides this default, all dot files are excluded from `fs.glob` results.

## Node.js comparison

Node.js `fs.glob` has **no `dot` option** either, but its behavior differs from Bun's:

- **Explicit dot patterns** (`**/.gitignore`, `a/.b`): Node.js matches these; Bun does not
- **Wildcard patterns** (`*`, `**/*`): neither Node.js nor Bun matches dot files

Node.js uses minimatch internally, where wildcards skip dot files by default (standard Unix glob behavior).
However, Node.js correctly matches dot files when the dot is **literal** in the pattern.
Bun's implementation skips dot files unconditionally because `Bun.Glob` with `dot: false` ignores them even in literal positions.

Node.js also has a known inconsistency: globstar (`**`) prevents dot-file matching even with literal dot prefixes.
See [nodejs/node#56321](https://github.com/nodejs/node/issues/56321) (filed Dec 2024, closed Dec 2025 without adding a `dot` option).

## Why this hasn't been widely reported

1. **`fs.glob` only stabilized in Node.js v22.17.0** (June 2025) -- most projects still use third-party packages
2. **Third-party glob packages dominate:** `glob` (312M/week), `fast-glob` (102M/week), `tinyglobby` (77M/week) as of March 2026
3. **Bun's `fs.glob` has only 4 commits** since its introduction in January 2025; the community is still finding more fundamental compat gaps (`withFileTypes` missing, directory matching broken, array patterns broken)
4. **The intersection of Bun users who use `fs.glob` and need dot-file matching is nearly zero**

## Impact on this codebase

Two files used `Bun.Glob`:

- **`packages/dev-script/file-enforcer/src/io/glob.ts`** -- `expandGlob()` requires `dot: true` to match hidden files. **Cannot migrate** to `fs.glob` due to this bug. Kept on `Bun.Glob`.
- **`packages/claude-code-plugins/session-start-housekeeping/src/index.ts`** -- matches named directories only (`packages/*/*/dist/final`), no dot-file concern. **Migrated** to `node:fs/promises` glob.

## Fix (upstream)

Add `dot: true` to the `mapOptions` return in `src/js/internal/fs/glob.ts`:

```typescript
return {
  cwd: options?.cwd ?? process.cwd(),
  followSymlinks: true,
  onlyFiles: false,
  dot: true,
  exclude,
};
```

This aligns with Node.js behavior where explicit dot patterns match dot files.
Wildcard exclusion of dot files is handled by minimatch/glob pattern semantics, not by the `dot` flag --
`Bun.Glob`'s `dot` flag controls whether the scanner **emits** dot entries at all,
which is a lower level than pattern matching.

## Source evidence

- **`src/js/internal/fs/glob.ts`** -- `mapOptions` function, missing `dot: true`
- **`src/bun.js/api/glob.zig`** line 70 -- `ScanOpts` defaults `.dot = false`
- **`packages/bun-types/bun.d.ts`** line 7646-7650 -- type definition confirms `dot` defaults to `false`
- **`src/js/node/fs.ts`** -- `node:fs` module imports and exposes `glob`/`globSync` from the internal module

## Verified on

- **Bun:** 1.3.10
- **Source:** oven-sh/bun `main` branch, cloned March 2026
