# Cross-package imports in large TypeScript monorepos

## Research status

- Status:
   complete;
   read-only survey of current configs plus first-party docs
- Date:
   2026-09-06
- Method:
   shallow clones under `~/temp/agent/<name>-2026-09-06`,
   `gh api` raw reads for doc sources,
   `WebFetch` for rendered pages
- Product changes:
   none;
   TypeScript project references are reported as fact only,
   per `.out-of-scope/typescript-project-references.md`

## Question

How do large TypeScript monorepos resolve sibling workspace imports for `tsc`,
bundlers,
tests,
editors,
and type-aware lint,
and is sibling source type-checked once or once per consumer?

Baseline from the task brief (not re-measured here):
Monochromatic resolves sibling imports to source through a `/ts` export subpath,
runs one `tsc` program per package (median 95 sibling source files across 148 packages),
and the type-aware oxlint JS plugin `prefer-readonly-parameter-type` re-analyses that closure per package,
costing 171 of 184 warm seconds in a whole-repo lint.

## Commits read

- Vue core `vuejs/core` at `d105e19e914bca6e1140bfec074e055ed0679e21`
- Vite `vitejs/vite` at `8492422b8f110625a90c702f42f30784e8cf19dc`
- Vitest `vitest-dev/vitest` at `7c818153add03b0bca54453a54e76961dd5be18d`
- typescript-eslint at `1288fcd1516472ab7a6d71ac4553d07191207f0b`
- Effect `Effect-TS/effect` at `2a30248b6eb739f22403456209bc468f2f4ef26a`
- Babel `babel/babel` at `a2c32a1385c64368c1b59a94c992fe5c15005f75`
- Sentry `getsentry/sentry-javascript` at `37fd6a5c8613761274671dabd5195ff253623e2b`
- Nx `nrwl/nx` docs and plugin at `fc41a1b479677fdb4a5166c85053c152ea3abb6a`
- Turborepo `vercel/turborepo` docs at `d65c615726a2ccad25fbc9cbbe952a01bbe8ff6a`
- JSR `jsr-io/jsr` docs at `0976443de8861c0a62914b6a2abc1410ac885243`

Paths are repo-relative to those commits.
Nx page URLs are derived from the docs' own internal links;
`nx.dev` returned 404 to the fetcher,
 so the `.mdoc` sources are the cited evidence.

## Vue core

- `tsc`:
   one root program;
   `tsconfig.json:23-27` maps `@vue/*` to `./packages/*/src`,
   `include` covers `packages/*/src` and `packages/*/__tests__` (`tsconfig.json:31-39`);
   `check` is `tsc --incremental --noEmit` (`package.json:15`).
- Bundler and tests:
   `scripts/aliases.js:7-11` builds `packages/<p>/src/index.ts` aliases shared by `rollup.config.js:328-329`
   and `vitest.config.ts:22-24`;
   `.github/contributing.md:279-281` documents the three mechanisms.
- Editor:
   same `paths`,
   so go-to-definition lands on source.
- Build first:
   no;
   only `test-dts` runs `build-dts` (`package.json:22-23`).
   Package `exports` point only at `dist` (`packages/runtime-core/package.json:12-25`).
- Lint:
   `eslint.config.js:19` extends `tseslint.configs.base`;
   no `projectService` or `project`,
   so not type-aware.

## Vite

- `tsc`:
   per package and per sub-tree;
   root `typecheck` is `tsc -p scripts && pnpm -r --parallel run typecheck` (`package.json:25`),
   and `packages/vite/package.json:65` runs seven programs.
   `src/node/tsconfig.json:3` includes `../module-runner` and `../types`,
   while `src/module-runner/tsconfig.json:3` includes `../node`,
   so those trees are checked in two programs each.
- Cross-package:
   `packages/plugin-legacy/package.json:59` depends on `vite: workspace:*`,
   whose `exports["."]` is `./dist/node/index.js` (`packages/vite/package.json:45`);
   `packages/plugin-legacy/tsconfig.json` has no `paths`,
   so types come from built `dist`.
   `CONTRIBUTING.md:13` says run `pnpm run build` first.
- Tests:
   `vitest.config.ts:16-19` sets `deps.moduleDirectories: ['node_modules', 'packages']`
   and aliases only `vite/module-runner` to source (`vitest.config.ts:27-34`).
- Editor:
   sub-tree programs for `vite` itself;
   `plugin-legacy` sees `dist` declarations (inferred from config,
   not observed).
- Lint:
   `eslint.config.js:10-13,41` enables `projectService` only when `VSCODE_PID` is set,
   "as enabling it is slow";
   CLI lint is not type-aware.

## Vitest

- `tsc`:
   one root program,
   `tsc -p tsconfig.check.json --noEmit` (`package.json:36`);
   `tsconfig.base.json:5` sets `customConditions: ["__vitest_source__"]`
   and `tsconfig.base.json:8-25` also maps every package to `src`.
- Exports:
   `packages/utils/package.json:19-23` lists `__vitest_source__: ./src/index.ts` before `types` and `default`.
- Bundler:
   `packages/vitest/rollup.config.js:87` passes `exportConditions: ['__vitest_source__']`.
- Tests:
   a repo-wide `rg` finds the condition only in `tsconfig.base.json` and two rollup configs,
   so tests resolve siblings to `dist`;
   `CONTRIBUTING.md:18` requires `pnpm run build`,
   and `ci` runs typecheck and lint before build (`package.json:12`).
- Editor:
   source via `customConditions` and `paths`.
- Lint:
   `eslint.config.js:3` calls `@antfu/eslint-config` without `typescript.tsconfigPath`;
   that project's README says type-aware rules stay off unless `tsconfigPath` is given.

## typescript-eslint

- `tsc`:
   project references throughout.
   `tsconfig.base.json:4-7` sets `composite`,
   `declaration`,
   `emitDeclarationOnly`;
   root `tsconfig.json:8-28` references every package;
   `packages/utils/tsconfig.build.json:4-14` references sibling `tsconfig.build.json` files.
   Nx infers `typecheck` as `tsc --build tsconfig.json --emitDeclarationOnly`
   (`nx.json:3-16`;
   Nx `packages/js/src/plugins/typescript/plugin.ts:567`),
   whose comment reads "`tsc --build` reads `.d.ts` ... from dependent tasks,
   not the source files of dependencies"
   (`plugin.ts:928-929`).
- Exports:
   `dist` only (`packages/utils/package.json:11-33`).
- Tests:
   `nx.json:67-68` makes `test` depend on `^build`;
   `packages/utils/tsconfig.spec.json:6-13` references the package's own `tsconfig.build.json`,
   so tests type-check against emitted declarations.
   `docs/contributing/Local_Development.mdx:29` says packages "depend on each other's built outputs".
- Editor:
   TypeScript 3.7 build-free editing opens referenced projects' source unless
   `disableSourceOfProjectReferenceRedirect` is set ([TS 3.7 notes][ts37]).
- Lint:
   `eslint.config.mjs:87-89` sets `projectService: true` with root `tsconfigRootDir`;
   each package's solution-style `tsconfig.json` (`packages/utils/tsconfig.json:5-12`) routes files to
   its build or spec program.
   `nx.json:58-60` makes `lint` depend on building the two plugin packages.
   The docs say references are supported "only with `parserOptions.projectService`"
   (`docs/troubleshooting/typed-linting/index.mdx:161-163`).

## Effect

- Exports:
   in-repo `exports["."]` is `./src/index.ts` and `./*` is `./src/*.ts`
   (`packages/effect/package.json:31-52`);
   `publishConfig.exports` swaps to `dist` at publish time (`packages/effect/package.json:72-80`).
- `tsc`:
   `check` is `tsc -b tsconfig.json` (`package.json:19`) over a solution
   (`tsconfig.json:4-7`,
   `tsconfig.packages.json:5-43`);
   `tsconfig.base.json:8-9` sets `incremental` and `composite`;
   `packages/platform/node/tsconfig.json:5-8` references `effect` and `node-shared`.
   `tsconfig.base.json:29` keeps `stripInternal: false` because
   "tests require `false` because project references type-check against those declarations".
- Tests:
   `tsconfig.tests.json:24-97` maps every package to `src` for the test program;
   `vitest.config.ts:66-68` sets `resolve.tsconfigPaths: true`,
   and source exports resolve anyway.
- Build first:
   `build` runs `tsc -b tsconfig.packages.json` then per-package Babel (`package.json:10`);
   `check` itself emits declarations,
   so nothing precedes it.
- Editor:
   source via `exports`.
- Lint:
   `oxlint -f unix` (`package.json:26`) with no `typeAware` in `.oxlintrc.json`;
   not type-aware.

## Babel

- `tsc`:
   generated per-package `tsconfig.json` files extend `tsconfig.base.json` plus `tsconfig.paths.json`
   and list `references` (`packages/babel-core/tsconfig.json:1-38`;
   generator `scripts/generators/tsconfig.ts`).
   `tsconfig.paths.json:23-25` maps `@babel/core` to `./packages/babel-core/src`;
   `tsconfig.base.json:3-12` sets `composite`,
   `emitDeclarationOnly`,
   `declarationDir: ./dts`.
   `tscheck` (`Makefile.source.ts:293-296`) runs `scripts/parallel-tsc/tsc.ts`,
   which forks `tsc -b <project>` per package in dependency order (`tsc.ts:139`).
   Under references,
   source-resolved sibling imports load the emitted declaration output
   ([TS handbook][ts-refs]).
- Condition:
   `tsconfig.base.json:14` sets `customConditions: ["babel-src"]`;
   it appears in `imports` subpaths such as `#config/files` (`packages/babel-core/package.json:80-89`),
   in three manifests only,
   and in rollup `exportConditions` (`Gulpfile.ts:511-512`).
   Cross-package `exports` stay `lib` only (`packages/babel-core/package.json:73-78`).
- Tests:
   `jest.config.ts:57-60` keeps `moduleNameMapper` empty,
   relying on Yarn links to built `lib`;
   `CONTRIBUTING.md:233` says build before tests.
- Lint:
   `eslint.config.ts:139-148` uses `projectService` with `allowDefaultProject`;
   `lint` runs `tscheck` first (`Makefile.source.ts:407-410`),
   so declarations exist when ESLint runs.
- Editor:
   source via `paths` and the TS 3.7 redirect.

## Sentry JavaScript SDK

- Exports:
   `build/npm` only,
   `types` at `build/npm/types/index.d.ts` (`packages/browser/package.json:18-36`).
- `tsc`:
   per package `build:types` is `tsc -p tsconfig.types.json` (`packages/browser/package.json:57`);
   `nx.json:40-45` orders it after `^build:types`.
   No `paths`,
   no references;
   `packages/typescript/tsconfig.json:4` sets `declarationMap: true`.
- Build first:
   yes;
   `nx.json:46-57` makes `lint` depend on `^build:types` and `test:unit` on `^build:transpile`;
   `CONTRIBUTING.md:23,74,166` says build first "so TypeScript can read all of the linked type definitions".
- Tests:
   `vite/vite.config.ts` has no aliases;
   siblings resolve to built output.
- Lint:
   `.oxlintrc.json:4-6` sets `typeAware: true`;
   packages run `oxlint . --type-aware` and `lint:types` runs `oxlint src --type-aware --type-check`
   (`packages/browser/package.json:65-67`),
   so type-aware lint sees sibling declarations.
   The oxlint guide says "Build dependent packages so `.d.ts` files are available" ([oxc type-aware][oxc]).
- Editor:
   declarations,
   mappable to source through declaration maps (inferred).

## Nx docs

- [TypeScript project linking][nx-link] (`astro-docs/src/content/docs/kb/typescript-project-linking.mdoc`):
   two methods,
   workspaces and `paths`;
   workspaces chosen because "packages will be resolved using native node module resolution" (line 31).
   With references,
   root `tsconfig.base.json` must not set `paths` (line 140);
   each `tsconfig.lib.json` references dependencies' `tsconfig.lib.json` (lines 192-211).
   References let `tsc` "individually check the types for each project" and cache `.tsbuildinfo` (line 248);
   the benchmark reports 186 s and 6.14 GB without references versus 25 s warm with them (lines 245-257).
- [Switch to workspaces and project references][nx-switch]
   (`astro-docs/src/content/docs/kb/switch-to-workspaces-project-references.mdoc:151`):
   add `customConditions` such as `@myorg/source` so TypeScript resolves "to source `.ts` files during
   development without requiring a build step first".
- [Testing without building dependencies][nx-test]
   (`astro-docs/src/content/docs/kb/testing-without-building-dependencies.mdoc:20-26,72-74,161-163`):
   `customConditions` plus a `@myorg/source` export plus Vitest `resolve.conditions`
   lets tests drop `dependsOn: ["^build"]`;
   "Nx already configures the first two pieces for you".

## Turborepo docs

[Internal packages][turbo] (`apps/docs/content/docs/core-concepts/internal-packages.mdx`):

- Just-in-time:
   `exports` reference `.ts` directly,
   no build (lines 84-111);
   "type-checking in a dependent package will fail if code in an internal dependency has TypeScript errors",
   and Turborepo cannot cache it (lines 117-118).
- Compiled:
   `types` points at source `.tsx` while `default` points at `dist` (lines 127-136);
   outputs are cacheable (line 143).
- Publishable:
   strictest requirements (line 152).

## The `source` condition

- Node.js defines only `types`,
   `browser`,
   `development`,
   `production` as community conditions
   and ignores unknown conditions by default ([Node packages][node-pkg]);
   `--conditions` adds custom ones.
- TypeScript `customConditions` is valid only under `node16`,
   `nodenext`,
   and `bundler`
   ([TSConfig reference][tsconfig]).
- Deno satisfies `deno`,
   `node`,
   `import`,
   `module-sync`,
   `default` and accepts `--conditions`;
   its page names no `source` condition ([Deno Node compatibility][deno]).
- JSR has no conditions:
   `exports` maps entry points straight to `.ts` (`frontend/docs/package-configuration.md:43-46`),
   and "TypeScript source files are published directly to JSR" (`frontend/docs/why.md:39-40`).
- No first-party spec of a bare `source` condition was found;
   every observed spelling is project-private:
   `__vitest_source__`,
   `babel-src`,
   Nx's `@myorg/source`,
   Monochromatic's `/ts` subpath.

## Patterns and what each buys

### Single root program with `paths` to source

Vue core;
 Vitest (with a condition too).
Sibling source is checked once,
 in the one program.
Lint in these repos is not type-aware;
 a type-aware linter over the same program would see source.
Cost:
 one process holds the whole repo,
 the profile Nx measured at 6.14 GB.

### Custom source condition plus compiled default

Vitest exports,
 Babel `imports`,
 Nx `@myorg/source`.
Editors,
 bundlers,
 and tests opt into source by naming the condition;
`default` consumers get `dist`.
Checked once with a root program (Vitest),
or once per referenced project with references (Nx,
 Babel).
Type-aware lint sees whatever its resolver picks;
 under references it reads declarations.

### Source exports in-repo, compiled on publish

Effect.
Runtime and editor resolve `./src/*.ts`;
`publishConfig.exports` swaps to `dist`.
Checking is by references,
 so sibling source is checked once and consumers read declarations.
Lint is not type-aware.

### Per-package programs over sibling declarations

typescript-eslint,
 Effect,
 Babel,
 Sentry,
 Nx's recommended layout.
Each package is one program;
 siblings enter as `.d.ts` (references or built `types`).
Sibling source is checked once.
Type-aware lint (`projectService` or oxlint `--type-aware`) sees declarations,
which is why Sentry orders `lint` after `^build:types` and Babel runs `tscheck` before ESLint.

### Compiled-only with build ordering

Vite `plugin-legacy`,
 Sentry runtime,
 typescript-eslint tests.
Everything below a consumer must be built first;
`dependsOn: ["^build"]` or a documented `pnpm run build` supplies the order.
Checked once;
 lint and tests see declarations and JS.

### Per-package programs over source

Vite's sub-tree programs (`node` and `module-runner` each included twice),
and Monochromatic's `/ts` subpath.
Sibling source is re-checked in every consumer program,
and any type-aware lint following the same resolution re-analyses the closure per package.
No surveyed project documents choosing this for cross-package imports;
Vite's duplication is intra-package,
and Turborepo's just-in-time page names the consequence ("errors in internal dependencies will be reported").

[deno]: https://docs.deno.com/runtime/fundamentals/node/
[node-pkg]: https://nodejs.org/api/packages.html
[nx-link]: https://nx.dev/docs/kb/typescript-project-linking
[nx-switch]: https://nx.dev/docs/kb/switch-to-workspaces-project-references
[nx-test]: https://nx.dev/docs/kb/testing-without-building-dependencies
[oxc]: https://oxc.rs/docs/guide/usage/linter/type-aware.html
[ts-refs]: https://www.typescriptlang.org/docs/handbook/project-references.html
[ts37]: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html
[tsconfig]: https://www.typescriptlang.org/tsconfig/
[turbo]: https://turborepo.dev/docs/core-concepts/internal-packages
