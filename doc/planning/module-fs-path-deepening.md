# module-fs-path deepening: the walker and its filesystem seam become the interface

Status:
 in progress (2026-09-08).
Owner decisions from the architecture grilling are recorded here as they land;
 this file is canonical for the change.
Mechanism for the release that follows:
 `doc/planning/module-fs-path-release.md` and `doc/decision/npm-publishing.md`.

## Driver

The 2026-09-07 architecture review of `package/module/fs-path` (report kept outside the repo,
 findings summarised here) picked "walker plus seam as the deep module" from six candidates.
Measured before the change:

- Four root finders (`findMiseMonorepoRoot`,
   `findGitRepoRoot`,
   `findPnpmWorkspaceRoot`,
   `findPackageRoot`) each with a cached twin,
   its own error text,
   its own memo,
   and its own log tag;
   the shared upward walk (`findRootByWalkingUp`) sat behind them,
   unreachable by callers and tests.
- `findPackageRoot` had its own recursion,
   its own `Map` memo keyed by package name only,
   and read `node:fs/promises` directly,
   so it shipped from `./node` although nothing in it needs Node once the seam exists.
- The `RootFilesystem` seam had two real adapters (`node:fs/promises`,
   OPFS) but no test adapter;
   every marker test built a directory tree under `mkdtemp`.
- Error identity was a string compare (`error.message === GIT_ROOT_MISSING_MESSAGE`) rewrapped into `GitRepositoryRootNotFoundError`;
   the other finders threw bare `Error`.
- Nine other upward walks live elsewhere in the repo (six `find-up` call sites,
   two hand-rolled `node_modules` walks,
   one in `module-test`),
   none able to reuse the walk because its interface was private.
- The `[monorepo]` matcher framed the file with `\n` and searched for `\n[monorepo]\n`,
   so a CRLF file or a header followed by a comment never matched.
- Consumers of the finders outside the package:
   26 files (list under "Migration").

## Settled decisions (2026-09-07)

- Q1,
   interface (owner chose "one manual and a badge drawer"):
   `findRoot({ marker, cwd?, fs? })` and `findRootCached({ marker, cwd? })` are the interface.
   A `RootMarker` is `{ name, matches({ dir, fs }) }`.
   Presets `MISE_MONOREPO`,
   `GIT_REPOSITORY`,
   `PNPM_WORKSPACE`;
   factories `packageNamed(name)`,
   `fileNamed(name)`,
   `directoryNamed(name)`.
   A new kind of root is one value,
   not a new function pair.
   Rejected:
   keeping the four named finders as thin wrappers (the deletion test says they vanish without loss),
   and a marker registry keyed by string (nothing varies across it).
- Q2,
   test seam (owner chose the public `fs` option):
   `findRoot` accepts a `RootFilesystem`,
   and the package ships `createMemoryRootFilesystem({ files, directories, links })` as a third adapter.
   Marker tests become data tables over the memory adapter;
   a few real-filesystem cases remain to prove the Node adapter reads real files,
   symbolic links included.
- Q3,
   migration (owner chose "migrate everything"):
   every importer moves to the new names in the same change,
   the old names are removed rather than deprecated,
   `package/module/matrix/src/root.ts` is deleted,
   and 0.2.0 ships.
   Rejected:
   a deprecation period (the package has one consumer,
   this repository).
- Q4,
   side findings:
   the CRLF and trailing-comment `[monorepo]` blind spot is fixed inside this change;
   everything else is tracked as GitHub issues #500 to #505 and not done here.
- Q5,
   memo key (owner chose "marker name plus start directory resolved at call time" after rejecting a process-pinned key):
   `findRootCached` keys its memo on `marker.name` and `cwd ?? <runtime default cwd>` resolved at call time,
   and keeps rejections per key.
   A `'<process>'` pin was proposed and withdrawn:
   commit `701dfc88e` chose lock-first as a lazy wrapper,
   not for a reason,
   and `process.chdir` appears only in logger fuzz harnesses and terminal-exec,
   which never call a finder.
   Consequence for package-root discovery:
   two modules of one package with different `import.meta.dirname` now run two walks instead of sharing one;
   accepted.
- Adopted without asking because the settled decisions determine them:
   one `RootNotFoundError { marker, startDir }` for every marker (the git subclass goes;
   git-policy's two `instanceof` sites switch to it);
   the filesystem contract keeps five probes and drops `resolvePath`
   (the git marker resolves gitfile and `commondir` targets through `#posix-path`,
   which is what both adapters did);
   `packageNamed` moves package-root discovery to the root entry,
   so `./node` keeps only the ensure and empty family (their fate is #503);
   one walker log line per walk under the tag `rootDiscovery`;
   `fileNamed` probes `isFile` and `directoryNamed` probes `isDirectory`,
   so `PNPM_WORKSPACE` no longer accepts a directory named `pnpm-workspace.yaml`
   (the old matcher used `exists`).
- `[monorepo]` matcher:
   split on `\n`,
   trim each line (which drops `\r`),
   accept `[monorepo]` alone or followed by a `#` comment,
   refuse the header inside a value.
   Whitespace inside the brackets (`[ monorepo ]`,
   valid TOML) stays unmatched;
   nothing in the repo writes it.

## Migration

Files outside the package that name a finder or the git error (measured 2026-09-08 with `rg`):

- `package/build-tool/css/src/cli.unit.test.ts`
- `package/cli/fy/src/cli.unit.test.ts`
- `package/cli/fy/src/resolve.ts`
- `package/cli/git-clone-size/src/cli.unit.test.ts`
- `package/cli/mutation-test/src/container/worktree.ts` (comment only)
- `package/cli/mvm/src/cli.unit.test.ts`
- `package/cli/rgffplay/src/index.unit.test.ts`
- `package/cli/vmsync/src/index.unit.test.ts`
- `package/dev-script/deps-cube/src/cli.ts`
- `package/dev-script/deps-cube/src/render-html.ts`
- `package/dev-script/vm-builder/src/build-and-import.ts`
- `package/dev-script/vm-builder/src/sign-and-push.ts`
- `package/git-policy/cli/src/rule/require-root.ts`
- `package/git-policy/cli/src/trust/config-discovery.ts`
- `package/git-policy/cli/src/trust/fixture/final-newline-workflow.ts`
- `package/mcp/mvm/src/index.unit.test.ts`
- `package/module/image-diff/src/cli.unit.test.ts`
- `package/module/matrix/src/matrix.ts`
- `package/module/matrix/src/root.ts` (deleted)
- `package/module/test/src/format-error.ts` (dynamic import site,
   changed mechanically)
- `package/module/token-count/src/cli.unit.test.ts`
- `package/oxlint-plugin/test-support/src/index.ts`
- `package/ssg/aquati.cat/src/lib/git-dates.ts`
- `package/test-fixture/file-enforcer-perf/src/run-constrained-config.ts`
- `package/webapp-productivity/doodle-widget/src/source-url.ts`
- `package-paused/dev-script/inference-canary-viewer/src/data/diff.ts` (outside the workspace globs;
   edited so no stale name remains)

Mapping:
 `findMiseMonorepoRootCached()` becomes `findRootCached({ marker: MISE_MONOREPO })`;
 `findGitRepoRoot({ cwd })` becomes `findRoot({ cwd, marker: GIT_REPOSITORY })`;
 `findPackageRootCached({ dir, name })` becomes `findRootCached({ cwd: dir, marker: packageNamed(name) })`;
 `GitRepositoryRootNotFoundError` becomes `RootNotFoundError`.

## Execution plan

1.   This record,
     committed first.
2.   Package source:
     marker contract,
     markers,
     walker with error and memo,
     memory adapter,
     contract without `resolvePath`,
     both adapters,
     git marker over `#posix-path`,
     entries.
     Remove `find-monorepo-root.ts` and `find-package-root.ts`.
3.   Tests:
     memory-adapter tables per marker (git marker branches included),
     walker and memo cases,
     memory adapter semantics,
     the few real-filesystem cases,
     leak guard and neutral-artifact test updated,
     browser gate updated to the new names.
4.   Migration of the files listed under "Migration".
5.   `DECISIONS.md`,
     README,
     changeset (`minor`).
6.   Lint,
     types,
     unit tests,
     Chromium gate;
     commit early with explicit pathspecs;
     CI publishes 0.2.0 through the trusted publisher registered on 2026-09-07 (first CI publish of this package).

## Progress log

- 2026-09-08:
   record written.

## Next action

Implement step 2.
