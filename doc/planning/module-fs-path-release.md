# module-fs-path first npm release

Status:
 in progress (2026-09-07).
Owner decisions from the release grilling are recorded here as they land;
 this file is canonical for the release.
Mechanism and prior art:
 `doc/decision/npm-publishing.md` and `doc/planning/module-logger-release.md`.

## Driver

`@monochromatic-dev/module-test` cannot publish while it depends on private packages.
The logger shipped on 2026-09-06 (0.4.0 today);
 `module-fs-path` is the other private dependency,
 so it gets the same treatment next.
After this release,
 `module-test` still waits on `module-async-time`,
 `module-caught-value`,
 `module-const`,
 and `module-numeric-format`.

## Settled decisions (2026-09-07)

- The published artifact follows the logger's platform split
   (`package/module/logger/DECISIONS.md`,
   "Platform-specific sinks live behind `./node` and `./browser`"):
   the root entry `.` is platform-neutral (POSIX path ops,
   trims,
   the three root finders,
   `GitRepositoryRootNotFoundError`);
   `./node` ships `ensureDir`,
   `ensureFile`,
   `ensurePath`,
   `emptyDir`,
   `emptyFile`,
   `emptyPath`,
   `removeEmptyFilesInDir`,
   `findPackageRoot`,
   and `findPackageRootCached` with static `node:` imports.
   The owner rejected a Node-only 0.1.0 (the package was created to run in browsers,
   confirmed by the extraction commit `894c84a5d`,
   the `dom` tsconfig,
   and the OPFS backend)
   and a single entry with dynamic imports (the logger decision measured that every `import()` leaks into every downstream bundle).
- Backends are chosen at resolution time through `package.json` `imports` entries:
   `#posix-path` (`node`:
   `node:path/posix`;
   `default`:
   the pure-JS implementation)
   and `#root-filesystem` (`node`:
   `node:fs/promises`;
   `default`:
   OPFS or an empty backend).
   Neither built artifact contains `import(`;
   the neutral artifact names no `node:` module;
   the node artifact touches no `navigator.storage`.
- The OPFS backend is rewritten on `navigator.storage.getDirectory()`,
   as the logger's OPFS sink already is.
   `happy-opfs` leaves the manifest,
   the pnpm catalog,
   and the lockfile:
   929 kB unpacked plus five transitive packages that every Node installer would download for a path no consumer runs.
- `normalize` is public and delegates to `node:path/posix` under the `node` condition like its siblings.
   `dirnameFallback`,
   `joinFallback`,
   and `resolveFallback` leave the public entry:
   in the neutral artifact they are the implementation,
   so tests import `dist/final/neutral/index.mjs` directly.
   The top-level `await import` in `index.ts` goes with them.
- Logger and caught-value stay inlined (standing decision).
   Accepted consequence:
   a consumer using both `module-logger` and `module-fs-path` runs two logger instances with separate sink discovery.
- A real Chromium run is a release gate:
   the Playwright harness (podman,
   local only,
   no browser CI job yet)
   loads the neutral artifact in the page,
   writes marker files into OPFS,
   and calls the finders.
   Firefox and WebKit run too and may report skipped where the platform refuses OPFS.
   The chunk-text leak test from the logger is adopted with positive controls and a proven red run.
- Tests for the seven untested fs helpers and the error class,
   through the built `./node` artifact.
   The `self.unit.test.ts` aggregator is replaced by the root `test:unit` task,
   which clears the 3 `require-eventual-artifact` findings.
- Manifest:
   drop `private`;
   `publishConfig` with `access: public`,
   `provenance: true`,
   and `exports` without `./ts`;
   `engines.node >=24` (both builds call `Error.isError` through the inlined logger);
   `sideEffects: false` (module-level state is loggers and caches);
   `files` gains `CHANGELOG.md`;
   inlined workspace dependencies move to `devDependencies`;
   the stale `dist/final/types/tsconfig.tsbuildinfo` (2026-07-21,
   110 kB) is removed before packing.
   The description keeps "Node/Bun and browser":
   Bun honors the `node` condition (`bun`,
   `node-addons`,
   `node`,
   `require`,
   `import`,
   `default`).
- First version 0.1.0 from a `minor` changeset;
   the first publish is local and interactive in this session,
   the owner typing the one-time password;
   later versions publish from CI with provenance.
- Records:
   `package/module/fs-path/DECISIONS.md` for the split (package docs stay beside code),
   this file for the release,
   README rewritten.

## Measured state (2026-09-07)

- `package/module/fs-path/package.json`:
   `private: true`,
   version 0.0.1,
   404 on the registry;
   `dependencies` on `module-caught-value` (private),
   `module-logger` (published),
   and `happy-opfs`.
- Both built artifacts inline the logger and caught-value (no `@monochromatic-dev` import),
   statically import `node:fs/promises` and `node:path` (from `ensure.ts`,
   `empty.ts`,
   `find-package-root.ts`),
   and carry `import(` of `happy-opfs`,
   `node:fs/promises`,
   and `node:path`.
   The `default` export condition therefore hands a browser bundler Node builtins.
- Consumers:
   34 import lines in 30 files,
   every one a Node context;
   no built client bundle in the repo contains fs-path code;
   `doc/troubleshooting/css-tooling.md` records done-postcss routing around fs-path because its imports dragged Node builtins into the client bundle.
   Only `dev-script/deps-cube` (2 files) imports a Node-only helper (`findPackageRootCached`);
   nothing in the repo imports the `ensure*` or `empty*` helpers.
- Gates:
   `lint:types` green;
   `buildAndTest` green;
   `lint:oxlint` red with 3 `require-eventual-artifact` errors on `self.unit.test.ts`.
   `ensureDir`,
   `ensureFile`,
   `ensurePath`,
   `emptyDir`,
   `emptyFile`,
   `emptyPath`,
   `removeEmptyFilesInDir`,
   and `GitRepositoryRootNotFoundError` have no test.
- README claims the package is source-only and lists `./find-monorepo-root` and `./find-package-root` subpaths removed in commit `06cceaa67` (2026-05-29).
- `npm pack --dry-run`:
   22 files,
   347 kB unpacked,
   including the stale tsbuildinfo.
- `doc/todo/packages.md` carried the open item "decide whether `module-fs-path` should publicly export `normalize()`";
   decided above.

## Execution plan

1.   This record.
2.   Platform split with the native OPFS backend;
     deps-cube imports move to `/ts/node.ts`;
     both builds and `lint:types` green.
3.   Tests:
     fs helpers and the error class through `./node`;
     pure-JS path ops and the no-filesystem behavior through the neutral artifact;
     the leak guard with positive controls and a proven red run;
     root `test:unit` replaces the aggregator;
     zero lint findings.
4.   Browser gate:
     harness route,
     `*.browser.test.ts`,
     Chromium pass,
     proven red run.
5.   Manifest,
     README,
     `DECISIONS.md`,
     `npm pack --dry-run` inspected.
6.   Changeset (`minor`),
     Version Packages pull request,
     tarball verified in a disposable Node 24 consumer.
7.   Bootstrap publish per `doc/runbook/publish-npm-package-first-time.md` with fs-path names,
     `npm trust github`,
     merge,
     tag and release,
     registry install verified.
8.   Records closed;
     `doc/todo/packages.md` item resolved.

## Progress log

- 2026-09-07:
   grilling complete;
   this record written.
- 2026-09-07,
   split landed:
   `e3badc3d7` (platform split,
   native OPFS backend,
   happy-opfs out of manifest,
   catalog,
   and lockfile;
   deps-cube imports moved to `/ts/node.ts`).
   The lockfile was regenerated with the committed pnpm 11.21.0 through `mise exec pnpm@11.21.0`:
   the uncommitted pnpm 12.3.4 bump in `mise.lock` (another session's change) fails every `pnpm install` in this checkout,
   pristine or not,
   while re-verifying the lockfile:
   `ERR_PNPM_META_FETCH_FAIL` fetching `@jsr/std__path` from `registry.npmjs.org`.
   Recorded in `doc/troubleshooting/pnpm-12-jsr-scope-lockfile-verification.md`.
   The deps-cube lint findings (11 warnings,
   21 errors in `controller.ts` and two test files) predate this change.
- 2026-09-07,
   tests landed:
   `27ad96116`.
   Two defects surfaced and fixed in the same commit:
   `ensureDir` and `ensureFile` repaired permissions with `chmod(path, R_OK | W_OK)` (mode `0o006`,
   owner locked out);
   the pure-JS `dirname` skipped one trailing slash where `node:path/posix` skips the run.
   Guard-failure proof for the platform-split guard:
   root entry made to re-export `ensureDir`,
   rebuilt,
   two cases red;
   restored,
   green.
- 2026-09-07,
   browser gate landed:
   `36400f8c8`.
   Chromium 2 passed,
   Firefox 2 passed,
   WebKit 1 passed and 1 skipped (OPFS writes refused).
   Guard-failure proof:
   OPFS backend made to report every path absent,
   rebuilt,
   Chromium 1 failed;
   restored,
   2 passed.
- 2026-09-07,
   manifest and docs:
   `fdc0302df`;
   changeset and todo item:
   `bbb395445`.
   The manifest commit reached `main` before the changeset,
   so the release workflow saw a public package at 0.0.1 missing from the registry and tried to publish it:
   `E404` from `PUT .../module-fs-path` (no trusted publisher can exist before the bootstrap).
   Harmless;
   lesson for the runbook:
   land the changeset in the same push as dropping `private`.
- 2026-09-07,
   tarball verified in a disposable Node 26 consumer:
   `dependencies` empty,
   no `./ts` export,
   no `workspace:` string,
   no tsbuildinfo;
   `findMiseMonorepoRoot`,
   `ensureDir`,
   and `findPackageRootCached` work from the installed package;
   `/ts` refused with `ERR_PACKAGE_PATH_NOT_EXPORTED`.
   The consumer's fixture put `[monorepo]` on line 1 of `mise.toml` and the finder missed it (the marker required a newline before the header):
   fixed in `a7876a2a2` with three regression cases.
