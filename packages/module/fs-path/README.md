# module-fs-path

POSIX path utilities,
 filesystem path-emptying and ensuring helpers,
 and repository-root discovery.
Cross-runtime helpers delegate to `node:path/posix` and `node:fs/promises` when available,
fall back to pure-JS path implementations,
 and use OPFS through `happy-opfs` in browser environments.

This package was extracted from `@monochromatic-dev/module-es`'s `path/` submodule so consumers needing only
filesystem and path utilities can depend on it directly without pulling in the rest of `module-es`.

## Exports

The package is source-only.
`.` resolves to `./src/index.ts` (the barrel),
 which re-exports every public helper.
`./find-monorepo-root` resolves directly to `./src/find-monorepo-root.ts` for consumers that only need root
finders.
`./find-package-root` resolves directly to `./src/find-package-root.ts` for consumers that only need package-root
finding.

### Path helpers

- `dirname` (`src/index.ts`):
   returns the directory portion of a POSIX path and delegates to `node:path/posix`
  when available.
- `join` (`src/index.ts`):
   joins path segments with `/` and normalizes the result.
- `resolve` (`src/index.ts`):
   resolves a sequence of paths to an absolute path.
- `isAbsolute` (`src/index.ts`):
   checks whether a POSIX path starts with `/`.
- `sep` (`src/index.ts`):
   exposes POSIX path separator `/`.
- `trimLeadingSlash` (`src/trim.ts`):
   removes a leading `/` unless the path is root.
- `trimTrailingSlash` (`src/trim.ts`):
   removes a trailing `/` unless the path is root.

### Root finders

- `findMiseMonorepoRoot` (`src/find-monorepo-root.ts`):
   walks upward for a `mise.toml` containing `[monorepo]`
  and preserves runtime-native path identity.
- `findMiseMonorepoRootCached` (`src/find-monorepo-root.ts`):
   memoised variant that locks the first resolved
  mise root for process lifetime.
- `findGitRepoRoot` (`src/find-monorepo-root.ts`):
   walks upward for a structurally usable `.git` directory or gitfile,
   validating HEAD,
  objects,
  refs,
  relative targets,
  and linked-worktree `commondir` pointers while preserving runtime-native path identity.
  Invalid nearer markers are skipped.
- `findGitRepoRootCached` (`src/find-monorepo-root.ts`):
   memoised variant that locks the first resolved Git root
  for process lifetime.
- `findPnpmWorkspaceRoot` (`src/find-monorepo-root.ts`):
   walks upward for `pnpm-workspace.yaml` and preserves runtime-native path identity.
- `findPnpmWorkspaceRootCached` (`src/find-monorepo-root.ts`):
   memoised variant that locks the first resolved
  pnpm workspace root for process lifetime.
- `findPackageRoot` (`src/find-package-root.ts`):
   walks upward for a `package.json` whose `name` field matches a
  given value,
   anchoring a package on its own root in source and built modes.
   Node/Bun only.
- `findPackageRootCached` (`src/find-package-root.ts`):
   memoised variant of `findPackageRoot`,
   keyed by package
  name.

### Filesystem helpers

- `ensureDir` (`src/ensure.ts`):
   creates a directory recursively when missing,
   verifies read/write when it exists.
- `ensureFile` (`src/ensure.ts`):
   creates a file and parents when missing,
   verifies read/write when it exists.
- `ensurePath` (`src/ensure.ts`):
   dispatches to `ensureFile` or `ensureDir` based on whether the path has an
  extension.
- `emptyDir` (`src/empty.ts`):
   removes all entries inside a directory without removing the directory itself.
- `emptyFile` (`src/empty.ts`):
   truncates a file to zero bytes and strips `?query` suffix before opening.
- `emptyPath` (`src/empty.ts`):
   dispatches to `emptyFile` or `emptyDir` based on whether the path has an
  extension.
- `removeEmptyFilesInDir` (`src/empty.ts`):
   deletes zero-byte files after trimming within a directory and leaves
  non-files and non-empty files alone.

## Usage

```ts
import {
  findGitRepoRoot,
  findMiseMonorepoRoot,
  findPnpmWorkspaceRoot,
} from '@monochromatic-dev/module-fs-path/find-monorepo-root';

const miseRoot = await findMiseMonorepoRoot();
const gitRoot = await findGitRepoRoot({ cwd: import.meta.dirname, });
const pnpmRoot = await findPnpmWorkspaceRoot();
```

```ts
import {
  dirname,
  emptyDir,
  ensureDir,
  trimTrailingSlash,
} from '@monochromatic-dev/module-fs-path';

await ensureDir('dist',);
await emptyDir(trimTrailingSlash(dirname('dist/bundle.js/',),),);
```

## Runtime support

`findMiseMonorepoRoot`,
 `findGitRepoRoot`,
 and `findPnpmWorkspaceRoot` share one filesystem backend chosen on
first root-discovery call:

- Node and Bun:
   `node:fs/promises` via dynamic import.
   Text probes use `readFile`,
   and marker probes use `lstat`.
- Browser with OPFS support:
   `happy-opfs` `readTextFile` and `exists`,
   with a warning logged on first use.
- Browser without OPFS:
   stub backend that never finds marker files,
   so the upward walk exhausts and the finder
  throws.

Cached root finders take no arguments.
 The first call captures the process working directory and returns the same
in-flight,
 fulfilled,
 or rejected promise for process lifetime.
 Use the uncached finder when a caller intentionally
changes `process.cwd()` and needs a fresh walk.

`findPackageRoot` is Node/Bun only:
 it reads `package.json` via `node:fs/promises` directly with no browser fallback.
Current consumers anchor on `import.meta.dirname`,
 which is itself Node-only.
 A cross-runtime backend can be added
when a browser consumer needs it.

The path utilities (`dirname`,
 `join`,
 `resolve`,
 `isAbsolute`) delegate to `node:path/posix` when available and fall
back to pure-JS implementations in `src/fallbacks.ts` otherwise.

## Built artifact is node/bun only

The source obfuscates the `node:path` specifier (`` `node${':path'}` ``) so browser bundlers cannot statically
resolve it,
 keeping `src/` genuinely cross-runtime.
 Browser consumers import the `/ts` source,
 where that obfuscation
is intact.

The neutral `.` build (`dist/final/neutral/index.mjs`) is a different story:
 rolldown constant-folds the template
literal back to a plain `import('node:path')`,
 so the built artifact is effectively node/bun-only.
 Nothing in this
repo loads the `.` dist in a browser (all consumers use `/ts`),
 so this is inconsequential in practice,
 but do not
assume the built `.` bundle is browser-loadable.
