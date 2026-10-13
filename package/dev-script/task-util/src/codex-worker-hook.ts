#!/usr/bin/env node

/**
 Attach Codex shell commands to the user's shared worker resource budget.

 @module
 */
import { execFileSync, } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, } from 'node:fs';

//region Worker membership: parent limits stay outside the writable child

/** Persisted systemd slice shared with the current Pi migration workers. */
const workerSlice = 'piwork3285273.slice';

/** Invalid hook input or missing limits must prevent the pending command. */
class WorkerLimitError extends Error {}

/**
 Resolve and verify the actual cgroup before emitting a shell attachment.

 @returns writable worker membership path beneath the protected budget

 @throws {@link WorkerLimitError} when the expected resource controls are absent
 */
function workerMembership(): string {
  /** Linux user delegation identifies the cgroup without a home-directory assumption. */
  const uid = process.getuid?.();
  if (uid === undefined)
    throw new WorkerLimitError('Codex worker limits require a Linux user cgroup.',);
  /** The slice owns aggregate limits; only its child is exposed to sandboxed shells. */
  const parent = `/sys/fs/cgroup/user.slice/user-${uid}.slice/user@${uid}.service/${workerSlice}`;
  if (!existsSync(parent,)) {
    execFileSync('/usr/bin/systemctl', ['--user', 'start', workerSlice,], {
      timeout: 5_000,
      stdio: ['ignore', 'ignore', 'pipe',],
    },);
  }
  /** These budgets remain unchanged when CPU capacity increases. */
  const fixedLimits = {
    'memory.max': '4294967296',
    'memory.swap.max': '0',
    'pids.max': '256',
  } as const;
  for (const [file, expected,] of Object.entries(fixedLimits,)) {
    if (readFileSync(`${parent}/${file}`, 'utf8',).trim() !== expected) {
      throw new WorkerLimitError(
        `Codex worker limit ${parent}/${file} must be ${expected}; restore the systemd slice configuration.`,
      );
    }
  }
  /** CPU quota may be raised explicitly, but may never silently become unlimited. */
  const [quota, period,] = readFileSync(`${parent}/cpu.max`, 'utf8',).trim().split(/\s+/v,);
  if (!(Number(quota,) > 0) || !(Number(period,) > 0))
    throw new WorkerLimitError(`Codex worker limit ${parent}/cpu.max requires a finite CPU quota.`,);
  /** Commands cannot change the parent budget through this delegated child. */
  const child = `${parent}/codex`;
  mkdirSync(child, { recursive: true, },);
  return `${child}/cgroup.procs`;
}

//endregion Worker membership

//region Hook protocol: change only command text, retaining native permissions

/**
 Produce the native PreToolUse rewrite without changing command arguments or approvals.

 @returns hook response consumed by Codex before its ordinary sandboxed execution

 @throws {@link WorkerLimitError} when the hook input lacks a Bash command
 */
function hookResponse(): object {
  /** The host supplies JSON, so input objects contain data rather than accessors. */
  const input: unknown = JSON.parse(readFileSync(0, 'utf8',),);
  if (input === null || typeof input !== 'object'
    || !('hook_event_name' in input) || input.hook_event_name !== 'PreToolUse'
    || !('tool_name' in input) || input.tool_name !== 'Bash') {
    throw new WorkerLimitError('Codex worker hook requires a Bash PreToolUse event.',);
  }
  if (!('tool_input' in input) || input.tool_input === null || typeof input.tool_input !== 'object'
    || !('command' in input.tool_input) || typeof input.tool_input.command !== 'string') {
    throw new WorkerLimitError('Codex worker hook requires the original command string.',);
  }
  /** Generated path contains only fixed path segments and the numeric user identifier. */
  const membership = workerMembership();
  /** Keep original shell source intact, including quotes, heredocs, functions and exit status. */
  const command = `command printf '%s' "$$" > '${membership}' || exit 70\n${input.tool_input.command}`;
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      updatedInput: { command, },
    },
  };
}

try {
  process.stdout.write(JSON.stringify(hookResponse(),),);
}
catch (error) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `Codex could not apply the worker resource limits: ${String(error,)}`,
    },
  },),);
}

//endregion Hook protocol
