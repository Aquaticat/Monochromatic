# Pi repository assessment audit

Date:
 2026-05-15

## Scope

This audit records the repository-wide assessment requested in the pi session.
It is a static assessment,
 not a full validation pass.
I did not run the full build or full test suite.

Evidence sources:

- `tokei` with heavy directories and `pnpm-lock.yaml` excluded.
- `find packages -mindepth 3 -maxdepth 3 -name package.json` for package count.
- Node one-off scripts over `packages/*/*/package.json`,
   `mise.toml`,
   and `src` trees.
- Direct reads of `README.md`,
   `mise.toml`,
   `pnpm-workspace.yaml`,
   `.github/workflows/*`,
  `AUDIT.md`,
   `SECURITY.md`,
   and representative package source files.
- `rg` scans for suppressions,
   raw console use,
   promise patterns,
   process exits,
  and README drift.

## Repository snapshot

Measured facts:

- The repository contains 96 workspace packages under `packages/*/*`.
- `tokei` counted 3,211 files,
   197,824 code lines,
   139,387 comment lines,
  and 38,271 blank lines,
   excluding `node_modules`,
   `.git`,
   `dist`,
  Playwright/test reports,
   `data`,
   `.serena`,
   `.crush/logs`,
   and `pnpm-lock.yaml`.
- TypeScript accounts for 2,281 counted files and 176,063 counted code lines.
- The tree contains 256 test files:
   244 unit tests,
   3 browser tests,
   6 e2e tests,
  and 3 other `.test.ts` files.
- The tree contains 336 Markdown files,
   including 111 `README.md` files,
  64 `TODO*` files,
   and 54 `TROUBLESHOOTING*` files.
- The package set includes 15 publishable packages and 24 packages with `bin` entries.

## Overall assessment

The repository is a mature TypeScript monorepo with strong local tooling,
strict conventions,
 extensive troubleshooting memory,
 and active dependency governance.
Its strongest areas are local developer workflow,
 source-level dependency audit practice,
custom lint enforcement,
 and documentation of tool failures.

The main weakness is the GitHub automation boundary.
The workflows I read cover forbidden-string scanning,
 publishing,
 OpenSSF Scorecard,
and Claude-assisted workflows,
 but I found no general workflow that runs the normal
build,
 lint,
 and test tasks on pull requests.
That means local quality gates are stronger than remote enforcement.

## Tooling and workflow

Strengths:

- `mise.toml` defines monorepo task fanout,
   root build/test/lint/format commands,
  Playwright-in-Podman browser and e2e tasks,
   file synchronization,
  catalog tightening,
   and page-weight checks.
- `pnpm-workspace.yaml` uses strict dependency settings:
   isolated linker,
  no hoisting,
   strict peer dependencies,
   catalog entries,
   and explicit overrides.
- `file-enforcer.config.ts` generates `mise.toml`,
   mirrors skills,
   and keeps
  derived files in sync.
- Root tasks route through `mise run`,
   which gives contributors one command surface.

Risks:

- The root toolchain uses several `latest` entries in `mise.toml`.
  This favors freshness,
   but it reduces reproducibility and can change behavior
  between checkouts without a repository change.
- The `enter` hook runs `mise install` and `mise upgrade`.
  That keeps tools current,
   but it can add latency and surprise at directory entry time.
- GitHub workflows do not currently mirror the local build,
   lint,
   and test gates.

## Architecture and code quality

Strengths:

- `packages/mcp/stdio/src/server.ts` is a deep module:
  it exposes `createMcpServer()` and hides JSON-RPC dispatch,
   initialization,
  tool listing,
   and tool call handling behind a small immutable server handle.
- `packages/build-tool/css/src/index.ts` provides useful public interfaces:
  `build()` and `applyMixins()` hide PostCSS parsing,
   import inlining,
  mixin collection,
   nested mixin expansion,
   apply expansion,
   and output writing.
- `packages/oxlint-plugin/no-restricted-syntax/src/index.ts` encodes repository
  conventions as custom Oxlint plugin rules rather than relying only on prose.
- `packages/git-policy/cli/src/index.ts` uses an explicit rule pipeline for wrapper behavior:
  root requirement,
   add restrictions,
   push restrictions,
   commit restrictions,
  and status-hint handling.

Risks:

- `packages/build-tool/css/src/index.ts` clears a shared `mixins` registry in both
  public APIs.
   Concurrent in-process calls can interfere if two builds or string
  expansions run at the same time.
- `packages/webapp-forge/server/src/server/runtime.ts` stores process-wide storage,
  write-buffer,
   and event cursor state.
   The file documents this as phase-1 design,
  so the risk is understood,
   but it remains a concurrency and deployment constraint.
- `packages/module/es/package.json` exposes deep taxonomy paths such as `./ts/*`
  and selected concrete implementation paths.
   That gives callers access,
   but it
  also makes the interface close to the implementation.
- `packages/module/es/README.md` carries a stale-warning dated 2026-05-13.
  That warning is useful honesty,
   but it means the package's public overview is
  not a dependable guide to the current export taxonomy.

Measured code-quality signals from TypeScript scans under `packages/**/*.ts`:

- 1,199 lint suppression matches.
- 49 TypeScript suppression matches.
- 69 `new Promise` matches.
- 39 `.then`,
   `.catch`,
   or `.finally` matches.
- 14 `process.exit(` matches,
   mostly tests and one CLI source path.
- 4 `switch` matches,
   including fixtures and plugin examples.

These counts include tests,
 fixtures,
 generated files,
 and justified exceptions.
They should be treated as audit targets,
 not automatic defects.

## Tests and verification

Strengths:

- `packages/module/test/README.md` documents a custom runtime-neutral test harness
  with `describe`,
   `it`,
   `expect`,
   concurrent execution,
   assertion counting,
  sinon integration,
   repeats,
   skips,
   and expected-failure support.
- The repository has 256 test files.
- Test files are concentrated in core utility and tooling areas:
  `packages/module` has 118 test files,
   `packages/dev-script` has 50,
  `packages/webapp-forge` has 20,
   `packages/pi-plugin` has 17,
   and `packages/cli` has 16.
- Root `mise.toml` defines unit,
   browser,
   e2e,
   watch,
   and build-and-test tasks.

Risks:

- 38 packages with source files have no colocated tests by my scan.
- The largest package without colocated tests by non-test source-file count is
  `packages/dev-script/inference-canary`,
   with 1,303 non-test TypeScript files.
  This count includes generated or artifact-like source files under the package.
- Other notable source packages without colocated tests include
  `packages/desktop-daemon/editord`,
   `packages/webapp-productivity/done`,
  `packages/webapp-productivity/done-postcss`,
   `packages/ssg/aquati.cat`,
  and `packages/cli/terminal-exec`.
- Browser and e2e test counts are small relative to the number of web application packages.

## Security and dependency governance

Strengths:

- `SECURITY.md` directs private vulnerability reports through GitHub private
  vulnerability reporting and states supported versions and scope.
- `AUDIT.md` records a Socket CLI scan dated 2026-04-05.
  The report states no malware,
   known CVEs,
   typosquatting,
   install scripts,
  unlicensed packages,
   obfuscation,
   high-entropy strings,
   or unstable ownership
  in that scan.
- `pnpm-workspace.yaml` contains 117 catalog entries.
- The workspace has 17 removal overrides,
   3 link-shim overrides,
   and comments
  tying specific overrides to CVE or GHSA identifiers.
- The dependency blocklist mechanism is documented in `doc/dependency-blocklist.md`.
- `.github/workflows/forbidden-strings.yml` runs a baseline deny-list scan on pull requests,
  merge groups,
   and pushes to `main`,
   with a full-tree scan on pushes to `main`.
- GitHub actions in the workflow files I read are pinned by commit SHA.

Risks:

- The security-oriented workflows do not compensate for missing build/test/lint CI.
  Secret scanning and Scorecard can pass while normal code validation is absent.
- The publish workflow filters a subset of publishable packages.
  My scan found 15 publishable packages,
   while `.github/workflows/publish.yml`
  filters 10 unique package names.
- Publishable packages missing from the workflow filter are:
  `@monochromatic-dev/config-oxlint`,
  `@monochromatic-dev/dev-script-watch-restart`,
  `@monochromatic-dev/module-test`,
  `@monochromatic-dev/module-toml-edit`,
   and
  `@monochromatic-dev/stylesheet-monochromatic`.

## Documentation and onboarding

Strengths:

- The repository has unusually extensive operational memory:
  54 troubleshooting documents,
   13 philosophy documents,
   multiple planning files,
  and many package READMEs.
- `AGENTS.md` is detailed and organized by moment of decision,
  which makes it useful for agent behavior and contributor expectations.
- Root docs capture dependency policy,
   tool failures,
   browser support,
  CSS policy,
   build-execution policy,
   and portability assumptions.

Risks and remediations applied:

- `README.md` said the monorepo had 48 packages,
   but the measured count is 96.
  I updated it in commit `fdea6d18`.
- `README.md` described Bun workspaces as the package manager,
  but `pnpm-workspace.yaml`,
   `mise.toml`,
   `AGENTS.md`,
   and `bunfig.toml`
  show pnpm as the dependency manager.
   I updated the technical stack entry
  in commit `fdea6d18`.
- `README.md` omitted several current package categories.
  I updated the project structure list in commit `fdea6d18`.
- `README.md` linked the license as Apache-2.0,
   while `LGPL-3.0-or-later.txt` is LGPL-3.0
  and `package.json` declares `LGPL-3.0-or-later AND CC-BY-SA-4.0`.
  I updated the license section in commit `fdea6d18`.

## Priority recommendations

1. Add a required GitHub workflow that runs the repository validation gates.
   Start with `mise run lint`,
    `mise run build`,
    and `mise run test`,
   or a documented scoped equivalent if runtime cost is too high.
2. Align `.github/workflows/publish.yml` with the publishable package set,
   or mark packages private if they are not intended for publication.
3. Create a test-coverage backlog for packages with source but no colocated tests.
   Start with `inference-canary`,
    `editord`,
    `done`,
    `ssg-test`,
    and `terminal-exec`.
4. Audit lint and TypeScript suppressions by package,
    excluding generated files
   and fixtures,
    so intentional exceptions remain visible.
5. Remove shared mutable state from `build-tool/css` if concurrent in-process
   CSS builds are a supported use case.
6. Continue refreshing stale top-level documentation when measured facts change.
