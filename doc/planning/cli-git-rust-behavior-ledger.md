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
