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
- Driver:
   public packages blocked by issue #338 (they depend on the private logger).
- README import examples change to root and `/ts` imports;
   no `/tagged` or `/logger` subpath exports are added.
- The four tuning options from the legacy plan (flush deadline,
   verify timeout,
   retire threshold,
   buffer cap) stay out of 0.1.0.
- The retire-after-N-failures policy is dropped;
   only `verify` failure retires a sink,
   as `DECISIONS.md` 2026-06-14 records.
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
- The #338 consumers (`module-toml-edit`,
   `module-test`,
   `dev-script-watch-restart`) bundle the logger into their dists;
   their `dependencies` entries are what would break an external install.
   `module-test` also depends on private `module-fs-path`.
- Prior direction in `doc/handover/cli-git-policies-platform.md` says to bundle logger into public artifacts rather than publish it.

## Open questions

Tracked in the grilling session;
 answers land in the settled-decisions list as they arrive.

- Which #338 consumer is the actual target,
   and therefore which dependency closure must publish.
- Whether `./ts` stays in the published surface (forces caught-value to publish first).
- Publish mechanism (workflow with a build step,
   local publish without provenance,
   or trusted publishing).
- First version number.
- Whether the 25 lint errors gate the publish.
- Whether the console terminal-escape boundary gates the publish,
   and which contract (neutralize all controls,
   or preserve SGR).
- Whether the "bundle, don't publish" direction is formally reversed.
- Whether the user owns the `@monochromatic-dev` npm scope.
- Whether shipped tests and `tsconfig.tsbuildinfo` are excluded from the tarball now.

## Next action

Continue the grilling rounds;
 no code changes until the owner confirms shared understanding.
