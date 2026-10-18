<!--
status: in progress; worktree experiment evidence recorded; upstream audit and repository inventory in flight
lifecycle-phase: candidate B hard-gate probes executed; final gate outcomes pending the remaining evidence classes
subject: pnpm store-loader
scope: Decide whether the Monochromatic monorepo can migrate dependency linking from the pnpm isolated node_modules linker to the pnpm experimental loaded linker (store loader).
started: 2026-10-18
last-updated: 2026-10-18
governing-skill: .agents/skills/choosing-technology/SKILL.md
governing-skill-commit: 37117e36397e30233062828581a5e38217da9458
governing-skill-sha256: 552ac9955299b65a9f921a4e836b60a3fabc15d3477eeb8ec2bfb3f400647f9b
compatibility-fingerprint: af53173d69e8b1f95654626ec891c8c57dea60e9b096d0464d9c8a05a4bc0aba
active-audit-owner: /var/home/user lead session (DSH web GUI)
prior-compatible-report: none; no report in doc/audit shares the tech-pnpm-store-loader subject slug
unresolved-preferences: none required for the feasibility verdict; adoption authority stays with the user
criteria-and-weights: six criteria frozen at weight 1 each; scoring runs only for finalists that survive hard gates
hard-constraints:
  - CI installs remain possible from the committed frozen lockfile with store caching
  - Electron packaging and Playwright-in-podman browser and e2e runs keep working
  - Mise-run workflows keep working: tsc --build type check, bare-node TypeScript unit tests, rolldown node/browser/client builds, oxlint with tsgolint, watch and dev servers
  - Native addon, napi, WASM and platform-binary dependencies stay loadable and buildable
  - No regression of the strict isolation guarantees behind nodeLinker isolated with hoist false
  - Node surfaces that must run stored code meet the loader Node floor of 24.18+ or 26.2+
  - Supply-chain policy keeps effect: .pnpmfile readPackage substitution, overrides including link shims, allowBuilds approvals, strict minimumReleaseAge, trustPolicy no-downgrade
  - The committed lockfile stays portable across supportedArchitectures darwin/linux, x64/arm64, glibc/musl
base-components:
  - Inspectable open-source local technology
overlays:
  - High-trust execution in CI and every spawned Node process
  - Incumbent dependency replacement
  - Multi-platform claim
  - Native, Wasm and prebuilt binary boundary
-->
# pnpm store-loader migration vet

## Purpose and authorization

The user asked whether this repository can migrate to the pnpm experimental loaded linker,
documented at [pnpm.io/store-loader][store-loader].
The request is a decision verb, so this evaluation produces an answer plus this report.
The main worktree receives documentation writes only.
Experiments run in a disposable git worktree that is removed after this report completes.
Adoption, if ever authorized, is a separate later action with its own decision record.

## Context (measured facts)

Host toolchain, measured on 2026-10-18 in `/var/home/user/Monochromatic`:

- pnpm 12.14.0 (`pnpm --version`), installed by mise (`pnpm = "latest"`, [mise.toml](../../mise.toml));
- Node v26.12.0 (`node --version`), installed by mise (`node = "latest"`);
- host is Fedora Silverblue-class Linux x64, Btrfs `/var/home`, 935 GiB free, 61 GiB RAM (`df`, `free`).

Workspace linker and supply-chain configuration in [pnpm-workspace.yaml](../../pnpm-workspace.yaml):

- `nodeLinker: isolated` (line 220), `hoist: false` (line 196), `hoistWorkspacePackages: false` (line 197);
- `packageImportMethod: clone-or-copy` (line 424), `modulesCacheMaxAge: 0` (line 13);
- `allowBuilds` build-script approvals with `sharp: true` (lines 1 to 6);
- `.pnpmfile.mjs` `readPackage` hook substituting blocklisted packages with workspace stubs;
- `overrides` including `link:package/shim/*` substitutions (lines 222 to 403);
- strict `minimumReleaseAge: 1440` with excludes (lines 199 to 218), `trustPolicy: no-downgrade` (line 460);
- `supportedArchitectures` darwin/linux, x64/arm64, glibc/musl for lockfile portability (lines 447 to 459),
  rationale in [doc/decision/pnpm-supported-architectures.md](../decision/pnpm-supported-architectures.md);
- catalogs with `catalogMode: strict` (lines 16 to 193).

Task execution model, measured in [mise.toml](../../mise.toml) (generated from `mise.no-env.toml`):

- unit tests run as bare `node <file.test.ts>` subprocesses spawned by the `run_test_files` var
  (Node native TypeScript type-stripping), never through `pnpm run` or `pnpm exec`;
- package entries dispatch through `execFileSync('node', ...)` in the `dispatch_workspace_node` var;
- builds call `rolldown` directly; type checks call the workspace `tsc-filter` wrapper with `--build`;
- browser and e2e tests run Playwright inside a podman image over a bind mount of the repo;
- `prepare` runs `pnpm install` first because every later child needs `node_modules`.

The loaded linker, as documented at [pnpm.io/store-loader][store-loader] (fetched 2026-10-18):

- enabled via `nodeLinker: { type: loaded, excluded: [...] }`; install writes
  `node_modules/.pnpm/.store-manifest.json` and `node_modules/.pnpm/.store-loader.mjs`;
- `pnpm run`, `pnpm test` and `pnpm exec` preload the loader; Node children inherit it through
  `NODE_OPTIONS`; generated JS bin shims register it; bare `node` outside pnpm needs an explicit
  `--import` preload;
- requires Node 24.18+ (24.x) or 26.2+, else every preloaded process stops with
  `ERR_PNPM_LOADER_UNSUPPORTED_NODE`;
- unsupported from the store: native addons, WebAssembly, TypeScript files, package-internal symlinks;
  `import.meta.url`, `__filename`, `__dirname` and `require.resolve()` of stored modules are virtual,
  so direct `fs` reads of package assets fail;
- independent test-runner resolvers and direct filesystem reads need materialization
  (`excluded` packages land in the global virtual store with their whole dependency tree)
  or resolver integration;
- `symlink: false` and `nodePackageMap.mode` other than `off` cannot combine with the mode;
- the standalone `@pnpm/esm-loader` API exists for manual integration.

Prior related repository evidence (to be re-verified by the repository inventory):

- [doc/troubleshooting/pnpm-symlink-false-isolated.md](../troubleshooting/pnpm-symlink-false-isolated.md)
  analyzed `nodeLinker` modes against virtual-store layout;
- [package/dev-script/catalog-tighten.matrix](../../package/dev-script/catalog-tighten.matrix/README.md)
  already exercises isolated, hoisted and pnp scenarios;
- [doc/troubleshooting/napi-loader-bundled-out-of-package.md](../troubleshooting/napi-loader-bundled-out-of-package.md)
  documents why strict isolation matters for napi resolution;
- [doc/troubleshooting/pnpm-modules-cache.md](../troubleshooting/pnpm-modules-cache.md) and
  [doc/handover/pnpm-modules-cache-benchmark.md](../handover/pnpm-modules-cache-benchmark.md)
  record modules-cache benchmarks under the isolated linker.

## Hard constraints (frozen)

Each constraint lists its measured source.

1. Mise-run workflows keep working: `tsc --build` type check, bare-node TypeScript unit tests,
   rolldown node/browser/client builds, oxlint with tsgolint, watch and dev servers.
   Source: [mise.toml](../../mise.toml) task templates and vars.
2. Native addon, napi, WASM and platform-binary dependencies stay loadable and buildable.
   Source: catalog entries in [pnpm-workspace.yaml](../../pnpm-workspace.yaml)
   (sharp, electron, Playwright, libsql/turso, ripgrep, esbuild, wasm font packages),
   `allowBuilds` list, napi incident record
   [doc/audit/depot-git-host-failure-mapping-2026-10-17.evidence.json](depot-git-host-failure-mapping-2026-10-17.evidence.json)
   and [doc/troubleshooting/napi-loader-bundled-out-of-package.md](../troubleshooting/napi-loader-bundled-out-of-package.md).
3. Supply-chain policy keeps effect: `.pnpmfile.mjs` substitution, `overrides` including `link:` shims,
   `allowBuilds` approvals, strict `minimumReleaseAge`, `trustPolicy: no-downgrade`.
   Source: [pnpm-workspace.yaml](../../pnpm-workspace.yaml), [.pnpmfile.mjs](../../.pnpmfile.mjs).
4. The committed lockfile stays portable across `supportedArchitectures` (darwin/linux, x64/arm64,
   glibc/musl) for mixed development and CI environments.
   Source: [pnpm-workspace.yaml](../../pnpm-workspace.yaml) lines 437 to 459.
5. CI installs remain possible from the committed frozen lockfile with store caching.
   Source: `.github/workflows` (exact invocations recorded by the repository inventory).
6. Electron packaging and Playwright-in-podman browser and e2e runs keep working.
   Source: `@electron/packager` catalog entry, `run_playwright` var in [mise.toml](../../mise.toml).
7. Node surfaces that must run stored code meet the loader Node floor (24.18+ or 26.2+).
   Source: [pnpm.io/store-loader][store-loader]; host Node is v26.12.0, other surfaces pending inventory.
8. No regression of the strict isolation guarantees behind `nodeLinker: isolated` with `hoist: false`.
   Source: [pnpm-workspace.yaml](../../pnpm-workspace.yaml) line 409 comment,
   [doc/troubleshooting/napi-loader-bundled-out-of-package.md](../troubleshooting/napi-loader-bundled-out-of-package.md).

## Candidate ledger

### Candidate A: pnpm isolated node_modules linker (incumbent)

- Discovery source: repository configuration, [pnpm-workspace.yaml](../../pnpm-workspace.yaml) line 220.
- Base category: inspectable open-source local technology (pnpm 12.14.0).
- Overlays: high-trust execution, native/Wasm/prebuilt boundary, multi-platform.
- Screening result: incumbent; required candidate under the replacement-parity overlay.

### Candidate B: pnpm loaded linker (store loader)

- Discovery source: user request naming [pnpm.io/store-loader][store-loader].
- Base category: inspectable open-source local technology (embedded in pnpm; standalone
  `@pnpm/esm-loader`).
- Overlays: incumbent replacement, high-trust execution (preload injected into every spawned Node
  process), native/Wasm/prebuilt boundary, multi-platform claim.
- Screening result: serious alternative; targeted evidence pending (version support in pnpm 12.14.0,
  behavior with this repository's configuration surface, hard-gate probes in the worktree experiment).

### Candidate C: pnpm hoisted linker

- Discovery source: repository evidence class; prior mode trials in
  [doc/troubleshooting/pnpm-symlink-false-isolated.md](../troubleshooting/pnpm-symlink-false-isolated.md)
  and [doc/troubleshooting/pnpm-pack-dedupe-direct-deps.md](../troubleshooting/pnpm-pack-dedupe-direct-deps.md)
  (hoisted used as a control, discarded).
- Base category: inspectable open-source local technology.
- Overlays: incumbent replacement, native/Wasm boundary, multi-platform.
- Screening result: pending; weakens constraint 8 (isolation guarantees) by design,
  targeted evidence to confirm.

### Candidate D: pnpm pnp linker

- Discovery source: repository evidence class; scenarios in
  [package/dev-script/catalog-tighten.matrix](../../package/dev-script/catalog-tighten.matrix/README.md)
  and [package/dev-script/catalog-tighten/src/version-pnp.ts](../../package/dev-script/catalog-tighten/src/version-pnp.ts).
- Base category: inspectable open-source local technology.
- Overlays: incumbent replacement, high-trust execution (Yarn-PnP-style resolver), native/Wasm boundary,
  multi-platform.
- Screening result: pending; catalog-tighten.matrix records pnp as a hybrid keeping per-importer
  `node_modules` symlinks; prior repo findings to be summarized by the inventory.

### Candidate E: `@pnpm/esm-loader` standalone preload over the isolated layout

- Discovery source: [pnpm.io/store-loader][store-loader], standalone integration section.
- Base category: inspectable open-source local technology.
- Overlays: high-trust execution (manual preload), incumbent augmentation rather than replacement.
- Screening result: pending; not a linker switch (packages stay materialized), so it cannot deliver the
  file-count or layout benefits; kept in the ledger because the docs advertise it as the manual
  integration path.

## Frozen query schedule

Recorded before executing discovery. Saturation rule per source class: two consecutive complete pages
add no screening survivor, or the provider reports exhaustion; a cap reached earlier marks the class
blocked, not saturated.

Source class 1, package registry (npm):

1. `npm view @pnpm/esm-loader versions time --json`
2. fetch `https://registry.npmjs.org/@pnpm/esm-loader`
3. npm search `pnpm loader` (record count; leads only, not evidence)

Source class 2, repository host (GitHub, `gh`):

1. `gh release list --repo pnpm/pnpm --limit 30`
2. release notes of every 12.x release for `loaded`, `store loader`, `store-loader`, `CAS`,
   `global virtual store`, `GVS`, `esm-loader`
3. `gh search issues --repo pnpm/pnpm "loaded linker"` (open and closed)
4. `gh search issues --repo pnpm/pnpm "store loader"` (open and closed)
5. `gh search issues --repo pnpm/pnpm "store-manifest"` (open and closed)
6. `gh search issues --repo pnpm/pnpm "esm-loader"` (open and closed)
7. `gh search issues --repo pnpm/pnpm "nodeLinker loaded"` (open and closed)
8. `gh search prs --repo pnpm/pnpm "loaded linker"` (open and closed)
9. `gh repo clone pnpm/pnpm` at depth 1 (record revision), source read of the loader, manifest
   generation, `excluded` materialization, preload injection, Node floor gate, and interactions with
   pnpmfile hooks, overrides, `link:` deps, workspace packages, build approvals, `supportedArchitectures`
   and frozen-lockfile installs

Source class 3, broader web:

1. `pnpm store loader`
2. `pnpm loaded linker`
3. `pnpm node_modules-free install`
4. `https://pnpm.io/store-loader` (all version tabs: 12.x, 11.x, 10.x)
5. `https://pnpm.io/settings` (`nodeLinker`, `nodePackageMap`, `frozenStore`, GVS sections)
6. `https://pnpm.io/pnpr` (relation to the loaded mode)

Expansion round (de-duplicated, from taxonomy already observed on the docs page; frozen with the
schedule): `global virtual store pnpm`, `CAS install pnpm`, `ERR_PNPM_LOADER_UNSUPPORTED_NODE`,
`enhanced-resolve pnpm loader`, `nodePackageMap pnpm`, `frozenStore pnpm`, `.store-manifest.json`.

Source class 4, this repository (incumbent, parallel systems, prior reports):

1. `rg "nodeLinker|node-linker"` across the repo (consumers, configs, docs)
2. `rg "node_modules"` across `package/`, `.github/`, container files, editor and linter configs
3. prior vet reports: `doc/audit/tech-monorepo-manager-vet-2026-09-16.md`,
   `doc/audit/tech-mpm-and-pnpm-as-a-mise-replacement-vet-2026-09-12.md`
4. troubleshooting and handover records listed in the context section
5. `rg "TODO|FIXME|HACK|workaround"` filtered to pnpm/linker/symlink/node_modules mentions

Query execution is delegated; literal queries, providers, filters, result counts and newly discovered
candidates are recorded in the evidence log when the delegated reports return.

## Frozen criteria and weights

No user preference was stated, so every criterion carries weight 1 and scoring only runs if at least
two finalists survive hard gates. Criteria apply to every finalist at equal depth:

1. Workflow continuity: current mise, CI, editor and packaging workflows keep functioning
   without per-tool reengineering.
2. Migration effort: size and risk of the change set required to adopt.
3. Dependency-graph compatibility: coverage of this graph's native, napi, WASM, TypeScript-source and
   bundler-consumed surfaces.
4. Upstream maturity: experimental versus stable status, release history, maintainer trajectory,
   open defect surface.
5. Resource benefit: disk usage, node_modules file count, install and branch-switch time
   (motivation class recorded by prior modules-cache work).
6. Supply-chain posture: preservation of substitution, build-approval, release-age and trust policies.

Ratings use the 0 to 4 scale with evidence and confidence per the governing skill; sensitivity reruns
move every medium/low-confidence rating and each weight one at a time.

## Execution manifest for the disposable-worktree experiment

Recorded before running the candidate command tree.

- Candidate and revision: pnpm 12.14.0 (loader embedded in the pnpm executable); repository HEAD
  `6889b9f273` checked out detached in `${HOME}/temp/agent/store-loader-research-20261018/cas-worktree`.
- Top-level commands: `pnpm install` (object-form then, if rejected, string-form `nodeLinker`),
  optional repeat with `excluded` entries for build-script packages; probe commands `node -e`,
  `node --import ./node_modules/.pnpm/.store-loader.mjs -e`, `pnpm exec node -e`, package `mise run`
  tasks, `node_modules/.bin` shims, one rolldown package build, one tsc type check.
- Statically discovered reachable tree: pnpm resolution against the public npm registry (HTTPS),
  `.pnpmfile.mjs` readPackage hook execution by pnpm, store blob clone-or-copy into the worktree,
  GVS materialization for excluded packages, approved build scripts per `allowBuilds` (sharp fetches
  prebuilt binaries), generation of `.store-manifest.json`, `.store-loader.mjs` and bin shims,
  `NODE_OPTIONS` injection into pnpm-run children.
- Files inspected to establish the tree: [pnpm-workspace.yaml](../../pnpm-workspace.yaml),
  [.pnpmfile.mjs](../../.pnpmfile.mjs), [pnpm.io/store-loader][store-loader].
- Expected reads: shared pnpm store under the mise-managed home, public registry metadata and
  tarballs. Expected writes: the disposable worktree only, plus pnpm's normal store metadata
  (project registration for store pruning; a stale registration may outlive worktree removal and is
  harmless until the next store prune). No network endpoints beyond the registry and sharp's
  release download. No credentials in the environment.
- Environment bounds: Fedora host, Btrfs, 61 GiB RAM, 935 GiB free; no container cap. Deviation
  justification: pnpm is the incumbent package manager performing its routine install class; the new
  code path is pnpm's own loader generation; isolation is provided by the disposable worktree; a
  memory/CPU cap would distort the install-time and layout measurements the evaluation needs.
- Success condition: install completes and probes classify the documented behavior on this graph.
  Failure and stop conditions: unsupported-configuration diagnostic (record, stop install attempts),
  install error (record, one variant retry with `excluded`), probe failures recorded not retried.
- Cleanup: `git worktree remove` after this report reaches a terminal outcome.

## Evidence log

Delegated evidence arrives in `${HOME}/temp/agent/store-loader-research-20261018/`
(`upstream.md`, `repo-inventory.md`, `experiment.md`). Decisive records are folded into this report
with citations when the delegations return; the scratch files are the raw backing.

### Upstream source audit (pending)

### Repository inventory (pending)

### Experiment results (disposable worktree, 2026-10-18)

Raw backing: `${HOME}/temp/agent/store-loader-research-20261018/experiment.md` (execution manifest,
484 lines) with artifacts `install-1.log`, `install-2.log`, `install-3.log`, `probe-timings.md`
(19 timed probes via `probes.mjs`), `rolldown-build-phase2.log`, `rolldown-build-phase2-preload.log`,
`store-manifest.phase1.json`, `main-nm-baseline.log`.
Worktree `cas-worktree`, detached at `a1dfc3ab92a03ce6e647b1a5ccafab11e6cfd070`,
pnpm 12.14.0, Node v26.12.0, mise 2026.10.0.
Environment deviation: the worktree lives on the encrypted volume, so pnpm fell back from the home
store to `/var/mnt/encrypted/.pnpm-store/v11` (hard links cannot cross devices); recorded in every
install log and harmless to the classification results.

Configuration acceptance and install gates:

- `nodeLinker: { type: loaded }` (object form) is accepted by pnpm 12.14.0;
  `node_modules/.modules.yaml` records `"nodeLinker": "loaded"`.
- Install attempt 1 failed in 0.433 s with `ERR_PNPM_CAS_REQUIRES_MATERIALIZATION`:
  `Package core-js needs materialization with the loaded linker`, even though `allowBuilds` maps
  `core-js: false`. The materialization gate fired despite disabled build scripts; recorded as an
  upstream-evidence wrinkle (lead-verified in `install-1.log`).
- With `excluded: [core-js]`, the warm install completed in 0.804 s (`Done in 770ms`);
  lockfile and supply-chain gates passed (`Lockfile passes supply-chain policies`).
- Phase 2 excluded 8 names (`core-js`, `rolldown`, `oxlint`, `oxlint-tsgolint`, `typescript`, `sharp`,
  `satteri`, `@bruits/satteri`): install 0.685 s, `+57` packages materialized into the GVS.

Layout facts (phase 1 unless noted; lead-verified directly against the worktree):

- Root `node_modules` holds only `.bin` (32 shims), `.modules.yaml`,
  `.pnpm/` (`.store-loader.mjs` 115821 B, `.store-manifest.json` 6268011 B, `cas-bins/` with 51
  hashed JS bin wrappers, `lock.yaml`) and `.pnpm-workspace-state-v1.json`.
  No package directories and no `@monochromatic-dev/` symlinks exist anywhere in the project.
- Manifest v1 phase 1: 762 entries = 181 `root` (project root, 179 workspace directories,
  core-js GVS) + 581 CAS `files` entries; the lockfile carries 652 packages over 181 workspace
  projects. Phase 2: 238 roots / 524 files / 58 `resolution: "node"` entries.
- The `link:` override shims appear as `root` entries pointing at their real `package/shim/*`
  directories (lead-verified in `store-manifest.phase1.json`: `node-domexception`, `proper-lockfile`,
  `readable-stream`, `ungap-structured-clone`), so the substitution mechanism survives at loader level.
- The GVS lives outside the project at `/var/mnt/encrypted/.pnpm-store/v11/links`
  (shared directory measured 535 M across projects).
- CAS bin shims self-register the loader and export
  `NODE_OPTIONS=--import=file://.../node_modules/.pnpm/.store-loader.mjs` to children;
  GVS-materialized bin shims do not register the loader.
- The logger sink directory `node_modules/.monochromatic` was still created and written by the
  unit-test probe run, so that first-party writer tolerates the layout.

Runtime probes (phase 1, then phase 2 delta):

- Bare `node` third-party import: FAIL (`Cannot find package 'execa'`); with the `--import` preload:
  PASS; `pnpm exec node`: PASS via the NODE_OPTIONS mechanism. The repository's mise tasks spawn bare
  `node` and `.bin` shims directly, never `pnpm run/test/exec`, so no current workflow receives the
  preload (corroborated by the repository inventory).
- CJS (`yaml`), JSON (require and ESM `with { type: 'json' }` on `@changesets/config/schema.json`),
  cross-package `createRequire`, exports gating: PASS.
- Virtual URLs behave as documented: `import.meta.resolve('execa')` returns
  `.pnpm-loader/<sha256>/index.js`; `fs` reads of it fail ENOENT; the directory never exists.
- Workspace TypeScript unit test (`package/module/or-throw/src/non-nullish-or-throw.unit.test.ts`):
  bare node FAIL (`Cannot find package '@monochromatic-dev/module-test'`); under preload PASS
  (exit 0) once the built `dist` exists for the self-reference import; sibling `/ts` workspace imports
  and their third-party dependencies resolve under the loader because workspace roots are real
  directories and Node's own type stripping applies.
- Native/napi packages from CAS: FAIL (`rolldown`, `sharp`, `satteri` with
  `Cannot find native binding`; TypeScript 7's JS launcher ENOENTs reading its own virtual
  `package.json`). Under phase-2 exclusions all six import/CLI probes PASS
  (`tsc --version` 7.0.2, `rolldown` v1.2.13, `oxlint` 1.88.0, `sharp`, `satteri`).
  The loader also enforces declared-dependency edges
  (`Package package/ssg/aquati.cat does not declare @bruits/satteri`).
- `tsc --build` on `package/module/or-throw` (phase 2, typescript materialized): exit 2 with 83
  errors; TS2307 for every workspace `/ts` import and the shared config packages, cascading
  TS5097/TS2550 from the lost base tsconfig. tsc's own fs-based resolution sees neither CAS nor GVS.
- rolldown build on `package/module/async-iter` (phase 2): without preload, config resolution fails
  (`Cannot find package '@monochromatic-dev/config-rolldown'`); with NODE_OPTIONS preload the config
  loads but the build fails with Rust-side `TSCONFIG_ERROR` on
  `@monochromatic-dev/config-typescript/dom` plus a transitive napi package
  (`@yuku-core/binding-linux-x64-gnu` via `rolldown-plugin-dts`) whose `.node` blob cannot load from
  CAS. The napi exclusion tail is discovered at runtime, not statically.
- Bin shims: pure-JS bins PASS standalone (`browserslist` 4.29.3); napi bins FAIL in phase 1 and
  PASS in phase 2.

Scale deltas (measured):

- Main worktree `node_modules` under the isolated linker: 20 G, 1761060 files
  (`du`/`find`, wall 1 m 11.6 s for the count).
- CAS worktree `node_modules`: 6.9 M / 96 files (phase 1), 6.7 M / 97 files (phase 2).
- Warm-store CAS install under 1 s for the whole 181-project graph.

Experiment conclusion (gate outcomes recorded in the Hard-gate outcomes section):
pure-JS runtime consumption works as documented today; the type-check and bundle workflows are broken
under the loaded layout even with the toolchain materialized, because fs-based resolvers outside
Node's loader hooks (tsc, rolldown's Rust side) cannot see CAS or GVS packages, and the napi
materialization tail is long and only discovered at runtime.

## Hard-gate outcomes (interim)

Candidate B (loaded linker), from the worktree experiment; final dispositions await the upstream
audit and repository inventory:

- Constraint 1 (mise-run workflows keep working): **FAIL, proven**. `tsc --build` exits 2 with 83
  errors on one small package even with `typescript` materialized (probe h); rolldown builds fail on
  the Rust-side tsconfig lookup and a hidden napi dependency even with preload and exclusions
  (probe j); unit tests pass only with an explicit `--import` preload that no current mise task
  injects, and `.bin` shims for GVS-materialized tools do not self-register the loader.
- Constraint 2 (native/napi/WASM loadable): **conditional pass** via `excluded` materialization;
  the exclusion set is discovered at runtime (hidden napi deps such as `@yuku-core` surfaced only
  during a build), which conflicts with reproducible CI expectations pending the inventory.
- Constraint 3 (supply-chain policy keeps effect): **pass so far**; lockfile and policy checks run
  unchanged, `link:` shims resolve as manifest root entries; `.pnpmfile` hook execution under CAS
  installs pending the upstream source audit.
- Constraint 7 (Node floor): host **pass** (v26.12.0 >= 26.2.0); Playwright container and Electron
  surfaces pending the repository inventory.
- Constraints 4, 5, 6, 8: pending; no counterevidence observed yet.

Candidates A, C, D, E: no gate executed yet; A is the incumbent baseline, C/D/E screening evidence
arrives with the upstream audit and repository inventory.

## Scoring and sensitivity (pending)

## Ranking and recommendation (pending)

[store-loader]: https://pnpm.io/store-loader
[settings]: https://pnpm.io/settings
[pnpr]: https://pnpm.io/pnpr
[pnpm-repo]: https://github.com/pnpm/pnpm
