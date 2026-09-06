# module-logger first npm release

Status:
 planning,
 grilling in progress (2026-09-06).
Owner decisions are recorded here as they land;
 this file is canonical for the release,
 not `package/module/logger/bulletproofing.plan.md`.

## Legacy reference

`package/module/logger/bulletproofing.plan.md` (written 2026-06-15,
 amended by a GPT Pro review) is a verification program,
 not a release plan.
The owner classified it as a historical reference written by an unreliable narrator.
Measured against current code on 2026-09-06:

- It predates the IndexedDB and localStorage sinks,
   the record buffer,
   and the bounded storage retries (all 2026-07-22),
   so its sink inventory and file map are wrong.
- Gap B (log call throws) is reachable only through `createLogger` with custom sinks;
   console `verify` fails only when `console` or `queueMicrotask` is missing.
- Gap A3 (retire after 10 failures) is unreachable for every shipped sink,
   which each swallow their own write errors,
   and it reverses the 2026-06-14 decision in `package/module/logger/DECISIONS.md`.
- Its claim that `%s` in a single-argument `console.info` is interpreted is false on the built artifact:
   `%s%d` reaches stdout literally.
- Its claim that terminal escapes pass through raw is true on the built artifact:
   OSC title-set and CSI clear-screen bytes reach stdout unchanged.

Its post-release value (toml-edit verification bar,
 model oracle,
 scheduler interleavings) is to be rewritten as a separate post-release track.

## Settled decisions

- Release means npm publish under `@monochromatic-dev` with provenance,
   the scope's first publish ever.
   The owner confirms the scope exists and they can publish to it.
- Driver:
   `@monochromatic-dev/module-test` is blocked by issue #338 because it depends on the private logger.
- README import examples change to root and `/ts` imports;
   no `/tagged` or `/logger` subpath exports are added.
- The four tuning options from the legacy plan (flush deadline,
   verify timeout,
   retire threshold,
   buffer cap) stay out of 0.1.0.
- The retire-after-N-failures policy is dropped;
   only `verify` failure retires a sink,
   as `DECISIONS.md` 2026-06-14 records.
- The console sink neutralizes every control character except `\n` and `\t` before 0.1.0;
   no SGR allowlist.
   This is a publish gate (rule `SYB`).
- Shipped tests and `tsconfig.tsbuildinfo` are excluded from tarballs repo-wide (issue #336),
   not for the logger alone;
   mechanism still open.
- Scope:
   the logger now,
   to enable publishing more later;
   the eight-package closure of `module-test` is not this release.
- `./ts` stays in the published surface,
   so `module-caught-value` publishes alongside the logger.
   Its dependency type given `./ts` is still open.
- Tarball:
   `tsconfig.tsbuildinfo` leaves every tarball via the shared tsconfig;
   test files ship (owner accepts the mixed ecosystem practice).
- Publish mechanism:
   fix `.github/workflows/publish.yml` (build step,
   auth gated on live runs,
   filter list including both packages).
   Bootstrap authenticates with a granular npm token in `NPM_TOKEN` for one live run;
   afterwards `npm trust github` per package and the token is deleted.
   Trusted publishing was never set up;
   the workflow used a token secret that does not exist in the repo.
- First version:
   0.1.0 for the logger;
   caught-value also 0.1.0 unless the owner vetoes.
- `module-caught-value` becomes an optional peer dependency of the logger (`workspace:^` so the published range is `^0.1.0`),
   kept as a devDependency for the logger's own build and tests.
   Repo precedent:
   workspace peers in `package/pi-plugin/goal/package.json`,
   `peerDependenciesMeta` in `package/pi-shared/model-selection/package.json`.
- The 25 `require-eventual-artifact` findings gate the publish:
   internals are exported from the entry as `@internal` and their tests import the built artifact.
- A `doc/decision/` entry supersedes the "bundle, do not publish" direction.
- The no-backend throw stays in 0.1.0:
   reachable only through `createLogger` with sinks that all fail verify,
   documented,
   pinned by tests,
   and consistent with rules PP4 and PP7.
- The legacy plan becomes a post-release track after a rewrite that fixes its inventory and removes the items decided against here.

## Measured state (2026-09-06)

- Nothing in the `@monochromatic-dev` scope exists on npm;
   ten names probed,
   all 404.
   No local npm login (`npm whoami` returns 401).
- `package/module/logger/package.json`:
   `private: true`,
   version 0.0.1,
   no `publishConfig`,
   `dependencies` on unpublished `module-caught-value`,
   exports `.`,
   `./ts`,
   `./ts/*`.
- Built dist bundles caught-value (no `@monochromatic-dev` imports in `dist/final/*/index.mjs`);
   the `./ts` export still imports `@monochromatic-dev/module-caught-value/ts` from source.
- `npm pack --dry-run` on the current dist:
   55 files,
   506,898 unpacked bytes,
   including `dist/final/types/tsconfig.tsbuildinfo` and 21 test files (issue #336).
- Gates:
   `lint:types` passes;
   `test:unit` passes;
   `lint:oxlint` reports 25 errors,
   all `test-import(require-eventual-artifact)`.
- `.github/workflows/publish.yml`:
   hardcoded filter list without logger,
   never run,
   no build step (issue #306),
   token required for dry run (issue #307).
- Consumers in this repo:
   288 `/ts` import sites,
   2 root import sites,
   1 `createLogger` caller outside the package (module-test's unit test).
- Transitive workspace runtime closure of `module-test` (all at 0.0.1):
   `module-test` (public, no `publishConfig`),
   `module-async-time`,
   `module-caught-value`,
   `module-const`,
   `module-numeric-format`,
   `module-or-throw` (public with provenance),
   `module-logger` and `module-fs-path` (private).
   Publishing `module-test` means publishing all eight.
- The #338 consumers bundle the logger into their dists;
   their `dependencies` entries are what would break an external install.
- `files` negation works under the packer:
   `package/git-policy/cli/package.json` lists `!src/**/*.unit.test.ts`,
   and `npm pack --dry-run` there shows 0 of its 44 unit-test files.
- `tsconfig.tsbuildinfo` lands in `dist/final/types` because the shared
   `package/config/typescript/tsconfig.options.json` sets `composite: true` with `outDir` there and no `tsBuildInfoFile`.
- pnpm `publishConfig` can override `exports` (and `bin`,
   `main`,
   `types`,
   `module`,
   `browser`,
   `typesVersions`,
   `cpu`,
   `os`,
   `engines`,
   `name`) but not `files`,
   per <https://pnpm.io/package_json>.
- npm `.npmignore` at a package root cannot override `files`;
   in a subdirectory it can,
   per <https://docs.npmjs.com/cli/v11/configuring-npm/package-json>.
- file-enforcer reads package manifests only for license expressions;
   it does not manage manifest fields.
   Its `overwriteEach` mirror-glob can stamp one source file into many destinations.
- Node refuses `.ts` files under `node_modules` by default (Node TypeScript docs),
   so a published `./ts` subpath serves bundler users only.
- npm trusted publishing cannot bootstrap:
   `npm trust` requires the package to already exist on the registry.
   pnpm supports OIDC trusted publishing since 10.21.0;
   the workflow installs `pnpm = "latest"` via mise.
- `gh secret list` shows no `NPM_TOKEN`.
- Test files shipped by other packages (`npm pack --dry-run`):
   rambdax 1 of 321,
   zod 191 of 828,
   pino 54 of 195,
   fast-check 0 of 11,
   picocolors 0 of 7.
- `module-caught-value` readiness:
   one source file,
   no workspace runtime dependencies,
   README present,
   `lint:types`,
   `lint:oxlint`,
   `test:unit` all pass,
   dist dated 2026-07-15 matches the last source change,
   tarball 8 files including the tsbuildinfo.
- The `require-eventual-artifact` rule exempts only test-only modules by name (`fixturePatterns`);
   its README forbids allowlisting behavior modules,
   so the 25 logger findings are fixed by exporting the internals from the entry as `@internal` and importing the built artifact,
   not by config.
- pnpm rewrites every `workspace:` specifier on pack or publish to the workspace version (`workspace:*` to the exact version,
   `workspace:^` to a caret range),
   per <https://pnpm.io/workspaces>.
   `pnpm-workspace.yaml` sets `autoInstallPeers: false` and `strictPeerDependencies: true`.
- `.github/workflows/cargo-publish.yml` already uses a `type: choice` dispatch input to select one crate.
- Prior direction in `doc/handover/cli-git-policies-platform.md` says to bundle logger into public artifacts rather than publish it.

## Open questions

- Whether the `flush()` hang is fixed before 0.1.0.
- How neutralized control characters render in console output.
- How the publish workflow selects packages for a run.

## Next action

Continue the grilling rounds;
 no code changes until the owner confirms shared understanding.
