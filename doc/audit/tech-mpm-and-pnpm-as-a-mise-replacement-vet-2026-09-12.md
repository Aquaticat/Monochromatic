# MPM and pnpm as a Mise replacement vet report

Status:
complete fit screening;
terminal result is no validated finalist for a complete two-tool replacement.

Lifecycle phase:
screening complete;
no candidate reached finalist validation for the full replacement scope.

Subject:
MPM and pnpm as a Mise replacement.

Decision scope:
assess whether Meta Package Manager 7.6.1 plus pnpm 12.4.1 can replace Mise for repository tasks and
 developer-tool provisioning in Monochromatic.

Start date:
2026-09-12.

Last updated:
2026-09-12.

Governing skill commit:
`a05818ad70a40e5769a36de669697ba109891b31`.

Governing skill SHA-256:
`393eb68c5b2b2f7b16c8f7f90c100fb8be43eefa4501511360cd0572e4ae8087`.

Compatibility fingerprint:
`cd0814dde67b79cb91f892b048e36ae6414f925facfb72fdfa7994cc8a945b71`.

Active audit owner:
Pi session `01a097c8-535a-72ce-9dbf-26985664148b`.

Prior compatible report:
none.
The existing [`mise-removal-coverage.md`](../planning/mise-removal-coverage.md) is a responsibility ledger,
not a technology vet report.

## Result

A migration away from Mise is realistic,
but **Meta Package Manager plus pnpm is not a complete two-tool replacement**.

pnpm 12.4.1 is a plausible owner for workspace dependency installation and task orchestration.
Meta Package Manager 7.6.1 is a machine-level inventory and command wrapper for already-present package managers.
It does not replace project tasks,
local file watching,
environment activation,
secret injection and output redaction,
or the underlying installers it invokes.
Its restore format also does not enforce recorded versions for several relevant backends.

The proposed pair therefore needs additional owners for at least these boundaries:

- Rust toolchains,
  components,
  and targets;
- JDK,
  Android SDK and NDK,
  Zig,
  and standalone binaries;
- task child environments,
  root and package environment precedence,
  and optional shell activation;
- SOPS decryption,
  child-only secret injection,
  redaction,
  and interactive editing;
- local source-file watch and restart behavior;
- CI setup,
  editor paths,
  repository-root discovery,
  agent command policy,
  and generated configuration migration.

The evidence supports a **pnpm-centered migration with focused native providers**.
It does not support adopting Meta Package Manager as a required project boundary yet.
That is a fit conclusion,
not an adoption recommendation.

## Context and hard constraints

The incumbent is Mise `2026.9.5` on Linux x64.
The repository currently resolves pnpm `12.3.4`.
`README.md:338-340` names Fedora as the development target and WSL2 as the Windows path.
Selected GitHub workflows also execute on macOS and Windows.

The current responsibility ledger measured:

- 178 active Mise configuration files containing 9,422 lines;
- 1,811 effective tasks;
- 37 root tool declarations and 38 lock entries;
- nine GitHub workflow files that reference Mise;
- 101 active package README files that reference Mise;
- 26 decision documents and nine runbooks that reference Mise.

Sources:
[`mise-removal-coverage.md`](../planning/mise-removal-coverage.md),
`mise.no-env.toml`,
active package `mise.toml` files,
and a fresh `mise tasks --all --hidden --json` count on 2026-09-12.

### Frozen hard constraints

- Complete responsibility coverage or an explicit retirement decision.
- Inspectable open-source local execution.
- Preserve current task failure,
  filtering,
  working-directory,
  and argument behavior.
- Preserve exact or reviewable tool versions and artifact provenance.
- Work on repository-supported local and CI platforms.

### Components and overlays

Every candidate is an inspectable open-source local technology.

Applicable overlays:

- incumbent dependency replacement;
- high-trust developer-machine and CI execution;
- secret-handling boundary;
- native or prebuilt artifact boundary;
- multi-platform claims.

### Frozen soft criteria

No candidate reached scoring.
If a later pilot produces validated finalists,
use these criteria without changing them in response to candidate results:

- separation of responsibilities,
  weight 5 because avoiding an over-broad owner is the stated motivation;
- repository fit,
  weight 1;
- human auditability,
  weight 1;
- maintenance evidence,
  weight 1;
- operational simplicity,
  weight 1.

Hard constraints remain outside arithmetic.

### Unresolved preferences

These preferences change the eventual architecture but do not change this report's fit result:

- retain or retire automatic directory-entry environment activation;
- accept generated `package.json` and `pnpm-workspace.yaml` task adapters from canonical TypeScript;
- retain floating tool requests or replace them with exact locks and reviewed update automation.

## Discovery protocol

### Frozen query schedule

Official ecosystem and registry queries:

- `site:mpm.run mpm.run task runner documentation pnpm monorepo`
- `site:pnpm.io pnpm runtime Node Deno Bun official docs`
- `site:pnpm.io/12.x pnpm cargo enabled python enabled documentation`
- exact PyPI metadata for `meta-package-manager`;
- exact GitHub release metadata for `kdeldycke/meta-package-manager` and `pnpm/pnpm`.

Repository-host queries:

- `mpm.run GitHub task runner monorepo package manager`
- `site:github.com "mpm.run"`
- GitHub repository metadata and release APIs for each discovered candidate.

Broader web queries:

- `"mpm" "pnpm" task runner run monorepo`
- `npm mpm.run package task runner`
- `open source meta package manager declarative package manifest restore cross-platform alternative to
  meta-package-manager mpm`
- `GitHub meta package manager wrapper multiple package managers install restore manifest cross platform`
- `package manager inventory restore all package managers mpm alternative Topgrade pacdef metapac`

Repository queries:

- active Mise configuration,
  tool,
  task,
  environment,
  workflow,
  source,
  README,
  decision,
  and runbook references;
- prior Mise removal plans and pnpm 12.4 investigation;
- existing repository-owned generators and provisioning code.

### Query outcomes

The initial web round identified Meta Package Manager,
pnpm,
`repo-run`,
and unrelated task runners.
The taxonomy expansion round identified `metapac`,
`pacdef`,
and Topgrade.
No later term added another candidate category.

The named-stack fit search is saturated across its official site,
package registry,
source host,
and this repository.
This was not a saturated selection of every task runner or every tool-version manager.
The report therefore assesses the proposed pair and records adjacent alternatives,
but does not select an entire replacement stack.

## Candidate ledger

### Meta Package Manager 7.6.1 plus pnpm 12.4.1

Discovery sources:
user proposal,
[Meta Package Manager documentation][mpm-home],
[pnpm documentation][pnpm-run],
and upstream source.

Base category:
inspectable open-source local technology.

Overlays:
all report overlays.

Screening result:
**fail as a complete two-tool Mise replacement**.
The pair does not own every current responsibility,
and stable Meta Package Manager cannot reproduce several required version pins.

### pnpm 12.4.1 plus repository-owned orchestration and focused native providers

Discovery source:
existing repository plan,
pnpm 12.4 documentation,
and pnpm source.

Base category:
inspectable open-source local technologies plus repository-owned TypeScript.

Overlays:
all report overlays.

Screening result:
**serious migration architecture,
not a validated candidate stack**.
Providers for non-pnpm toolchains,
environments,
secrets,
and watches remain unselected.
No adoption recommendation is possible.

### Mise 2026.9.5 plus pnpm 12.3.4

Discovery source:
incumbent repository configuration.

Base category:
inspectable open-source local technologies.

Overlays:
incumbent and high-trust execution.

Screening result:
**excluded from the requested endpoint**.
It is the current rollback baseline,
but retaining it does not achieve migration away from Mise.

### metapac

Discovery source:
GitHub and the broader meta-package-manager search.

Base category:
inspectable open-source local technology.

Overlays:
incumbent replacement,
high-trust execution,
and multi-platform claims.

Screening result:
**fail as a complete replacement**.
Its own README describes a declarative wrapper over underlying package managers,
not a project task,
environment,
watch,
or secret runtime.
It is closer than Meta Package Manager to desired-state package declarations,
but it does not dissolve the missing-owner problem.

### pacdef

Discovery source:
Meta Package Manager's comparable-tool catalogue and GitHub.

Screening result:
**hard-gate exit**.
The repository was archived on 2025-08-05 and points users to metapac.

### Topgrade

Discovery source:
Meta Package Manager integration and the broader search.

Screening result:
**category mismatch**.
Topgrade detects package managers and upgrades existing installations;
it is not a declarative clean-machine provisioner or project task runner.

## Meta Package Manager evidence

### Scope and execution model

Meta Package Manager's official homepage describes `mpm` as a wrapper around package managers.
Its primary operations inventory,
search,
install,
remove,
upgrade,
dump,
restore,
and export machine packages.
The current catalogue reports 143 actively supported manager adapters.
The stable 7.6.1 source contains 42 Python manager modules,
42 manager classes,
and 24 bundled TOML manager definitions.

This breadth is coherent for machine package inventory,
but it does not address the project's task and environment surfaces.
It also means adopting MPM does not remove a broad abstraction.
It replaces a multi-domain abstraction with a package-manager-only abstraction that still spans many backends.

Evidence:
[official homepage][mpm-home],
[manager catalogue][mpm-managers],
and stable source measurements.

### MPM delegates to already-installed managers

Before an operation,
MPM detects selected managers by invoking each manager's version probe.
It then fans operations out across available managers.
It does not install those package managers as prerequisites.

That leaves a bootstrap graph outside MPM:
pnpm,
Cargo or rustup,
SDKMAN or another JDK provider,
platform package managers,
and any standalone-binary installer must already exist before MPM can drive them.

Evidence:
[concurrency documentation][mpm-concurrency] and
`meta_package_manager/manager.py` plus `meta_package_manager/pool.py` at stable tag `v7.6.1`.

### Restore is machine-scoped and version support is uneven

`mpm dump` writes installed package versions into a TOML manifest.
`mpm restore` reconstructs a versioned `Specifier` for every entry and asks each selected manager to install it.
That format looks lock-like,
but manager adapters can explicitly ignore the version.

For relevant stable 7.6.1 adapters:

- pnpm installation is decorated with `version_not_implemented` and runs
  `pnpm add --global <package>` without the recorded version;
- pipx installation is decorated the same way;
- the Cargo bundled definition runs `cargo install <package>` without `--version`;
- the stew bundled definition runs `stew install <package>` without a tag or version.

The decorator logs a warning and allows the underlying manager to choose a version.
This fails the exact or reviewable tool-version hard constraint for those paths.

Evidence:

- `meta_package_manager/cli_snapshots.py:400-476`;
- `meta_package_manager/capabilities.py:268-286`;
- `meta_package_manager/managers/pnpm.py:215-225`;
- `meta_package_manager/managers/pipx.py:269-280`;
- `meta_package_manager/managers/cargo.toml:41-43`;
- `meta_package_manager/managers/stew.toml:29-31`.

### Stable release differs from current documentation

The latest stable release is 7.6.1,
commit `d0404ee2f93f95dac9329e41e47511ef6da4132b`,
published 2026-08-11.
Current documentation includes unreleased 8.0 material.
In particular,
the current `rustup` and `bin` pages mark those adapters as 8.0.0 development additions.
Neither adapter exists in the 7.6.1 source tree.

This matters because Rust toolchains and standalone binaries are required Mise responsibilities.
Assessing current website feature headings without reading their changelog sections overstates stable coverage.

Evidence:
[latest GitHub release][mpm-release],
[current rustup page][mpm-rustup],
[current bin page][mpm-bin],
and the cloned stable tree.

### Platform and artifact surface

MPM publishes standalone Linux,
macOS,
and Windows binaries for x64 and arm64.
The Linux x64 7.6.1 asset is 29,313,224 bytes with GitHub-reported SHA-256
`de58308be281c46cd515ce01af4932ea3b4b5fcbec13d211d987cf463e4014be`.
A sibling attestation asset is published.

The stable source is GPL-2.0-or-later,
contains 32,906 Python lines across its production package,
and declares eight runtime dependencies on Python 3.10 or newer.
These measurements describe audit surface,
not a hard-gate failure.

Evidence:
GitHub release API,
`pyproject.toml:135-287`,
and local stable-source measurements.

### Security model

MPM executes manager commands as argument vectors rather than through a shell.
Its normal configuration is per-user and is not automatically discovered from the current repository.
An explicitly supplied configuration can redirect binaries and run arbitrary commands,
so project use would need the same trusted-configuration treatment as task files.

Evidence:
[security model][mpm-security].

### Maintenance and validation boundary

The project is actively releasing and its latest stable release includes Linux,
macOS,
and Windows artifacts.
The repository is not archived.
A full maintenance sample and upstream CI execution were not used to promote it,
because the candidate exited on responsibility coverage and version-reproduction hard gates.

No MPM binary was downloaded or executed.
There is no consumer-boundary validation result.

## pnpm evidence

### Task orchestration is a plausible replacement boundary

pnpm 12 workspace tasks are `package.json` scripts.
`pnpm -r run <script>` builds a dependency-aware task graph,
limits concurrency,
skips absent scripts without severing graph edges,
continues independent work with `--no-bail`,
and exposes a stable JSON dry-run graph.

This maps well to the repository's package-scoped build,
test,
and lint families.
It does not directly consume TypeScript task declarations,
so the existing file-enforcer boundary would need to generate package scripts and
`pnpm-workspace.yaml` task relationships.

Evidence:
[pnpm task orchestration][pnpm-tasks] and
[`pnpm-12-4-polyglot-workspace.md`](../troubleshooting/pnpm-12-4-polyglot-workspace.md).

### Pipeline is promising but experimental

`pnpm pipeline` 12.4 performs a frozen install,
affected-project selection,
task graph execution,
result caching,
and aggregate failure reporting.
The official page marks its configuration and output experimental.
The repository's installed pnpm 12.3.4 does not contain this command.

A migration can use stable recursive `pnpm run` first and evaluate pipeline caching separately.
Full removal should not depend on pipeline until a disposable pilot passes the repository's parity gates.

Evidence:
[pipeline documentation][pnpm-pipeline] and the repository troubleshooting report.

### Runtime and ecosystem reach has boundaries

pnpm can install exact Node,
Deno,
and Bun runtimes.
pnpm 12 is itself available as a native executable,
so Node is not required after pnpm is bootstrapped.

Experimental 12.4 Cargo support installs and verifies locked crate sources,
then Cargo compiles them.
It does not install Cargo,
rustup,
components,
or targets.
Experimental Python support builds project environments from an existing Python interpreter;
it does not install that interpreter.

Evidence:
[pnpm runtime documentation][pnpm-runtime],
[pnpm installation documentation][pnpm-install],
[pnpm Cargo documentation][pnpm-cargo],
and [pnpm Python documentation][pnpm-python].

### Current repository version

The current checkout resolves pnpm 12.3.4,
while the assessed feature release is 12.4.1 at commit
`19eb39448649c926bc63b0e9fa16f0e340701460`.
No pnpm 12.4 executable was run against this repository.
The existing source audit records the relevant 12.4.1 implementation paths.

## Responsibility coverage ledger

### Workspace dependencies

Proposed owner:
pnpm.

Coverage:
strong current fit for npm dependencies;
experimental additional Cargo and Python dependency installation in 12.4.

Gate:
disposable 12.4 install and lockfile pilot.

### Task discovery and execution

Proposed owner:
pnpm recursive run,
with generated package scripts and workspace task relationships.

Coverage:
plausible but unvalidated.

Gate:
preserve namespaced partial invocation,
arguments containing spaces,
working directories,
sequential and parallel groups,
optional package tasks,
failure tolerance,
and aggregate exit status.

### Tool acquisition and locking

Proposed owner:
not fully selected.
pnpm can own Node and Bun runtimes plus npm-distributed CLIs.
Ecosystem-native installers remain necessary for Rust,
JDK,
Android,
Zig,
and standalone binaries.

MPM contribution:
unified invocation and inventory after those managers exist.

Gap:
stable MPM does not enforce several recorded versions and cannot bootstrap the managers it wraps.

### Environment and PATH

Proposed owner:
unselected task environment launcher plus pnpm's workspace-bin PATH behavior.

Coverage:
partial.
pnpm exposes workspace bins and Python project environments to scripts.
It does not reproduce Mise's tool-generated environment,
root and package precedence,
or optional shell activation.

### Secrets

Proposed owner:
unselected narrow SOPS and age child-environment launcher.

Coverage from MPM and pnpm:
none for decryption,
redaction,
and child-only secret injection.

### Watching

Proposed owner:
direct package watcher processes or a focused local watch owner.

Coverage:
pnpm can launch watcher scripts.
`pnpm pipeline --watch` polls repository revisions and is not a replacement for local source-file watches.

### CI,
editors,
root discovery,
and agent policy

Proposed owner:
generated adapters after task,
tool,
and environment interfaces stabilize.

Coverage:
migration work remains.
MPM does not supply a GitHub Action equivalent to the current `jdx/mise-action` setup or
stable project-local tool paths.

## Hard-gate outcomes

### MPM plus pnpm as exactly two tools

Outcome:
fail.

Reasons:
missing owners for required responsibilities and non-reproducible MPM restore paths for relevant managers.
Soft scoring cannot offset either hard failure.

### pnpm plus native providers and repository-owned generation

Outcome:
pending,
not validated.

Reason:
the architecture can cover every ledger entry in principle,
but several providers and runtime contracts are still unselected.

### Keep Mise

Outcome:
valid rollback baseline but excluded from the requested endpoint.

### metapac

Outcome:
fail as a complete replacement.

Reason:
package desired-state management does not cover task,
environment,
watch,
and secret responsibilities.

### pacdef

Outcome:
fail because upstream is archived.

### Topgrade

Outcome:
category mismatch.

## Scoring and sensitivity

No candidate was validated across the full replacement boundary,
so scores and sensitivity calculations are not applicable.
Publishing provisional numbers would allow soft evidence to hide missing responsibility owners.

## Pros and cons of the proposed pair

### Pros

- pnpm already owns the workspace dependency graph and is the natural home for package scripts.
- pnpm 12.4's task graph has machine-readable inspection and explicit dependency relationships.
- pnpm 12 can bootstrap Node and Bun runtimes after a standalone pnpm bootstrap.
- MPM offers one inventory,
dump,
restore,
SBOM,
and update interface over many machine package managers.
- MPM does not auto-load repository configuration by default.

### Cons

- MPM is not a tool-version manager or project environment manager.
- MPM needs its underlying package managers to exist first.
- MPM's stable restore path ignores recorded versions for pnpm,
pipx,
Cargo,
and stew installations.
- Stable MPM lacks its documented development-branch rustup and bin adapters.
- Neither tool owns Mise's SOPS injection and output redaction.
- pnpm pipeline,
Cargo installation,
and Python installation are new 12.4 experimental surfaces.
- Adding MPM retains a broad cross-manager abstraction,
which weakens the stated separation-of-responsibility goal unless its role is restricted to optional machine inventory.

## Migration implication

The smallest evidence-backed next experiment is not an MPM rollout.
It is a disposable pnpm 12.4.1 task pilot that translates representative TypeScript,
Rust,
watch,
and failure-preserving task paths while Mise remains available as the adapter and rollback path.

In parallel,
build a tool coverage manifest that assigns every one of the 37 current declarations to:

- pnpm runtime;
- pnpm workspace dependency;
- rustup or Cargo tooling;
- JDK and Android tooling;
- platform package manager;
- verified standalone-binary provider;
- intentional retirement.

Evaluate MPM only after that assignment exists.
If MPM merely runs those already-selected providers,
it is optional convenience rather than a prerequisite for Mise removal.

## Recommendation boundary

No complete stack is recommended for adoption from this report.

The realism answer is conditional:

- **realistic** as a staged migration centered on pnpm plus focused additional providers;
- **not realistic** as a literal `mise -> mpm + pnpm` substitution with no other owners;
- **not yet evidenced** for a clean-machine cutover,
  because pnpm 12.4 and every remaining provider still need disposable consumer-boundary validation.

## Evidence limits

- MPM was screened from official documentation and stable source,
but not executed.
- pnpm 12.4.1 source was audited previously,
but its executable was not run against this repository.
- macOS and Windows replacement paths were not exercised.
- no secret,
watch,
Android,
desktop,
or clean-machine parity test ran.
- current MPM documentation includes unreleased behavior;
this report separates stable 7.6.1 from development 8.0 material where relevant.

## Evidence records

### Repository context probe

Candidate:
incumbent Mise 2026.9.5 and pnpm 12.3.4.

Claim:
current versions and task/configuration surface.

Commands:
`mise --version`,
`pnpm --version`,
`mise tasks --all --hidden --json`,
`find`,
`rg`,
and `wc` from `/var/home/user/Monochromatic` on Linux x64.

Environment:
current developer checkout;
no credentials requested;
read-only repository inspection intended.

Result:
exit status 0 for cited probes.
The command tool imposed 30-second or 60-second ceilings;
exact elapsed time was not captured.

### MPM stable source audit

Candidate:
Meta Package Manager 7.6.1,
commit `d0404ee2f93f95dac9329e41e47511ef6da4132b`.

Clone:
`~/temp/agent/meta-package-manager-2026-09-12` from
`https://github.com/kdeldycke/meta-package-manager` using `gh repo clone --depth 1 --branch v7.6.1`.

Claim:
restore and relevant manager adapters do not form an exact-version project toolchain contract.

Files:
`meta_package_manager/cli_snapshots.py`,
`meta_package_manager/capabilities.py`,
`meta_package_manager/managers/pnpm.py`,
`meta_package_manager/managers/pipx.py`,
`meta_package_manager/managers/cargo.toml`,
and `meta_package_manager/managers/stew.toml`.

Status:
hard-gate failure for the proposed role.
No third-party candidate command was executed.

### pnpm source audit

Candidate:
pnpm 12.4.1,
commit `19eb39448649c926bc63b0e9fa16f0e340701460`.

Clone:
`~/temp/agent/pnpm-2026-09-11` from `https://github.com/pnpm/pnpm`.

Claim:
pipeline task bodies come from package scripts;
Cargo support installs dependencies but not the Rust toolchain;
Python support requires an interpreter.

Files and excerpts:
recorded in
[`pnpm-12-4-polyglot-workspace.md`](../troubleshooting/pnpm-12-4-polyglot-workspace.md).

Status:
serious component,
consumer-boundary validation pending.

[mpm-home]: https://mpm.run/
[mpm-managers]: https://mpm.run/managers/
[mpm-concurrency]: https://mpm.run/concurrency/
[mpm-security]: https://mpm.run/security/
[mpm-release]: https://github.com/kdeldycke/meta-package-manager/releases/tag/v7.6.1
[mpm-rustup]: https://mpm.run/managers/rustup/
[mpm-bin]: https://mpm.run/managers/bin/
[pnpm-run]: https://pnpm.io/cli/run
[pnpm-tasks]: https://pnpm.io/workspace-task-orchestration
[pnpm-pipeline]: https://pnpm.io/cli/pipeline
[pnpm-runtime]: https://pnpm.io/cli/runtime
[pnpm-install]: https://pnpm.io/installation
[pnpm-cargo]: https://pnpm.io/cargo
[pnpm-python]: https://pnpm.io/python
