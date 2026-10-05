# cli-git native foundation

## Authority and scope

This records a scoped delegation of the Rust cli-git rewrite:
configuration,
real-Git resolution and forwarding,
the thin executable,
diagnostics and the management-command skeleton,
a mutation runner,
and a fuzz sidecar.
The accepted approach is
[`cli-git-rust-implementation.md`](../planning/cli-git-rust-implementation.md);
the behavior inventory is
[`cli-git-rust-behavior-ledger.md`](../planning/cli-git-rust-behavior-ledger.md).
Transactions,
hooks,
locks,
replay,
recovery,
worktree copy,
auto-push,
the Git command parser,
and the policy rule cores are outside this delegation.

The native executable is a development artifact.
It is not installed,
does not shadow `git`,
and stops every repository-changing command.
Nothing here brings the wrapper close to cutover.

## Gate results

The gate is `mise run //package/git-policy/cli:native:test:container`:
a mount-free,
network-disabled container bounded to 2 GiB,
2 CPUs,
and 128 PIDs,
built on the audited Git 2.56.0 image
`6ec87f6d290a2f59bda5b3ffd4197058fe0749d02b4978c877e8edf6dc38802a`.
It runs `cargo test --offline --locked --all-targets`,
then Clippy with warnings denied.

### Slice 1, configuration

Commit `df25471a9`.
The gate passed 51 unit tests and Clippy before the commit
(9 tests existed before this delegation).
The run's evidence directory was not retained by name;
the later slice 2 run covers the same sources.

### Registry default correction

Commit `72056d25d`.
Verified together with slice 2 in the run recorded there;
it was not gated alone.

### Slice 2, real Git and forwarding

Commit `414ab5ff7`.
The gate passed 114 unit tests,
16 binary-level tests,
and Clippy.
Test image
`606ad8d2e58639ca1729aa18cdc5f77223d389eb1f4150b87620e27f3a4d9d77`;
evidence `package/git-policy/cli/target/verification/native-SyV2Pq`.

## Configuration

### Shape

`cli-git.config.jsonc` at the worktree top level is one JSONC object.
It is read through `package/rust-module/jsonc-edit`
and is the closest direct translation of the TypeScript `policies` map without plugins and trust.

```jsonc
// cli-git.config.jsonc
{
  "policies": {
    "markdown/autofix": ["warn", { "rules": ["lfs-image-url"], "exclude": ["package/ssg/"] }],
    "mono/forbidden-root-context": "error",
    "security/forbidden-strings": ["error", { "builtinRules": true }],
  },
  "hooks": { "concurrentCommits": false },
  "indexLock": { "unprovenOwnerTimeoutMs": 1000 },
  "landing": { "reserveAfterLostRaces": 1 },
}
```

The `policies` block shown is the direct translation of this repository's `cli-git.config.ts`.
The three concurrency sections show their defaults and may be omitted.
`config_parse_tests.rs` loads that `policies` block
and asserts that `mono/dependent-version-bump` stays at `error` without being listed.

A setting is a severity (`"off"`,
`"warn"`,
`"error"`)
or `[severity, options]` for the two policies that have options.
Unknown keys,
unknown policy IDs,
keys defined twice (also through JSON escapes),
`null`,
and wrong types are errors naming the key path,
for example `policies.markdown/autofix[1].rules[0]`.
The retired keys `plugins`,
`trust`,
`executable`,
and `command` get their own explanation.
Nothing in the file is executed,
imported,
or resolved as a program path.

### Registry

`policy_registry.rs` holds the shipped policies in execution order:
`require-root`,
`linked-worktree-only`,
`branch-worktree-only`,
`add-explicit`,
`final-newline`,
`markdown/autofix`,
`mono/forbidden-root-context`,
`mono/dependent-version-bump`,
`security/forbidden-strings`.
Each default severity equals the incumbent definition's `defaultSeverity`,
pinned by `every_identity_resolves_to_its_declared_row`:
`final-newline` and `markdown/autofix` are `warn`,
every other policy is `error`.

### Choices open to veto

#### Policy names

The four formerly plugin-provided policies keep this repository's namespaced IDs
(`markdown/`,
`mono/`,
`security/`).
Those are the IDs in today's `policies` map and in emitted JSONL `policyId` fields.
Alternatives are the plugin package names (`markdown-lint/autofix`,
`repository/...`,
`forbidden-strings/forbidden-strings`)
or flat names.

#### Defaults with and without a configuration file

A repository that has `cli-git.config.jsonc` runs every shipped policy at its incumbent default
unless the file says otherwise;
`"off"` is the way to stop one.
A repository without the file runs the five built-ins only
(`CliGitConfig::unconfigured()`),
because the incumbent ran the other four only where a configuration registered their plugin.
Consequence:
an empty `{}` file enables four more policies than no file.
The alternative,
running all nine policies in every repository on the machine,
would add scanning,
Markdown rewriting,
root `CONTEXT.md` rejection,
and dependent-version propagation to repositories that have never configured cli-git.

#### Options

`security/forbidden-strings` keeps `builtinRules`.
`markdown/autofix` keeps `rules` and `exclude`.
`rules` accepts only `lfs-image-url`,
must not be empty,
and must not repeat a rule.
A bare severity on an option-bearing policy uses default options;
the incumbent required an options object there.
Whether `FORBIDDEN_STRINGS_RULES` stays the way to name the rules file is not decided here.

#### Configuration root

The root is what `git rev-parse --show-toplevel` reports under the caller's global options.
For a linked worktree that is the linked worktree's own top level,
as with the incumbent.
Unlike the incumbent it honors `--git-dir`,
`--work-tree`,
and their environment forms,
which matches `SPEC.md` ("canonical real-Git toplevel").
A bare repository,
the inside of `.git`,
and a non-repository read no file and use the unconfigured defaults.

#### Legacy files

`cli-git.config.mjs` or `cli-git.config.ts` without a JSONC file is a migration error.
Beside a JSONC file,
the JSONC file is authoritative and each legacy file is reported on every configuration-loading command.
This lets both wrappers keep their configuration during the rollback window.
The stricter alternative is to reject any legacy file.

#### File handling

The file must be a regular file,
not a symbolic link,
at most 1 MiB,
and UTF-8.
A leading byte order mark is accepted.
`$schema` is rejected like any other unknown key.

## Real Git and forwarding

### Resolution and self-exclusion

`real_git.rs` builds candidates from `PATH`
(and `PATHEXT` on Windows),
promotes conventional locations that `PATH` exposes,
and selects the first candidate `real_git_candidate.rs` classifies as real Git.
A candidate is a wrapper when it is this executable by device and inode or canonical path,
when it has the same length and bytes as this executable,
or when it is a script carrying a TypeScript-wrapper marker.
The incumbent rule that every ELF,
PE,
or Mach-O file is real Git is not inherited without those checks.

`binary_resolution_tests.rs` starts the built executable through a `git`-named symbolic link,
a chained link,
a hard link,
copies earlier and later on `PATH`,
and a linked directory,
with repeated and relative `PATH` entries,
and observes real Git's output each time.
Real Git sits at a non-conventional location in those fixtures,
because a conventional location is promoted first and would hide whether earlier entries were skipped.
`time_bound_detects_a_forwarding_loop` is the positive control:
a self-executing `git` is killed at the time bound.

### Forward-target marker, open to veto

A different wrapper build cannot be recognized by identity or content.
Every real-Git child therefore receives `CLI_GIT_NATIVE_FORWARD_TARGET` naming the selected executable.
A wrapper that finds its own executable named there stops with exit status 2.
The variable is inherited by hooks and every Git child;
a hook-started wrapper sees real Git's path there,
which never matches it.
Limitation:
a different wrapper build ahead of a non-conventional real Git stops every command instead of reaching Git.
The byte-identical copy check is also beyond the stated minimum and is open to veto.

### Forwarding

Commands that need no policy configuration replace the wrapper process with real Git (`exec`) on Unix.
The caller then observes Git's own process:
argument bytes,
streams,
exit status,
and signals.
`binary_forwarding_tests.rs` compares the wrapper with `/usr/bin/git` byte for byte
for non-UTF-8 arguments and paths,
standard input,
binary output,
exit statuses 0,
1,
128,
and 129,
and observes that the wrapper's process ID becomes Git before `SIGTERM`,
`SIGINT`,
and `SIGHUP` end it.

`run_real_git` is the second form,
for callers that must act after Git returns.
It waits for a child with inherited streams and reports `128 + signal` for a signaled child,
which is Git's own `run-command.c` convention;
the ledger lists the incumbent's exit status 1 as a defect.
It installs no signal handler,
as the incumbent did not:
a signal sent to the wrapper alone does not reach Git in that form.
No third-party crate was needed.

### Child environment

`child_environment.rs` appends `core.lockfilePid=true` through the numbered `GIT_CONFIG_*` variables.
`GIT_CONFIG_COUNT` is parsed as Git 2.56.0 `config.c` does (`strtoul`,
then the `*endp` and `INT_MAX` checks),
verified against real Git for accepted and rejected spellings.
The incumbent accepted digits only,
so a count such as `" 2"` lost the injection.

### Worktree identity

`worktree_identity.rs` runs one query,
`git <global options> rev-parse --path-format=absolute --is-bare-repository --git-dir --git-common-dir --show-toplevel`.
Git applies `-C` chains through symbolic links itself;
the incumbent's lexical `-C` resolution is not ported.
Output with a line count other than the expected one is rejected,
so a path containing a line feed fails closed instead of being misparsed.

## What the executable does today

`entry.rs` decides;
`main.rs` only collects arguments and environment.

- A wrapper named by the forward-target marker stops.
- Real Git is resolved;
  failure exits 2 with the resolver's counts.
  The incumbent exited 1 there;
  2 follows the stream and exit contract for a wrapper failure and is open to veto.
- Inspection commands,
  native queries,
  option errors,
  and a bare `git` are forwarded without reading configuration.
- Every other command resolves the worktree,
  loads and validates configuration,
  and stops with exit 2 and a notice that policy execution is not implemented.
  Forwarding it unguarded would drop enforcement silently.

## Not ported

- Startup transaction recovery,
  which the incumbent runs before almost every command including `status`.
- The built-in policies and fixed transforms the incumbent runs on inspection commands without configuration,
  for example `require-root` and the status-hints transform.
- Post-command output:
  the version banner and the status note.
  Both need the waiting form of forwarding.
  The banner lists behaviors this executable does not implement.
- Index-writer coordination and worktree copy around forwarding.
- Alias resolution (`src/forwarded-command.ts`) and the built-in command table.
- Generic `--no-enforce-<policy-id>` controls (`src/policy-engine/controls.ts`).
  `escape_hatch.rs` ports only the per-command stripping of one token.
- Windows and macOS behavior is written but not run:
  only Linux is verified.
  Executable detection uses mode bits,
  not `access(2)`.

## Cutover items

- `package/git/executable/src/self-shim.ts` treats every native executable as real Git,
  so the TypeScript resolver would select the native wrapper.
  It needs native-wrapper recognition at cutover;
  this delegation does not edit TypeScript.
- The Cargo binary is named `cli-git-native`,
  not `git`,
  so a `target` directory on `PATH` cannot shadow Git.
  Installation wiring gives it the `git` name.
- The root `cli-git.config.jsonc` translation is shown under "Shape" and is not created here.

## Next action

Slice 3:
JSONL diagnostics and the management-command skeleton.
