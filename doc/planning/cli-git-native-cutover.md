# cli-git native cutover runbook

## Purpose and how to use this document

This document is the runbook for the cutover of the Git policy wrapper:
publishing the native crate,
 installing it as a `cargo:` mise tool,
migrating consumers,
 documentation,
 and retirement of the TypeScript implementation.
The user's standing decision is that there is no hybrid and the old TypeScript goes
(`doc/handover/cli-git-rust-implementation.md`,
 queue item "Commit path,
 run as parallel lanes",
and the section `User decisions 2026-10-05`).

A read-only scout wrote it on 2026-10-12 against `main` at `e1890fb471`.
It was updated on 2026-10-13 after the user's answers,
 against `main` at `f7a4d08160`.
Between the two,
 `package/git-policy/cli` changed only in tests
(`0c4d65094e`,
 `dfcab2b44e`,
 `5717784913`:
 `binary_commit_tests.rs` and `commit_convergence_tests.rs`).
Facts measured on 2026-10-12 carry that date;
 facts measured on 2026-10-13 say so.
Nothing in the real installation was installed,
 replaced,
 or published by either author;
the probes are listed in `Evidence basis`.

Terms:
the incumbent is the TypeScript wrapper (every file of `package/git-policy/cli` outside `src/native/`);
native is the Rust executable `cli-git-native` built from `package/git-policy/cli/src/native/`.
Paths starting with `src/`,
 `bin/`,
 `e2e/`,
 `perf/` or `native-interop/` are relative to `package/git-policy/cli/`;
every other path is repository-relative.
`file:line` citations were read in this checkout.

How to use it:
`Decisions` lists what is settled and what is open to veto.
`Publishing the native crate` is the prerequisite of the install.
`Installation sequence with rollback` and `Order of the retirement commits` give the order of work.
`Not established` lists the facts no probe settled.

## Decisions

### Decided by the user on 2026-10-13

- Install route:
  publish the native crate to crates.io and install it as a `cargo:` mise tool,
   like the published linter
  `monochromatic-lint` (root `mise.no-env.toml`,
   `package/linter/monochromatic-lint`).
  The answer is the approval for this crate's first publication.
  The `cargo publish` itself is run by the orchestrator after the verification described in
  `Publication steps in order`;
   the owner-only parts are the API token and the Trusted Publishing form.
  Carried out in `Publishing the native crate`.
- Hk cleanup:
  retire the task `cleanup:hk-git-config` and `doc/runbook/remove-retired-hk-git-config.md` now.
  `src/maintenance/hk-config-cleanup*.ts`,
   its fixture test and the task `test:hk-config-cleanup` go with `src/`.
  The troubleshooting document that points at the task is rewritten to the manual removal (see `Documentation`).
- Rollback window:
  it ends right after the installed wrapper is verified.
  The incumbent's shim,
   `dist` and dependency links stay only until that verification passes.
  Afterwards rollback is versioned (pin the previous published crate version);
  returning to the incumbent then means a fresh install from the pinned revision (see `Rollback`).
- First native workflow:
  Linux only.
  Hosted macOS and Windows runners wait for the trailing Windows checks.

### Adopted without asking on 2026-10-13, open to veto

- Stale worktrees:
  switch after the worktrees in active use have merged `main`,
   run `mise run sync:files` and run `mise install`;
  stale worktrees fail with the migration message quoted under hazard 3.
- Verification tools with the incumbent as reference:
  pin the last incumbent revision (its hash goes in the retirement commit and the behavior ledger);
  delete the commit,
   configuration and dependent-version differentials;
  keep `native:interop` and give it an incumbent-provisioning step from the pinned revision.
- Release and CI jobs:
  build the crate from the checkout with `cargo build --release --locked` and put `git` first on `PATH` for the step.
- The four authoring and policy packages (`package/git-policy/{api,forbidden-strings,markdown-lint,repository}`):
  delete after their consumers have moved.
- Performance:
  keep `perf/*.json`,
   delete the harness,
   its tasks and `cli-git-performance.yml` now.
- Package `build`:
  becomes the release build of `cli-git-native`.
- Crate name:
  `monochromatic-git-policy-cli` (rationale and cost under `Name`).
- Location of the `git` link:
  a gitignored per-worktree directory `.cache/cli-git-bin`,
   first in `PATH` (rationale under `Install the published tool`).

## Evidence basis

Read-only probes run for this document,
 all on 2026-10-12:

- `command -v git`,
   `type -a git`,
   `git --version`,
   `git cli-git --help`,
   `git cli-git status`,
  `mise env --json` (PATH only),
   `mise exec -- command -v git` and `mise exec -- git --version` in this worktree.
- `ls`,
   `sha256sum` and `rg` over the main checkout's `package/git-policy/cli/dist`,
   `node_modules` and `.git`.
- `find` over `.git` for transaction directories and locks,
   and `pgrep` for running wrapper processes.
- `gh api` GET calls for branch protection and rulesets of `Aquaticat/Monochromatic`.
- A scratch repository under `${HOME}/temp/agent` driven through a private PATH entry that linked the integration
  worktree's debug `cli-git-native` as `git`;
   it was deleted afterwards and nothing production was shadowed.
  It produced the exact refusal texts quoted under `Coordination hazards and detection`.
- Reads of the handover,
   planning and decision documents named in the citations.

Read-only or throwaway probes run on 2026-10-13,
 after the user's answers:

- `GET https://crates.io/api/v1/crates/<name>` for the candidate names and for the dependency crates.
- Downloads of `forbidden-strings` 0.4.1,
   `forbidden-regex` 0.1.1 and `monochromatic-jsonc-edit` 0.1.1 from crates.io
  into a scratch directory,
   compared with the local sources.
- `cargo package`,
   `cargo package --list`,
   `cargo publish --dry-run` and `cargo check` in the package and in
  throwaway copies under `${HOME}/temp/agent`,
   with `CARGO_TARGET_DIR` outside the repository.
  No upload happened.
- `cargo build --release --locked --offline --bin cli-git-native` into a scratch target directory.
- `mise` 2026.10.0 in a throwaway `MISE_DATA_DIR`,
   state directory and project,
   with a real install of
  `monochromatic-lint` 0.1.1 standing in for the crate (no published crate of this package exists yet).
  `mise env --json`,
   `mise install`,
   `mise exec`,
   `mise reshim`.
- `git diff` between the gated commit and the current head for `package/git-policy/cli`.

## How the wrapper is installed and run today

### The installed incumbent

The `git` that a session in this repository resolves is a pnpm shim,
 not a wrapper binary:

- `command -v git` prints `/var/home/user/Monochromatic/node_modules/.bin/git`;
  `type -a git` then lists `/usr/bin/git` and `/bin/git`.
   `git --version` prints `git version 2.55.0`.
- That shim is a 2,314-byte POSIX script (dated Sep 22) whose last lines `exec node` on
  `node_modules/@monochromatic-dev/git-policy-cli/dist/final/node/index.mjs`.
  `node_modules/@monochromatic-dev/git-policy-cli` is a symlink to `../../package/git-policy/cli`.
- So the program every session runs is `package/git-policy/cli/dist/final/node/index.mjs` of the main checkout:
  1,439,660 bytes,
   built Oct 10 14:48,
   SHA-256 `d7c26d53eb463d8f3d0137905931d59bac5164915e81301a7e8206fb83dc0b47`.
  `dist/` is ignored (`.gitignore:53`),
   so the artifact is not in any commit.
- The bundle is not standalone.
   `dist/final/node/index.mjs:18` to `:21` import `valibot`,
   `yuku-parser`,
  `yuku-ast` and `ignore` as bare specifiers.
  They resolve through the symlinks in `package/git-policy/cli/node_modules/` (into `node_modules/.pnpm`).
  The incumbent therefore runs only while the cli package's own `node_modules` links exist.
- The shim exists because the root manifest depends on the package (`package.json:36`
  `"@monochromatic-dev/git-policy-cli": "workspace:*"`) and the package declares `bin.git`
  (`package/git-policy/cli/package.json:17`).
   `pnpm install` links that bin into `node_modules/.bin/git`;
  the shim is an install-state file,
   not a tracked file.

### `git cli-git trust` and the trust registry

- The incumbent's management commands are `trust`,
   `untrust`,
   `status`,
   `check`,
   `fix` (`git cli-git --help`).
  `git cli-git status` in this worktree prints a JSON `trust-status` event with `"trusted":true` for the worktree's
  `cli-git.config.ts`.
- Trust is consent to run the executable configuration `cli-git.config.ts`.
  Records live outside the repository in `~/.local/state/cli-git/trust/v1` (the directory exists;
  its contents were not read).
- A changed config needs `git cli-git trust --yes` before the incumbent runs it again.
  The linter cutover did exactly that after the user approved it (`doc/handover/unified-linter-cutover.md`,
  section `Landing choreography`,
   step 3).
- The native executable retires these commands:
   `git cli-git trust` and `git cli-git status` print
  "`git cli-git trust is retired. cli-git now reads cli-git.config.jsonc as data ...`" and exit 0,
   change nothing,
  and leave the old records in place and unread (observed with the integration worktree's debug build;
  decision in `doc/handover/cli-git-rust-implementation.md`,
   `User decisions 2026-10-05`).
  This difference is the cheapest way to tell which wrapper a `git` is:
   the incumbent prints JSON for `status`.

### Tasks that build or install the incumbent

- `mise run //package/git-policy/cli:build` (template `build` in `mise.no-env.toml:536-538`,
   fan-out to `build:js`,
  then `build:js:node`,
   which runs `rolldown --configLoader native --config rolldown.node.config.ts`) produces
  `dist/`.
   The root `mise run build` fans out to every package's `build` (`mise.no-env.toml:690-693`,
  `vars.fanout_packages`),
   and `prepareAndBuild` is `prepare` then `build` (`mise.no-env.toml:1086`).
- `pnpm install` (root task `prepare:pnpm:install`) creates the `node_modules/.bin/git` shim.
- `mise run //package/git-policy/cli:pack:npm` (`package/git-policy/cli/mise.toml:141`) builds the unpublished tarball
  `dist/pack/monochromatic-dev-git-policy-cli-0.0.1.tgz`;
  the e2e image,
   the perf tasks and the packed-trust test depend on it.
- The previous wrapper replacement was manual:
   build `dist` in a branch worktree,
  then copy it over the live one by rename (`doc/handover/unified-linter-cutover.md`,
   `Landing choreography`,
   step 3).

### PATH mechanics on this host

- The root `mise.toml` is generated from `mise.no-env.toml` by file-enforcer (`mise.toml:1-5`);
  the `[env]` block with `_.path` is written by `generateMiseToml` in `file-enforcer.config.ts:656-720`.
  `_.path` lists `node_modules/.bin` first (`file-enforcer.config.ts:680`) and then every
  `package/*/*/node_modules/.bin` found on disk,
   all relative to the config root.
- `mise env --json` run in this worktree gives a PATH whose first mise entries are this worktree's
  `node_modules/.bin`,
   then the other package bin directories,
   then the mise tool directories,
  so `_.path` entries precede tool directories and `/usr/bin`.
Probed on 2026-10-13 in a throwaway project (mise 2026.10.0):
   `{{env.HOME}}` and `~` in `_.path` both expand to the home
directory,
   a relative entry resolves against the config root,
   and `_.path` entries precede tool `bin` directories.
- This session's PATH instead names the main checkout's `node_modules/.bin` first,
  because the session was started from the main checkout.
   PATH is fixed when a process starts;
  changing `mise.toml` does not change running sessions.
- A worktree has its own `node_modules/.bin/git` shim pointing at its own `package/git-policy/cli/dist`.
  In this worktree no `dist` exists,
   so `mise exec -- git --version` fails with
  `Cannot find module '.../cli-git-lane-cutover-scout/package/git-policy/cli/dist/final/node/index.mjs'`.
  The same failure is recorded for `gh` in `doc/troubleshooting/gh-implicit-repository-git-wrapper.md`.
  Sessions in worktrees only work because they inherit the main checkout's PATH.
- Real Git is `/usr/bin/git` 2.55.0.
   The incumbent's debug output in this session shows it resolving `/usr/bin/git`
  through common-platform-path priority.

### The native executable and how it is built

- The crate is `package/git-policy/cli/Cargo.toml` (`name = "git-policy-cli"`,
   `publish = false` at `:10`).
  Its binary is `cli-git-native` (`[[bin]]` at `:19`,
   path `src/native/main.rs`),
   deliberately not named `git`;
  the manifest comment at `:17-18` says installation wiring gives it the `git` name at cutover.
  `Cargo.toml` is managed by file-enforcer (`generateCargoManifests`,
   `file-enforcer.config.ts:1777`),
  so comment edits are followed by `mise run sync:files`.
- Host build:
   `mise run //package/git-policy/cli:native:build` runs
  `cargo build --locked --offline --bin cli-git-native`,
   a debug build for differentials
  (`package/git-policy/cli/mise.toml:36-38`).
   The integration worktree's debug binary is 93,671,240 bytes.
  No task builds or installs a host release binary.
  The host Rust toolchain is `rust = nightly` (`mise.no-env.toml:101`).
  The user's `~/.cargo/config.toml` sets `build-dir` (`doc/decision/cargo-build-dir-host-cache.md`),
  so intermediates are outside the package's `target/`.
- Container build:
   `mise run //package/git-policy/cli:test:e2e:concurrent:native:image`
  (`package/git-policy/cli/mise.toml:413`,
   `bin/e2e-native-container.mjs`) compiles
  `cargo build --offline --locked --release --bin cli-git-native` in `rust:1.97-bookworm` from a mount-free snapshot
  of `Cargo.toml`,
   `Cargo.lock`,
   `README.md`,
   `src/native` and the path dependencies,
  then adds it to the image `localhost/cli-git-concurrent-e2e-native:<tag>` as `/opt/native/cli-git-native` with
  `/opt/native/bin/git` linked to it.
   That image starts from `localhost/cli-git-concurrent-e2e:latest`,
  whose build packs the incumbent (`package/git-policy/cli/e2e/concurrent-commits.Containerfile:56-59`).
  Image `localhost/cli-git-concurrent-e2e:latest` has id `b7cf6d8c1786`;
  `localhost/cli-git-concurrent-e2e-native:integration` has id `d04ea26e5350`.
- The container gate (`native:test:container`) and the end-to-end suite passed on `0ff1379f7d`
  (`doc/handover/cli-git-native-integration.md`,
   `Results`).
  `git diff 0ff1379f7d e1890fb471 -- package/git-policy/cli` is empty,
   so current `main` has the gated crate.
- There is no release artifact yet:
   the crate is unpublished and no workflow builds it.
  A `git`-named symlink to the executable is the form the binary tests use (`src/native/binary_support.rs:74-75`),
  so a symlinked install is a tested shape.
- Runtime prerequisites the native wrapper finds itself:
   real Git on PATH after the wrapper (floor 2.55.0,
  `src/native/git_version.rs:26`),
   `monochromatic-lint` on PATH (a mise shim at
  `~/.local/share/mise/shims/monochromatic-lint`;
  pinned `"cargo:monochromatic-lint" = "0.1.1"` at `mise.no-env.toml:120`),
  `cli-git.config.jsonc` at the repository top level,
   and `.cache/forbidden-strings.rules.txt` in each worktree
  (`cli-git.config.jsonc` names it through `rulesFile`).
   The scanner is linked in-process and needs no lookup.

### What installing replaces

Replaced:
 the `git` that sessions resolve (today the shim to `dist/final/node/index.mjs`),
 the `trust` workflow,
the executable configuration `cli-git.config.ts`,
 and every Node process the incumbent starts per Git command.
Not replaced:
 `/usr/bin/git`,
 the user's trust records (left inert),
 the `monochromatic-lint` shim,
the scanner source,
 and `.git/cli-git*` state,
 which both wrappers read
(`doc/handover/cli-git-rust-implementation.md`,
 `Adopted without a question`,
 first item).

## Consumer inventory

Every reference found with `rg --hidden` over the checkout (which honors `.gitignore`),
 excluding `.git`,
`node_modules`,
 `target` and `pnpm-lock.yaml`,
 then classified.
Searched patterns:
 `git-policy-cli`,
 `git-policy/cli`,
 `cli-git.config.ts`,
 `cli-git/ts`,
 `hk-git-config`,
`hk-config-cleanup`,
 `CLI_GIT_`,
 `git cli-git`,
 `git-executable`,
 `dist/final/node/index.mjs`.
Hidden directories searched:
 `.github`,
 `.changeset`,
 `.idea`,
 `.agents`,
 `.pi`,
 `.serena`,
 `.opencodereview`,
`.out-of-scope`,
 `.claude-plugin`.
 No hits in `.idea`,
 `.agents`,
 `.pi`,
 `.serena`,
 `.opencodereview`,
`.out-of-scope`,
 `.claude-plugin`,
 `tsconfig.json`,
 `oxlint.config.ts`,
 `socket.json`,
 `.pnpmfile.mjs`,
`.pnpmfile.policies.json`,
 `forbidden-strings.append.txt`,
 `pnpm-workspace.yaml` (its `packages` glob is
`package/*/*`,
 `pnpm-workspace.yaml:420-421`,
 so no workspace entry names the package).
The main checkout's `.claude/settings.json` has no hit;
 `*.local.*` files were not read.

### Root configuration and tasks

- `package.json:36`,
   the root devDependency on `@monochromatic-dev/git-policy-cli`:
   delete the line.
  This is the line that makes `pnpm install` create `node_modules/.bin/git`.
  Land it only in the final retirement commit (see `Order of the retirement commits`),
  because a later `pnpm install` in the main checkout removes the incumbent's shim.
- `mise.no-env.toml:678-684`,
   task `cleanup:hk-git-config`,
   runs
  `node package/git-policy/cli/src/maintenance/hk-config-cleanup-command.ts`:
   delete it (the hk cleanup is retired;
   see `Decisions`).
  `mise.toml:679-685` is the generated copy;
   edit only `mise.no-env.toml`,
   then `mise run sync:files`.
- `mise.no-env.toml:1208-1212`,
   task `changeset:version`,
   runs
  `mise run //package/git-policy/repository:bump:dependents`:
   migrate to
  `git cli-git fix --all --policy mono/dependent-version-bump` (release and CI jobs build the crate from the checkout;
   see `Decisions`;
  `doc/handover/cli-git-native-dependent-version.md`,
   section `Wiring into the native executable`,
  item "The release task").
   The task's optional base-revision argument has no equivalent;
   the base is `HEAD`.
- `cli-git.config.ts` (root):
   delete after the native wrapper is installed and verified.
  It imports `@monochromatic-dev/git-policy-cli/ts` (`cli-git.config.ts:11-12`),
   the package's `./ts` export,
  which is `src/authoring.ts` and disappears with `src/`.
  `cli-git.config.jsonc` is its translation (all four optional policies and `rulesFile`).
  While both exist,
   native `git cli-git check` prints a `legacy-config-ignored` configuration warning
  (`doc/handover/cli-git-native-config.md`,
   `Facts the integrator must know`);
   deleting the TypeScript file ends it.
- `cli-git.config.jsonc:2`,
   the comment "Translated from `cli-git.config.ts`":
  reword to state the file is the configuration,
   so the comment does not name a deleted file.
- `.changeset/config.json:21` lists `@monochromatic-dev/git-policy-cli` under `ignore`:
  keep while the package name is kept.
   If the name goes,
   delete the line;
  `@changesets/config` 4.0.1 filters `ignore` through `globMatch`
  (`node_modules/.pnpm/@changesets+config@4.0.1/node_modules/@changesets/config/dist/index.mjs:708-719,776`) and does
  not reject unmatched names.
- `pnpm-lock.yaml` importers:
   root `.` (`:460-462`) and `package/git-policy/cli` (`:2044` onward) change with the
  manifests.
   Regenerate through the package manager,
   inspect the diff,
   never hand-edit (`LFW`).
- `package/config/pnpr/config.yaml:78` lists `@monochromatic-dev/git-policy-cli`;
  the file is generated by `generatePnprConfig` (`file-enforcer.config.ts:2062`) from manifests that have an entry
  point,
   version and no exclusion.
   Removing `main`,
   `types`,
   `exports` and `bin` from the cli manifest drops the entry
  on the next `mise run sync:files`.
   `PNPR_EXCLUDED_PACKAGES` (`file-enforcer.config.ts:1884`) names no git-policy
  package,
   so no exclusion edit is needed.
- `slopo.ignore.txt:45,50,69,200,309,324,373` carry duplicate-code dismissals whose subjects are deleted TypeScript or
  `perf/` files;
   `:298` names `src/native/policy_registry.rs` and stays.
  The file's own header (`slopo.ignore.txt:40`) already counts "10 dead pending a decision",
  so dead dismissals exist in it today and removal is cleanup,
   not a blocker.
- `README.md:65` ("behind a side-effect-free policy authoring API") and `README.md:262` ("policy authoring API,
  forbidden-strings policy"):
   reword;
   the authoring API is retired.
- `AGENTS.md:1366` and `CLAUDE.md:1415` say "Never preemptively bypass `git-policy-cli` guards":
  the name is still the crate and package name,
   so keep.
   `CLAUDE.md` is generated from `AGENTS.md`.
- `monochromatic-lint.config.jsonc:58-66` scopes the native Rust path (`package/git-policy/cli/src/native/**/*.rs`):
  keep.
   Its comment cites a manual task `native:lint:rust` that no longer exists in
  `package/git-policy/cli/mise.toml`;
   that staleness predates the cutover.

### File-enforcer

- `file-enforcer.config.ts:2276-2341`:
   three `Promise.all` blocks (`mirrorRepositoryPolicy`,
  `mirrorForbiddenStringsPolicy`,
   `mirrorMarkdownLintPolicy`) copy
  `package/git-policy/{repository,forbidden-strings,markdown-lint}/src` into `package/git-policy/cli/src/optional/`.
  Delete all three in the same commit that deletes `src/optional/`;
  otherwise `mise run sync:files` regenerates the deleted files.
- `package/dev-script/file-enforcer/src/generated-policy-contracts.unit.test.ts` (76 lines,
  only these mirror fixtures at `:49-55`):
   delete with the mirrors.
- `file-enforcer.config.ts:680`:
   the static first `_.path` entry.
  `.cache/cli-git-bin` is added here as the first entry (see `Install the published tool`),
   never by hand in `mise.toml`.
- `generateCargoManifests` (`:1777`) and `generatePackageLicenseTexts` (`:534`) keep working:
   the crate stays,
  its `LICENSES/` follow `Cargo.toml`'s license expression.

### Continuous integration

- `.github/workflows/cli-git-trust.yml`:
   delete.
  It builds the TypeScript package at the Node floor,
   runs `verify:supported-runtime`,
  and exercises trust on three operating systems (ubuntu,
   macos and windows in the job matrix at `:194-197`;
  also `:178`,
   `:187`,
   `:222-232`);
   every job tests the retired trust subsystem.
  Its `paths` filter `package/git-policy/**` (`:7,17`) also means no native change ever triggered a native job:
  there is none.
- `.github/workflows/cli-git-performance.yml`:
   delete (the performance harness and workflow go now;
   `perf/*.json` stays;
   see `Decisions`).
  It triggers on version changes of `package/git-policy/cli/package.json` (`:5-11`) and runs
  `mise run //package/git-policy/cli:perf:lifecycle-latency`,
   which depends on `pack:npm`.
- `.github/workflows/final-newline.yml:35-39`:
   migrate.
  It installs the incumbent's dependency closure and runs
  `node package/git-policy/cli/src/trust/fixture/final-newline-workflow.ts`,
  which clones the checkout and runs the incumbent's direct check.
  It needs the native executable in CI (built from the checkout,
   Linux only;
   see `Decisions`) and a native replacement of that script.
- `.github/workflows/npm-release.yml:127` runs `mise run changeset:version` in a job that installs only node and pnpm
  (`:100-118`):
   after `changeset:version` calls `git cli-git fix`,
   the job needs the native executable,
   built from the checkout (see `Decisions`).
- No workflow builds `cli-git-native`,
   runs its tests on macOS or Windows,
  or publishes it (`doc/handover/cli-git-rust-implementation.md`,
   `Adopted without a question`,
  item on hosted runners,
   is not implemented).
- The first native workflow covers Linux only (see `Decisions`).
  `.github/workflows/cargo-publish.yml` gains the job group for the new crate (`Publication steps in order`,
   step 4).
- Branch protection of `main`:
   `required_status_checks` has empty `contexts` and `checks`,
   required signatures are on,
  and the only ruleset is "Copilot review" (`gh api repos/Aquaticat/Monochromatic/branches/main/protection` and
  `.../rulesets`).
   Deleting workflows therefore strands no required check.

### Sibling packages

- `package/git/executable` (the shared real-Git resolver,
   `@monochromatic-dev/git-executable`):
  migrate before install.
   `package/git/executable/src/self-shim.ts:185-243` `isGitPolicySelfShim` returns "not a shim"
  for any ELF,
   PE or Mach-O header (`:212`),
   and the markers (`:139-171`) match only the incumbent's package name and
  `dist` path.
   So the resolver would select the native `git` as "real Git" for its other consumers:
  `resolveRealGit` is called by `package/pi-plugin/auto-mode/src/git-worktree-read-allowlist.ts:290` and by the hk cleanup command (retired with `src/`;
   see `Decisions`).
   On this host the common-path rule masks it (`package/git/executable/src/resolve-real-git.ts`
  promotes `/usr/bin/git` when PATH exposes it),
   but not on a host whose Git is elsewhere.
  Reading whole binaries is not an option (`doc/troubleshooting/starship-cli-git-command-timeout.md`).
  Change:
   also treat a candidate whose `realpath` basename is `cli-git-native` as the wrapper,
  which holds because the installed `git` is a symlink to the file `cli-git-native` (see `Install the published tool`).
  Keep the existing script markers,
   so a stale incumbent shim is still rejected.
  Tests to change:
   `package/git/executable/src/native-executable.unit.test.ts:29` (a marker inside an ELF must still
  not be scanned) and `package/git/executable/src/resolve-real-git.unit.test.ts:79,92,102,540`.
  `package/git/executable/README.md:9` documents the marker behavior.
  The native side already rejects the incumbent's markers (`src/native/real_git_candidate.rs:91-94`,
  test `src/native/binary_resolution_tests.rs:206`);
   keep them while stale shims can exist.
- `package/git-policy/api`,
   `package/git-policy/forbidden-strings`,
   `package/git-policy/markdown-lint`,
  `package/git-policy/repository` (the four authoring and policy packages):
   delete after the config,
  the release task and the cli mirrors are gone (see `Decisions`).
  Their only consumers are `cli-git.config.ts`,
   the cli mirrors,
   `package/git-policy/cli/bin/dependent-version-*.mjs`
  (through `@monochromatic-dev/git-policy-repository/ts`),
   `changeset:version`,
  and their own READMEs (`package/git-policy/repository/README.md:14-15`,
  `package/git-policy/markdown-lint/README.md:70-74`).
- `package/cli/forbidden-strings/README.md:118`,
   `:788-789`,
   `:799`,
   `:809`:
   migrate text.
  They say root `cli-git.config.ts` gives the policy the scanner path and that "the policy invokes the
  repository-built scanner directly";
   the native wrapper links the scanner in-process and reads `rulesFile` from
  `cli-git.config.jsonc`.
   `package/cli/forbidden-strings/PERF.md:159,199-212` cite incumbent `perf/` files and a
  packed tarball path:
   historical,
   keep.
- In the package `package/oxlint-plugin/prefer-readonly-parameter-type`,
  the comment at line 392 of `src/prefer-readonly-parameter-types/effect-member-result-relation.ts` cites
  `package/git-policy/cli/src/policy-engine/manual-push-candidates.ts` in a comment:
  replace the citation with the explanation it supports,
   since the file will not exist.
- `package/ssg/aquati.cat/TODO.generalize-ssg.draft.md:286` cites `package/git-policy/cli/package.json:8` as a model
  for a `bin` entry:
   cite another package that keeps a `bin`.
- `package/pi-plugin/auto-mode/README.md:371`:
   no edit,
   it names `git-executable` only.
- `package/git-policy/cli.fuzz`:
   keep.
   It depends on the crate by path (`Cargo.toml:23`) and copies `Cargo.toml`,
  `Cargo.lock`,
   `README.md` and `src/native` (`bin/planted-controls.mjs:21-24`);
  `src/controls.rs:30` holds TypeScript pseudocode in a comment only.

### Documentation

- Live and wrong after the cutover:
   `package/git-policy/cli/README.md` (1,190 lines;
   its rewrite is a precondition of the first publication,
   see `Verdicts`) and
  `package/git-policy/cli/SPEC.md` (4,305 lines).
  Neither mentions `cli-git.config.jsonc` (measured:
   zero matches),
   both describe plugins,
  executable configuration and trust.
   README sections to rewrite or delete:
   `Runtime` (`:6`,
   Node floor,
  PATH shadowing),
   `Policy authoring API` (`:130`),
   `Shipped optional policies` (`:210`),
   `Exact MJS trust` (`:573`),
  `Performance gates` (`:1075`),
   `How it works` (`:1166`),
   `Adding rules` (`:1185`).
  Keep the sections that describe behavior both wrappers share,
   after checking each against the native source.
  SPEC sections that exist for the retired surface,
   by heading and line:
   `Public authoring declarations` (`:77`),
  `Authoring example` (`:628`),
   `Trust registry schema version 1` (`:1638`),
   `Trust consent protocol` (`:1796`),
  `Recursive enrollment and revocation` (`:1823`),
   `Relaxed-mode parser` (`:1895`),
  `TypeScript build contract` (`:1931`),
   `Package and user-boundary verification` (`:4268`) and
  `Contract fixture verification` (`:4299`).
   `Configuration validation` (`:718`) needs the JSONC schema.
  The native behavior ledger cites SPEC line numbers (`doc/planning/cli-git-rust-behavior-ledger.md`),
  so edit the SPEC in one commit and re-cite the ledger in the next,
   or cite by heading.
  The README must keep existing:
   `Cargo.toml` `readme`,
   `bin/test-native-container.mjs:62`,
  and `package/git-policy/cli.fuzz/bin/planted-controls.mjs:23` read it.
- `package/git-policy/cli/e2e/README.md:42-44`:
   describes `E2E_WRAPPER` defaulting to `incumbent` and the
  ELF-versus-script check.
- `doc/runbook/remove-retired-hk-git-config.md`:
   delete it with the task (see `Decisions`).
`doc/troubleshooting/cli-git-hk-retirement-stale-hook-config.md` points at the runbook and the task:
rewrite that section to the manual removal (`git config --show-scope --get-regexp '^hook\.hk-'` to list,
`git config <scope> --unset-all <key>` to remove) and keep its root cause.
- `doc/philosophy/agents.md:362` cites `DEFAULT_ALLOWED_WORKTREE_DIRS` in
  `package/git-policy/cli/src/allowed-worktree-dirs.ts`:
   repoint to `default_allowed_worktree_dirs` in
  `package/git-policy/cli/src/native/effective_target.rs:118`.
- `doc/handover/cli-git-rust-implementation.md` queue items at `:1556-1558`,
  `:1593` and the sentence "Current production tools remain active until cutover" (`:1599`),
  and `doc/handover/cli-git-native-integration.md` `Remaining`:
   update when the cutover lands;
   replace,
   do not append.
- Historical records that cite incumbent paths and stay as written:
   44 files in `doc/handover`,
   45 in `doc/planning`,
  62 in `doc/troubleshooting`,
   17 in `doc/audit`,
   8 in `doc/decision`,
   2 in `doc/research`,
   1 in `doc/artifact`.
  Apply the repository's moved-identifier rule (`WR6`) only where a document is still read as current;
  put the retired incumbent's last commit hash (see `Order of the retirement commits`) at the top of
  `doc/planning/cli-git-rust-behavior-ledger.md` so its `src/...ts:NN` citations stay resolvable through Git history.
- `package/git-policy/cli/doc/concurrent-commits-implementation-plan.md` (1,388 lines,
  about 135 TypeScript path citations):
   historical implementation plan;
   keep.
- `doc/runbook/forbidden-strings-out-of-band-rules.md:152` (`git cli-git check`) and
  `doc/todo/forbidden-strings.md:18`:
   still correct,
   no edit.

## Retirement list

### Delete inside `package/git-policy/cli`

- `src/` except `src/native/`:
   478 tracked files (188 in `policy-engine/`,
   112 in `trust/`,
   56 at the top level,
  25 in `worktree-copy/`,
   22 in `parser/`,
   21 in `optional/`,
   17 in `index-lock/`,
   10 in `rule/`,
  9 in `shadow-repository/`,
   6 in `hook-dispatch/`,
   6 in `api/`,
   4 in `owner-lock/`,
   2 in `maintenance/`),
  of which 110 are `*.unit.test.ts`.
   `src/native/` keeps its own `index_lock_restart_manager.ps1` and
  `dependent_version_fixtures/unit_cases.json`.
- `rolldown.node.config.ts`.
- `perf/*.ts`,
   the harness that installs a packed tarball (deleted now;
   see `Decisions`);
   `perf/*.json` stays.
- `dist/` (ignored,
   on disk in the main checkout):
   remove after the verification passes,
   when the rollback window ends (see `Decisions`).
- `src/maintenance/` goes with `src/`;
   the hk cleanup is retired with it (see `Decisions`).
- Tasks in `package/git-policy/cli/mise.toml`:
   `run` (`:74`),
   `build`,
   `build:js`,
   `build:js:node`,
   `watch:build`,
  `watch:build:js`,
   `watch:build:js:node` (`:78-95`),
   `verify:supported-runtime` (`:137`),
   `pack:npm` (`:141`),
  `test:built:trust` (`:153`),
   `test:hk-config-cleanup` (`:186`),
   `perf:lifecycle-latency` (`:190`),
  `perf:concurrent-commits` (`:255`),
   `test:e2e:concurrent` (`:378`,
   the incumbent run) and
  `test:e2e:concurrent:native:surface` (`:428`,
   compares incumbent with native).
- Incumbent-bound verification bins (all need `src/index.ts`,
   `cli-git.config.ts`,
  the packed incumbent or the planner in `package/git-policy/repository`):
  `bin/differential-commit.mjs` (runs `src/index.ts`,
   line 388),
   `bin/differential-config-*.mjs` and
  `bin/differential-repository-config.mjs` (`bin/differential-config-fixture.mjs:116-120,248-268` copy
  `cli-git.config.ts`,
   run `src/index.ts`,
   and trust the config),
   the 21 `bin/dependent-version-*.mjs` files (import
  `@monochromatic-dev/git-policy-repository/ts`,
   `bin/dependent-version-incumbent.mjs:23`),
  `bin/interop-native-container.mjs` and `native-interop/*.mjs` (copy the main checkout's `dist` and `/opt/cli-git`
  into the image,
   `bin/interop-native-container.mjs:55-79,146,211-212`).
  The three differentials (commit,
   configuration,
   dependent-version) are deleted (see `Decisions`).
No surviving bin,
   e2e file or native test imports them (searched `bin`,
   `e2e`,
   `native-interop`,
   `mise.toml` and
`src/native`:
   only the three tasks `native:config:differential`,
   `native:differential:commit` and
`native:differential:dependent-version` run them).
The interop bin `bin/interop-native-container.mjs` and `native-interop/*.mjs` stay,
   but copy the main checkout's `dist`
and `/opt/cli-git` into the image (`bin/interop-native-container.mjs:55-79,146,211-212`),
   so they cannot run
unchanged until an incumbent-provisioning step from the pinned revision exists.

### Keep inside `package/git-policy/cli`

- The crate:
   `Cargo.toml`,
   `Cargo.lock`,
   `src/native/**` (including `dependent_version_fixtures/unit_cases.json`,
  which the native tests read and which stays as the recorded incumbent truth),
   `README.md`,
   `SPEC.md`,
   `LICENSES/`.
- The end-to-end runner `e2e/` (TypeScript run by Node inside the image) with `e2e/commit-shape-trace.json`.
  Edit `e2e/wrapper-selection-fixture.ts:16-26,60-80,167-219` and `e2e/wrapper-selection.unit.test.ts:26-57,68-87` so
  the only wrapper kind is native and an unset `E2E_WRAPPER` no longer selects the incumbent;
  delete `e2e/wrapper-surface-probe.ts` and `e2e/wrapper-surface-steps-fixture.ts` with the `surface` task;
  edit `e2e/concurrent-e2e-consumer.ts:12`.
   Eight unit-test files remain under `e2e/` and keep running under
  `test:unit`.
- The native bins:
   `bin/test-native-container.mjs`,
   `bin/mutate-native-container*.mjs`,
  `bin/native-planted-controls.mjs`,
   `bin/native-*-snapshot.mjs`,
   `bin/native-verification-process.mjs`,
  `bin/build-git-test-image.mjs`,
   `bin/e2e-native-container.mjs` (minus the `surface` subcommand and the base-image
  coupling).
- `perf/*.json` (the incumbent's measured baselines):
   the accepted performance bar is "faster than the incumbent per
  scenario" (`doc/handover/cli-git-rust-implementation.md`,
   `Adopted without a question`),
  and the baselines are the incumbent side of that comparison.
  The `perf/*.ts` harness runs a packed npm tarball (`perf/manual-push-latency-contracts.ts:114`,
  `perf/lifecycle-latency-contracts.ts:144`) and cannot run unchanged (deleted now;
   see `Decisions`).
- Tasks:
   every `native:*` task,
   `test:git-image`,
   `e2e:concurrent:trace`,
   `test:e2e:concurrent:native:image`,
  `test:e2e:concurrent:native`,
   `native:lock:scanner`,
   and the lint tasks named in
  `What the manifest and tasks must become`.
- The fuzz sidecar `package/git-policy/cli.fuzz` is untouched.

### What the manifest and tasks must become

- `package/git-policy/cli/package.json` stays,
   because `e2e/` and `bin/` still import workspace packages and the lint
  tasks need a manifest,
   but it stops being a published package:
   `private: true`;
  remove `main`,
   `types`,
   `exports`,
   `bin`,
   `files`,
   `engines`,
   `publishConfig`,
   `sideEffects`,
  and all runtime `dependencies` that only `src/` used (`ignore`,
   `rolldown`,
   `type-fest`,
   `typescript`,
   `yuku-ast`,
  `yuku-parser`);
   keep the name so `SGD` holds and the `.changeset/config.json` entry stays valid.
  Imports measured in the surviving `e2e/`,
   `perf/`,
   `bin/`,
   `native-interop/`:
   `@monochromatic-dev/module-test`,
  `@monochromatic-dev/module-caught-value`,
   `@monochromatic-dev/module-logger`,
   `nano-spawn` (only `perf/`),
  `valibot` (only `bin/differential-config-compare.mjs:11`),
   plus `@monochromatic-dev/config-typescript` for
  `tsconfig.json` and `@types/node`.
   Drop `nano-spawn` and `valibot` together with the files that use them.
  The `@monochromatic-dev/git-executable`,
   `...-git-policy-repository`,
   `...-config-rolldown`,
  `...-module-async-time`,
   `...-module-fs-id`,
   `...-module-fs-path` and `...-ownership-marker-foreign-borrowed`
  devDependencies go with `src/`.
   Removing `valibot`,
   `yuku-*` and `ignore` from this manifest also removes the
  incumbent's runtime closure (hazard 5).
- `tsconfig.json` (`package/git-policy/cli/tsconfig.json`):
   `include` loses `src/**/*.ts` and `*.config.ts`;
  `e2e/**/*.ts` (and `perf/**/*.ts` if kept) remain.
  `package.json` stays in `include` only if JSON modules are imported.
- `lint` is a template fan-out to direct child tasks (`mise.no-env.toml:611-613` template `lint`,
   `vars.fanout`);
  it throws when no child exists.
   Keep `lint:oxlint`,
   `lint:types` and `lint:oxlint:paths` (`:99-131`),
  and add `lint:clippy` running `cargo clippy --locked --offline --all-targets -- -D warnings`,
  matching the sibling Rust CLI `package/cli/forbidden-strings/mise.toml` (`lint:clippy`).
  Today `lint` does not run Clippy at all:
   the crate is checked only by `native:clippy` and the container gate.
  Adding `lint:clippy` makes the root `mise run lint` compile the crate;
   its duration was not measured.
- `test:unit` (`:134`) keeps globbing `**/*.unit.test.ts` inside the package;
  after retirement it runs the eight `e2e/` unit tests.
   The authority for Rust remains `native:test:container`;
  there is no `test` task for the crate.
- `build`:
   root `mise run build` runs every package's task named `build` and throws only when no package has one.
  `build` becomes the release build of `cli-git-native` by decision
  (`cargo build --release --locked --offline --bin cli-git-native`,
   as the sibling `package/cli/forbidden-strings`
  does),
   so `prepareAndBuild` keeps producing an artifact;
   every root `mise run build` then compiles the crate (about 71 seconds in one run on this host;
   see `Publishing the native crate` for why that is not a clean-machine figure).
   Do not leave the templates that run `rolldown` in place.
- `test:e2e:concurrent:image` (`:349`) loses `depends = ["pack:npm"]`,
  the `TARBALL` build argument and the context `dist/pack`;
  `e2e/concurrent-commits.Containerfile:13,56-59` loses `ARG TARBALL`,
   `COPY ${TARBALL}` and `npm install`.
  The image keeps Node at the floor,
   Git 2.39.5,
   2.40.0 and 2.55.0,
   `ssh-keygen` and the `caught-value` link.
  Its `engines.node` comment (`:17`) must name the Node version itself,
   since `engines` is gone.
  The tag `localhost/cli-git-concurrent-e2e:latest` and the task names with `:native` can stay (renaming them touches
  the rerun commands of every handover);
   do not rename in the cutover commits.

### Places where deleting the TypeScript breaks something not obviously covered

1.  Root `mise run build`,
     `watch:build` and `lint` fan out by task name;
    the cli package's templates run `rolldown` and a fan-out.
    Removing `src/` and `rolldown.node.config.ts` without removing or replacing the tasks makes `mise run build` fail
    in this package.
2.  `test:e2e:concurrent:image` and the native e2e image depend on `pack:npm`.
    The native image requires `localhost/cli-git-concurrent-e2e:latest` and refuses to build without it
    (`bin/e2e-native-container.mjs`,
     `buildImage`).
3.  `E2E_WRAPPER` unset means the incumbent (`e2e/wrapper-selection-fixture.ts:73-80`).
4.  File-enforcer regenerates `src/optional/**` unless its three mirror blocks go (`file-enforcer.config.ts:2276-2341`).
5.  `pnpm install` after the manifest edits prunes
    `package/git-policy/cli/node_modules/{valibot,yuku-parser,yuku-ast,ignore}`,
     which the installed `dist` needs:
    the incumbent stops working for every session still using the shim.
    The same `pnpm install` removes `node_modules/.bin/git` in that checkout once `package.json:36` is gone.
6.  `mise run //package/git-policy/cli:native:config:differential` needs `cli-git.config.ts` and the incumbent;
    `native:differential:commit` needs `src/index.ts`;
    `native:differential:dependent-version` needs `package/git-policy/repository`;
    `native:interop` needs the incumbent `dist` and the packed `/opt/cli-git`.
    All four are verification tools whose reference side is the incumbent
(see `Decisions`:
     the three differentials are deleted,
     `native:interop` stays and needs provisioning from the pinned
revision).
7.  The trailing gates in `doc/handover/cli-git-rust-implementation.md` (`Gates that trail the cutover`) include the
    old-and-new interop matrix,
     which needs a runnable incumbent after the retirement.
8.  `package/git/executable` treats native executables as real Git (see `Sibling packages`).
9.  `cli-git.config.ts` imports the `./ts` export that the retirement deletes,
    so after the deletion nothing can load it:
     the native wrapper never reads a `.ts` configuration,
    and the incumbent could not import the missing export.
     It must be deleted.
    Once it is gone,
     any session still on the incumbent runs only the core policies (hazard 6).
10. The hk cleanup command imports `@monochromatic-dev/git-executable/ts` and `@monochromatic-dev/module-logger/ts`
    (`src/maintenance/hk-config-cleanup-command.ts:14`,
     `hk-config-cleanup.ts:7`);
    its disposable-fixture test lives in `src/trust/fixture/hk-config-cleanup-consumer.ts` and is run by
    `test:hk-config-cleanup`.
     Both go with `src/`.
11. `final-newline.yml`,
     `npm-release.yml` (through `changeset:version`) and `cli-git-trust.yml` call deleted paths.
12. `package/git-policy/cli/Cargo.toml:9-10` ("the TypeScript executable remains active meanwhile") and `:17-18` ("at
    cutover") become false comments;
     reword and run `mise run sync:files`.

## Publishing the native crate

This section holds the 2026-10-13 investigation of what stops `cargo publish` for the native crate in
`package/git-policy/cli`,
 how the `cargo:` mise backend names the installed binary,
 and the exact steps.
Every command ran in a throwaway copy or with `CARGO_TARGET_DIR` under `${HOME}/temp/agent`;
nothing was published and `cargo publish` ran only as a dry run.
Real publication is the orchestrator's act,
 after the checks in `Publication steps in order`.

### Name

- The crates.io API (read-only `GET https://crates.io/api/v1/crates/<name>`) answered "does not exist" on 2026-10-13
  for `git-policy-cli`,
   `cli-git-native`,
   `cli-git`,
   `cli-git-wrapper`,
   `monochromatic-git-policy-cli`,
  `monochromatic-cli-git` and `monochromatic-git-policy`.
  Every candidate is free.
- Repository precedent is mixed.
  Published with the `monochromatic-` prefix:
   `monochromatic-jsonc-edit`,
   `monochromatic-lint`,
  `monochromatic-nested-wayland-session`.
  Published bare:
   `forbidden-strings`,
   `forbidden-regex`
  (`doc/research/unified-linter-naming.md`,
   section `Repository facts`).
  The three prefixed crates are the newer ones.
- Adopted,
   open to veto (see `Decisions`):
   rename the crate to `monochromatic-git-policy-cli`.
  A published name cannot be renamed,
   the bare name is generic,
   and the prefix matches the newest releases.
  The rename touches `Cargo.toml` (`name`),
   `Cargo.lock`,
   `package/git-policy/cli.fuzz/Cargo.toml:23` (the
  dependency key) and `package/git-policy/cli.fuzz/Cargo.lock`.
  No Rust source changes,
   because `[lib] name = "git_policy_cli"` keeps every `git_policy_cli::` path
  (`package/git-policy/cli.fuzz/src/*.rs`).
  The text of one message in `src/native/scanner_adapter.rs:67` names the crate and is reworded with it.
  The mise tool name becomes `cargo:monochromatic-git-policy-cli`.
- Keeping the bare name is the alternative:
   skip the rename in `Minimal changes` and substitute the name wherever this document names the crate.
- The binary stays `cli-git-native`.
  Renaming it before first publication would touch 21 files outside `doc/` (counted with `rg --files-with-matches`);
  the word "native" loses its contrast with the incumbent after retirement,
   but the installed `git` link hides it.

### What the packaging commands showed

Registry state on 2026-10-13:
 `forbidden-strings` 0.4.1 (published 2026-09-17),
 `forbidden-regex` 0.1.1,
`monochromatic-jsonc-edit` 0.1.1 (2026-10-06),
 `monochromatic-lint` 0.1.1.

1.  `cargo package --offline --locked --allow-dirty --no-verify` in the package exits 101:
    "failed to select a version for the requirement `forbidden-strings = "^0.4.1"` ... candidate versions found
    which didn't match:
     0.1.9".
    This is not a manifest defect.
    The local registry index cache knows only an old `forbidden-strings`.
    Without `--offline` the same command exits 0 with "Packaged 1168 files,
     19.7MiB (3.7MiB compressed)".
2.  `cargo publish --dry-run --locked --allow-dirty --no-verify` exits non-zero with
    "`git-policy-cli` cannot be published.
     `package.publish` must be set to `true` or a non-empty list in Cargo.toml".
    Blocks publication.
3.  The 1168 files are the whole package directory:
    `bin/`,
     `e2e/`,
     `perf/`,
     `doc/`,
     `SPEC.md` and the incumbent's TypeScript sit next to `src/native`.
    No `*.local.*` file and no credential-like file appeared in `cargo package --list`
    (searched for `local`,
     `.env`,
     `secret`,
     `token` and `credential` in the list).
    Blocks a sensible publication,
     not the command.
4.  Verification build (`cargo package --locked --allow-dirty`,
     which compiles the packaged crate against crates.io)
    fails with five `E0432` errors:
     `forbidden_strings::CandidateScan`,
     `ScanFinding`,
     `Scanner` and `CacheWarning`
    do not exist in the published 0.4.1.
    The commit that introduced them is `0696e56c4c` (2026-10-04),
     after the 0.4.1 release.
    The local `package/cli/forbidden-strings` still says `version = "0.4.1"`,
     so its source differs from the
    published crate of the same version.
    Blocks publication:
     `forbidden-strings` needs a new release first.
5.  Control that the rest resolves:
     in a throwaway copy with `monochromatic-jsonc-edit` and `forbidden-regex`
    taken from crates.io and the local `forbidden-strings` patched in,
     `cargo check --lib --bins` exits 0
    (1 minute 10 seconds).
    So the published `forbidden-regex` 0.1.1 and `monochromatic-jsonc-edit` 0.1.1 are sufficient.
    A comment-insensitive comparison of their `src` against the local sources found
    no code difference for `monochromatic-jsonc-edit`,
     and for `forbidden-regex` only local-binding renames
    (for example `Node::Repeat { node: body, .. }`) plus a test-only change in `src/gate_tests.rs`.
    Neither needs a republish.
6.  With `publish = false` removed,
     an `include` list added,
     the crate renamed and `jsonc-edit` raised to 0.1.1,
     in a
    throwaway copy,
     `cargo publish --dry-run --allow-dirty --no-verify` prints
    "Packaged 535 files,
     4.9MiB (1.1MiB compressed)" and "aborting upload due to dry run".
7.  `cargo build --release --locked --offline --bin cli-git-native` in a fresh target directory finished in about 71
    seconds on this host (one run,
     `CARGO_BUILD_JOBS=4`,
     behind the slot limiter,
     under unrelated load);
    the binary is 9,028,800 bytes.
    That bounds the cost of a source install through the `cargo:` backend on this host only:
     the user's `~/.cargo/config.toml` sets a shared `build-dir` (`doc/decision/cargo-build-dir-host-cache.md`),
     so a fresh `CARGO_TARGET_DIR` does not guarantee cold intermediates,
     and the figure is not a clean-machine install time.
    The build script's slowness is contained by `[profile.release.build-override] opt-level = 3`,
    which applies because the crate declares its own `[workspace]`.

### Verdicts

Blocks `cargo publish` or its verification build:

- `publish = false` (`Cargo.toml:10`) with its comment at `:9`.
- `forbidden-strings` 0.4.1 on crates.io lacks the scanner API the crate imports.

- First publication of any crate needs an owner API token,
   because Trusted Publishing cannot configure a crate that
  does not exist (`doc/runbook/publish-crate-first-time.md`,
   opening section).
  Whether the credential stored on this host still authorizes publishing was not established (the file was not read);
  the runbook records a 403 for it on 2026-09-25.

Does not block `cargo publish`,
 but must change first:

- The `monochromatic-jsonc-edit` requirement is `0.1.0` (`Cargo.toml:35`).
   It resolves,
   because 0.1.1 satisfies it,
   but `monochromatic-lint` raised its requirement to 0.1.1 for the fuzz-found fixes and the same reasoning applies.
- No `include`:
   the package carries the incumbent's TypeScript,
   scripts and 19.7 MiB of files.
- `README.md` describes the incumbent (trust,
   the policy authoring API).
  `readme = "README.md"` is enforced by file-enforcer,
   so the registry page and every release archive would show
  stale text,
   and a published version is immutable.
  The README rewrite therefore comes before the first publication,
   not in the retirement commits.
- No `[package.metadata.binstall]` table:
   without it `cargo-binstall` finds no archive and mise compiles from source
  (`doc/troubleshooting/mise-cargo-binstall-falls-back-to-compiling.md`).
  The tag layout is `<crate>-v<version>`;
   copy the table from `package/linter/monochromatic-lint/Cargo.toml` and
  keep only the Linux targets.
- No release jobs in `.github/workflows/cargo-publish.yml` for this crate (see `Publication steps in order`,
   step 4).

Does not block:

- The license (`LGPL-3.0-or-later`) and `LICENSES/LGPL-3.0-or-later.txt`,
   `LICENSES/GPL-3.0-or-later.txt`.
- The lockfile:
   `--locked` packaging succeeded with the committed `Cargo.lock`.
- `description`,
   `repository`,
   `homepage` and `readme` fields are present.
  `keywords` and `categories` are absent and optional.
- The path dependencies:
   cargo drops `path` from the packaged manifest and resolves from crates.io,
   so the
  `path` plus `version` form stays in the repository.
- `[[test]]` targets and the compile-time files:
   the `include` of `Minimal changes` keeps `src/native/**/*.rs`,
   the two non-Rust
  files and the lockfile.
  `src/native/config_repository_tests.rs:36` reads a path outside the crate,
   so the crate's own tests do not run from
  the unpacked archive;
   no consumer of the archive runs them.
- `rust-version` is undeclared;
   the gates build with Rust 1.97 (`bin/e2e-native-container.mjs` image
  `rust:1.97-bookworm`).
  Declaring `rust-version = "1.97"` is optional and records the tested toolchain,
   not a measured minimum.

### Minimal changes

In `package/cli/forbidden-strings`:
 raise `version` to `0.5.0` (a minor bump for 0.x API growth;
removals between 0.4.1 and now were not checked with a semver tool,
 which is why the minor bump is the safe default).

In `package/git-policy/cli/Cargo.toml` (managed by file-enforcer,
 so run `mise run sync:files` after editing):

- Set `name = "monochromatic-git-policy-cli"` and `version = "0.1.0"`.
- Delete `publish = false` (`Cargo.toml:10`) and its comment (`Cargo.toml:9`).
  The file-enforcer guard on `package.publish` is present-seeded
  (`file-enforcer.config.ts`,
   `CARGO_STATIC_ENFORCEMENTS`;
   `doc/planning/cargo-toml-file-enforcer.md`,
   `Owned scope`),
  so deleting the key stays deleted;
   setting it to `true` would be reverted.
- Add
  `include = ["src/native/**/*.rs", "src/native/dependent_version_fixtures/*.json", "src/native/index_lock_restart_manager.ps1", "Cargo.toml", "Cargo.lock", "README.md", "LICENSES/*.txt"]`.
  The list took the package from 1168 files (3.7 MiB compressed) to 535 files (1.1 MiB).
- Raise the `forbidden-strings` requirement to `version = "0.5.0"` and the `monochromatic-jsonc-edit` requirement to
  `version = "0.1.1"`,
   keeping the `path` keys.
- Add the `[package.metadata.binstall]` table (Linux targets only).
- Reword the comments at `:9-10` and `:17-18`,
   which describe the pre-cutover state.
- Regenerate the locks:
   `mise run //package/git-policy/cli:native:lock:members`,
   and the same for
  `package/git-policy/cli.fuzz` and any other lock that lists the changed crates;
   inspect each diff.

Rewrite `package/git-policy/cli/README.md` for the native wrapper before the first publication.

### Publication steps in order

1.  Release `forbidden-strings` 0.5.0.
    Raise the version,
     commit,
     push to `main`.
    The jobs `fs-*` of `.github/workflows/cargo-publish.yml` detect the bump,
     publish through Trusted Publishing
    (no token) and create the release.
    Check `curl -sS https://crates.io/api/v1/crates/forbidden-strings/0.5.0` and the GitHub release.
2.  Land the manifest,
     lock and README changes of `Minimal changes`,
     then run
    `mise run //package/git-policy/cli:native:test:container` through the slot limiter.
    The gate builds the path dependencies,
     so it does not prove the registry build;
     step 3 does.
3.  Run the verification build on the committed head,
     in a clean checkout,
     bounded:
    `cargo package --locked` in `package/git-policy/cli` (compiles the packaged crate against crates.io;
     expect about
    1 to 3 minutes),
     then `cargo publish --dry-run --locked` (expect "aborting upload due to dry run").
    The check that failed on 2026-10-13 must pass.
4.  Add the release jobs for the crate to `.github/workflows/cargo-publish.yml`,
     mirrored from the `ml-*` jobs
    (`ml-detect`,
     `ml-publish-crate`,
     `ml-build-binary`,
     `ml-create-release`):
     a `workflow_dispatch` choice,
     the
    `push` path `package/git-policy/cli/Cargo.toml`,
     a detect job reading the version,
     an idempotent publish step,
     a
    binary matrix restricted to `x86_64-unknown-linux-gnu` and `aarch64-unknown-linux-gnu` (the Windows and macOS code
    never compiled,
     and the repository's immutable releases mean one failing target produces no release),
     the archive
    layout `<crate>-<version>-<target>/cli-git-native`,
     and a release tagged `<crate>-v<version>`.
    Dry-run it with `gh workflow run cargo-publish.yml -f crate=<crate> -f dry-run=true` before the real run.
5.  First publication,
     owner action:
     follow `doc/runbook/publish-crate-first-time.md` with the new crate name,
     version
    `0.1.0`,
     the workflow job prefix of step 4 and the token name `<crate>-bootstrap`.
    The owner creates the token and runs `cargo login`;
     the orchestrator then runs `cargo publish` from the verified
    commit of step 3,
     and the owner saves the Trusted Publishing form at
    `https://crates.io/crates/<crate>/settings`.
6.  Dispatch the workflow with `dry-run=false` on a ref whose package directories equal the published commit.
    It authenticates,
     skips the existing upload,
     builds the archives and creates the release.
    Check `gh release view <crate>-v0.1.0` lists the archives.
7.  Continue with `Ordered steps` in `Installation sequence with rollback`:
     step 3 verifies the published artifact in
    isolation,
     step 4 adds the tool entry (`Install the published tool`) and runs `mise run lock:mise`.

### Install the published tool

How the `cargo:` backend names things (mise 2026.10.0,
 observed with the installed `monochromatic-lint` and a real
install into a throwaway `MISE_DATA_DIR`):

- The installed file is `<mise data>/installs/cargo-<crate>/<version>/bin/<bin name>`,
   so the executable is
  `cli-git-native`,
   not `git` and not the crate name.
  The `cargo:` backend has no option to rename it,
   and a `bin_path` option is ignored for this backend.
- Never make the crate's binary or a link in that `bin/` directory be named `git`.
  A probe with a `git` entry in an installed tool's `bin/` made `mise reshim` create `<mise data>/shims/git`;
  on this host that directory comes before `/usr/bin` in every shell,
   including outside the repository
  (positions 131 and 135 of this session's `PATH`).
- The wrapper behaves as the wrapper under any file name.
  It recognizes itself through `current_exe` (`src/native/real_git.rs:453`,
   `src/native/commit_command.rs:167`),
   and
  hook entries are symlinks to the canonical file,
   not to the `git` link (`src/native/hook_dispatch_entries.rs:80`).
  A relink of `git` mid-transaction is therefore harmless;
   removing the version directory it resolves to
  (`mise prune`,
   an uninstall,
   or reinstalling the same version) is not.

The `git` link comes from a tool-level `postinstall` that writes a symlink in a gitignored per-worktree directory,
and that directory is the first `_.path` entry.
Probed in a throwaway project with a real `cargo:monochromatic-lint` install (stand-in for the crate):

- `postinstall = { run = "...", when = "always" }` runs on `mise install` even when the tool is already installed
  (`when = "always"` creates the link in a new worktree where the tool was installed earlier).
  It does not run on `mise exec`,
   `mise env` or shell activation.
- The postinstall's `PATH` is not guaranteed to hold a working `node`:
   in a throwaway data directory without Node,
   a first attempt with an inline Node program failed with "node is not a valid shim".
   Use coreutils only.
- Atomic relink:
   create the link under a temporary name,
   then `mv --no-target-directory` it over `git`.
  Rerunning it repeatedly kept one valid link.
- `_.path`:
   `{{env.HOME}}/...` and `~/...` both expand to the home directory;
  a relative entry resolves against the config root;
   `_.path` entries precede tool `bin` directories in `PATH`.
  So a relative `.cache/cli-git-bin` first entry works in every worktree.

The tool entry for `mise.no-env.toml` (the pin needs a comment,
 as the repository requires for pins):

```toml
# mise.no-env.toml
# Pinned so a release of the wrapper reaches the repository only together with its configuration and policies.
# The postinstall links the executable as `git` in a gitignored per-worktree directory that `_.path` puts first.
# It never lives in the tool's own `bin/`, because mise would then create a global `git` shim.
# `os = ["linux"]` because only Linux archives are released and the code never compiled elsewhere.
"cargo:monochromatic-git-policy-cli" = { version = "0.1.0", os = ["linux"], postinstall = { run = "mkdir --parents \"$MISE_CONFIG_ROOT/.cache/cli-git-bin\" && ln --symbolic \"$MISE_TOOL_INSTALL_PATH/bin/cli-git-native\" \"$MISE_CONFIG_ROOT/.cache/cli-git-bin/.git.$$\" && mv --no-target-directory \"$MISE_CONFIG_ROOT/.cache/cli-git-bin/.git.$$\" \"$MISE_CONFIG_ROOT/.cache/cli-git-bin/git\"", when = "always" } }
```

The `_.path` change is in `generateMiseToml` in `file-enforcer.config.ts` (the array that starts with
`'node_modules/.bin'`):
 put `'.cache/cli-git-bin'` before it,
 then run `mise run sync:files`.
Never edit the generated `mise.toml` by hand.
Then `mise run lock:mise` records the version in `mise.lock`.

Why per worktree and not one user-level directory:
 the pin and the link live in the same checkout,
 so a worktree on an older pin keeps its own version,
 and one worktree's `mise install` never repoints the link of another.
The cost is that `.cache/cli-git-bin` of the main checkout serves every session started from the main checkout,
 in whatever worktree they later enter,
 because the session's `PATH` is fixed at its start.
`os = ["linux"]` was probed:
 on this Linux host `os = ["macos"]` made `mise install` install nothing ("all tools are installed"),
 and `os = ["linux"]` made `mise install --dry-run` report "would install".
No workflow installs the tool by default:
 every `jdx/mise-action` step in `.github/workflows` runs `mise install` with named tools,
 so the entry reaches a runner only when a step names it.

Each checkout needs `mise install` once after it merges the change,
 because the link directory is per worktree;
until then its `PATH` entry points at a missing directory and `git` resolves to `/usr/bin/git` without the wrapper.
That is the same failure mode the incumbent has when `node_modules/.bin/git` is missing.
Rollback is pinning the previous version,
 running `mise install` in each worktree (the postinstall relinks),
 and
`mise run lock:mise`.

The installed bytes are what the release workflow built with the runner's toolchain,
 not the bytes the container gate
tested.
User-boundary verification of the installed artifact is therefore the only proof for the installed file.

## Installation sequence with rollback

### Preconditions

1.  The crate is published,
     its release archives exist,
     and the published version passed the isolated verification
    (steps 2 and 3 of `Ordered steps`).
2.  The published head's `package/git-policy/cli` equals the gated one except for test files:
    `git diff 0ff1379f7d <head> -- package/git-policy/cli` lists only `*_tests.rs` files
    (three commits on 2026-10-12 and 2026-10-13 do),
     and the container gate passes on `<head>` with
    `GIT_POLICY_NATIVE_IMAGE_TAG=cutover` and every container command through
    `node "${HOME}/temp/agent/gate-slot.ts"`.
    The installed bytes come from the release workflow's toolchain,
     not from that gate,
     so the user-boundary
    verification is the only proof for the installed file.
3.  The incumbent identity is recorded:
    main's `HEAD`,
     the `dist/final/node/index.mjs` SHA-256,
     and the id of `localhost/cli-git-concurrent-e2e:latest`
    (values on 2026-10-12 are in `How the wrapper is installed and run today`).
    The incumbent is not a single file (hazard 5);
    the rollback artifact before verification is the shim plus its install state,
     and afterwards the pinned revision.
4.  The Git on the host is 2.55.0 or newer (it is 2.55.0;
     `src/native/git_version.rs:26`).
5.  Every worktree that will commit during or after the switch has merged `main`,
     run `mise run sync:files` and run
    `mise install` (hazards 3 and 4).
    Stale worktrees are not waited for (see `Decisions`).

### Coordination hazards and detection

Detect first,
 in this order,
 all read-only;
 repeat the in-flight check immediately before the switch.

1.  In-flight incumbent transactions and locks.
    One `find` per class,
     from the repository's common git directory (here `/var/home/user/Monochromatic/.git`):
    ```sh
    # run from the common git directory
    find . -maxdepth 4 -type d -regextype posix-extended \
      -regex '\./(worktrees/[^/]+/)?cli-git-transactions/[0-9a-f-]{36}'
    find . -maxdepth 4 -type d -regextype posix-extended \
      \( -name landing.lock -o -name reservation.lock -o -name capture.lock -o -name hook.lock \)
    find . -maxdepth 4 -name 'index.lock'
    ls cli-git/shadow cli-git-worktree-copy/v1
    ```
    A published transaction directory (a UUID,
     not `*.pending`),
     any `*.lock` directory,
    a `shadow/<id>` repository or an `index.lock` means a commit is running or was killed (layout:
    `package/git-policy/cli/SPEC.md:2085-2135`).
    Names ending in `.pending` are abandoned staging directories kept for diagnosis.
    State on 2026-10-12 from this host:
     one published transaction,
     a live `capture.lock` in
    `worktrees/cli-git-lane-rules-cache/cli-git-captures/` that was gone on the next probe,
    three `cli-git/shadow` entries,
     two stale `cli-git-transactions/*.pending` (Oct 3 and Oct 4),
    four stale `cli-git-worktree-copy/v1/settlement.lock.*.pending` (Oct 6),
    39 `cli-git-add-policy-*` directories (Jul to Oct),
     and no `cli-git-transaction` legacy directory.
    The probe is racy by nature:
     another session can start a commit right after it.
2.  Running wrapper processes:
     `pgrep --list-full --full '^node .*git-policy[-/]cli/dist/final/node/index\.mjs'` lists
    live incumbent Git commands.
     The character class matters:
     the main checkout's shim reaches the bundle through
    `node_modules/@monochromatic-dev/git-policy-cli/dist/...` (hyphen),
    while a package directory path has `git-policy/cli` (slash).
    The `^node` anchor keeps the shell that runs `pgrep` from matching itself.
    Positive control on 2026-10-12:
     a scratch `node` process started on a `git-policy-cli/dist/final/node/index.mjs`
    path was listed,
     and so was a live incumbent `commit` of this session through the main checkout shim.
    There is no native counterpart:
     for commands that do not wait on policy,
    the native wrapper replaces itself with `/usr/bin/git` by `exec`,
     so native processes look like plain Git.
    The published `cli-git-transactions` directories and `*.lock` files in the common git directory are the
    authoritative signal for in-flight native work.
3.  Stale and active worktrees.
     `git worktree list --porcelain` shows 89 worktrees (23 under
    `/var/mnt/encrypted/temp/agent/tr-fan`,
     18 under `/var/home/user/worktrees`,
     18 under `/var/home/user/temp/agent`,
    17 under `/var/home/user/Monochromatic/.claude/worktrees`,
     and others).
    A scratch script (not committed) over that list measured,
     at HEAD of each:
     72 have `cli-git.config.ts`,
    5 have `cli-git.config.jsonc`,
     7 have `.cache/forbidden-strings.rules.txt`.
    Active means a process whose `/proc/<pid>/cwd` is inside the worktree or a reflog or index modified recently;
    read those two signals,
     do not guess.
     Under native,
     in a worktree whose HEAD has only the TypeScript config,
    a config-loading command such as `git add` ends with exit 2 and an `engine-failure` event of code `config-invalid`
    (observed).
     Its message starts with "Legacy configuration",
     then the worktree's `cli-git.config.ts` path,
    then "is not executed or read by the native cli-git.
    Translate its settings into",
     then the worktree's `cli-git.config.jsonc` path
    (`src/native/config_file.rs:152-170,303-351`);
     read-only `git status` still works.
    In a worktree with the JSONC file but no `.cache/forbidden-strings.rules.txt`,
    `git add` ends with exit 2 and an `engine-failure` event of code `policy-incomplete` (observed).
    Its message starts "cli-git could not load the forbidden-strings rules,
     so no file was scanned:
     read rules",
    then the worktree's `.cache/forbidden-strings.rules.txt` path,
     then ":
    No such file or directory" (`doc/handover/cli-git-native-config.md`,
     `Rules file in a linked worktree`).
    Under the incumbent a missing `.cache` file did not stop commits in a worktree because its variable pointed at the
    main checkout's file;
     that is new fail-closed behavior.
    Remedy per worktree:
     merge `main`,
     then `mise run sync:files`,
     then `mise install` (the link directory of the native `git` is created
there).
4.  Sessions with the old PATH.
     PATH is inherited at start,
     so after the switch,
    sessions that started before the switch keep the TypeScript shim until restarted.
    Read,
     per process of the same user,
     only the PATH value from `/proc/<pid>/environ` (never print other variables;
    one environment contains tokens) and count those whose PATH names `node_modules/.bin` before the worktree's `.cache/cli-git-bin` directory.
    Both wrappers share `.git/cli-git*` state (adopted:
     locks and journals interoperate both ways),
    so a mixed fleet is the designed state,
     but only the incumbent-writes,
    native-reads direction has a recorded test (`doc/handover/cli-git-native-transactions.md:629-631`,
     trailing gate).
5.  The incumbent's runtime closure (see `The installed incumbent`) lives in install state:
    do not run `pnpm install` in the main checkout with the cli manifest reduced until the verification has passed and the hazard 4 count of sessions that still start the shim is zero.
6.  The incumbent without `cli-git.config.ts` runs only core policies:
    optional policies "remain disabled until trusted config registers them"
    (`package/git-policy/cli/README.md:210-212`),
     so rolling back after deleting the file silently drops
    `security/forbidden-strings`,
     `markdown/autofix`,
     `mono/forbidden-root-context` and `mono/dependent-version-bump`
    until the file is restored from Git history and trusted again.
    The same loss hits every session that still has the old PATH (hazard 4) the moment the file is deleted in the
    checkout it uses.
7.  The generated hook entries are symlinks from each transaction's `hooks/` directory to the wrapper executable
    (`doc/handover/cli-git-native-hooks.md`,
     `hook_dispatch_entries.rs`),
    so the installed file must keep a stable path for the length of any transaction.
The executable that hook entries target is the canonical file under the mise `installs` directory,
     because
`current_exe` (`src/native/real_git.rs:453`,
     `src/native/commit_command.rs:167`) resolves the `git` link.
Relinking `git` during a transaction is harmless;
     `mise prune`,
     an uninstall,
     or reinstalling the same version over
that file during a transaction is not.

### Ordered steps

All commits go through the installed wrapper with explicit pathspecs (`CLG`,
 `CPN`);
commit each step before the next (`GCE`).

1.  Land the migrations that do not need the native wrapper installed and do not affect the incumbent:
    the `package/git/executable` native recognition and its tests;
    the CI additions (a Linux job that builds the crate from the checkout and runs the final-newline and
    dependent-version checks);
    the docs that are true under both wrappers;
    the retirements the user ordered "now" that touch no wrapper behavior:
    the hk cleanup (`cleanup:hk-git-config` in `mise.no-env.toml`,
     `test:hk-config-cleanup`,
    `doc/runbook/remove-retired-hk-git-config.md`,
     and the rewrite of the section of
    `doc/troubleshooting/cli-git-hk-retirement-stale-hook-config.md` that names the task),
    and the performance harness (`perf/*.ts`,
     the `perf:*` tasks,
     `.github/workflows/cli-git-performance.yml`).
    `src/maintenance/` stays until `src/` goes.
    Keep `cli-git.config.ts`,
     the root dependency,
     the cli manifest and `src/` untouched.
2.  Publish the crate (`Publishing the native crate`,
     `Publication steps in order`,
     steps 1 to 6).
    The tool entry is not added to the repository until step 4 here.
3.  Verify the published artifact in isolation,
     with a throwaway data directory and project,
     before any repository
    file names the tool.
    `PROJECT` holds a `mise.toml` with the tool entry of `Install the published tool` (the real pin) and no other tool:

    ```sh
    # run by hand in a throwaway project; nothing production is touched
    V=$(mktemp --directory "${HOME}/temp/agent/cutover-isolated.XXXXXX")
    mkdir --parents "$V/proj" "$V/state" "$V/cfg"
    cp "$PROJECT" "$V/proj/mise.toml"
    cd -- "$V/proj"
    export MISE_DATA_DIR="$V/data" MISE_STATE_DIR="$V/state" MISE_CONFIG_DIR="$V/cfg" \
      MISE_GLOBAL_CONFIG_FILE="$V/cfg/none.toml" MISE_CACHE_DIR="$V/cache" MISE_YES=1 MISE_TRUSTED_CONFIG_PATHS="$V"
    mise trust "$V/proj/mise.toml"
    mise install
    ls -la "$V/proj/.cache/cli-git-bin"
    ```

    Expected:
     `mise install` takes the prebuilt archive (a few seconds;
     a compile that takes a minute or more means the release archives were not found,
     see `doc/troubleshooting/mise-cargo-binstall-falls-back-to-compiling.md`);
    `.cache/cli-git-bin/git` is a symlink to `$V/data/installs/cargo-monochromatic-git-policy-cli/<version>/bin/cli-git-native`.
    Then run items 1 and 2 of `User-boundary verification` with
    `BIN="$V/proj/.cache/cli-git-bin"` (skip its `ROOT` line) and `MAIN` set to the main checkout,
     and delete `$V`.
4.  Land the switch in one commit,
     made through the incumbent:
    the tool entry in `mise.no-env.toml`,
     the `.cache/cli-git-bin` first entry of `_.path` in
    `file-enforcer.config.ts`,
     the regenerated `mise.toml` and `mise.lock` (`mise run sync:files`,
     then
    `mise run lock:mise`).
    Check that `mise env --json` prints `<root>/.cache/cli-git-bin` before any `node_modules/.bin`.
5.  In the main checkout and in each active worktree:
     merge `main` (the main checkout pulls it),
     run `mise run sync:files`,
     run `mise install`,
     then check
    `command -v git` (identity item of `User-boundary verification`).
    Sessions started before this step keep the shim until restarted (hazard 4),
     and a session started from the main checkout takes its link from the main checkout,
     so `mise install` there is what switches such sessions;
    the shim and `dist` stay until step 8.
6.  Repeat the hazard 1 detection immediately before the first native commit.
    The switch is atomic per process start,
     so no quiet period is required by design
    (`doc/planning/cli-git-rust-open-decisions.md`,
     `Lock and journal interoperability across versions`,
     option A),
    but the reverse direction is not tested,
     so prefer a moment with no transaction directories.
7.  Run `User-boundary verification` through the real `PATH`.
8.  When it passes,
     the rollback window is over (see `Decisions`).
    Delete `cli-git.config.ts` and reword `cli-git.config.jsonc:2`,
     only when the hazard 4 count of sessions on the
    old `PATH` is zero (hazard 6 explains what those sessions lose otherwise).
    Commit through the native wrapper.
9.  Record the installation in `doc/handover/cli-git-rust-implementation.md` and
    `doc/handover/cli-git-native-integration.md` by replacing the superseded text;
    that commit is also the doc-only verification commit.
10. Start the retirement (`Order of the retirement commits`) at once;
    no waiting period follows the verification.

### User-boundary verification

Both checks use the installed `git` on the resolved PATH,
 not an explicit executable path.

1.  Identity.
     `command -v git` prints `<root>/.cache/cli-git-bin/git`,
     where `<root>` is the checkout whose `mise.toml` set the session's `PATH` (a session started from the main checkout uses the main checkout's link in every worktree it enters;
     `mise exec -- sh -c 'command -v git'` shows a worktree's own environment);
    `readlink --canonicalize "$(command -v git)"` ends in `cli-git-native`;
    `git --version` prints `git version 2.55.0`;
    `git cli-git status` prints the "is retired" sentence,
     where the incumbent prints a JSON `trust-status` line.
2.  A real commit in a throwaway repository (sequence run end to end against a native debug build on 2026-10-12,
    with these results).
     Everything runs in a subshell with a disposable `HOME` and no system Git configuration,
    so no user configuration is read;
     `/usr/bin/git` is used only for fixture setup,
    and the wrapper is found through `PATH`:

    ```sh
    # run by hand; MAIN is the main checkout; the wrapper policies require a linked worktree and explicit paths
    ROOT=$(git rev-parse --show-toplevel)
    BIN="${ROOT}/.cache/cli-git-bin"
    V=$(mktemp --directory "${HOME}/temp/agent/cutover-verify.XXXXXX")
    mkdir --parents "$V/home"
    (
      export HOME="$V/home" GIT_CONFIG_NOSYSTEM=1
      export PATH="$BIN:${MAIN}/node_modules/.bin:/usr/bin:/bin"
      command -v git
      /usr/bin/git init --initial-branch=main "$V/repo"
      /usr/bin/git -C "$V/repo" config user.name Verify
      /usr/bin/git -C "$V/repo" config user.email verify@example.invalid
      /usr/bin/git -C "$V/repo" config commit.gpgsign false
      /usr/bin/git -C "$V/repo" commit --allow-empty --message seed
      /usr/bin/git -C "$V/repo" worktree add -b work "$V/wt"
      cd -- "$V/wt"
      echo hello > a.txt
      git add -- a.txt
      git commit --message 'verify native wrapper' -- a.txt
      git log --oneline
      find "$V/repo/.git" -name 'cli-git-transactions*' -o -name '*.lock'
    )
    /usr/bin/git -C "$V/repo" worktree remove --force "$V/wt"
    rm --recursive --force "$V"
    ```

    Observed:
     `git add -- a.txt` exits 0,
     `git commit ... -- a.txt` exits 0 and `git log --oneline` shows the new
    commit,
     `git add .` is refused with `add-explicit/bulk-add-rejected`,
    and `git commit -a -m x` with `commit-only/all-flag` (both exit 1 with one JSONL finding on standard error;
    run them inside the subshell before the cleanup to see them).
    The final `find` must print nothing after the commit:
     no published transaction directory and no lock (this check
    was not part of the 2026-10-12 run).
     The throwaway disables signing on purpose,
    because a hermetic `HOME` has no signing key;
     signing is checked by item 3 instead.

3.  A doc-only commit in this repository,
     from a linked worktree that has merged `main` and has run `mise run sync:files` and `mise install` (so `cli-git.config.jsonc`,
     `.cache/forbidden-strings.rules.txt` and `monochromatic-lint` on
    PATH all exist):
     edit one Markdown file under `doc/`,
     `git add -- <that file>`,
    `git commit -m '<type>(<scope>): <subject>' -- <that file>`.
    Expect exit 0 and,
     if the Markdown autofix policy rewrites the file,
     the wrapper's `fix` outcome;
    then confirm `git status --short` is clean,
     `git log -1` shows the commit,
    and the common git directory has no new transaction directory or lock.
    Then check the signature:
     `git log -1 --format='%h %G? %GK'` must print `G` and the same key id as
    `git log -1 --format='%GK' main`,
     because the branch protection on `main` requires signatures and the native
    wrapper must leave signing to Git,
     which the throwaway check cannot show.
    A failure here with `config-invalid` or `policy-incomplete` is hazard 3,
     not a defect.
4.  Auto-push:
     with auto-push enabled (`APG`) the commit pushes the branch;
    a push failure is a result to read,
     not noise.

### Rollback

Before the verification passes (step 7 of `Ordered steps`),
 the incumbent is still installed and rollback is a
change of `PATH`:

1.  Make sure no native transaction is in flight (hazard 1 detection returns nothing),
    because the incumbent reading native-written records is not tested.
    Let running native commits finish,
    or run any native read-only Git command in the affected repository,
    which runs recovery for interrupted transactions before it forwards.
2.  Remove or rename `.cache/cli-git-bin/git` in each affected worktree.
    Every process whose `PATH` contains that directory then falls through to the next `git`.
    For a session started from the main checkout that is the main checkout's `node_modules/.bin/git`,
    the incumbent,
     immediately and without a restart.
    A shell activated inside a worktree falls through to that worktree's own shim,
    which already fails today for lack of a `dist` (see `PATH mechanics on this host`),
    so it loses nothing it had.
    Removing the main checkout's link rolls back every session started from the main checkout at once.
     Then revert the switch commit and run `mise run sync:files`,
     so new sessions stop adding the directory and the
    tool entry is gone.
3.  Verify with `git cli-git status` (JSON `trust-status`,
     `"trusted":true`) and one commit in a throwaway
    repository with the incumbent.

After the verification passes the window is over,
 by decision.
`cli-git.config.ts` is deleted,
 and the shim and `dist` go in the retirement commits.
Rollback then has two shapes:

- To an earlier native version:
  pin the previous published version in `mise.no-env.toml`,
   run `mise run lock:mise`,
   and run `mise install` in each
  worktree (the postinstall relinks `git` atomically).
  The first published version has no predecessor,
   so a fix after it is a new version through the same publication
  steps;
   the registry's yank operation was not examined.
- To the incumbent:
  create a worktree at the pinned incumbent revision,
   install its dependencies with the package manager,
  build `dist` with `mise run //package/git-policy/cli:build:js:node`,
  put that worktree's `node_modules/.bin` first on `PATH`,
  restore `cli-git.config.ts` from Git history,
   and run `git cli-git trust --yes` for it with the user's approval
  (precedent:
   `doc/handover/unified-linter-cutover.md`,
   `Landing choreography`).
  That path was not exercised here and its duration was not measured.

### Order of the retirement commits

Start right after the verification of step 7.
Each step is its own commit,
 made through the native wrapper:

1.  Record the pinned incumbent revision:
    the last commit that contains the TypeScript,
    in the commit body of step 2,
    in `doc/planning/cli-git-rust-behavior-ledger.md` and in the handover queue.
2.  Switch `changeset:version` to the native `fix` and prove it on the release workflow's input before deleting the
    planner;
    delete the three differentials (`bin/differential-*.mjs`,
     the 21 `bin/dependent-version-*.mjs` files and their
    tasks),
     because those bins import the planner and the TypeScript source;
    then delete `package/git-policy/repository` and the other three authoring packages
    with `file-enforcer.config.ts:2276-2341`,
    the file-enforcer test,
    and `src/optional/`.
3.  Delete `src/` (except `src/native/`),
    `rolldown.node.config.ts`,
    the tasks and bins listed under `Retirement list`,
    reduce `package.json` and `tsconfig.json`,
    edit `e2e/` and the Containerfile,
    delete `cli-git-trust.yml`,
    `src/maintenance/` (with `src/`),
    rewrite the `SPEC.md` sections of `Documentation`
    (the `README.md` was rewritten before the first publication).
4.  Remove `package.json:36` and regenerate `pnpm-lock.yaml`,
    `package/config/pnpr/config.yaml` and `mise.toml`
    (`pnpm install --lockfile-only` or `mise run prepare:pnpm:install`,
     then `mise run sync:files`),
    inspecting each diff.
    Only now does `pnpm install` remove `node_modules/.bin/git` and the incumbent's closure.
5.  Remove the main checkout's ignored leftovers (`package/git-policy/cli/dist`,
     `dist/pack`,
     `dist/perf`):
    list them first with `git clean --dry-run -d -X` (`GCL`,
     `GC2`) and check stray git-dir entries with `ls -d` and
    `git check-ignore --verbose` (`GCR`).
    Remove them by explicit path,
     never with `git clean -X`:
     its listing includes `.cache/cli-git-bin`,
     the link every session depends on,
     and `.cache/forbidden-strings.rules.txt`.
     The rollback-window decision covers deleting them;
    the hazard 4 count of sessions still on the shim must be zero first.
6.  After the trailing gates are recorded (interop matrix,
    long fuzz,
    non-core mutation,
    `pathBytes`,
    Windows,
    release performance) and verified complete,
    the queue item "retirement of the old TypeScript implementation is verified complete" in
    `doc/handover/cli-git-rust-implementation.md` can be closed.

## Not established

- Whether the API token stored on this host still authorizes publishing:
  the file was not read,
   and `doc/runbook/publish-crate-first-time.md` records a 403 for it on 2026-09-25.
- Everything that needs a published crate:
  the release jobs for the new crate in `.github/workflows/cargo-publish.yml` do not exist yet and never ran;
  the prebuilt archive path of `mise install` for this crate (the probes used `monochromatic-lint` 0.1.1 as a stand-in);
  and the glibc and Git versions of hosted runners against the 2.55.0 floor.
  The source-install fallback was measured only as a build:
   about 71 seconds,
   one run,
   9,028,800 bytes,
   on a host with a shared cargo `build-dir`.
- Whether file-enforcer keeps a deleted `publish = false` deleted:
  derived from the present-seeded guard in `file-enforcer.config.ts` and `doc/planning/cargo-toml-file-enforcer.md`,
   not
  from a run of `mise run sync:files`.
- Whether removals between `forbidden-strings` 0.4.1 and the local source exist.
  No semver tool ran,
   which is why the first release is a minor bump.
- Whether the worktree setup flow of this repository runs `mise install`.
  The link directory is created only by `mise install` (`postinstall` with `when = "always"`);
  `mise exec`,
   `mise env` and shell activation do not run it.
- Which of the 89 worktrees are active,
   and which sessions hold the old `PATH`:
  the commands are given,
   not run against processes.
- Whether `pnpm install` prunes the cli package's links the moment its manifest drops them:
  inferred from the symlink layout,
   not run.
- The reverse interoperability direction (incumbent reads records native wrote):
   untested by decision (trailing gate).
- Whether the native wrapper tolerates the four Oct 6 `settlement.lock.*.pending` directories in
  `.git/cli-git-worktree-copy/v1`;
  the transaction staging names are ignored by design (`package/git-policy/cli/SPEC.md:2085-2095`).
- The contents of `*.local.*` files,
   `~/.local/state/cli-git/trust/v1`,
   and whether any of them name the shim or `dist`.
- Windows and macOS behavior of anything native,
   which is why the release matrix of the new crate is Linux only.
- The duration of the Clippy addition to `lint`.
- Baseline results of `mise run //package/git-policy/cli:lint` and `lint:types` before and after the manifest
  reduction (not run:
   the package is large and the scout was read-only).
- The exact `package.json` field list after reduction is derived from import counts,
   not from a type check of the
  reduced package.
