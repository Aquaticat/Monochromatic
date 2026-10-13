# Automatic resource limits for Codex shell commands

Status:
 accepted by the user's implementation request on 2026-10-13.

## Purpose

Apply the existing worker budget automatically before Codex executes a shell command.
The user requested this before continuing the Pi migration because repeating a systemd launcher
in every tool call wastes context.
This request authorizes this focused exception to the general Codex integration exclusion.

## Implementation

The maintained hook is
[`codex-worker-hook.ts`](../../package/dev-script/task-util/src/codex-worker-hook.ts).
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
The persistent hook installation and native host verification are pending.
