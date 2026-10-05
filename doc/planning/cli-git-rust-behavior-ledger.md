# cli-git Rust behavior ledger

Every responsibility the incumbent TypeScript Git policy wrapper carries,
who consumes it,
whether the Rust rewrite keeps it,
and its proposed owner and proof in the native implementation.
This is the first step of the accepted sequence in
[`cli-git-rust-implementation.md`](cli-git-rust-implementation.md)
("Implementation sequence and verification").
It is an inventory:
it changes no accepted decision and proposes no design beyond owner module names.

## Source and conventions

Source:
a read-only survey on 2026-10-05.
Line numbers are as of commit `cd54f8b64`.
The incumbent TypeScript under `package/git-policy/cli/src` (outside `src/native`)
and `package/git-policy/cli/SPEC.md` last changed in `cf2bf70d2` (2026-09-26).
The native Rust files last changed in `2680f7cb6`.
`doc/handover/cli-git-rust-implementation.md` changed during the survey,
so it is cited by section name.

Path convention:
`SPEC.md`,
`README.md`,
and paths starting with `src/`,
`e2e/`,
`perf/`,
or `bin/` are relative to `package/git-policy/cli/`.
Every other path is repository-relative.
A bare line range after a path citation refers to the same file.

Planning citations:
"implementation plan" is `doc/planning/cli-git-rust-implementation.md`,
"rewrite scope" is `doc/planning/cli-git-rust-rewrite.md`,
and the accepted decision is `doc/decision/cli-git-rust-rewrite.md`.

Each responsibility records these points:

- Behavior:
  what the incumbent does,
  with the implementing source.
- Spec:
  the `SPEC.md` lines that state it,
  or that no section states it.
- Consumers:
  who depends on it.
- Status:
  `retained` or `retired`.
  A retired entry cites the planning text that retires it.
- Rust owner:
  a module under `package/git-policy/cli/src/native/`.
  Only `global_arguments.rs` and `config_loading.rs` exist;
  every other name is a proposal for the owning delegate to confirm.
- Consumer-level test:
  what is run and what is observed.
  "Standard fixture" means the built native `git` executable,
  first on `PATH`,
  in a disposable repository with a local bare remote,
  inside the bounded Git 2.56.0 container image
  (implementation plan lines 326 to 338).
- Native state:
  `absent`,
  `in progress`,
  or `implemented`.
  "In progress" means the `Resumption 2026-10-05` section of `doc/handover/cli-git-rust-implementation.md`
  delegates the area;
  at `40436cd01` `src/native/` held only `lib.rs`,
  `global_arguments.rs`,
  `config_loading.rs`,
  and their test files.

## Measured size

Measured with `tokei` 15.0.0 over `package/git-policy/cli/src` excluding `native`;
code lines only.

- Source outside tests and built-artifact fixtures:
  312 files,
  40,559 lines.
- Built-artifact fixtures under `src/trust/fixture`:
  53 files,
  9,379 lines.
- Unit tests (`*.unit.test.ts`):
  110 files,
  24,102 lines.
- Per source directory,
  tests excluded:
  `policy-engine` 135 files and 18,582 lines;
  `trust` 42 files and 5,939 lines;
  `worktree-copy` 25 files and 3,755 lines;
  top-level files 33 and 3,587 lines;
  `optional` 18 files and 2,211 lines;
  `parser` 20 files and 1,837 lines;
  `index-lock` 11 files and 1,645 lines;
  `shadow-repository` 8 files and 1,176 lines;
  `hook-dispatch` 4 files and 542 lines;
  `rule` 6 files and 453 lines;
  `owner-lock` 2 files and 386 lines;
  `api` 6 files and 317 lines;
  `maintenance` 2 files and 129 lines.
- Inside `policy-engine`,
  by file-name family:
  `commit-transaction-*` without recovery 36 files and 4,798 lines;
  `commit-landing-*` 14 files and 2,301 lines;
  `commit-transaction-recovery-*` 12 files and 1,848 lines;
  `commit-replay-*` 10 files and 1,772 lines;
  `manual-push-*` 8 files and 1,215 lines;
  `commit-capture-order-*` 8 files and 1,109 lines.
- Harnesses:
  `e2e` 48 source files and 7,782 lines plus 7 test files and 1,050 lines;
  `perf` 26 files and 3,498 lines.
- Sibling packages:
  `package/git/executable` 7 source files and 409 lines;
  `package/git-policy/repository` 9 and 1,119;
  `package/git-policy/forbidden-strings` 6 and 633;
  `package/git-policy/markdown-lint` 5 and 600;
  `package/git-policy/api` 6 and 305.

## Entry and dispatch

### Executable entry

- Behavior:
  `src/index.ts:1` carries the Node shebang;
  `src/index.ts:40-41` runs `runCliGit` only when Node executes the file as the program entry.
  `package/git-policy/cli/package.json:17-19` maps the `git` bin name to `dist/final/node/index.mjs`.
  The installed shim `node_modules/.bin/git` is a package-manager shell script that starts Node on that file.
- Spec:
  `SPEC.md:48-60`.
- Consumers:
  every `git` invocation whose `PATH` resolves the shim first.
  Root `mise.toml:1252-1253` puts `node_modules/.bin` on `PATH`;
  root `package.json:36` depends on the package.
  Agent tooling reaches it the same way:
  `AGENTS.md:1338` (rule CLG) names its guards.
- Status:
  retained.
  The implementation plan lines 425 to 426 require the installed launcher to resolve directly to the native executable,
  not to a Node process that starts it.
- Rust owner:
  a thin binary entry beside `lib.rs`
  (implementation plan lines 29 to 35).
- Consumer-level test:
  in the standard fixture,
  run `git --version` through `PATH` and inspect the process tree;
  observe native Git's version text and no Node process.
- Native state:
  in progress.

### Startup order

- Behavior:
  `runCliGit` (`src/bin.ts:109-465`) runs these steps in order:
  install the lock PID environment (`110`);
  detect the management namespace (`139-148`);
  resolve real Git (`169`,
  `187`);
  resolve worktree identity when classification skips configuration (`191-197`);
  recover dead commit transactions unless a preparation lease is inherited (`199-204`);
  load configuration (`208-210`);
  run the commit transaction (`248-257`);
  run the pre-forward engine when no transaction applied (`261-272`);
  run the manual-push gate (`314-346`);
  forward to real Git when no commit landed (`357-369`);
  run the post-commit lifecycle and auto-push (`385-423`);
  print post-command output (`425-428`).
- Spec:
  `SPEC.md:1991-2010`,
  `3497-3503`.
- Consumers:
  every wrapper invocation.
- Status:
  retained.
- Rust owner:
  `wrapper_main.rs` (proposed).
- Consumer-level test:
  in the standard fixture,
  plant a dead-owner transaction directory and an invalid configuration,
  then run `git add -- a.txt`;
  observe that the transaction directory is recovered
  before the configuration failure is reported with exit `2`.
- Native state:
  absent.

### Global option parsing

- Behavior:
  `parseGlobalOptions` (`src/parse-global-options.ts:203-210`) walks the tokens before the subcommand.
  It applies each `-C <path>` to an effective working directory (`68-83`,
  `133-155`),
  skips one value after `-c`,
  `-C`,
  `--git-dir`,
  `--work-tree`,
  `--namespace`,
  `--super-prefix`,
  and `--attr-source` (`12-20`),
  treats every other dash-led token as a flag (`166-174`),
  and marks `--version`,
  `-v`,
  `--help`,
  and `-h` as short-circuit forms (`25-30`).
  It returns `effectiveCwd`,
  `subcommandIndex`,
  and `willShortCircuit` (`35-48`).
- Spec:
  `SPEC.md:779-797`.
- Consumers:
  25 non-test source files import it
  (`rg --files-with-matches "parse-global-options" src --glob '!**/*.unit.test.ts' --glob '!src/native/**'`,
  minus the file itself).
- Status:
  retained.
  The native table differs from the incumbent table;
  see "Spec and code disagreements" and "Incumbent defects and stale comments".
- Rust owner:
  `global_arguments.rs` (exists).
- Consumer-level test:
  in the standard fixture,
  run each global option form,
  including a missing value,
  an unknown option,
  and a non-UTF-8 `-C` path,
  through the native `git` and through `/usr/bin/git`;
  observe identical exit status and output.
- Native state:
  implemented as a library function (`src/native/global_arguments.rs:98-164`).
  Evidence:
  5 unit tests in `src/native/global_arguments_tests.rs`,
  part of the 9 tests and Clippy pass of `mise run //package/git-policy/cli:native:test:container`
  recorded in the `Resumption 2026-10-05` section of `doc/handover/cli-git-rust-implementation.md`.
  No executable consumes it yet,
  so the consumer-level test has not run.

### Configuration-loading fast path

- Behavior:
  `classifyConfigLoading` (`src/trust/command-classification.ts:267-304`) returns `skip-config`
  for 27 inspection commands (`17-45`)
  and for `branch` and `tag` forms without a mutating flag that list or take no positional (`49-118`,
  `178-251`,
  `299-303`).
  Every other command,
  and an absent subcommand,
  returns `load-config`.
  `resolveRuntimeConfig` (`src/trust/runtime-config.ts:36-61`) consults it before discovery,
  and `src/bin.ts:191-197` reuses the worktree identity only on the skip path.
  Short-circuit forms never load configuration (`src/bin.ts:208-210`).
- Spec:
  `SPEC.md:787-797`.
- Consumers:
  every wrapped inspection command;
  the `read-only` and `no-config` scenarios of `perf/lifecycle-latency-contracts.ts:219-231`.
- Status:
  retained.
  The implementation plan lines 76 to 77 keep the fast path:
  operations that need no policy configuration must not initialize the policy engines.
- Rust owner:
  `config_loading.rs` (exists).
- Consumer-level test:
  in the standard fixture,
  write an invalid `cli-git.config.jsonc`,
  then run `git status` and `git add -- a.txt`;
  observe that `status` succeeds and `add` exits `2` with a `config-invalid` event.
- Native state:
  implemented as a library function (`src/native/config_loading.rs:236-257`).
  Evidence:
  4 unit tests in `src/native/config_loading_tests.rs`,
  in the same recorded 9-test and Clippy pass.
  No executable consumes it yet.

### Wrapper controls and escape hatches

- Behavior:
  `parsePolicyControls` (`src/policy-engine/controls.ts:132-226`) removes wrapper-only tokens
  before Git's `--` separator and outside option values:
  `--cli-git-keep-going` (`12`),
  one `--no-enforce-<policy-id>` per registered policy (`69-71`,
  `142-147`),
  and the aliases `--no-enforce-worktree`,
  `--no-enforce-worktree-branch`,
  and `--no-enforce-bulk-add` (`37-50`).
  It returns the forwardable arguments,
  the keep-going flag,
  and the escaped policy IDs.
  `stripEscapeHatch` (`src/escape-hatch.ts:81-135`) removes one flag-position token
  for the per-command checks.
  `--no-enforce-only` belongs to the commit-only transform (`src/parser/commit.ts:25`),
  and `--no-worktree-copy` to worktree copy (`src/escape-hatch.ts:15`).
- Spec:
  `SPEC.md:1246-1252`,
  `4005-4008`.
- Consumers:
  agents and humans bypassing one policy for one invocation;
  `AGENTS.md:1338` (rule CLG) restricts when agents may use them.
- Status:
  retained.
- Rust owner:
  `wrapper_controls.rs` (proposed).
- Consumer-level test:
  in the standard fixture,
  run `git add --no-enforce-add-explicit .`,
  `git add --no-enforce-bulk-add .`,
  and `git commit -m --no-enforce-only -- a.txt`;
  observe that the first two stage,
  the wrapper token never reaches Git,
  and the third commits with the literal message `--no-enforce-only`.
- Native state:
  absent.

### Post-command output

- Behavior:
  `printPostCommandOutput` (`src/post-command-output.ts:38-103`) prints one line to stdout
  after a successful version request (`88-94`)
  and one human note after `git status`
  unless the output is machine-readable or the caller set `advice.statusHints` (`72-87`,
  `95-102`).
- Spec:
  no `SPEC.md` section states it.
- Consumers:
  humans reading `git status`;
  any script that parses `git --version` output sees the added line.
- Status:
  retained.
  The implementation plan does not name it;
  see "Open questions".
- Rust owner:
  `post_command_output.rs` (proposed).
- Consumer-level test:
  in the standard fixture,
  run `git status`,
  `git status --porcelain`,
  and `git -c advice.statusHints=true status`;
  observe the note only in the first.
- Native state:
  absent.

## Real Git and child processes

### Real-Git resolution and self-exclusion

- Behavior:
  `resolveRealGit` (`package/git/executable/src/resolve-real-git.ts:360-414`) builds absolute candidates
  from `PATH` and,
  on Windows,
  `PATHEXT` (`78-96`,
  `155-226`),
  promotes common platform locations that `PATH` exposes
  (`package/git/executable/src/platform-paths.ts:10-22`,
  `44-98`),
  and returns the first executable candidate that is not a wrapper shim (`290-338`).
  `isGitPolicySelfShim` (`package/git/executable/src/self-shim.ts:185-246`) returns `false`
  for any ELF,
  PE,
  or Mach-O header (`34-45`,
  `212-218`),
  and otherwise searches at most 64 KiB of script text for four markers
  naming the package or its bundled entry (`139-164`).
  Successful results are cached for the process (`package/git/executable/src/resolution-cache.ts`).
- Spec:
  `SPEC.md:29-38`;
  `README.md:21-38`.
- Consumers:
  the wrapper (`src/bin.ts:33`,
  `169`,
  `187`;
  `src/effective-target.ts:6`;
  `src/policy-engine/branch-worktree-check.ts`;
  `src/policy-engine/direct-check-facts.ts`;
  `src/policy-engine/direct-fix.ts`;
  `src/rule/commit-index-check.ts`;
  `src/rule/commit-sequencer-check.ts`;
  `src/maintenance/hk-config-cleanup-command.ts`)
  and `package/pi-plugin/auto-mode/src/git-worktree-read-allowlist.ts`.
- Status:
  retained.
  The implementation plan lines 84 to 91 port resolution,
  wrapper-self exclusion,
  and platform lookup into Rust,
  and state that the TypeScript resolver used by other consumers
  needs native-wrapper recognition at cutover.
  The incumbent classifies every native executable as real Git,
  so an unchanged TypeScript resolver would select a native wrapper.
- Rust owner:
  `git_resolution.rs` (proposed).
- Consumer-level test:
  in the standard fixture,
  place the native wrapper under two `PATH` directories ahead of real Git and run `git rev-parse --git-dir`;
  observe one real-Git process and no recursion.
  Repeat with no real Git on `PATH`;
  observe a diagnostic and a nonzero exit.
- Native state:
  in progress.

### Alias resolution and built-in command table

- Behavior:
  `resolveForwardedCommand` (`src/forwarded-command.ts:261-397`) resolves the command a forwarded invocation runs.
  Names in `GIT_BUILTIN_COMMANDS` (`src/git-builtin-commands.ts:17`,
  taken from Git 2.55.0) are never treated as aliases.
  Other names are looked up as `alias.<name>` and `alias.<name>.command` (`219-259`),
  split with Git's `split_cmdline` quoting rules (`112-217`),
  and expanded up to 16 times (`28`).
  A value starting with `!` is a shell alias and stays unresolved.
- Spec:
  `SPEC.md:910-918`,
  `3472-3473`.
- Consumers:
  index-writer coordination and worktree-copy applicability.
- Status:
  retained.
- Rust owner:
  `alias_resolution.rs` (proposed).
- Consumer-level test:
  in the standard fixture,
  define `alias.wta = worktree add` and a chained alias,
  then run `git wta ../topic` from a linked worktree;
  observe that ignored files are copied into the new worktree.
- Native state:
  absent.

### Worktree identity resolution

- Behavior:
  `resolveGitWorktreeIdentity` (`src/git-worktree-identity.ts:298-374`) replays the caller's global options
  through `git rev-parse --path-format=absolute --is-bare-repository --git-dir --git-common-dir --show-cdup`
  (`158-228`),
  canonicalizes the paths,
  and classifies the target as `outside-worktree`,
  `bare-repository`,
  `main-worktree`,
  or `linked-worktree` (`25-97`,
  `365-373`).
- Spec:
  `SPEC.md:903-908`.
- Consumers:
  linked-worktree enforcement (`src/effective-target.ts:62-86`),
  worktree copy (`src/worktree-copy/git-observer.ts:93`),
  and startup recovery (`src/bin.ts:191-204`).
- Status:
  retained.
- Rust owner:
  `worktree_identity.rs` (proposed).
- Consumer-level test:
  in the standard fixture,
  run a guarded command with `--git-dir` and `--work-tree` naming a main worktree from inside a linked one;
  observe the main-worktree rejection.
- Native state:
  absent.

### Child environment and lock PID injection

- Behavior:
  `installGitChildEnvironment` (`src/git-child-environment.ts:191-194`) appends `core.lockfilePid=true`
  through `GIT_CONFIG_COUNT`,
  `GIT_CONFIG_KEY_<n>`,
  and `GIT_CONFIG_VALUE_<n>` (`103-157`).
  It preserves existing entries,
  adds nothing when the last numbered `core.lockfilePid` entry already reads as true,
  and adds nothing when `GIT_CONFIG_COUNT` is malformed (`74-83`,
  `119-122`).
  Private preparation removes `GIT_DIR`,
  `GIT_WORK_TREE`,
  `GIT_COMMON_DIR`,
  and `GIT_OBJECT_DIRECTORY` from the native commit's environment
  (`src/policy-engine/commit-preparation-native.ts:96-101`).
  Leases travel in `CLI_GIT_PREPARATION_LEASE`,
  `CLI_GIT_LANDING_LEASE`,
  and `CLI_GIT_WORKTREE_COPY_LEASE`
  (`src/hook-dispatch/hook-dispatch-plan.ts:57`;
  `src/index-lock/landing-lease.ts:26`;
  `src/worktree-copy/journal-lock.ts:63`).
- Spec:
  `SPEC.md:3382-3398`,
  `2209-2213`,
  `2455-2458`,
  `3487-3493`.
- Consumers:
  every forwarded and spawned Git;
  foreign `index.lock` evidence reads the PID files this setting produces.
- Status:
  retained.
- Rust owner:
  `git_child_environment.rs` (proposed).
- Consumer-level test:
  in the standard fixture,
  run a wrapped `git add` held in a hook with `GIT_CONFIG_COUNT=1` already set;
  observe the caller's entry intact,
  a second entry for `core.lockfilePid`,
  and a PID file beside `index.lock`.
- Native state:
  in progress.

### Forwarding, standard streams, signals, and exit codes

- Behavior:
  `forwardToRealGit` (`src/forward-real-git.ts:41-91`) resolves the command,
  takes index-writer coordination,
  and runs real Git through `runGitWithWorktreeCopy`.
  Real Git is spawned with an argument array,
  no shell,
  and inherited standard streams (`src/worktree-copy/lifecycle.ts:75-106`).
  The exit mapping is in `src/bin.ts:431-464`:
  a failed real Git exits with its code,
  or `1` when it has none (`454-456`);
  a policy decision exits `1` or `2` (`441-442`);
  recovery and unproven-lock errors emit one engine-failure event and exit `2` (`432-440`);
  a worktree-copy failure exits `2`,
  or Git's code,
  or `1` (`443-453`);
  any other error prints its message and exits `1` (`457-460`).
  The wrapper source installs no signal handler:
  `rg "process\.on\(|process\.once\(|\.on\(['\"]SIG" src --glob '!src/native/**'` returns nothing,
  with and without `--hidden --no-ignore`.
  A Git child ended by a signal therefore yields exit `1`.
- Spec:
  `SPEC.md:1577-1622`,
  `1066-1073`.
- Consumers:
  every forwarded command;
  callers that branch on Git's exit status.
- Status:
  retained.
  The implementation plan lines 84 to 91 port child environment,
  signals,
  and exit handling,
  and lines 47 to 49 require argument bytes and path representations to be preserved.
  The incumbent holds arguments as JavaScript strings (`src/bin.ts:114-115`).
- Rust owner:
  `git_forwarding.rs` (proposed).
- Consumer-level test:
  in the standard fixture,
  run a forwarded command that exits `3`,
  one killed by `SIGTERM`,
  and one with a non-UTF-8 pathspec;
  observe the wrapper's exit status and that Git received the exact bytes.
- Native state:
  in progress.

## Configuration

### Executable configuration discovery

- Behavior:
  `discoverConfig` (`src/trust/config-discovery.ts:142-178`) finds the repository root from the effective directory
  and returns `cli-git.config.mjs`,
  or else `cli-git.config.ts`,
  rejecting symbolic links and non-regular files (`68-90`).
  The root configuration is `cli-git.config.ts`,
  which imports plugins from `@monochromatic-dev/git-policy-cli/ts` (`cli-git.config.ts:6-12`).
- Spec:
  `SPEC.md:19-27`,
  `718-747`.
- Consumers:
  this repository's root configuration.
- Status:
  retired.
  The implementation plan lines 71 to 75 delete executable-config discovery;
  lines 440 to 443 replace it with an explicit migration diagnostic for legacy `.ts` or `.mjs` files
  and a hand translation of this repository's configuration.
  The rewrite scope lines 110 to 115 record the user's selection of JSONC.
- Rust owner:
  none for discovery of executable files;
  the migration diagnostic is listed under "Responsibilities the plan adds".
- Consumer-level test:
  in the standard fixture,
  leave only `cli-git.config.ts` in the repository root and run `git add -- a.txt`;
  observe the migration diagnostic and that no TypeScript ran.
- Native state:
  absent.

### Configuration value validation

- Behavior:
  `validateConfig` (`src/trust/config-validation.ts:396-544`) rejects unknown top-level keys (`401-407`),
  validates concurrency keys,
  registers built-ins and plugin policies,
  resolves each policy ID,
  applies defaults,
  parses option values through each policy's schema,
  and resolves declared inputs.
  `runPolicyEngine` rejects an unknown configured or selected policy ID
  with `config-invalid` (`src/policy-engine/engine.ts:207-241`).
  A severity is `off`,
  `warn`,
  or `error` (`src/api/policy-types.ts:21`).
- Spec:
  `SPEC.md:718-747`.
- Consumers:
  the root configuration's `policies` map (`cli-git.config.ts:27-58`).
- Status:
  retained for values:
  severities,
  policy IDs,
  per-policy options,
  and concurrency keys.
  The implementation plan lines 55 to 61 require the same errors from a typed JSONC document.
  The plugin and trust keys are retired;
  see "Plugin registration" and "Trust consent protocol".
- Rust owner:
  the JSONC configuration module owned by the native foundation delegate
  (`configuration.rs` proposed).
- Consumer-level test:
  in the standard fixture,
  run `git add -- a.txt` once per invalid document:
  an unknown key,
  an unknown policy ID,
  a duplicate key,
  an invalid severity,
  and an invalid option value;
  observe exit `2` and one `config-invalid` event each,
  before any policy runs.
- Native state:
  in progress.

### Concurrency configuration

- Behavior:
  `validateConcurrencyConfig` (`src/trust/config-validation-concurrency.ts:167-205`) accepts
  `hooks.concurrentCommits` (default `false`),
  `indexLock.unprovenOwnerTimeoutMs` (default `1000`),
  and `landing.reserveAfterLostRaces` (default `1`),
  with the defaults at `60-67`.
  Startup recovery and config-free forwarding use the defaults (`src/bin.ts:361-366`).
- Spec:
  `SPEC.md:749-775`.
- Consumers:
  the hook lock,
  the foreign `index.lock` wait,
  and the starvation reservation.
- Status:
  retained.
  The implementation plan line 57 names "existing concurrency controls" as typed settings.
- Rust owner:
  the JSONC configuration module (`configuration.rs` proposed).
- Consumer-level test:
  in the standard fixture,
  set each key to a valid value,
  zero,
  a negative number,
  a fraction,
  a string,
  and an unknown nested key;
  observe acceptance or a `config-invalid` exit `2` as `SPEC.md:770-774` lists.
- Native state:
  in progress.

### Plugin registration

- Behavior:
  `validateConfig` registers each namespace of `plugins` and resolves plugin policy IDs
  as `<namespace>/<policy-name>` (`src/trust/config-validation.ts:411-420`).
  The root configuration registers the namespaces `markdown`,
  `mono`,
  and `security` (`cli-git.config.ts:22-26`).
- Spec:
  `SPEC.md:336-356`,
  `725-728`.
- Consumers:
  the root configuration.
- Status:
  retired.
  The implementation plan lines 63 to 67 state that there are no imports,
  callbacks,
  plugin package names,
  command arrays,
  or executable-path overrides,
  and lines 103 to 106 fix the registry to shipped policies.
  The rewrite scope lines 113 to 115 record the user's rejection of a generic external-policy extension.
- Rust owner:
  none.
- Consumer-level test:
  in the standard fixture,
  write a JSONC document with a `plugins` key;
  observe a `config-invalid` exit `2` naming the unknown key.
- Native state:
  absent.

## Trust subsystem

Every entry in this section is retired by the implementation plan lines 71 to 75
("Delete executable-config discovery,
bundling,
stored-code evaluation,
consent,
and trust-registry management")
and by the rewrite scope lines 115 and 121 to 124
(the user wants the executable-config trust subsystem removed
and no replacement trust registry or global policy layer).
Retained modules still import helpers from `src/trust/`:
17 files import `src/trust/registry-io.ts`
(`rg --files-with-matches "trust/registry-io" src --glob '!src/trust/**' --glob '!**/*.unit.test.ts'`),
and `src/bin.ts:35`,
`44` and `src/policy-engine/commit-transaction.ts:22` import classification and concurrency helpers.
The implementation plan lines 78 to 80 move those helpers by responsibility.

### Trust candidate capture

- Behavior:
  `captureTrustCandidate` (`src/trust/candidate.ts:77-163`) opens the configuration without following links
  and resolves filesystem identity,
  through `/proc/<pid>/fd/<fd>` on Linux (`53`).
- Spec:
  `SPEC.md:1752-1762`.
- Consumers:
  trust commands and strict loading.
- Status:
  retired.
- Rust owner:
  none.
- Consumer-level test:
  covered by the retired-command test under "Trust management commands".
- Native state:
  absent.

### MJS self-containment validation

- Behavior:
  `validateMjs` (`src/trust/mjs-validator.ts:58-197`) parses module syntax without execution
  and rejects imports other than Node built-ins.
- Spec:
  `SPEC.md:1736-1750`.
- Consumers:
  MJS trust.
- Status:
  retired.
- Rust owner:
  none.
- Consumer-level test:
  none;
  no JavaScript is parsed or executed by the native wrapper.
- Native state:
  absent.

### TypeScript bundling and source capture

- Behavior:
  `buildTypeScriptCandidate` (`src/trust/typescript-builder.ts:95-243`) bundles the configuration with Rolldown
  into one chunk;
  `sourceCapturePlugin` (`src/trust/typescript-source-capture.ts:204-344`) records the tracked source graph.
- Spec:
  `SPEC.md:1917-1966`.
- Consumers:
  TypeScript trust for the root `cli-git.config.ts`.
- Status:
  retired.
- Rust owner:
  none.
- Consumer-level test:
  none.
- Native state:
  absent.

### Stored-code evaluation

- Behavior:
  `loadStrictMjs` and `loadStrictTypeScript` (`src/trust/config-loader.ts:180-350`) compare live bytes
  with stored snapshots and import the stored executable snapshot (`107-170`).
- Spec:
  `SPEC.md:1764-1780`.
- Consumers:
  every configuration-loading wrapper command.
- Status:
  retired.
- Rust owner:
  none.
- Consumer-level test:
  in the standard fixture,
  run a configuration-loading command with `strace` following children;
  observe that no Node or other interpreter starts for configuration.
- Native state:
  absent.

### Relaxed trust mode

- Behavior:
  `loadRelaxedConfig` (`src/trust/relaxed-loader.ts:272-303`) rebuilds or re-snapshots a trusted configuration
  when `CLI_GIT_NO_PARANOID` names it (`src/trust/trust-service.ts:182`;
  `src/trust/relaxed-paths.ts:138-166`).
- Spec:
  `SPEC.md:1881-1915`.
  The spec does not name the environment variable.
- Consumers:
  developers who set the variable.
- Status:
  retired.
- Rust owner:
  none.
- Consumer-level test:
  in the standard fixture,
  set `CLI_GIT_NO_PARANOID` and run a wrapped command;
  observe no change in behavior.
- Native state:
  absent.

### Trust consent protocol

- Behavior:
  `trustConfig` (`src/trust/trust-service.ts:66-176`) discloses the candidate on stderr
  and accepts an interactive affirmative response or `--yes`;
  `trust.children` adds a second stage for recursive authority.
- Spec:
  `SPEC.md:1782-1807`.
- Consumers:
  `git cli-git trust`.
- Status:
  retired.
  The implementation plan lines 68 to 69 add that repository settings can disable policies
  or change permitted severities without consent,
  and that no other approval mechanism replaces the prompts.
- Rust owner:
  none.
- Consumer-level test:
  in the standard fixture,
  change `cli-git.config.jsonc` to disable a policy and run the affected command;
  observe that the change takes effect with no prompt and no trust failure.
- Native state:
  absent.

### Trust registry storage

- Behavior:
  records live under an account-derived root (`src/trust/account-root.ts:35-65`)
  at reversible base64url paths (`src/trust/registry-path.ts:41-219`),
  with private modes on POSIX and protected ACLs on Windows (`src/trust/registry-io.ts:25-29`,
  `130-247`),
  and atomic prepared-record installation (`src/trust/registry-record-preparation.ts:168-303`).
- Spec:
  `SPEC.md:1624-1734`.
- Consumers:
  trust loading and management.
- Status:
  retired.
  The implementation plan lines 444 to 445 leave old trust records inert rather than deleting them.
- Rust owner:
  none.
- Consumer-level test:
  in the standard fixture,
  seed a trust registry under a disposable home and run wrapped commands;
  observe the registry bytes unchanged.
- Native state:
  absent.

### Recursive enrollment, revocation, and provenance journals

- Behavior:
  `autoEnrollRecursiveConfig` (`src/trust/recursive-enrollment.ts:272-316`) enrolls descendants of a recursive root;
  `revokeRecursiveTrust` (`src/trust/recursive-revocation.ts:168-262`) removes inherited records;
  provenance journals are applied and recovered in `src/trust/registry-transaction.ts:135-291`
  under the recursive-operation lock (`src/trust/registry-recursive-lock.ts:159-259`).
- Spec:
  `SPEC.md:1809-1879`,
  `3339-3356`.
- Consumers:
  trust loading in every wrapped command.
- Status:
  retired.
- Rust owner:
  none.
- Consumer-level test:
  none beyond the inert-registry test under "Trust registry storage".
- Native state:
  absent.

### Trust management commands

- Behavior:
  `runTrustManagement` (`src/trust/management-runtime.ts:177-294`) implements `trust`,
  `untrust`,
  and `status`,
  each writing one JSON object to stdout.
- Spec:
  `SPEC.md:799-885`.
- Consumers:
  humans and agents enrolling a repository;
  `.github/workflows/cli-git-trust.yml:189-232` (job `trust`) runs the trust suites on Linux,
  macOS,
  and Windows.
- Status:
  retired.
  The implementation plan line 444 states that retired trust commands explain
  that JSONC no longer requires code-execution approval.
- Rust owner:
  `management_retired.rs` (proposed) for the explanation.
- Consumer-level test:
  in the standard fixture,
  run `git cli-git trust`,
  `git cli-git trust --yes`,
  `git cli-git untrust`,
  and `git cli-git status`;
  observe the explanation and that no registry file is read or written.
  The exit status and stream are undetermined;
  see "Open questions".
- Native state:
  in progress
  (the handover lists a management-command skeleton).

### Trust warnings

- Behavior:
  trust warnings are JSON objects on stderr with the codes at `src/trust/types.ts:166-189`.
- Spec:
  `SPEC.md:1309-1325`.
- Consumers:
  none measured outside the package.
- Status:
  retired.
- Rust owner:
  none.
- Consumer-level test:
  none.
- Native state:
  absent.

## Authoring surfaces

Every entry in this section is retired by the implementation plan lines 33 to 35
(no permanent TypeScript bridge and no general plugin runtime),
lines 63 to 67,
and lines 295 to 297
(retired implementations and authoring surfaces are deleted only after their consumers have moved).

### Authoring API

- Behavior:
  `definePolicy`,
  `definePlugin`,
  `defineConfig`,
  and `definePolicyOptions` return their argument (`src/api/authoring.ts:37-116`);
  the types are in `src/api/config-types.ts`,
  `src/api/policy-types.ts`,
  `src/api/context-types.ts`,
  and `src/api/policy-input-types.ts`.
  The canonical copy is `package/git-policy/api/src`.
- Spec:
  `SPEC.md:77-398`,
  `628-716`.
- Consumers:
  `cli-git.config.ts:6-12`;
  `package/git-policy/repository`,
  `package/git-policy/forbidden-strings`,
  and `package/git-policy/markdown-lint`,
  which define policies with it.
- Status:
  retired.
- Rust owner:
  none.
- Consumer-level test:
  after cutover,
  `rg "git-policy-cli/ts|git-policy-api" . --glob '!doc/**'` returns no importer.
- Native state:
  absent.

### Package exports and single MJS artifact

- Behavior:
  `package/git-policy/cli/package.json:8-16` exports the built artifact and `./ts`;
  `src/authoring.ts:6-99` re-exports the authoring API,
  the optional plugins,
  and final-newline helpers.
  `package/git-policy/cli/rolldown.node.config.ts` builds one static bundle.
- Spec:
  `SPEC.md:48-75`,
  `4254-4283`.
- Consumers:
  `package/config/pnpr/config.yaml:76-80` lists the five `git-policy-*` packages for the private registry;
  `.changeset/config.json:21` names the wrapper package;
  the mise tasks `build`,
  `pack:npm`,
  and `test:built:trust` (`package/git-policy/cli/mise.toml:25-131`).
- Status:
  retired.
  The implementation plan lines 29 to 32 keep the TypeScript executable available
  until the Rust replacement passes the consumer contracts.
- Rust owner:
  none;
  native packaging is implementation sequence step 7.
- Consumer-level test:
  install the native package into a disposable project;
  observe that `PATH` resolves its `git` first and that no JavaScript artifact is installed.
- Native state:
  absent.

### Optional-policy mirrors

- Behavior:
  `file-enforcer.config.ts:2260-2322` copies the sources of `package/git-policy/repository`,
  `package/git-policy/forbidden-strings`,
  and `package/git-policy/markdown-lint` into `src/optional/`,
  rewriting their API imports,
  so the single artifact bundles them.
- Spec:
  `SPEC.md:62-75`.
- Consumers:
  the wrapper build;
  `package/dev-script/file-enforcer/src/generated-policy-contracts.unit.test.ts`.
- Status:
  retired.
  The implementation plan line 435 lists file-enforcer-owned scanner and build integration
  among the things updated together at cutover.
- Rust owner:
  none.
- Consumer-level test:
  after cutover,
  running file-enforcer produces no file under `package/git-policy/cli/src/optional/`.
- Native state:
  absent.

### Internal test exports

- Behavior:
  `src/index.ts:11-37` exports `internalTestExports` and manual-push helpers
  so built-artifact tests reach internals (`src/internal-test-exports.ts:202-236`).
- Spec:
  no `SPEC.md` section states it.
- Consumers:
  unit tests under `src/` that exercise the built artifact
  (`rg --files-with-matches "internalTestExports|internal-test-exports" package` lists files under `src/` only).
- Status:
  retired with the JavaScript artifact.
  The behaviors those tests cover keep their own entries in this ledger.
- Rust owner:
  none.
- Consumer-level test:
  none.
- Native state:
  absent.

### Supported Node runtime contract

- Behavior:
  `package/git-policy/cli/package.json:30-32` declares `^24.11.0 || ^26.0.0`;
  `src/runtime-contract.host-evidence.ts` imports the built artifact and runs representative commands
  at each floor.
- Spec:
  `README.md:6-19`.
- Consumers:
  `.github/workflows/cli-git-trust.yml:34-187`
  (jobs `runtime-policy`,
  `latest-lts-policy`,
  and `supported-runtime`);
  the mise task `verify:supported-runtime` (`package/git-policy/cli/mise.toml:84-86`).
- Status:
  retired with the Node executable.
  The rewrite scope lines 104 to 106 state that eliminating an external Node installation
  is not a hard requirement,
  and the implementation plan lines 425 to 426 remove Node from the launch path.
- Rust owner:
  none.
- Consumer-level test:
  none.
- Native state:
  absent.

## Management commands

### Namespace dispatch, grammar, and help

- Behavior:
  the wrapper owns an invocation only when the parsed subcommand is exactly `cli-git` (`src/bin.ts:147-148`).
  `parseManagementArgs` (`src/management-parser.ts:175-265`) accepts `--help` or `-h`,
  `trust [--yes]`,
  `untrust`,
  `status`,
  and `check` or `fix` with repeatable `--policy <id>`,
  `--all`,
  and pathspecs.
  `runManagementCommand` (`src/management.ts:136-316`) prints usage to stderr and exits `2` on a refusal (`149-152`),
  prints help to stdout and exits `0` (`153-156`),
  and requires exactly one scope for `check` and `fix`:
  `--all`,
  or a non-empty pathspec list after `--` (`171-198`).
  Help returns before real-Git resolution and recovery (`src/bin.ts:159-174`).
- Spec:
  `SPEC.md:796-833`.
- Consumers:
  humans and agents running `git cli-git`;
  `.github/workflows/final-newline.yml:38-39` runs a fixture that calls the direct check.
- Status:
  retained for the namespace,
  help,
  `check`,
  and `fix`.
  The implementation plan lines 107 to 112 preserve `check` and `fix`,
  and line 438 lists the surviving management-command documentation.
- Rust owner:
  `management_arguments.rs` (proposed).
- Consumer-level test:
  in the standard fixture,
  run `git cli-git --help`,
  `git cli-git check`,
  `git cli-git check --all -- a.txt`,
  `git cli-git check a.txt`,
  and `git add cli-git`;
  observe help on stdout with exit `0`,
  exit `2` for the three malformed scopes,
  and ordinary staging of a file named `cli-git`.
- Native state:
  in progress
  (management-command skeleton).

### Direct check

- Behavior:
  `git cli-git check` loads configuration with `forceLoad` (`src/management.ts:99-118`),
  projects the selected worktree bytes into a private index
  (`src/policy-engine/direct-check-facts.ts:66-111`),
  runs the engine with the `direct-check` trigger and the optional `--policy` filter (`src/management.ts:291-307`),
  writes events to stdout,
  and returns the engine's exit code (`311-315`).
  `--all` becomes the pathspec `:/` (`234-236`).
- Spec:
  `SPEC.md:1209-1213`.
- Consumers:
  `src/trust/fixture/final-newline-workflow.ts`,
  run by `.github/workflows/final-newline.yml:38-39`;
  agents checking policies without committing.
- Status:
  retained.
- Rust owner:
  `management_check.rs` (proposed).
- Consumer-level test:
  in the standard fixture,
  write a worktree file that violates one policy and differs from its staged copy,
  then run `git cli-git check --policy final-newline -- a.txt`;
  observe one `finding` event on stdout for the worktree bytes,
  exit `0` or `1` by severity,
  and unchanged index and worktree bytes.
- Native state:
  absent.

### Direct fix

- Behavior:
  `runDirectFix` (`src/policy-engine/direct-fix.ts:238-272`) holds the landing lock (`181`),
  snapshots the real index,
  converges patches on private candidate state
  (`src/policy-engine/direct-fix-convergence.ts:103-309`,
  at most 8 changed passes,
  `33`),
  replaces only changed worktree files (`src/policy-engine/direct-fix-install.ts:230-339`),
  verifies that every real index blob is unchanged,
  and emits findings plus one `fix-summary`.
- Spec:
  `SPEC.md:1215-1227`,
  `837`.
- Consumers:
  humans and agents applying fixes;
  the `dependent-version-bump` policy declares the `direct-fix` trigger for this command
  (`src/optional/repository-policy/dependent-version-bump-policy.ts:253-258`).
- Status:
  retained.
- Rust owner:
  `management_fix.rs` (proposed).
- Consumer-level test:
  in the standard fixture,
  stage one version of a file,
  leave a different fixable version in the worktree,
  and run `git cli-git fix -- a.txt` while a concurrent wrapped commit lands;
  observe the fixed worktree bytes,
  a byte-identical real index,
  one `fix-summary` on stdout,
  and exit `0`.
- Native state:
  absent.

## Policy engine

### Registry, order, and triggers

- Behavior:
  `BUILT_IN_POLICIES` (`src/policy-engine/built-ins.ts:21-27`) fixes the built-in order:
  `require-root`,
  `linked-worktree-only`,
  `branch-worktree-only`,
  `add-explicit`,
  `final-newline`.
  `runPolicyEngine` (`src/policy-engine/engine.ts:157-420`) runs built-ins (`279-311`),
  then fixed transforms for the `pre-forward` trigger only (`315-326`),
  then plugin policies in registration order (`354-375`).
  A policy runs only for the triggers it declares (`src/policy-engine/policy-stage.ts:135-137`);
  the trigger set is `pre-forward`,
  `post-commit`,
  `manual-push`,
  `direct-check`,
  and `direct-fix` (`src/api/policy-types.ts:31-36`).
- Spec:
  `SPEC.md:1229-1244`,
  `3992-3999`.
- Consumers:
  every lifecycle.
- Status:
  retained as a fixed typed registry of shipped policies with stable ordering
  (implementation plan lines 103 to 106).
- Rust owner:
  `policy_registry.rs` (proposed).
- Consumer-level test:
  in the standard fixture,
  make one command violate two policies and pass `--cli-git-keep-going`;
  observe the findings in registry order with increasing `sequence`.
- Native state:
  absent.

### Severities, defaults, and unsafe warnings

- Behavior:
  the effective severity is the configured value or the policy default (`src/policy-engine/policy-stage.ts:145`);
  `off` skips the policy (`146-147`).
  A `warn` setting on a policy that is not warn-safe emits a `configuration-warning` event,
  even when the check is clean (`151`,
  `209-214`).
  Defaults:
  `final-newline` is `warn`;
  the other four built-ins are `error`
  (`src/policy-engine/final-newline-policy.ts:88`;
  `src/policy-engine/require-root-policy.ts:24`;
  `src/policy-engine/linked-worktree-policy.ts:21`;
  `src/policy-engine/branch-worktree-policy.ts:21`;
  `src/policy-engine/add-explicit-policy.ts:21`).
  `branch-worktree-only` and `final-newline` are warn-safe.
- Spec:
  `SPEC.md:1352-1366`,
  `4000-4004`.
- Consumers:
  the root configuration sets three severities (`cli-git.config.ts:33-57`).
- Status:
  retained.
  The implementation plan lines 68 to 69 let repository settings disable policies
  or change permitted severities without consent.
- Rust owner:
  `policy_registry.rs` (proposed).
- Consumer-level test:
  in the standard fixture,
  set `add-explicit` to `warn` and run `git add .`;
  observe a `finding` with severity `warn`,
  a `configuration-warning` with code `warn-unsafe`,
  and that Git staged the files.
- Native state:
  absent.

### Stage execution and stopping

- Behavior:
  `runPolicyStage` (`src/policy-engine/policy-stage.ts:103-257`) runs one policy at a time.
  Without `--cli-git-keep-going`,
  the first error finding stops the stage (`223-231`).
  A thrown check emits `plugin-threw` and stops (`162-177`);
  an invalid finding emits `policy-incomplete` and stops (`183-184`,
  `233-248`).
  A proposed patch ends the stage so convergence can restart (`215-222`).
  The direct-check filter and escaped IDs skip policies (`138-141`).
- Spec:
  `SPEC.md:387-398`,
  `1246-1252`.
- Consumers:
  every lifecycle.
- Status:
  retained.
  `plugin-threw` loses its plugin meaning with a fixed registry;
  see "Open questions".
- Rust owner:
  `policy_engine.rs` (proposed).
- Consumer-level test:
  in the standard fixture,
  run a command that violates the first and third policies,
  with and without `--cli-git-keep-going`;
  observe one finding and exit `1` without the flag,
  and both findings and exit `1` with it.
- Native state:
  absent.

### Finding validation

- Behavior:
  `findingsAreValid` (`src/policy-engine/policy-stage.ts:60-71`) requires a non-empty `code` and `message`.
  `createFindingEvent` prefixes the code with the policy ID (`src/policy-engine/events.ts:410`).
- Spec:
  `SPEC.md:562-574`.
  The spec also requires kebab-case codes and an in-range byte location;
  the engine checks neither
  (see "Spec and code disagreements").
- Consumers:
  JSONL consumers.
- Status:
  retained as structured findings from typed policies
  (implementation plan lines 103 to 106).
- Rust owner:
  `policy_findings.rs` (proposed).
- Consumer-level test:
  in the standard fixture,
  trigger a finding that carries a location;
  observe `byteStart` and `byteEnd` inside the candidate's byte length
  and a code of the form `<policy-id>/<code>`.
- Native state:
  absent.

### Patch validation and application

- Behavior:
  `validatePolicyPatch` (`src/policy-engine/commit-transaction-patch.ts:122-209`) accepts one textual unified diff
  for exactly the declared path,
  with one `index` header naming the candidate's blob revision and mode `100644` or `100755` (`62-106`),
  and rejects rename,
  copy,
  mode,
  and binary directives (`21-32`,
  `203-207`) and paths with traversal or line breaks (`134-143`).
  `applyPolicyPatches` (`src/policy-engine/apply-policy-patches.ts:247-342`) applies patches in order
  through `git apply --cached --3way` on the private index
  (`src/policy-engine/commit-transaction-git.ts:248-291`).
  The built-in and optional policies build patches with
  `createFinalNewlinePatch` (`src/policy-engine/final-newline-patch.ts:70-129`)
  and `createFullContentPatch` (`src/optional/markdown-lint/full-content-patch.ts:114-171`).
- Spec:
  `SPEC.md:576-626`.
- Consumers:
  commit transactions and direct fix.
- Status:
  retained.
  The patch is no longer supplied by untrusted plugin code,
  but the candidate edit path stays
  (implementation plan lines 103 to 112).
- Rust owner:
  `policy_patches.rs` (proposed).
- Consumer-level test:
  in the standard fixture,
  commit a file whose fix conflicts with a concurrent edit of the same lines;
  observe exit `2` with `patch-conflict`,
  no patch bytes in the event,
  and unchanged ref,
  index,
  and worktree bytes.
- Native state:
  absent.

### Bounded fix passes

- Behavior:
  `convergeCommitPolicies` (`src/policy-engine/commit-transaction-convergence.ts:110-276`) restarts the whole order
  after each changed candidate state,
  with at most 8 changed passes (`32`).
  Candidate states are serialized to private files and compared byte for byte
  (`src/policy-engine/commit-transaction-candidate-snapshot.ts:82-247`).
  A repeated non-adjacent state is `fix-cycle`;
  a changed last pass is `fix-pass-limit`
  (`src/policy-engine/commit-transaction-results.ts:128-157`,
  `233-248`).
  Direct fix uses the same limit (`src/policy-engine/direct-fix-convergence.ts:33`).
- Spec:
  `SPEC.md:1254-1277`.
- Consumers:
  commit transactions,
  revalidation after replay,
  and direct fix.
- Status:
  retained
  (implementation plan line 106,
  "bounded fixing passes").
- Rust owner:
  `policy_convergence.rs` (proposed).
- Consumer-level test:
  in the standard fixture,
  commit a file that needs two different policy fixes;
  observe one `fix-summary` with `passes` equal to the changed passes,
  the committed bytes fully fixed,
  and no finding for the corrected problems.
- Native state:
  absent.

### JSONL events

- Behavior:
  events are compact JSON objects,
  one per line,
  with `schemaVersion: 1` (`src/policy-engine/events.ts:23`,
  `588-598`).
  Types:
  `finding` (`33`),
  `engine-failure` with 15 codes (`88-103`,
  `113`),
  `commit-landed` (`156`),
  `core-finding` (`195`),
  `configuration-warning` (`250`),
  `fix-summary` (`289`),
  and the concurrency events `landing-race-lost`,
  `landing-reserved`,
  `commit-replayed`,
  and `replay-headers-dropped` (`src/policy-engine/events-concurrency.ts:33-178`).
  `withFixSummary` appends the summary with sorted unique paths (`src/policy-engine/fix-summary.ts:28-100`).
- Spec:
  `SPEC.md:1279-1575`.
- Consumers:
  agents and scripts reading wrapper stderr or management stdout;
  the end-to-end suite checks exit codes against events
  (`e2e/jsonl-event-fixture.ts`).
- Status:
  retained
  (implementation plan lines 107 to 112).
  The trust-only codes `config-untrusted`,
  `config-changed`,
  `trust-consent-unavailable`,
  and `trust-failed` lose their emitters.
- Rust owner:
  `policy_events.rs` (proposed).
- Consumer-level test:
  in the standard fixture,
  drive one event of each retained type and parse stderr line by line;
  observe field sets equal to `SPEC.md:1296-1575`,
  no JSON `null`,
  and LF termination.
- Native state:
  absent.

### Stream routing and exit codes

- Behavior:
  wrapper policy events go to stderr (`src/bin.ts:219-224`,
  `277-280`,
  `336-339`,
  `412-415`,
  `433-438`);
  `check` and `fix` events go to stdout (`src/management.ts:219-224`,
  `261-265`,
  `311-314`).
  When Git does not run,
  exit `0` means clean or warnings only,
  `1` means error findings,
  and `2` means an engine failure (`src/policy-engine/engine.ts:308`,
  `347`,
  `392`,
  `417`).
  A landed commit followed by a blocked post-commit gate exits `2` (`src/bin.ts:416-417`).
- Spec:
  `SPEC.md:1577-1622`.
- Consumers:
  every caller that branches on the exit status or separates Git output from events.
- Status:
  retained
  (implementation plan lines 107 to 112).
- Rust owner:
  `policy_events.rs` and `wrapper_main.rs` (proposed).
- Consumer-level test:
  in the standard fixture,
  capture stdout and stderr separately for a blocked wrapped command and for `git cli-git check`;
  observe events only on stderr for the first and only on stdout for the second,
  with the exit codes of `SPEC.md:1588-1622`.
- Native state:
  absent.

### Candidate facts

- Behavior:
  each lifecycle builds lazy Git facts for the policy context:
  `git add` predicts the staged delta in a private index
  (`src/policy-engine/add-policy-facts.ts:116-261`;
  `src/policy-engine/add-staged-delta.ts:38-216`);
  commit transactions read the private commit index
  (`src/policy-engine/commit-transaction-candidates.ts:316-367`)
  and tracked files (`src/policy-engine/commit-transaction-tracked-files.ts:166-294`);
  post-commit reads the landed commit's delta
  (`src/policy-engine/post-commit-facts.ts:130-198`);
  manual push reads newly published content
  (`src/policy-engine/manual-push-candidates.ts:330-426`);
  direct commands read selected worktree bytes
  (`src/policy-engine/direct-check-facts.ts:66-111`).
  Blob bytes load through one `git cat-file --batch` process (`src/policy-engine/blob-batch.ts:205-270`).
- Spec:
  `SPEC.md:336-385`,
  `597-605`.
- Consumers:
  every content policy.
- Status:
  retained.
  The implementation plan lines 93 to 99 require immutable candidate versions,
  lazy batched Git facts,
  candidate bytes rather than live worktree bytes,
  and no Git process per file.
- Rust owner:
  `candidate_facts.rs` (proposed).
- Consumer-level test:
  in the standard fixture,
  stage clean bytes,
  then write a forbidden string to the worktree copy only,
  and commit the staged path with `--no-only`;
  observe a clean commit,
  and with `strace` a fixed number of Git processes for 1 and for 100 candidate files.
- Native state:
  absent.

### Policy read sets and input fingerprints

- Behavior:
  inside a commit transaction each policy run records what it read:
  the candidate list,
  the paths whose bytes it loaded,
  tracked-file requests,
  and the `headOid`,
  `landedCommitOid`,
  and `pushUpdates` values (`src/policy-engine/policy-read-set.ts:126-159`,
  `400-494`).
  Declared external inputs are fingerprinted:
  worktree pathspecs,
  executables,
  revisions,
  and environment variables
  (`src/policy-engine/policy-input-fingerprint.ts:367-448`;
  `src/policy-engine/policy-input-executable.ts:215-261`).
  After a replay,
  `decideRerun` (`src/policy-engine/policy-read-tracking.ts:253-310`) reuses a recorded run
  when it proposed no patch,
  its inputs hold,
  and its reads replay to the same identities
  (`src/policy-engine/policy-read-validation.ts:254-293`).
  Unrestricted policies always re-run.
- Spec:
  `SPEC.md:400-560`.
- Consumers:
  revalidation after replay.
- Status:
  retained
  (implementation plan lines 215 to 219 list policy read sets;
  lines 143 to 146 require a replay that changes a declared input to invalidate the policy result).
  The authoring-facing `inputs` declaration and its schema
  (`src/trust/policy-inputs-schema.ts:163-330`) retire with the authoring API;
  the shipped policies' declarations become fixed data.
- Rust owner:
  `policy_read_set.rs` and `policy_inputs.rs` (proposed).
- Consumer-level test:
  in the standard fixture,
  force a lost landing race with a disjoint winning commit,
  then with a winning commit that changes the scanner rules file;
  observe through debug logs or a counting scanner fixture that the context-only policy is reused in the first case
  and that the scanner re-runs in the second.
- Native state:
  absent.

### Pre-forward lifecycle

- Behavior:
  `runPreForwardPolicyEngine` (`src/policy-engine/pre-forward-engine.ts:34-77`) strips wrapper controls,
  builds add candidate facts when the command is `git add`,
  and runs the engine.
  A blocking result prevents forwarding (`src/bin.ts:273-286`);
  the transformed arguments replace the raw ones (`291`).
- Spec:
  `SPEC.md:889-899`.
- Consumers:
  every wrapped command that loads configuration and is not a commit transaction.
- Status:
  retained.
- Rust owner:
  `lifecycle_pre_forward.rs` (proposed).
- Consumer-level test:
  in the standard fixture,
  run `git add -- CONTEXT.md` at the repository root;
  observe a `forbidden-root-context` finding on stderr,
  exit `1`,
  and an unchanged index.
- Native state:
  absent.

### Post-commit lifecycle

- Behavior:
  `runPostCommitLifecycle` (`src/policy-engine/post-commit-lifecycle.ts:101-195`) uses the landed commit ID
  passed from the transaction,
  runs `post-commit` policies against the landed delta,
  and on a blocking result appends `commit-landed` with outcome `post-commit-blocked` (`160-171`).
  A setup failure emits `content-unavailable` plus `commit-landed` (`173-194`).
  Only a clean or warning-only result reaches auto-push (`src/bin.ts:416-422`).
- Spec:
  `SPEC.md:1075-1092`,
  `1558-1575`.
- Consumers:
  auto-push,
  which this gate guards.
- Status:
  retained.
- Rust owner:
  `lifecycle_post_commit.rs` (proposed).
- Consumer-level test:
  in the standard fixture,
  land a commit whose content passes pre-forward only because of a one-time escape flag;
  observe the commit present locally,
  the causal finding,
  a final `commit-landed` event,
  exit `2`,
  and no push to the bare remote.
- Native state:
  absent.

### Manual-push lifecycle

- Behavior:
  `runManualPushGate` (`src/policy-engine/manual-push-gate.ts:45-87`) applies to `git push`
  that is not a dry run and has an enabled `manual-push` policy.
  `probeManualPushUpdates` (`src/policy-engine/manual-push-probe.ts:184-208`) runs a private
  `--dry-run` push whose generated `pre-push` hook records Git's update records
  (`src/policy-engine/manual-push-hook.ts:344-405`),
  and validates remote values with `git ls-remote --refs`.
  The published set comes from remote-tracking refs and prior values
  (`src/policy-engine/manual-push-published.ts:105-304`);
  candidates are each newly published commit's delta,
  or the final tree when nothing is known to be published
  (`src/policy-engine/manual-push-descriptors.ts:204-392`;
  `src/policy-engine/manual-push-candidates.ts:330-426`),
  with at most 4 concurrent per-update processes (`37`).
- Spec:
  `SPEC.md:1169-1207`,
  `4020-4041`.
- Consumers:
  `forbidden-strings`,
  `final-newline`,
  and Markdown autofix declare the `manual-push` trigger;
  `perf/manual-push-latency-benchmark.ts` measures it.
- Status:
  retained
  (implementation plan lines 107 to 109 name manual-push checks).
  The generated `pre-push` hook is a Node program today;
  its native form is undetermined
  (see "Open questions").
- Rust owner:
  `lifecycle_manual_push.rs` (proposed).
- Consumer-level test:
  in the standard fixture,
  push a branch whose newest commit adds a forbidden string,
  first to a remote that already has its parent and then to an empty remote;
  observe a blocked push with exit `1` in both cases,
  a scan of only the newest commit's delta in the first,
  and a bounded process count for a 1,000-commit history.
- Native state:
  absent.

## Built-in policies and fixed transforms

### Git command region parsers

- Behavior:
  `parseArgv` (`src/parser/argv.ts:240-415`) is a shared region parser over declared flags and value options.
  `expandAbbreviations` (`src/abbrev.ts:52-114`) lists the unambiguous long-option abbreviations Git accepts.
  Per-command parsers produce the facts the rules use:
  `parseAddRegion` (`src/parser/add.ts:258-313`),
  `parseCommitRegion` (`src/parser/commit.ts:212-291`) with `normaliseCommitArgs`
  (`src/parser/commit-normalise.ts:165-288`),
  `parsePushRegion` (`src/parser/push.ts:64-96`),
  `parseStatusPreRegion` and `parseStatusPostRegion` (`src/parser/status.ts:83-157`),
  `parseStashRegion` (`src/parser/stash.ts:96-128`),
  `parseCleanRegion` (`src/parser/clean.ts:144-232`) with `scanCleanOptionOrder`
  (`src/parser/clean-option-order.ts:430-438`),
  `parseResetRegion` (`src/parser/reset.ts:127-197`),
  and `parseBranchCreationRegion` (`src/parser/branch-create.ts:108-217`).
- Spec:
  `SPEC.md:777-797`;
  `doc/handover/cli-git-cac-migration.md` records why the package owns its parser.
- Consumers:
  every built-in policy and fixed transform,
  the commit transaction,
  and the manual-push gate.
- Status:
  retained.
  The implementation plan lines 47 to 49 require Git-specific token classification
  rather than an unrelated option grammar.
- Rust owner:
  `command_*.rs`,
  one module per command,
  owned by the command-parser delegate.
- Consumer-level test:
  in the standard fixture,
  run each documented abbreviation and clustered short form through the native wrapper and through `/usr/bin/git`
  for the same repository state;
  observe that the wrapper's decision matches what Git then does
  (for example `git commit --am` amends and `git clean --dry` deletes nothing).
- Native state:
  in progress
  (queued delegate;
  no `command_*.rs` file at `40436cd01`).

### require-root

- Behavior:
  `requireRoot` (`src/rule/require-root.ts:130-191`) rejects a command whose effective directory
  is inside a repository but not at its root.
  It exempts `init`,
  `clone`,
  `version`,
  and `help` (`24-29`),
  `config` with `--global`,
  `--system`,
  `--list`,
  or `-l` (`34-39`,
  `159-170`),
  and a directory outside any repository (`175-179`).
  Policy metadata:
  default `error`,
  warn-unsafe,
  triggers `pre-forward` and `direct-check` (`src/policy-engine/require-root-policy.ts:22-31`).
- Spec:
  `SPEC.md:3992-4008`.
- Consumers:
  every wrapped command.
- Status:
  retained
  (implementation plan lines 116 to 120).
- Rust owner:
  `rule_require_root.rs` (proposed).
- Consumer-level test:
  in the standard fixture,
  run `git status` from a subdirectory,
  from the root,
  with `-C <root>`,
  and outside any repository;
  observe exit `1` with a `require-root` finding only in the first case.
- Native state:
  in progress
  (queued rule-core delegate).

### linked-worktree-only

- Behavior:
  `checkLinkedWorktree` (`src/policy-engine/linked-worktree-check.ts:237-308`) rejects every `git stash`,
  `git clean` that is neither a dry run nor interactive,
  and `git reset` with a destructive mode (`138-175`),
  unless the target is a linked worktree or an allowlisted tool cache (`298-307`).
  Messages are in `src/policy-engine/linked-worktree-messages.ts:52-109`.
  Policy metadata:
  default `error`,
  warn-unsafe,
  trigger `pre-forward` (`src/policy-engine/linked-worktree-policy.ts:19-25`).
- Spec:
  `SPEC.md:3992-4008`.
- Consumers:
  agents and humans in the main worktree;
  `e2e/README.md:525-528` records that it blocks lint-staged's `git stash` in a main worktree.
- Status:
  retained
  (implementation plan lines 116 to 120).
- Rust owner:
  `rule_linked_worktree.rs` (proposed).
- Consumer-level test:
  in the standard fixture,
  run `git stash`,
  `git clean -fd`,
  `git clean -nd`,
  and `git reset --hard` in a main worktree and in a linked worktree;
  observe rejection with exit `1` only for the three destructive forms in the main worktree.
- Native state:
  in progress
  (queued rule-core delegate).

### Allowed worktree directories

- Behavior:
  `classifyEffectiveTarget` (`src/effective-target.ts:62-86`) returns `allowlisted`
  when the repository's Git directory lies under a baked-in tool cache.
  The only entry is uv's cache:
  `UV_CACHE_DIR`,
  or `XDG_CACHE_HOME/uv`,
  or `<home>/.cache/uv` (`src/allowed-worktree-dirs.ts:60-102`).
  Membership resolves each root through `realpath` and tests segment-aware containment (`144-164`,
  `247-281`).
- Spec:
  no `SPEC.md` section states it.
- Consumers:
  uv,
  whose internal `git reset --hard` in its cache would otherwise be rejected (`src/allowed-worktree-dirs.ts:43-48`).
- Status:
  retained.
  The implementation plan does not name it;
  it is part of the linked-worktree policy's accepted behavior.
- Rust owner:
  `allowed_worktree_directories.rs` (proposed).
- Consumer-level test:
  in the standard fixture,
  create a repository under a disposable `UV_CACHE_DIR` and one beside it with the same prefix,
  then run `git reset --hard` in each;
  observe success in the first and rejection in the second.
- Native state:
  absent.

### branch-worktree-only

- Behavior:
  `checkBranchWorktree` (`src/policy-engine/branch-worktree-check.ts:101-188`) rejects branch creation
  in the current worktree:
  explicit forms of `branch`,
  `checkout`,
  and `switch` (`145-146`),
  and the remote-tracking guess of `git switch <name>` and `git checkout <name>`,
  probed against real Git (`src/policy-engine/branch-worktree-remote-guess.ts:158-227`).
  Policy metadata:
  default `error`,
  warn-safe,
  trigger `pre-forward` (`src/policy-engine/branch-worktree-policy.ts:19-25`).
- Spec:
  `SPEC.md:3992-4008`.
- Consumers:
  agents and humans;
  the status note names the allowed form `git worktree add -b` (`src/post-command-output.ts:96-101`).
- Status:
  retained
  (implementation plan lines 116 to 120).
- Rust owner:
  `rule_branch_worktree.rs` (proposed).
- Consumer-level test:
  in the standard fixture with one remote branch `topic` and no local one,
  run `git switch -c x`,
  `git switch topic`,
  `git branch --list`,
  and `git worktree add -b y ../y`;
  observe rejection of the first two only.
- Native state:
  in progress
  (queued rule-core delegate).

### add-explicit

- Behavior:
  `checkAddExplicit` (`src/policy-engine/add-explicit-check.ts:77-137`) rejects `git add`
  with the bulk tokens `.`,
  `*`,
  `-A`,
  or `-u` (`src/parser/add.ts:23-41`),
  naming the matched tokens (`src/policy-engine/add-explicit-check.ts:121-133`).
  Policy metadata:
  default `error`,
  warn-unsafe,
  trigger `pre-forward` (`src/policy-engine/add-explicit-policy.ts:19-25`).
- Spec:
  `SPEC.md:3992-4008`.
- Consumers:
  agents and humans;
  `AGENTS.md:1338` (rule CLG).
- Status:
  retained
  (implementation plan lines 116 to 120).
- Rust owner:
  `rule_add_explicit.rs` (proposed).
- Consumer-level test:
  in the standard fixture,
  run `git add .`,
  `git add -A`,
  `git add --pathspec-from-file -A` with a pathspec file named `-A`,
  and `git add -- a.txt`;
  observe rejection of the first two and staging by the last two.
- Native state:
  in progress
  (queued rule-core delegate).

### final-newline

- Behavior:
  `finalNewlinePolicy` (`src/policy-engine/final-newline-policy.ts:86-119`) checks each regular or executable candidate.
  `normalizeFinalNewline` (`src/policy-engine/final-newline-normalize.ts:108-133`) leaves empty,
  NUL-containing,
  and non-UTF-8 bytes unchanged,
  and otherwise requires exactly one terminal LF.
  `isFinalNewlineExcluded` (`72-93`) preserves five path families.
  Where patches apply,
  the finding carries a patch (`src/policy-engine/final-newline-policy.ts:60-74`).
  Policy metadata:
  default `warn`,
  warn-safe,
  all five triggers,
  no external inputs (`86-98`).
- Spec:
  `SPEC.md:4061-4087`.
- Consumers:
  every commit in this repository;
  `.github/workflows/final-newline.yml`.
- Status:
  retained
  (implementation plan lines 116 to 120).
- Rust owner:
  `rule_final_newline.rs` (proposed).
- Consumer-level test:
  in the standard fixture,
  commit a text file without a terminal LF,
  one with three,
  a CRLF file,
  a binary file,
  an empty file,
  and a file under `x/dist/final/node/`;
  observe exact committed bytes:
  the first three end in one LF with interior bytes untouched,
  and the others are unchanged.
- Native state:
  in progress
  (queued rule-core delegate).

### atomic-push transform

- Behavior:
  `atomicPush` (`src/rule/atomic-push.ts:48-89`) inserts `--atomic` after `push`
  unless the caller passed `--atomic` or `--no-atomic`.
- Spec:
  `SPEC.md:1242-1244`.
- Consumers:
  every wrapped `git push`.
- Status:
  retained
  (implementation plan lines 121 to 123).
- Rust owner:
  `rule_atomic_push.rs` (proposed).
- Consumer-level test:
  in the standard fixture with a remote hook that rejects one of two refs,
  run `git push origin a b` and `git push --no-atomic origin a b`;
  observe that the remote takes neither ref in the first case and one in the second.
- Native state:
  in progress
  (queued rule-core delegate).

### commit-only transform

- Behavior:
  `commitOnly` (`src/rule/commit-only.ts:222-418`) inserts `-o` after `commit`.
  It rejects `-a` or `--all` (`all-flag`,
  `302-306`),
  a pathless commit outside a merge,
  cherry-pick,
  or revert conclusion (`pathspec-required`,
  `319-343`),
  and a pathless `--amend` or `--allow-empty` while the index differs from `HEAD`
  (`staged-changes-ignored`,
  `363-393`).
  It skips insertion for an explicit `-o`,
  `--only`,
  or `--no-only` (`346-349`),
  for include,
  interactive,
  or patch selection (`351-357`),
  and for `--no-enforce-only` (`284-299`).
  The checks query real Git (`src/rule/commit-index-check.ts:65-110`;
  `src/rule/commit-sequencer-check.ts:108-176`).
  Rejections are `core-finding` events (`src/policy-engine/fixed-transforms.ts:123-133`).
- Spec:
  `SPEC.md:1368-1396`,
  `2516-2529`.
- Consumers:
  every wrapped `git commit`;
  `AGENTS.md:1338` (rule CLG) and rule CPN.
- Status:
  retained
  (implementation plan lines 121 to 123).
- Rust owner:
  `rule_commit_only.rs` (proposed).
- Consumer-level test:
  in the standard fixture,
  stage `b.txt`,
  then run `git commit -m x -- a.txt`,
  `git commit -m x`,
  `git commit -a -m x`,
  and `git commit --amend --no-edit`;
  observe that the first commits only `a.txt` and leaves `b.txt` staged,
  and that the other three exit `1` with the three `commit-only/*` codes.
- Native state:
  in progress
  (queued rule-core delegate).

### status-hints-off transform

- Behavior:
  `statusHintsOff` (`src/rule/status-hints-off.ts:105-137`) inserts `-c advice.statusHints=false`
  before `status` unless the caller set that key with a global `-c` (`56-71`).
- Spec:
  `SPEC.md:1242-1244`.
- Consumers:
  every wrapped `git status`.
- Status:
  retained
  (implementation plan lines 121 to 123).
- Rust owner:
  `rule_status_hints.rs` (proposed).
- Consumer-level test:
  in the standard fixture with one unstaged change,
  run `git status` and `git -c advice.statusHints=true status`;
  observe Git's `use "git add"` hint only in the second.
- Native state:
  in progress
  (queued rule-core delegate).

## Optional policies

### forbidden-strings

- Behavior:
  `forbiddenStringsPolicy` (`src/optional/forbidden-strings/index.ts:112-156`,
  canonical source `package/git-policy/forbidden-strings/src/index.ts`) scans candidate bytes.
  `materializeCandidates` writes candidate bytes to temporary files with at most 64 concurrent lanes
  (`src/optional/forbidden-strings/materialize-candidates.ts:21`,
  `97-236`);
  `scanCandidates` starts the scanner executable with an argument array
  (`src/optional/forbidden-strings/scan-candidates.ts:273-387`);
  `parseScannerOutput` turns exit `1` output into redacted findings
  (`src/optional/forbidden-strings/scanner-output.ts:323-361`).
  Options:
  `executable` (default `forbidden-strings`) and `builtinRules` (default `true`)
  (`src/optional/forbidden-strings/index.ts:40-49`).
  Declared inputs:
  the executable,
  `FORBIDDEN_STRINGS_RULES`,
  and the rules file (`78-101`).
  Policy metadata:
  default `error`,
  warn-unsafe,
  triggers `pre-forward`,
  `post-commit`,
  `manual-push`,
  and `direct-check` (`116-124`).
- Spec:
  `SPEC.md:4016-4059`.
- Consumers:
  the root configuration (`cli-git.config.ts:45-57`),
  which points `executable` at the Rust scanner under `package/cli/forbidden-strings/target/release/`;
  root `mise.toml:1321-1327` sets `FORBIDDEN_STRINGS_RULES`;
  `.github/workflows/forbidden-strings.yml` runs the standalone scanner independently.
- Status:
  retained
  (implementation plan lines 124 and 128 to 152).
  The scanner is linked in-process through its library interface;
  the temporary content files,
  the scanner child process,
  and stderr parsing are removed (lines 148 to 152).
  The `executable` option retires:
  the rewrite scope lines 126 to 131 forbid arbitrary program selection through JSONC.
- Rust owner:
  `policy_forbidden_strings.rs` (proposed),
  over the `Scanner` interface in `package/cli/forbidden-strings/src`.
- Consumer-level test:
  in the standard fixture,
  commit a file with a planted built-in-rule match and a clean control,
  with a different string in the worktree copy than in the staged copy;
  observe exit `1`,
  a redacted finding for the staged bytes only,
  no matched bytes in any output,
  and with `strace` no scanner child process and no temporary content file.
- Native state:
  absent in the wrapper.
  The scanner's embedding interface is implemented and verified
  (`doc/handover/scanner-native-verification.md`).

### forbidden-root-context

- Behavior:
  `forbiddenRootContext` (`src/optional/repository-policy/index.ts:114-148`,
  canonical source `package/git-policy/repository/src/index.ts`) reports a non-deleted candidate
  at exactly `CONTEXT.md` (`97-103`).
  Policy metadata:
  default `error`,
  warn-safe,
  triggers `pre-forward` and `direct-check`,
  no external inputs (`115-123`).
- Spec:
  `SPEC.md:4010-4014`.
- Consumers:
  the root configuration (`cli-git.config.ts:44`);
  `AGENTS.md` rule SK3 states the no-context-file convention it enforces.
- Status:
  retained
  (implementation plan line 125).
- Rust owner:
  `policy_forbidden_root_context.rs` (proposed).
- Consumer-level test:
  in the standard fixture,
  commit a new root `CONTEXT.md`,
  a nested `a/CONTEXT.md`,
  and a deletion of a root `CONTEXT.md`;
  observe rejection of the first only.
- Native state:
  absent.

### Dependent-version propagation

- Behavior:
  `dependentVersionBump` (`src/optional/repository-policy/dependent-version-bump-policy.ts:247-271`,
  canonical source `package/git-policy/repository/src`) runs for commits that modify a workspace manifest
  (`179-191`).
  It plans patch-level bumps for publishable dependents
  (`src/optional/repository-policy/dependent-bump-workflow.ts:297-391`;
  `src/optional/repository-policy/dependent-version-bump.ts:153-353`),
  reading manifests through `trackedFiles`,
  publishable names from `package/config/pnpr/config.yaml`
  (`src/optional/repository-policy/publishable-names.ts:11`,
  `39-82`),
  and source imports (`src/optional/repository-policy/source-imports.ts:39-267`).
  Each stale dependent is a finding with a full-content patch for a tracked file that is not a candidate,
  so the fix adds the path to the commit
  (`src/optional/repository-policy/dependent-version-bump-policy.ts:204-226`).
  Policy metadata:
  default `error`,
  warn-unsafe,
  triggers `pre-forward`,
  `direct-check`,
  and `direct-fix` (`247-258`).
  The root configuration does not list it,
  so it runs at its default severity.
- Spec:
  `SPEC.md:531-532`,
  `607-623`,
  `2531-2559`;
  `doc/planning/cli-git-policy-added-paths.md`.
- Consumers:
  every commit that bumps a workspace package version.
  The standalone task `//package/git-policy/repository:bump:dependents`,
  called by the root `changeset:version` task (`mise.toml:1193-1197`),
  shares the planning code (`package/git-policy/repository/src/bump-dependents-worktree.ts`).
- Status:
  retained
  (implementation plan line 125).
- Rust owner:
  `policy_dependent_version.rs` (proposed).
- Consumer-level test:
  in the standard fixture with three workspace manifests where `b` depends on `a`,
  bump `a` and commit only `a`'s manifest;
  observe that the landed commit also bumps `b`,
  that `b`'s worktree and index entries match the commit,
  and that a dirty `b` manifest instead yields `patch-conflict` with exit `2`.
- Native state:
  absent.

### Markdown autofix

- Behavior:
  `markdownLintPolicy` (`src/optional/markdown-lint/index.ts:93-141`,
  canonical source `package/git-policy/markdown-lint/src`) sends each Markdown candidate
  through the configured command in stdin fix mode
  (`src/optional/markdown-lint/rewrite-candidates.ts:594-632`),
  reports `markdown-autofix` with a full-content patch or `markdown-violation` (`34-39`),
  and treats exit `2` or any other status as a failure.
  Options:
  `command` (default `node package/cli/markdown-lint/src/cli.ts`),
  `rules` (default `lfs-image-url`),
  and `exclude` (`src/optional/markdown-lint/index.ts:46-81`).
  Policy metadata:
  default `warn`,
  warn-safe,
  all five triggers,
  unrestricted inputs (`97-109`).
- Spec:
  `SPEC.md:547-552`.
- Consumers:
  the root configuration (`cli-git.config.ts:33-43`),
  which runs only `lfs-image-url` and excludes `package/ssg/`.
- Status:
  retained as current commit-time Markdown normalization
  (implementation plan line 126).
  Lines 181 to 189 replace the configured command with the coordinated installation's native linter,
  called with `--config`,
  `--stdin`,
  `--stdin-filename`,
  and `--fix`;
  repository JSONC cannot choose the executable.
  The `command` option retires
  (rewrite scope lines 126 to 131).
- Rust owner:
  `policy_markdown.rs` (proposed),
  calling the binary of `package/linter/monochromatic-lint`.
- Consumer-level test:
  in the standard fixture with `.lfsconfig` and an LFS-tracked image,
  commit a Markdown file that links the image,
  including an astral-character and a BOM variant;
  observe the landed bytes with the rewritten object URL,
  one `fix-summary`,
  and an untouched file under an excluded path.
- Native state:
  absent in the wrapper.
  The linter rule port is pending:
  the handover work queue lists native LFS URL normalization as open.
