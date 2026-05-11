# module-fs-path

POSIX path utilities, filesystem path-emptying and ensuring helpers, and monorepo-root discovery for the Monochromatic monorepo.
Cross-runtime: delegates to `node:path/posix` and `node:fs/promises` when available, falls back to pure-JS implementations and OPFS (`happy-opfs`) in browser environments.

This package was extracted from `@monochromatic-dev/module-es`'s `path/` submodule so that consumers needing only filesystem and path utilities can depend on it directly without pulling in the rest of `module-es`.

## Exports

The package is source-only.
`.` resolves to `./src/index.ts` (the barrel), which re-exports every helper.
`./find-monorepo-root` resolves directly to `./src/find-monorepo-root.ts` for consumers that only need that one function.

| Function                | Source                      | Description                                                                                              |
| ----------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------- |
| `dirname`               | `src/index.ts`              | Returns the directory portion of a POSIX path. Delegates to `node:path/posix` when available.            |
| `join`                  | `src/index.ts`              | Joins path segments with `/` and normalizes the result.                                                  |
| `resolve`               | `src/index.ts`              | Resolves a sequence of paths to an absolute path.                                                        |
| `isAbsolute`            | `src/index.ts`              | Whether a POSIX path starts with `/`.                                                                    |
| `sep`                   | `src/index.ts`              | POSIX path separator (`'/'`).                                                                            |
| `findMonorepoRoot`      | `src/find-monorepo-root.ts` | Walks upward for a `mise.toml` containing `[monorepo]`. Normalizes `/home/` to `/var/home/` for ostree.  |
| `ensureDir`             | `src/ensure.ts`             | Creates a directory recursively when missing, verifies read/write when it exists.                        |
| `ensureFile`            | `src/ensure.ts`             | Creates a file (and parents) when missing, verifies read/write when it exists.                           |
| `ensurePath`            | `src/ensure.ts`             | Dispatches to `ensureFile` or `ensureDir` based on whether the path has an extension.                    |
| `emptyDir`              | `src/empty.ts`              | Removes all entries inside a directory without removing the directory itself.                            |
| `emptyFile`             | `src/empty.ts`              | Truncates a file to zero bytes. Strips `?query` suffix before opening.                                   |
| `emptyPath`             | `src/empty.ts`              | Dispatches to `emptyFile` or `emptyDir` based on whether the path has an extension.                      |
| `removeEmptyFilesInDir` | `src/empty.ts`              | Deletes zero-byte files (after trimming) within a directory; leaves non-files and non-empty files alone. |
| `trimLeadingSlash`      | `src/trim.ts`               | Removes a leading `/` unless the path is root.                                                           |
| `trimTrailingSlash`     | `src/trim.ts`               | Removes a trailing `/` unless the path is root.                                                          |
| `normalize`             | `src/fallbacks.ts`          | Browser fallback for `node:path/posix.normalize`. Exported for completeness.                             |
| `dirnameFallback`       | `src/fallbacks.ts`          | Browser fallback for `dirname`. Used internally by `dirname` when `node:path` is unavailable.            |
| `joinFallback`          | `src/fallbacks.ts`          | Browser fallback for `join`.                                                                             |
| `resolveFallback`       | `src/fallbacks.ts`          | Browser fallback for `resolve`.                                                                          |

## Usage

```ts
import { findMonorepoRoot, } from '@monochromatic-dev/module-fs-path/find-monorepo-root';

const root = await findMonorepoRoot();
```

```ts
import {
  dirname,
  ensureDir,
  emptyDir,
  trimTrailingSlash,
} from '@monochromatic-dev/module-fs-path';

await ensureDir('dist');
await emptyDir(trimTrailingSlash(dirname('dist/bundle.js/'),),);
```

## Runtime support

`findMonorepoRoot` chooses a filesystem backend on first call:

- Node and Bun: `node:fs/promises` via dynamic import.
- Browser with OPFS support: `happy-opfs` `readTextFile` (logs a warning on first use).
- Browser without OPFS: stub that always returns `undefined`; the upward walk exhausts and the function throws.

The path utilities (`dirname`, `join`, `resolve`, `isAbsolute`) delegate to `node:path/posix` when available and fall back to the pure-JS implementations in `src/fallbacks.ts` otherwise.
