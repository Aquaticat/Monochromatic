# Automatic resource limits for Codex shell commands

Status:
 accepted by the user's implementation request on 2026-10-13.

## Purpose

Apply the existing worker budget automatically before Codex executes a shell command.
The user requested this before continuing the Pi migration because repeating a systemd launcher
in every tool call wastes context.
This request authorizes this focused exception to the general Codex integration exclusion.

## Implementation

The maintained hook is the Rust `codex-bash-limit` binary in
[`codex-plugin/bash-limit`](../../package/codex-plugin/bash-limit/src/main.rs).
Codex's native Bash `PreToolUse` hook adds a cgroup membership write before the original command.
The command cannot continue when attachment fails.
The hook retains native sandbox and approval handling.

The shared `piwork3285273.slice` has these aggregate limits:

- Memory: 4 GiB.
- Swap: zero.
- CPU quota: 200%, with explicit user authorization to increase only this limit if needed.
- Tasks: 256.

Only the slice's `codex` child is writable inside the sandbox.
The parent budget remains read-only.
Codex itself remains outside the worker cgroup.
Child processes inherit their shell's membership.

The installed user systemd slice must persist across reboots.
The hook starts that slice if absent and verifies its limits before permitting a command.
The exact installed hook definition receives Codex's normal persisted trust entry;
global hook-trust bypass is unnecessary.

## Evidence

The installed CLI is `codex-cli 0.162.1`.
Its source maps `exec_command` to the native Bash hook,
then changes only the command string when consuming `updatedInput`.
The [official hooks documentation](https://learn.chatgpt.com/docs/hooks)
documents this rewrite contract and persisted hook trust.

The user's Claude settings contain `CLAUDE_CODE_TOOL_MEMORY_LIMIT=8000000000`.
The running `claude-code-bash` cgroup reports that memory limit.
This is precedent for applying limits at the shell boundary;
it does not change the separately authorized Pi worker memory budget.

A disposable Codex sandbox successfully joined a separate test slice's child and reported
`memory.max=4294967296`,
`memory.swap.max=0`,
`cpu.max=200000 100000`,
and `pids.max=256` from its parent.
The initial TypeScript implementation was rejected after 30 unchanged-input measurements:
62.26 ms median,
67.51 ms at the 95th percentile,
and 167.34 ms maximum.
The shell-only control measured 2.40 ms median.
The measurement includes process startup and hook execution;
it does not isolate TypeScript processing from Node startup.

The user requires per-command hook overhead below 30 ms and requested a Rust implementation.
The suggested `jq` shortcut was unnecessary and was never installed as a hook.
The Rust helper uses `serde_json` directly.
Measure native host dispatch as well as standalone helper execution before claiming the latency target.
Persistent hook installation and native host verification are pending.

## Package and test ownership

The user specified `package/codex-plugin/bash-limit` on 2026-10-13.
This is a standalone Rust crate.
Rust integration tests run through nextest;
TypeScript does not test this crate.
The earlier mixed-language placement in `task-util` was rejected and removed.
Native fixture migration and verification are pending.
