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
- Prior direction in `doc/handover/cli-git-policies-platform.md` says to bundle logger into public artifacts rather than publish it.

## Open questions

- Whether the release scope is the full eight-package closure (flipping `module-fs-path` public too).
- Mechanism for the repo-wide #336 fix.
- Whether `./ts` stays in the published surface.
- Publish mechanism (workflow with a build step,
   local publish without provenance,
   or trusted publishing).
- First version number.
- Whether the 25 lint errors gate the publish.
- Whether the "bundle, don't publish" direction is formally reversed.

## Next action

Continue the grilling rounds;
 no code changes until the owner confirms shared understanding.
