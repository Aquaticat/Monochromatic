#!/usr/bin/env bun

/**
 * CLI tool that spawns steerable child Claude Code sessions in terminal windows.
 *
 * Launches a child Claude session via `terminal-exec`, passing environment
 * variables that enable the companion hooks to forward results
 * back to the parent session automatically.
 *
 * Replaces the MCP server approach with a direct CLI invocation via Bash.
 *
 * @module
 */

import { readFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

import { object } from '@optique/core/constructs';
import { message } from '@optique/core/message';
import { optional } from '@optique/core/modifiers';
import { argument, option } from '@optique/core/primitives';
import { string } from '@optique/core/valueparser';
import { runSync } from '@optique/run';

import { BY_PID_DIR, SPAWNS_DIR } from './paths.ts';
import type { PidMapping } from './paths.ts';

export {};

//region CLI argument parsing

/**
 * Optique parser for the spawn-claude CLI.
 *
 * @example
 * ```
 * spawn-claude "implement feature X"
 * spawn-claude --cwd /some/path "fix the bug"
 * spawn-claude --extra-arguments "--model sonnet" "refactor module Y"
 * ```
 */
const parser = object({
  cwd: optional(option('--cwd', string({ metavar: 'DIR' }), {
    description: message`Working directory for the child session. Defaults to current directory.`,
  })),
  extraArguments: optional(option('--extra-arguments', string({ metavar: 'ARGS' }), {
    description: message`Additional CLI arguments passed directly to the claude command (e.g. "--model sonnet --allowedTools Edit,Bash").`,
  })),
  prompt: argument(string({ metavar: 'PROMPT' }), {
    description: message`Initial prompt for the spawned Claude session.`,
  }),
});

const args = runSync(parser, {
  programName: 'spawn-claude',
  help: 'option',
  brief: message`Spawn a steerable child Claude Code session in a visible terminal window.`,
});

//endregion

//region Session identity resolution via process tree walk

/**
 * Walks up the process tree from the current process to find the
 * Claude session identity by checking each ancestor PID against
 * the `.by-pid/` coordination directory.
 *
 * When invoked via Bash tool, the process tree is:
 *   Claude → [sandbox?] → shell → spawn-claude
 * The SessionStart hook writes `.by-pid/{claudePid}`, so we walk
 * up until we find a matching PID file.
 *
 * @returns Session identity of the calling Claude instance, or `null` if not found.
 *
 * @example
 * ```ts
 * const identity = findCallingSession();
 * if (identity === null) throw new Error('No Claude session found');
 * console.log(identity.sessionId);
 * ```
 */
function findCallingSession(): PidMapping | null {
  let pid = process.ppid;

  // Walk up the process tree, checking each ancestor PID.
  // Stop at PID 1 (init) to avoid infinite loops.
  while (pid > 1) {
    const pidFilePath = join(BY_PID_DIR, String(pid));

    try {
      const raw = readFileSync(pidFilePath, 'utf8');
      /* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted file written by our own SessionStart hook */
      return JSON.parse(raw) as PidMapping;
    } catch {
      // No coordination file for this PID — walk up to its parent.
    }

    try {
      const statusContent = readFileSync(`/proc/${String(pid)}/status`, 'utf8');
      const ppidLine = statusContent.split('\n').find(function isPpidLine(line) {
        return line.startsWith('PPid:');
      });

      if (ppidLine === undefined) {
        return null;
      }

      pid = parseInt(ppidLine.split(/\s+/)[1] ?? '0', 10);
    } catch {
      // Cannot read /proc — platform limitation or process already exited.
      return null;
    }
  }

  return null;
}

//endregion

//region Spawn execution

const identity = findCallingSession();

if (identity === null) {
  console.error('Error: Could not find calling Claude session. Ensure the claude-spawn plugin hooks are active and SessionStart has fired.');
  process.exitCode = 1;
} else {
  const spawnId = randomUUID();
  const cwd = args.cwd ?? process.cwd();

  /** Extra args split on whitespace, filtering empty strings. */
  const extraArgs = (args.extraArguments ?? '')
    .split(/\s+/)
    .filter(function nonEmpty(s) { return s.length > 0; });

  mkdirSync(SPAWNS_DIR, { recursive: true });

  const proc = Bun.spawn(
    ['terminal-exec', '--', 'claude', ...extraArgs, args.prompt],
    {
      cwd,
      env: {
        ...process.env,
        CLAUDE_SPAWN_ID: spawnId,
        CLAUDE_SPAWNED_BY_SESSION: identity.sessionId,
      },
      stdin: 'ignore',
      stdout: 'ignore',
      stderr: 'ignore',
    },
  );

  proc.unref();

  console.log(JSON.stringify({ spawnId }));
}

//endregion
