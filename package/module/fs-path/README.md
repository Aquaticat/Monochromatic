# module-fs-path

POSIX path operations and repository-root discovery that run under Node,
 Bun,
 and browsers,
 plus Node-only directory and file helpers.
The package was extracted from `@monochromatic-dev/module-es`'s `path/` submodule so consumers that need only
filesystem and path utilities can depend on it directly.

## Entries

### `.` (platform-neutral)

Path operations:

- `dirname`,
   `join`,
   `resolve`,
   `normalize`,
   `isAbsolute`,
   `sep`:
   POSIX path operations.
   `join` and `resolve` take one array of segments.
- `trimLeadingSlash`,
   `trimTrailingSlash`:
   strip one leading or trailing `/` unless the path is `/`.

Root finders,
 each walking upward from `cwd` (default:
 the process working directory,
 or `/` where no process exists):

- `findMiseMonorepoRoot`:
   nearest ancestor whose `mise.toml` contains a `[monorepo]` section.
- `findGitRepoRoot`:
   nearest ancestor with a structurally usable `.git` directory or gitfile
   (HEAD,
   objects,
   refs,
   relative targets,
   and linked-worktree `commondir` pointers are validated;
   invalid nearer markers are skipped).
   Rejects with `GitRepositoryRootNotFoundError` when none exists.
- `findPnpmWorkspaceRoot`:
   nearest ancestor holding `pnpm-workspace.yaml`.
- `findMiseMonorepoRootCached`,
   `findGitRepoRootCached`,
   `findPnpmWorkspaceRootCached`:
   memoised variants that take no arguments,
   start from the process working directory on the first call,
   and return the same in-flight,
   fulfilled,
   or rejected promise for the process lifetime.

### `./node` (Node and Bun only)

- `ensureDir`,
   `ensureFile`,
   `ensurePath`:
   create the path when missing (parents included) and verify owner read and write access when it exists,
   granting the owner bits when the mode denies them.
   `ensurePath` picks file or directory by whether the path has an extension.
- `emptyDir`,
   `emptyFile`,
   `emptyPath`,
   `removeEmptyFilesInDir`:
   clear a directory's entries,
   truncate a file (a `?query` suffix is stripped first),
   dispatch by extension,
   or delete files that are empty after trimming.
- `findPackageRoot`,
   `findPackageRootCached`:
   nearest ancestor whose `package.json` `name` matches the given name,
   anchoring a package on its own root in source and built modes.

## Usage

```ts
import {
  findGitRepoRoot,
  findMiseMonorepoRootCached,
  join,
} from '@monochromatic-dev/module-fs-path';

const repoRoot = await findMiseMonorepoRootCached();
const gitRoot = await findGitRepoRoot({ cwd: import.meta.dirname, });
const manifest = join([repoRoot, 'package.json',],);
```

```ts
import {
  emptyDir,
  ensureDir,
} from '@monochromatic-dev/module-fs-path/node';

await ensureDir('dist',);
await emptyDir('dist',);
```

## Runtime support

The backends are chosen when the package is resolved,
 not at runtime.
`package.json` `imports` maps two private aliases by export condition:

- `#posix-path`:
   `node:path/posix` under the `node` condition,
   a pure-JS implementation with the same semantics under `default`.
- `#root-filesystem`:
   `node:fs/promises` under the `node` condition;
   under `default`,
   the origin private file system through `navigator.storage.getDirectory()` where the platform grants it,
   and otherwise an empty backend that finds no marker,
   so the finder rejects.

Node and Bun resolve the `node` condition (Bun's order is `bun`,
 `node-addons`,
 `node`,
 `require`,
 `import`,
 `default`),
 so they get `dist/final/node/index.mjs`.
Browsers and bundlers targeting them resolve `default` and get `dist/final/neutral/index.mjs`,
 which names no `node:` module.
Neither build contains a dynamic `import()`;
 a unit test reads every built chunk and rejects leaks in either direction,
 and a Playwright test drives the neutral build over OPFS in Chromium and Firefox
 (headless WebKit refuses OPFS writes and reports itself skipped).

In browsers,
 paths are absolute POSIX strings rooted at the OPFS root:
 `/repo/mise.toml` is the file `mise.toml` in the directory `repo` under `navigator.storage.getDirectory()`.
Marker files must exist there to be found.

A Node consumer whose bundler resolves the `default` condition gets the neutral build:
 path operations work,
 root discovery finds no filesystem and rejects.
Point the bundler at the `node` condition to keep `node:fs`.

## Logging

Diagnostics go through `@monochromatic-dev/module-logger`,
 inlined into both builds under the tags `rootDiscovery`,
 `rootFilesystem`,
 `findMonorepoRoot`,
 `findPackageRoot`,
 `path/ensure`,
 and `path/empty`.
The inlined logger builds its default sinks on first use;
 a consumer that also installs `@monochromatic-dev/module-logger` runs a second,
 independent logger instance.

## Source files

- `src/index.ts`:
   platform-neutral entry.
- `src/node.ts`:
   Node-only entry.
- `src/posix-path.node.ts`,
   `src/posix-path.neutral.ts`:
   the `#posix-path` backends.
- `src/root-filesystem-contract.ts`,
   `src/root-filesystem.node.ts`,
   `src/root-filesystem.neutral.ts`:
   the `#root-filesystem` contract and backends.
- `src/root-discovery.ts`:
   upward walk shared by the finders.
- `src/find-monorepo-root.ts`:
   the three root finders and `GitRepositoryRootNotFoundError`.
- `src/git-marker.ts`:
   Git administrative marker validation.
- `src/find-package-root.ts`,
   `src/ensure.ts`,
   `src/empty.ts`,
   `src/trim.ts`:
   the remaining helpers.

Decisions:
 `DECISIONS.md`.
