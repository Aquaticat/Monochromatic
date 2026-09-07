/**
 Platform-neutral entry (`\@monochromatic-dev/module-fs-path`).

 POSIX path operations and upward root discovery that run under Node, Bun,
 and browsers. The backends are chosen when the package is resolved, not at
 runtime: `package.json` maps `#posix-path` and `#root-filesystem` to
 `node:path/posix` and `node:fs/promises` under the `node` condition, and
 to the pure-JS path code and the origin private file system under
 `default`. Neither built artifact contains a dynamic import, and the
 neutral one names no `node:` module.

 Helpers that only make sense over a real filesystem (`ensureDir`,
 `emptyDir`, `findPackageRoot`, and their siblings) ship from
 `\@monochromatic-dev/module-fs-path/node`.

 @module
 */

export {
  dirname,
  isAbsolute,
  join,
  normalize,
  resolve,
  sep,
} from '#posix-path';
export {
  findGitRepoRoot,
  findGitRepoRootCached,
  findMiseMonorepoRoot,
  findMiseMonorepoRootCached,
  findPnpmWorkspaceRoot,
  findPnpmWorkspaceRootCached,
  GitRepositoryRootNotFoundError,
} from './find-monorepo-root.ts';
export {
  trimLeadingSlash,
  trimTrailingSlash,
} from './trim.ts';
