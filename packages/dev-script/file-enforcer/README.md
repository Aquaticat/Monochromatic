# file-enforcer

Declarative TypeScript tool for keeping derived files in sync across a monorepo.
Uses direct async function calls instead of a descriptor/engine pattern; each call reads and writes immediately.

## Motivation

Two problems prompted this package:

- Claude Code's `@AGENTS.md` include syntax is unreliable, so `CLAUDE.md` must be a literal copy of `AGENTS.md`
- Oxlint config files live in a config package but need to appear at the monorepo root

Generic file-sync GitHub Actions exist, but they target cross-repo sync and lack operations like concatenation, deduplication, and property extraction.

## Usage

Create a `file-enforcer.config.ts` at the monorepo root:

```ts
import {
  cat,
  overwrite,
} from '@monochromatic-dev/dev-script-file-enforcer/ts';

await overwrite('./CLAUDE.md', await cat(['./AGENTS.md',],),);
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

- `cat(files: string[])`: reads and concatenates files into a single string; paths containing `*` or `?` are auto-expanded as globs
- `cat(glob: string)`: reads files matching a glob pattern, returns `GlobResults` (a `GlobResult[]` carrying the source pattern)

### Writing

- `overwrite(dest, content)`: writes content to dest; skips when existing content is identical
- `overwriteIfNotExists(dest, content)`: writes only if the file does not exist
- `overwriteEach(destGlob, files)`: mirrors each `GlobResults` entry to a destination using positional wildcard substitution; source glob is read from the array

### Transforms

- `dedup(content)`: removes duplicate lines, preserving first occurrence order
- `getProperty(path, jsonContent)`: extracts a nested value using dot-separated paths (e.g., `.config.features`)
- `exec(cmd, args)`: runs a command and captures stdout
- `exec(platformCommands)`: platform-aware exec; evaluates `[predicate, command]` tuples top-to-bottom and runs the first match (see [Platform-aware exec](#platform-aware-exec) below)
- `evaluatePredicate(predicate)`: runs a predicate and returns whether it succeeded (exit 0); results cached per-session
- `inspect(value)`: debug tap that logs and returns the value unchanged

### Watch mode utilities

- `addWatchedPaths(paths)`: registers additional paths for watch mode to monitor (for `exec()` dependencies)
- `invalidatePaths(paths)`: surgically removes specific entries from the in-memory read cache
- `reset()`: clears read/write tracking sets between re-runs (preserves cache and write timestamps)

## Platform-aware exec

`exec()` accepts an array of `[predicate, command]` tuples for platform-dependent command dispatch.
Predicates are direct commands (no shell involved); exit code 0 means the predicate matched.
Tuples are evaluated top-to-bottom; the first match wins.

```ts
import { exec, } from '@monochromatic-dev/dev-script-file-enforcer/ts';

// Install git via the first available package manager
const output = await exec([
  [['mise', '--version',], ['mise', 'use', 'git',],],
  [['brew', '--version',], ['brew', 'install', 'git',],],
  [['dnf', '--version',], ['dnf', 'install', 'git',],],
],);
```

### Checking tool capabilities

Predicates can verify not just tool presence but specific capabilities.
Use `evaluatePredicate()` to combine multiple checks:

```ts
// Can mise manage git at all?
const hasMise = await evaluatePredicate(['mise', '--version',],);
const miseCanManageGit = hasMise
  && await evaluatePredicate(['mise', 'registry', 'git',],);

if (miseCanManageGit)
  await exec('mise', ['use', 'git',],);
```

### Reusable predicates

Define predicates as constants to share across multiple `exec()` calls:

```ts
const HAS_MISE = ['mise', '--version',] as const;

await exec([[HAS_MISE, ['mise', 'exec', '--', 'git', 'pull',],],],);
await exec([[HAS_MISE, ['mise', 'exec', '--', 'git', 'status',],],],);
```

### Manual dispatch with `evaluatePredicate()`

For complex logic that doesn't fit the tuple pattern, use `evaluatePredicate()` directly:

```ts
import {
  evaluatePredicate,
  exec,
} from '@monochromatic-dev/dev-script-file-enforcer/ts';

const hasMise = await evaluatePredicate(['mise', '--version',],);
const hasBrew = await evaluatePredicate(['brew', '--version',],);

if (hasMise)
  await exec('mise', ['use', 'git',],);
if (hasBrew)
  await exec('brew', ['install', 'git',],);
```

### Nested platform dispatch

The command slot accepts another `PlatformCommands` for multi-level dispatch.
The first element of the inner array being an array (not a string) triggers recursive evaluation.

```ts
await exec([
  [['mise', '--version',], [
    [['mise', 'where', 'python@3.12',], ['mise', 'exec', 'python@3.12', '--',
      'script.py',],],
    [['mise', 'where', 'python@3.11',], ['mise', 'exec', 'python@3.11', '--',
      'script.py',],],
  ],],
  [['python3', '--version',], ['python3', 'script.py',],],
],);
```

Nested command literals require `as const` to satisfy the recursive type.
Extract them into a typed constant to keep the call site readable:

```ts
const miseDispatch = [
  [['mise', 'where', 'python@3.12',], ['mise', 'exec', 'python@3.12', '--',
    'script.py',],],
  [['mise', 'where', 'python@3.11',], ['mise', 'exec', 'python@3.11', '--',
    'script.py',],],
] as const;

await exec([
  [['mise', '--version',], miseDispatch,],
  [['python3', '--version',], ['python3', 'script.py',],],
],);
```

### Negation via noop fallthrough

Predicates only express positive checks (exit 0 = match).
To express "if X is NOT available, do Y", match the positive case with a noop command and let the negative case fall through:

```ts
await exec([
  [['python3', '--version',], ['true',],], // python found → noop
  [['true',], installPython,], // fallthrough → install
],);
```

For complex negation logic, use `evaluatePredicate()` with control flow instead:

```ts
const hasPython = await evaluatePredicate(['python3', '--version',],);
if (!hasPython)
  await exec('apt-get', ['install', '--yes', 'python3',],);
```

## Package management

`ensurePackage()` ensures a system-level binary exists on the current machine,
installing it via the platform's native package manager if absent.
Designed for packages that mise cannot manage (system libraries, servers, desktop apps, core OS utilities).

### Basic usage

```ts
import {
  packages,
} from '@monochromatic-dev/dev-script-file-enforcer/data/packages.ts';
import {
  ensurePackage,
  registerPackages,
} from '@monochromatic-dev/dev-script-file-enforcer/ts';

registerPackages(packages,);

await ensurePackage('curl',); // already installed → noop
await ensurePackage('rg',); // not found → installs ripgrep via detected manager
```

### How it works

1. Check if the binary exists on PATH (runs `<binary> --version` or a custom check flag)
2. Look up the binary in the registered package index
3. Detect the system's package manager (apt, dnf, pacman, apk, zypper, brew, winget, scoop, choco)
4. Verify the package exists in the manager's repository (`apt-cache show`, `dnf info`, etc.)
5. Install the package (with auto-detected privilege escalation)
6. Verify the binary now exists on PATH

### Package index

The index ships as TypeScript source using the `p()` builder:

```ts
p('curl',); // binary = effname = package name everywhere
p({ bin: 'rg', effname: 'ripgrep', },); // binary differs from package name
p({ effname: 'wget', winget: 'JernejSimoncic.Wget', },); // per-manager override
p({ bin: 'openssl', check: 'version', effname: 'openssl', },); // custom existence check
```

The index is split into two files:

- `data/packages.generated.ts`: auto-generated from Repology database dump (7,332 entries).
  Freely rebuilt; contains effname and per-manager package name mappings.
- `data/packages.overrides.ts`: hand-maintained.
  Contains binary names, custom check flags, and corrections that Repology cannot infer.
  Survives index regeneration.
- `data/packages.ts`: merges both files into the final index.

### Supported package managers

| Manager | Detection           | Search                   | Install                            | Privilege |
| ------- | ------------------- | ------------------------ | ---------------------------------- | --------- |
| apt     | `apt-get --version` | `apt-cache show`         | `apt-get install --yes`            | sudo      |
| dnf     | `dnf --version`     | `dnf info`               | `dnf install --assumeyes`          | sudo      |
| pacman  | `pacman --version`  | `pacman -Si`             | `pacman -S --noconfirm`            | sudo      |
| apk     | `apk --version`     | `apk info --description` | `apk add`                          | sudo      |
| zypper  | `zypper --version`  | `zypper info`            | `zypper install --non-interactive` | sudo      |
| brew    | `brew --version`    | `brew info`              | `brew install`                     | user      |
| winget  | `winget --version`  | `winget show --exact`    | `winget install --id --exact`      | user      |
| scoop   | `scoop --version`   | `scoop info`             | `scoop install`                    | user      |
| choco   | `choco --version`   | `choco info`             | `choco install --yes`              | admin     |

Privilege escalation is auto-detected: `sudo` is prepended for managers that need root,
skipped when already running as root (UID 0 / container context).

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

- **source**: a tracked source file or the config changed; triggers re-run
- **protected**: a managed destination was modified externally; triggers re-run + system notification via `notify-send`
- **ignore**: unrelated file or our own write echoing through `fs.watch`

Echo detection compares the file's `mtime` against the recorded write timestamp.

### Mirror-glob expansion

`overwriteEach` maps wildcards positionally between source and destination patterns.
`packages/*/src/index.ts` -> `dist/*/index.ts` substitutes each captured segment into the corresponding position.

## Source files

All production source files are under 100 lines per the monorepo coding guidelines.

- `cache.ts`: in-memory read cache with invalidation and post-write updates
- `cat.ts`: overloaded file reading (array concatenation vs glob expansion)
- `ensure-package.ts`: `ensurePackage()` function, index lookup, binary check, install dispatch
- `evaluate-predicate.ts`: shell predicate evaluation with per-session caching
- `exec.ts`: child process execution with stdout capture and platform-aware tuple dispatch
- `glob.ts`: glob expansion and mirror-glob path mapping
- `inspect.ts`: generic debug tap
- `manager.ts`: package manager detection, `binaryExists`, `canProvide`, `installPackage`
- `merge.ts`: merge generated index with hand-maintained overrides
- `mod.ts`: re-exports for the public API
- `index.ts`: CLI entry point with find-up and --watch flag
- `notify.ts`: terminal warning + platform-aware desktop notification dispatch
- `p.ts`: `p()` builder for `PackageEntry` values
- `tracker.ts`: read/write/timestamp tracking for watch mode
- `transform.ts`: dedup and dot-prop getProperty
- `types.ts`: `PackageManager`, `PackageSpec`, `PackageEntry` type definitions
- `watch.ts`: main watch loop with debounce and cache-busting re-import
- `watch-dir.ts`: per-directory fs.watch wrapper with AbortController
- `watch-filter.ts`: event classification (source/protected/ignore)
- `write.ts`: overwrite, overwriteIfNotExists, overwriteEach with content-skip

## Tests

145 unit and integration tests covering all modules. Run via the mise task (preferred) or by invoking individual `*.unit.test.ts` files directly with `bun`:

```bash
mise run //packages/dev-script/file-enforcer:test:unit
```
