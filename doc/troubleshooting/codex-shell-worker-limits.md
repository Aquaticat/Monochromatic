# Codex Bash hook resource limits

## Scope and environment

Observed on Linux with cgroup v2,
`codex-cli 0.162.1`,
and nextest `0.9.148`.
The local implementation is
[`package/codex-plugin/bash-limit`](../../package/codex-plugin/bash-limit/README.md).
The [decision record](../decision/codex-shell-worker-limits.md) owns the accepted budgets and measurements.

## Native hook boundary

Codex maps `exec_command` to a Bash `PreToolUse` event with `tool_input.command`.
The handler consumes `updatedInput.command` by replacing the original call's command field.
Other execution settings continue through the normal handler.
Source inspected:
`codex-rs/core/src/tools/handlers/unified_exec/exec_command.rs`,
functions `pre_tool_use_payload` and `with_updated_hook_input`.

The [official hook documentation](https://learn.chatgpt.com/docs/hooks)
describes command rewrites,
blocking exit status 2,
and exact-definition trust.
The host fixture in `tests/native_host.rs` independently exercises this boundary.

Working cases include shell quotes,
backslashes,
command-substitution text inside quoted literals,
heredocs,
functions,
empty commands,
and explicit exit statuses.
The rewritten command preserves its original suffix exactly.

Malformed events,
missing commands,
changed memory or task budgets,
unbounded CPU quotas,
and absent membership files all produce blocking hook failures.
The shell itself exits with status 70 if attachment fails after hook validation.
The guard test includes a successful payload as a positive control.
Removing the guard in a throwaway worktree made that test fail.

## Hook arguments belong in the command string

A hook definition containing separate `command` and `args` properties launched the binary without its arguments.
The binary emitted:

```text
# codex-bash-limit stderr, surfaced by Codex as a blocked hook
Codex worker limits: Expected --hook or --initialize followed by the worker slice path.
```

The `args` field inspected in Codex's hook engine describes its internal shell launch.
It is not a command-hook configuration field.
The working definition puts the binary,
mode,
and parent path in the `command` string,
with POSIX shell quoting applied to each filename.
JSON serialization then encodes that complete command string.
The native host fixture uses a path containing spaces and apostrophes to exercise both boundaries.

## Joining the cgroup from the sandbox

Launching `systemd-run --user` inside the default Codex sandbox failed because the user bus was inaccessible.
The working shell prefix writes its own PID directly to the already-created child cgroup's `cgroup.procs`.
Session initialization happens outside the tool sandbox and creates the child first.
No daemon call occurs for each command.

Adding only `cgroup.procs` to `sandbox_workspace_write.writable_roots` failed:
Codex's bubblewrap setup attempted to create a `.git` entry under that file path.
Granting the child cgroup directory as the writable root allowed the sandboxed shell to join it.
The parent directory stays read-only inside the sandbox,
so the command cannot change the parent budgets through this grant.

A disposable native sandbox probe joined a separately bounded slice and read its parent controls:
4 GiB memory,
zero swap,
200% CPU,
and 256 tasks.
The ordinary native tests use files shaped like these controls;
they do not claim to test kernel enforcement.

## Startup overhead

The discarded Node implementation measured 62.26 ms median across 30 process launches.
Its shell-only control measured 2.40 ms median.
The user required a native implementation without a recurring 30 ms startup penalty.

The Rust host fixture measured 2 to 4 ms per hook in two runs of 40 commands,
with a 3 ms median in each run.
These numbers include Codex's reported hook execution duration.
They do not promise a maximum under arbitrary host scheduling or load.

## Nextest concurrency options

Nextest emitted:

```text
# cargo nextest run stderr
error: the argument '--test-threads <N>' cannot be used multiple times
```

The installed `cargo nextest run --help` identifies `--jobs` as an alias for `--test-threads`.
Compilation concurrency has a separate `--build-jobs` flag.
The accepted package task supplies neither override and uses nextest defaults.
The worker cgroup independently bounds aggregate resource use.

## Reproduction and verification

```sh
# Repository root
mise run //package/codex-plugin/bash-limit:build
mise run //package/codex-plugin/bash-limit:test
mise run //package/codex-plugin/bash-limit:test:host
mise run //package/codex-plugin/bash-limit:lint:types
```

The host fixture creates a private Codex home,
records stderr there,
and uses a local deterministic provider.
Its recursion guard prevents a host-launched process from launching another fixture.
Nextest terminates a stalled test after its configured timeout.
Successful runs close the host and remove their fixture.

## Upstream filing decision

1.  Upstream fault:
    the failures came from local configuration assumptions and the sandbox's intended access boundary.
2.  Fixability:
    the supported command field and directory grant solve the required behavior locally.
3.  Supported use:
    native Bash rewrites and explicit hook trust are documented and covered by the host fixture.
4.  Contribution policy:
    no upstream contribution is proposed;
    the repository's Codex integration exclusion was overridden only for this requested local implementation.
5.  Maintainer intent:
    not evaluated because no upstream defect is being claimed.
6.  Prototype:
    the Rust hook and native integration fixtures provide the local implementation and evidence.

Nothing to file upstream.
