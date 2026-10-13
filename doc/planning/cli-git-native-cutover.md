# cli-git native cutover runbook

## Purpose and how to respond

This document is the runbook for the remaining cutover of the Git policy wrapper:
 coordinated native installation,
consumer migration,
 documentation,
 and retirement of the TypeScript implementation.
The user's standing decision is that there is no hybrid and the old TypeScript goes
(`doc/handover/cli-git-rust-implementation.md`,
 queue item "Commit path,
 run as parallel lanes",
and the section `User decisions 2026-10-05`).

It was written by a read-only scout on 2026-10-12 against `main` at `e1890fb471`.
Nothing was installed,
 built into the real installation,
 or changed;
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

To respond,
 read `Open questions and unestablished facts`,
 answer each question,
 and name the option you pick.
The sections before it assume the recommended option of every question and say where a step depends on an answer.
A reader who only wants the order of work should read `Installation sequence with rollback` and
`Order of the retirement commits`.

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
- There is no release artifact:
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
   migrate or retire (question 6).
  `mise.toml:679-685` is the generated copy;
   edit only `mise.no-env.toml`,
   then `mise run sync:files`.
- `mise.no-env.toml:1208-1212`,
   task `changeset:version`,
   runs
  `mise run //package/git-policy/repository:bump:dependents`:
   migrate to
  `git cli-git fix --all --policy mono/dependent-version-bump` (question 4;
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
  The native install directory is added here (question 1),
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
   delete or rebuild around the native executable (question 7).
  It triggers on version changes of `package/git-policy/cli/package.json` (`:5-11`) and runs
  `mise run //package/git-policy/cli:perf:lifecycle-latency`,
   which depends on `pack:npm`.
- `.github/workflows/final-newline.yml:35-39`:
   migrate.
  It installs the incumbent's dependency closure and runs
  `node package/git-policy/cli/src/trust/fixture/final-newline-workflow.ts`,
  which clones the checkout and runs the incumbent's direct check.
  It needs the native executable in CI and a native replacement of that script (question 4).
- `.github/workflows/npm-release.yml:127` runs `mise run changeset:version` in a job that installs only node and pnpm
  (`:100-118`):
   after `changeset:version` calls `git cli-git fix`,
   the job needs the native executable (question 4).
- No workflow builds `cli-git-native`,
   runs its tests on macOS or Windows,
  or publishes it (`doc/handover/cli-git-rust-implementation.md`,
   `Adopted without a question`,
  item on hosted runners,
   is not implemented).
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
  `resolveRealGit` is called by `package/pi-plugin/auto-mode/src/git-worktree-read-allowlist.ts:290` and by the hk
  cleanup command.
   On this host the common-path rule masks it (`package/git/executable/src/resolve-real-git.ts`
  promotes `/usr/bin/git` when PATH exposes it),
   but not on a host whose Git is elsewhere.
  Reading whole binaries is not an option (`doc/troubleshooting/starship-cli-git-command-timeout.md`).
  Recommended:
   also treat a candidate whose `realpath` basename is `cli-git-native` as the wrapper,
  which holds when the install is a `git` symlink to the file `cli-git-native` (question 1).
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
  the release task and the cli mirrors are gone (question 5).
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
   `package/git-policy/cli/README.md` (1,190 lines) and
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
   rewrite or delete with the task (question 6).
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
   the harness that installs a packed tarball (question 7);
   `perf/*.json` stays.
- `dist/` (ignored,
   on disk in the main checkout):
   remove only when the rollback period ends (question 8).
- `src/maintenance/` goes with `src/`;
   the hk cleanup survives only if question 6 moves it first.
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
  Whether they are deleted or kept alive from a pinned incumbent revision is question 3;
   they cannot run unchanged.

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
  `perf/lifecycle-latency-contracts.ts:144`) and cannot run unchanged (question 7).
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
  Question 9 decides whether `build` becomes the release build of `cli-git-native`
  (`cargo build --release --locked --offline --bin cli-git-native`,
   as the sibling `package/cli/forbidden-strings`
  does) or the package has no `build` at all.
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
    All four are verification tools whose reference side is the incumbent (question 3).
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

## Installation sequence with rollback

### Preconditions

1.  Question 1 (install mechanism and location),
     question 3 (incumbent pin) and question 8 (rollback horizon) are
    answered.
2.  The binary to install is built from a head whose `package/git-policy/cli` equals the gated one
    (`git diff 0ff1379f7d <head> -- package/git-policy/cli` empty),
     through the existing container route,
    with `GIT_POLICY_NATIVE_IMAGE_TAG=cutover` and every container command through
    `node "${HOME}/temp/agent/gate-slot.ts"`.
3.  The incumbent identity is recorded:
     main's `HEAD`,
     the `dist/final/node/index.mjs` SHA-256,
    and the id of `localhost/cli-git-concurrent-e2e:latest` (values on 2026-10-12 are in
    `How the wrapper is installed and run today`).
     The incumbent is not a single file (hazard 5);
    the rollback artifact is the pinned revision plus its install state.
4.  The Git on the host is 2.55.0 or newer (it is 2.55.0;
     `src/native/git_version.rs:26`).
5.  Every worktree that will commit during or after the switch has merged `main` and has run `mise run sync:files`
    (hazards 3 and 4).
     Decide,
     with question 2,
     how stale worktrees are treated.

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
     then `mise run sync:files`.
4.  Sessions with the old PATH.
     PATH is inherited at start,
     so after the switch,
    sessions that started before the switch keep the TypeScript shim until restarted.
    Read,
     per process of the same user,
     only the PATH value from `/proc/<pid>/environ` (never print other variables;
    one environment contains tokens) and count those whose PATH names `node_modules/.bin` before the native directory.
    Both wrappers share `.git/cli-git*` state (adopted:
     locks and journals interoperate both ways),
    so a mixed fleet is the designed state,
     but only the incumbent-writes,
    native-reads direction has a recorded test (`doc/handover/cli-git-native-transactions.md:629-631`,
     trailing gate).
5.  The incumbent's runtime closure (see `The installed incumbent`) lives in install state:
    do not run `pnpm install` in the main checkout with the cli manifest reduced until the rollback horizon has
    passed.
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
    so the installed file must keep a stable path for the length of any transaction;
     never overwrite it in place.

### Ordered steps

All commits go through the installed wrapper with explicit pathspecs (`CLG`,
 `CPN`);
commit each step before the next (`GCE`).

1.  Land the migrations that do not need the native wrapper installed and do not affect the incumbent:
    the `package/git/executable` native recognition and its tests;
     the hk cleanup move if question 6 chooses it;
    the CI additions of question 4 (a job that builds the crate and runs the final-newline and dependent-version
    checks);
     the docs that are true under both wrappers.
    Keep `cli-git.config.ts`,
     the root dependency,
     the cli manifest and `src/` untouched.
2.  Build the artifact with `localhost/cli-git-concurrent-e2e:latest` present:
    ```sh
    GIT_POLICY_NATIVE_IMAGE_TAG=cutover node "${HOME}/temp/agent/gate-slot.ts" \
      mise run //package/git-policy/cli:test:e2e:concurrent:native:image
    ```
    Then run the end-to-end suite once on the same tag through the same limiter,
    under a memory-capped unit (`mise run //package/git-policy/cli:test:e2e:concurrent:native --git 2.55.0`;
    the unit form is in `doc/handover/cli-git-native-integration.md`,
     `Rerun commands`).
    Extract `/opt/native/cli-git-native` from the image (`podman create`,
     `podman cp`,
    `podman rm`) into a staging directory outside the repository.
     The scout did not run the extraction.
3.  Place it without shadowing yet (recommended layout under question 1):
    `${HOME}/.local/share/cli-git/native/<sha256-prefix>/cli-git-native` (mode 0755,
    never edited again) and the PATH directory `${HOME}/.local/share/cli-git/bin/` holding `git` as a symlink to that
    file.
     Nothing resolves it until PATH names the directory.
4.  Verify in isolation first,
     with an explicit PATH in a throwaway shell,
     before editing any repository file:
    the disposable-repository check in `User-boundary verification`,
     using
    `PATH="${HOME}/.local/share/cli-git/bin:${MAIN}/node_modules/.bin:/usr/bin:/bin"`,
    where `MAIN` is the main checkout.
     The install directory comes first so it shadows the shim,
    and the main checkout's `node_modules/.bin` stays so tools the later doc-only check needs (`monochromatic-lint`,
    `mise`-managed helpers) still resolve.
     Check with `command -v git` before running anything.
5.  Edit the PATH source:
     add the install directory as the first `_.path` entry in `file-enforcer.config.ts:680` (an
    absolute entry,
     ahead of `node_modules/.bin`),
     run `mise run sync:files`,
    and check `mise env --json` prints that directory before any `node_modules/.bin`.
    Whether mise expands `{{env.HOME}}` or `~` in `_.path` was not tested;
    probe it in a scratch config root before committing.
    Commit `mise.no-env.toml` (if touched),
     `file-enforcer.config.ts` and the regenerated `mise.toml` together.
6.  Roll the new PATH out:
     new sessions only.
     Existing sessions keep the shim (hazard 4);
     the shim and `dist` stay.
    For the switch moment,
     repeat hazard 1 detection;
    the switch itself is atomic per process start,
     so no quiet period is required by design
    (`doc/planning/cli-git-rust-open-decisions.md`,
     `Lock and journal interoperability across versions`,
     option A),
    but the reverse direction is not tested,
     so prefer a moment with no transaction directories.
7.  Run `User-boundary verification` through the real PATH.
8.  Delete `cli-git.config.ts` and reword `cli-git.config.jsonc:2` only after step 7 passes,
    only when the hazard 4 count of sessions on the old PATH is zero,
     and only if question 8 allows losing the
    incumbent's optional policies (hazard 6).
     Commit through the native wrapper.
9.  Record the installation in `doc/handover/cli-git-rust-implementation.md` and
    `doc/handover/cli-git-native-integration.md` by replacing the superseded text;
    that commit is also the doc-only verification commit.
10. Start the retirement (`Order of the retirement commits`) only after the rollback horizon of question 8.

### User-boundary verification

Both checks use the installed `git` on the resolved PATH,
 not an explicit executable path.

1.  Identity.
     `command -v git` prints the install directory's `git`;
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
    # verify-throwaway.sh (run by hand; the wrapper policies require a linked worktree and explicit paths)
    BIN="${HOME}/.local/share/cli-git/bin"
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
    was not part of the scout run).
     The throwaway disables signing on purpose,
    because a hermetic `HOME` has no signing key;
     signing is checked by the next item instead.

3.  A doc-only commit in this repository,
     from a linked worktree that has merged `main` and has run
    `mise run sync:files` (so `cli-git.config.jsonc`,
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

While the incumbent's `dist` and the cli package's `node_modules` links exist:

1.  Make sure no native transaction is in flight (hazard 1 detection returns nothing),
    because the incumbent reading native-written records is not tested.
    Let running native commits finish,
     or run any native read-only Git command in the affected repository,
    which runs recovery for interrupted transactions before it forwards.
2.  Remove or rename the symlink `${HOME}/.local/share/cli-git/bin/git`.
    Every process whose PATH contains that directory then falls through to the next `git`.
    For a session started from the main checkout that is the main checkout's `node_modules/.bin/git`,
     the incumbent,
    immediately and without a restart.
     A shell activated inside a worktree falls through to that worktree's own shim,
    which already fails today for lack of a `dist` (see `PATH mechanics on this host`),
     so it loses nothing it had.
    Then revert the `_.path` commit and run `mise run sync:files` so new sessions stop adding the directory.
3.  If `cli-git.config.ts` was deleted:
     restore it from Git history at the pinned revision,
    then run `git cli-git trust --yes` for it with the user's approval (precedent:
    `doc/handover/unified-linter-cutover.md`,
     `Landing choreography`).
4.  Verify with `git cli-git status` (JSON `trust-status`,
     `"trusted":true`) and one commit in a throwaway repository
    with the incumbent.

After the retirement commits have landed,
 the incumbent is not reachable from the working tree;
rollback is then to create a worktree at the pinned revision,
 install its dependencies with the package manager,
build `dist` with `mise run //package/git-policy/cli:build:js:node`,
 and put that worktree's `node_modules/.bin` first
on PATH.
 That path was not exercised here and its duration was not measured.

### Order of the retirement commits

Start only after the rollback horizon of question 8.
 Each step is its own commit,
 made through the native wrapper:

1.  Record the pinned incumbent revision:
     the last commit that contains the TypeScript,
     in the commit body of step 2,
    in `doc/planning/cli-git-rust-behavior-ledger.md` and in the handover queue.
2.  Switch `changeset:version` to the native `fix` and prove it on the release workflow's input before deleting the
    planner (question 4);
     then delete `package/git-policy/repository` and the other three authoring packages (question
    5) with `file-enforcer.config.ts:2276-2341`,
     the file-enforcer test,
     and `src/optional/`.
3.  Delete `src/` (except `src/native/`),
     `rolldown.node.config.ts`,
     the tasks and bins listed under
    `Retirement list`,
     reduce `package.json` and `tsconfig.json`,
     edit `e2e/` and the Containerfile,
    delete `cli-git-trust.yml` and `cli-git-performance.yml`,
     rewrite `README.md` and `SPEC.md`.
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
    `git check-ignore --verbose` (`GCR`);
     this is the user's decision with question 8.
6.  After the trailing gates are recorded (interop matrix,
     long fuzz,
     non-core mutation,
     `pathBytes`,
     Windows,
    release performance) and verified complete,
     the queue item "retirement of the old TypeScript implementation is
    verified complete" in `doc/handover/cli-git-rust-implementation.md` can be closed.

## Open questions and unestablished facts

### Questions for the user

Each question names the plain-language situation first.

#### Question 1: Where does the native `git` live and how does it get on PATH?

Today `git` is a shim that the package manager creates;
native needs an executable named `git` ahead of `/usr/bin/git` only inside this repository's shells,
and hooks the wrapper creates point at that executable's path.
 No install task exists.

- Option A,
   recommended:
   build through the existing container route,
   copy the binary to a versioned directory
  `${HOME}/.local/share/cli-git/native/<sha256-prefix>/cli-git-native`,
  expose it as a symlink named `git` in `${HOME}/.local/share/cli-git/bin/`,
  and add that directory as the first `_.path` entry via `file-enforcer.config.ts`.
  Pros:
   it is exactly the binary the end-to-end suite passed against (built on Debian 12's glibc,
  older than the host's,
   so it is expected to run here;
   step 4 proves it);
  it lives outside any worktree or `target/`,
   and shells activated inside a worktree get a working `git` where their
  own shim fails today;
   versioned files are never overwritten,
   so in-flight hooks stay valid;
  switching or rolling back is one symlink rename;
  the `cli-git-native` basename gives the TypeScript resolver a cheap identity test.
  Cons:
   needs a small new install task and a generator edit;
   `{{env.HOME}}` in `_.path` is untested;
  the build uses Rust 1.97 while the host uses nightly.
- Option B:
   a host `cargo build --release` plus the same layout.
   Pros:
   no container for installation.
  Cons:
   no host release task exists;
   the toolchain is nightly,
   which the gates never exercised;
  the scanner's build script is documented as slow (390.8 s unoptimized against 98.5 s at `opt-level = 3`;
  the `build-override` comment in `package/git-policy/cli/Cargo.toml`),
   so a host release build is long.
- Option C:
   publish the crate to crates.io and install it as a `cargo:` mise tool like `monochromatic-lint`.
  Pros:
   same mechanism as the linter,
   versioned and rollbackable by mise.
  Cons:
   needs the first-publication approval for this crate (the session approval of 2026-10-06 named the linter),
  a release workflow,
   and a tool whose binary name is `git`,
   none of which exist.

Ranking:
 A > B,
 because A installs the bytes that were gated while B installs bytes nobody ran the suite on;
B > C,
 because C needs approvals and pipelines that do not exist yet.

#### Question 2: How are worktrees that predate the JSONC file treated?

Seventy-two of 89 registered worktrees still hold only the TypeScript config,
 and 82 lack the rules file.
After the switch every config-loading command there stops with the exit 2 events quoted under hazard 3.

- Option A,
   recommended:
   switch only after the worktrees that are in active use have merged `main` and run
  `mise run sync:files`;
   leave stale worktrees to fail with the explicit migration message.
  Pros:
   nothing hybrid,
   the failure is loud and names the fix.
  Cons:
   a forgotten active worktree interrupts a session once.
- Option B:
   wait until all 89 are merged or removed.
   Pros:
   no surprise.
   Cons:
   may never end;
   blocks the user's decision.
- Option C:
   keep the incumbent reachable per worktree through its own PATH.
   Pros:
   none lost.
  Cons:
   that is a hybrid,
   which the user ruled out.

Ranking:
 A > B,
 because B has no end condition;
 B > C,
 because C contradicts the standing decision.

#### Question 3: What happens to the verification tools whose reference side is the incumbent?

The commit differential,
 the configuration differential,
 the dependent-version differential and the interop matrix
compare native with the TypeScript wrapper.
 After retirement the wrapper only exists in Git history;
the interop matrix is still a trailing gate.

- Option A,
   recommended:
   pin the last incumbent revision (its hash in the retirement commit and the ledger) and make
  the bins that must keep running check it out into a throwaway worktree and install it on demand;
  delete the three differentials (their results are recorded in the handover documents,
  and `src/native/dependent_version_fixtures/unit_cases.json` keeps the planner's recorded behavior as a fixture the
  native tests read).
   Pros:
   the trailing interop gate stays runnable;
   no TypeScript in the working tree.
  Cons:
   the interop bins need an incumbent-provisioning step that does not exist yet.
- Option B:
   delete all of them and cancel the interop matrix.
   Pros:
   simplest.
  Cons:
   the user decided that gate trails the cutover (`doc/handover/cli-git-rust-implementation.md`),
  so this cancels a recorded decision.
- Option C:
   keep the TypeScript under `package-deprecated/`.
   Pros:
   bins unchanged.
  Cons:
   the user said the old TypeScript must go.

Ranking:
 A > B,
 because B silently cancels a recorded trailing gate;
B > C,
 because C keeps the code the user asked to remove.

#### Question 4: How do the release and CI jobs get the native executable?

The release job (`npm-release.yml`) and the final-newline check run on GitHub runners that install only Node and pnpm.
The user decided the dependent-version bump ends with one implementation in the native wrapper
(`doc/handover/cli-git-rust-implementation.md`,
 `User decisions 2026-10-05`);
 the open part is delivery.
The release task was never run end to end through the native path (`doc/handover/cli-git-native-dependent-version.md`,
`Not verified`).

- Option A,
   recommended:
   a job step builds the crate from the checkout with the pinned Rust toolchain (the same
  `cargo build --release --locked` the container uses) and puts `git` in front on PATH for that step only.
  Pros:
   no release artifact or publication;
   the checkout and the executable always match.
  Cons:
   adds build minutes per run (the scanner build step is slow) and needs a Rust toolchain and Git 2.55.0 or newer
  on the runner (runner Git version unverified).
- Option B:
   publish a release artifact and download it.
   Pros:
   fast jobs.
  Cons:
   needs a release pipeline and publication approval.
- Option C:
   keep the TypeScript planner for releases.
   Pros:
   no CI change.
  Cons:
   contradicts the recorded decision and keeps `package/git-policy/repository` alive.

Ranking:
 A > B,
 because A needs nothing that does not exist;
 B > C,
 because C reverses a user decision.

#### Question 5: Do the four authoring and policy packages retire with the cli?

`package/git-policy/api`,
 `forbidden-strings`,
 `markdown-lint` and `repository` are TypeScript sources for the retired
plugin surface;
 the plan says authoring surfaces go "only after their consumers have moved"
(`doc/planning/cli-git-rust-implementation.md:297`).

- Option A,
   recommended:
   delete all four in the retirement commits,
   after the config,
  the release task and the mirrors are gone.
   Pros:
   no hybrid,
   no consumer left.
  Cons:
   `package/git-policy/repository` must wait for question 4.
- Option B:
   keep them as dormant packages.
   Pros:
   nothing to do.
  Cons:
   unused code with no consumer and a policy mirror generator that no longer has a target.

Ranking:
 A > B,
 because B leaves exactly the retired code the user asked to remove.

#### Question 6: Is the hk cleanup task still wanted?

The task `cleanup:hk-git-config` removes `hook.hk-*` Git configuration left by a retired hook manager.
On this host `git config --show-scope --get-regexp '^hook\.hk-'` exits 1 with no output (re-measured today).
Other machines were never inspected.
 The adopted default was to move it to a surviving TypeScript package (open to
veto).

- Option A:
   retire the task and `doc/runbook/remove-retired-hk-git-config.md` now.
   Pros:
   less code.
  Cons:
   a machine that still has the keys loses the supported removal.
- Option B:
   move `src/maintenance/hk-config-cleanup*.ts` and its fixture test to a surviving package (a new small
  package under `package/dev-script/`,
   since `package/git/executable` is a library) and repoint the root task.
  Pros:
   no behavior change.
   Cons:
   carries a one-time migration tool indefinitely.

Ranking:
 B > A,
 because B removes no supported cleanup path;
A is better only if you know that no other machine ever ran hk,
 and in that case answer A.

#### Question 7: What happens to `perf/` and the performance workflow?

The accepted bar is "faster than the incumbent per scenario".
The JSON baselines in `perf/` are the incumbent's numbers;
the harness runs a packed npm tarball and the workflow triggers on `package.json` version changes.

- Option A,
   recommended:
   keep `perf/*.json`,
   delete the harness,
   tasks and `cli-git-performance.yml` now,
  and write the native harness when the release-artifact performance gate runs (it trails the cutover).
  Pros:
   baselines survive,
   no dead tasks.
   Cons:
   the harness scenario definitions must be rewritten.
- Option B:
   adapt the harness now to install the native executable instead of a tarball.
   Pros:
   scenarios reused.
  Cons:
   expands the cutover;
   the gate trails by decision.

Ranking:
 A > B,
 because B does trailing work before the cutover.

#### Question 8: How long is the rollback period, and what ends it?

The plan keeps the previous executable "until native installation and recovery checks pass"
(`doc/planning/cli-git-rust-implementation.md:446`),
 but nothing says who declares that.
Ending it deletes the shim,
 the incumbent's `dist`,
 the cli package's dependency links,
and (separately) `cli-git.config.ts`.

- Option A,
   recommended:
   end it when the user says so after one working day of native commits across sessions with no
  recovery event,
   then do the retirement commits in order.
   Pros:
   the user decides on observed use.
   Cons:
   open ended.
- Option B:
   end it when the trailing interop matrix passes.
   Pros:
   evidence based.
  Cons:
   that gate is long and trails by decision.
- Option C:
   end it immediately after the verification.
   Pros:
   smallest window.
  Cons:
   rollback then needs a fresh incumbent install.

Ranking:
 A > B,
 because B couples cutover to a gate the user moved after it;
 B > C,
 because C leaves no cheap rollback.

#### Question 9: What does the package `build` task do after the cutover?

Root `mise run build` and `prepareAndBuild` run every package's task named `build`;
today the cli package's `build` produces the `dist` the installed `git` runs.

- Option A,
   recommended:
   `build` becomes the release build of `cli-git-native`
  (`cargo build --release --locked --offline --bin cli-git-native`),
   as the sibling Rust CLI
  `package/cli/forbidden-strings` does.
   Pros:
   `prepareAndBuild` keeps producing the installable artifact.
  Cons:
   every root `mise run build` compiles the crate,
   whose scanner build script is slow.
- Option B:
   no `build` task;
   an explicit install task builds on demand.
   Pros:
   root builds stay fast.
  Cons:
   `prepareAndBuild` no longer produces the installed artifact.

Ranking:
 A > B,
 because A keeps the one-command setup the repository has today;
B wins only if build time at the root matters more,
 which you can decide from the measurement this document lacks.

#### Question 10: Which operating systems does the first native workflow cover?

Windows and macOS code was never compiled beyond a Clippy type-check for Windows GNU,
and the adopted decision of 2026-10-05 says the whole native suite runs on hosted macOS and Windows on every wrapper
change.

- Option A,
   recommended:
   Linux only at the cutover,
   the other systems when the trailing Windows checks run.
  Pros:
   matches what has been verified.
   Cons:
   a regression on another system is not caught meanwhile.
- Option B:
   the full matrix now.
   Pros:
   matches the adopted decision.
  Cons:
   the first runs will fail on untested code and need Git 2.55.0 or newer installed on each runner.

Ranking:
 A > B,
 because B turns the cutover into the trailing Windows work.

### Not established

- Whether mise expands `{{env.HOME}}` or `~` in `_.path`,
   and the final PATH position of a new first entry in a
  worktree session:
   only the current ordering was observed (`_.path` before tool directories and `/usr/bin`).
- The duration and size of a host release build and of the Clippy addition to `lint`;
  only the debug binary size was seen.
- Which of the 89 worktrees are active,
   and which sessions hold the old PATH:
   the commands are given,
  not run against processes.
- Whether `pnpm install` prunes the cli package's links the moment its manifest drops them:
  inferred from the symlink layout,
   not run.
- The reverse interoperability direction (incumbent reads records native wrote):
   untested by decision (trailing gate).
- Whether the native wrapper tolerates the four Oct 6 `settlement.lock.*.pending` directories in
  `.git/cli-git-worktree-copy/v1`;
   the transaction staging names are ignored by design
  (`package/git-policy/cli/SPEC.md:2085-2095`).
- The contents of `*.local.*` files,
   `~/.local/state/cli-git/trust/v1`,
   and whether any of them name the shim or `dist`.
- Hosted-runner Git versions against the 2.55.0 floor,
   and Windows or macOS behavior of anything native.
- Baseline results of `mise run //package/git-policy/cli:lint` and `lint:types` before and after the manifest
  reduction (not run:
   the package is large and the scout was read-only).
- The exact `package.json` field list after reduction is derived from import counts,
  not from a type check of the reduced package.
