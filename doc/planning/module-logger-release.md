# module-logger first npm release

Status:
 planning complete pending owner confirmation (2026-09-06).
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

- Release means npm publish under `@monochromatic-dev`,
   the scope's first publish ever.
   The owner confirms the scope exists and they can publish to it.
- Driver:
   `@monochromatic-dev/module-test` is blocked by issue #338 because it depends on the private logger.
   Scope is the logger alone,
   as groundwork;
   `module-fs-path` stays private,
   so module-test remains blocked after this release.
- README import examples change to root imports;
   no `/tagged` or `/logger` subpath exports are added.
- The tuning options from the legacy plan stay out of 0.1.0 except `flushDeadlineMs`.
- The retire-after-N-failures policy is dropped;
   only `verify` failure retires a sink,
   as `DECISIONS.md` 2026-06-14 records.
- The console sink neutralizes every control character except `\n` and `\t` before 0.1.0,
   rendering each as `\uXXXX`;
   no SGR allowlist.
   This is a publish gate (rule `SYB`).
- Tarball:
   `tsconfig.tsbuildinfo` leaves every tarball via the shared tsconfig;
   test files ship (owner accepts the mixed ecosystem practice).
- `./ts` is stripped from the published manifest through `publishConfig.exports` (pnpm override);
   in-repo `/ts` imports are unaffected.
   `module-caught-value` moves to `devDependencies` (the dist bundles it) and is not published in this release.
- `flush()` gets a deadline before 0.1.0,
   exposed as one `createLogger` option `flushDeadlineMs` with a named default chosen after measuring local write latency.
- The 25 `require-eventual-artifact` findings gate the publish:
   internals are exported from the entry with an underscore prefix (toml-edit precedent) and their tests import the built artifact.
- The no-backend throw stays in 0.1.0:
   reachable only through `createLogger` with sinks that all fail verify,
   documented,
   pinned by tests,
   consistent with rules PP4 and PP7.
- `engines.node` declares `>=24`:
   the dist calls `Error.isError`,
   which arrived with V8 13.6 in Node 24.0.0.
- First version 0.1.0,
   produced by a `minor` changeset.
- Versioning and publishing tool:
   changesets (the owner's standing intent,
   issue #159's recommendation).
   Adoption requires a vet report per the `choosing-technology` skill,
   since it promotes one tool over release-please and semantic-release.
- Publish workflow:
   a changesets release workflow with `id-token: write` and OIDC trusted publishing,
   building selected packages through mise before `pnpm publish -r`.
   The never-run `publish.yml` is deleted;
   issue #307 closes by construction and #306's build and pack checks move to the new workflow.
- Bootstrap:
   the first publish of a package is local and interactive.
   `pnpm pack` the package (rewrites `workspace:` and applies `publishConfig`),
   `npm publish <tarball> --access public` with provenance disabled and the owner's OTP,
   then `npm trust github` for the release workflow.
   Later versions publish from CI with provenance.
   No npm token is ever stored.
- A `doc/decision/` entry supersedes the "bundle, do not publish" direction.
- The legacy plan becomes a post-release track after a rewrite that fixes its inventory and removes the items decided against here;
   a GitHub issue tracks it.

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
   token required for dry run (issue #307);
   `gh secret list` shows no `NPM_TOKEN`.
- Consumers in this repo:
   288 `/ts` import sites,
   2 root import sites,
   1 `createLogger` caller outside the package (module-test's unit test).
- Transitive workspace runtime closure of `module-test` (all at 0.0.1):
   `module-test`,
   `module-async-time`,
   `module-caught-value`,
   `module-const`,
   `module-numeric-format`,
   `module-or-throw` (public),
   `module-logger` and `module-fs-path` (private).
- The #338 consumers bundle the logger into their dists;
   their `dependencies` entries are what would break an external install.
- Node refuses `.ts` files under `node_modules` by default (Node TypeScript docs),
   so a published `./ts` subpath serves bundler users only.
- No in-repo file imports both the logger and a color library,
   and no log call carries an escape literal or color helper.
- The dist uses `Error.isError` (twice) and `toSorted`;
   `Error.isError` needs Node 24+.
- `files` negation works under the packer:
   `package/git-policy/cli/package.json` lists `!src/**/*.unit.test.ts`,
   and `npm pack --dry-run` there shows 0 of its 44 unit-test files.
- `tsconfig.tsbuildinfo` lands in `dist/final/types` because the shared
   `package/config/typescript/tsconfig.options.json` sets `composite: true` with `outDir` there and no `tsBuildInfoFile`.
   `package/dev-script/task-util/src/tsc-filter.ts` already deletes `dist/**/*.tsbuildinfo`,
   and the root tsconfig redirects its own build info to `.cache/typescript/`.
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
   pnpm rewrites every `workspace:` specifier on pack or publish,
   per <https://pnpm.io/workspaces>.
- npm trusted publishing cannot bootstrap:
   `npm trust` requires the package to already exist on the registry.
   pnpm supports OIDC trusted publishing since 10.21.0;
   the workflow installs `pnpm = "latest"` via mise.
   npm's access-token docs steer CI publishing to trusted publishing and away from Bypass-2FA tokens.
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
   all package gates pass.
- The `require-eventual-artifact` rule exempts only test-only modules by name (`fixturePatterns`);
   its README forbids allowlisting behavior modules.
   toml-edit exposes seams as underscore-prefixed entry exports;
   the shared rolldown config builds one entry;
   no `stripInternal` in the shared tsconfig.
- Git tags follow `<package>-v<version>` (17 tags).
   `cargo-publish.yml` combines a tag push trigger with a dispatch choice input.
- The changesets action supports OIDC trusted publishing,
   needs `id-token: write`,
   takes `publish-script` and `version-script` inputs,
   and pnpm's own guide publishes with `pnpm publish -r`.
   No `.changeset/` directory exists yet.
- Prior direction in `doc/handover/cli-git-policies-platform.md` says to bundle logger into public artifacts rather than publish it.

## Execution plan

Order matters:
 docs that gate code first,
 code gates next,
 tooling,
 then verification and the manual bootstrap.

1.   Vet report `doc/audit/tech-npm-release-versioning-and-publishing-vet-2026-09-06.md` for changesets against release-please,
     semantic-release,
     and manual tags,
     per the `choosing-technology` skill.
2.   Decision doc `doc/decision/npm-publishing.md`:
     supersedes "bundle, do not publish";
     records changesets,
     trusted publishing,
     the local bootstrap,
     `./ts` stripped at publish,
     tests shipped,
     `engines.node >=24`.
3.   Logger code gates:
     control-character neutralization module for the console sink with adversarial tests;
     `flushDeadlineMs` with tests that force the deadline;
     underscore seam exports and the 25 tests pointed at the built artifact;
     reword the `logger.ts` throw comment.
     Zero lint findings,
     types and unit tests green.
4.   Manifest:
     drop `private`,
     add `publishConfig` (access public,
     provenance,
     exports without `./ts`),
     `engines`,
     caught-value to `devDependencies`,
     README examples rewritten.
     Version stays 0.0.1 until the changeset (`minor`) bumps it to 0.1.0.
5.   Shared tsconfig:
     `tsBuildInfoFile` outside `dist/final`;
     confirm `tsc-filter.ts` still cleans it.
6.   Changesets:
     `@changesets/cli` as a root devDependency via the catalog,
     `.changeset/config.json` (`access: public`,
     `baseBranch: main`,
     other options at defaults),
     `.github/workflows/npm-release.yml`,
     delete `publish.yml`,
     one changeset file for the logger.
7.   Verification at the consumer boundary:
     `pnpm pack` the logger,
     install the tarball in a disposable non-workspace project on Node 24,
     import the root entry,
     log,
     flush,
     confirm the escape neutralization and the absence of `./ts` on the installed package.
8.   Runbook `doc/runbook/publish-npm-package-first-time.md` for the local bootstrap and `npm trust github`.
9.   Rewrite `bulletproofing.plan.md` as the post-release track and open an issue for it.
10.  Comment on issues #159,
     #306,
     #307,
     and #338 with what changed.

## Next action

Owner confirms shared understanding after a step-by-step walkthrough;
 then execute in the order listed.
