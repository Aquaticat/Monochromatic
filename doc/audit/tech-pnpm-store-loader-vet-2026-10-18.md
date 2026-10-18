<!--
status: in progress; context, hard constraints and rubric frozen; evidence collection in flight
lifecycle-phase: discovery and screening delegated; no finalist validated yet
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

### Experiment results (pending)

## Hard-gate outcomes (pending)

## Scoring and sensitivity (pending)

## Ranking and recommendation (pending)

[store-loader]: https://pnpm.io/store-loader
[settings]: https://pnpm.io/settings
[pnpr]: https://pnpm.io/pnpr
[pnpm-repo]: https://github.com/pnpm/pnpm
