# file-enforcer

Declarative TypeScript tool for keeping derived files in sync across a monorepo.
Uses direct async function calls instead of a descriptor/engine pattern -- each call reads and writes immediately.

## Motivation

Two problems prompted this package:

- Claude Code's `@AGENTS.md` include syntax is unreliable, so `CLAUDE.md` must be a literal copy of `AGENTS.md`
- Oxlint config files live in a config package but need to appear at the monorepo root

Generic file-sync GitHub Actions exist, but they target cross-repo sync and lack operations like concatenation, deduplication, and property extraction.

## Usage

Create a `file-enforcer.config.ts` at the monorepo root:

```ts
import { cat, overwrite } from '@monochromatic-dev/dev-script-file-enforcer/ts';

await overwrite('./CLAUDE.md', await cat(['./AGENTS.md']));
```

Run it directly or through the CLI:

```bash
# Direct execution
bun file-enforcer.config.ts

# CLI (finds config via find-up)
bun packages/dev-script/file-enforcer/src/index.ts

# Watch mode -- re-runs on source changes, protects managed destinations
bun packages/dev-script/file-enforcer/src/index.ts --watch
```

## API

### Reading

- `cat(files: string[])` -- reads and concatenates files into a single string; paths containing `*` or `?` are auto-expanded as globs
- `cat(glob: string)` -- reads files matching a glob pattern, returns `GlobResults` (a `GlobResult[]` carrying the source pattern)

### Writing

- `overwrite(dest, content)` -- writes content to dest; skips when existing content is identical
- `overwriteIfNotExists(dest, content)` -- writes only if the file does not exist
- `overwriteEach(destGlob, files)` -- mirrors each `GlobResults` entry to a destination using positional wildcard substitution; source glob is read from the array

### Transforms

- `dedup(content)` -- removes duplicate lines, preserving first occurrence order
- `getProperty(path, jsonContent)` -- extracts a nested value using dot-separated paths (e.g., `.config.features`)
- `exec(cmd, ...args)` -- runs a command and captures stdout
- `inspect(value)` -- debug tap that logs and returns the value unchanged

### Watch mode utilities

- `addWatchedPaths(paths)` -- registers additional paths for watch mode to monitor (for `exec()` dependencies)
- `invalidatePaths(paths)` -- surgically removes specific entries from the in-memory read cache
- `reset()` -- clears read/write tracking sets between re-runs (preserves cache and write timestamps)

## Architecture

### Direct execution

The config file is a plain TypeScript script with top-level `await`.
Each function call reads from disk (or cache) and writes immediately.
There is no descriptor collection phase and no engine interpreter.
Users control sequencing and parallelism with `await` and `Promise.all`.

### In-memory read cache

After the first run, file contents are cached in memory.
On watch-mode re-runs, only the file that triggered the event is invalidated and re-read.
All other files return cached content, turning ~300 file reads into ~1.

### Content-based write skipping

`overwrite()` reads the existing destination content before writing.
If the content is identical, the write is skipped entirely.
This makes full re-runs cheap even without knowing which source changed.

### Watch mode

The CLI's `--watch` flag uses `fs.watch` on directories derived from tracked reads and writes.
Events are classified into three categories:

- **source** -- a tracked source file or the config changed; triggers re-run
- **protected** -- a managed destination was modified externally; triggers re-run + system notification via `notify-send`
- **ignore** -- unrelated file or our own write echoing through `fs.watch`

Echo detection compares the file's `mtime` against the recorded write timestamp.

### Mirror-glob expansion

`overwriteEach` maps wildcards positionally between source and destination patterns.
`packages/*/src/index.ts` -> `dist/*/index.ts` substitutes each captured segment into the corresponding position.

## Source files

All production source files are under 100 lines per the monorepo coding guidelines.

- `cache.ts` -- in-memory read cache with invalidation and post-write updates
- `cat.ts` -- overloaded file reading (array concatenation vs glob expansion)
- `exec.ts` -- child process execution with stdout capture
- `glob.ts` -- glob expansion and mirror-glob path mapping
- `inspect.ts` -- generic debug tap
- `mod.ts` -- re-exports for the public API
- `index.ts` -- CLI entry point with find-up and --watch flag
- `notify.ts` -- terminal warning + notify-send for write-protection events
- `tracker.ts` -- read/write/timestamp tracking for watch mode
- `transform.ts` -- dedup and dot-prop getProperty
- `watch.ts` -- main watch loop with debounce and cache-busting re-import
- `watch-dir.ts` -- per-directory fs.watch wrapper with AbortController
- `watch-filter.ts` -- event classification (source/protected/ignore)
- `write.ts` -- overwrite, overwriteIfNotExists, overwriteEach with content-skip

## Tests

132 unit and integration tests covering all modules:

```bash
bun test packages/dev-script/file-enforcer/src/
```
