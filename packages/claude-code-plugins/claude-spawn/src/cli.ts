#!/usr/bin/env bun

/**
 * CLI tool that spawns steerable child Claude Code sessions in terminal windows.
 *
 * Launches a child Claude session via `terminal-exec` with a pre-created spawn
 * state file. Only `CLAUDE_SPAWN_ID` is passed as an env var — the child's
 * SessionStart and Stop hooks use it to fill in session info and report completion.
 *
 * Replaces the MCP server approach with a direct CLI invocation via Bash.
 *
 * @module
 */

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { object } from '@optique/core/constructs';
import { message } from '@optique/core/message';
import { optional } from '@optique/core/modifiers';
import { argument, option } from '@optique/core/primitives';
import { string } from '@optique/core/valueparser';
import { runSync } from '@optique/run';

import { BY_PID_DIR, SPAWNS_DIR, type PidMapping, type SpawnState } from './paths.ts';

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

/** Parsed CLI arguments from the spawn-claude command invocation. */
const args = runSync(parser, {
  programName: 'spawn-claude',
  help: 'option',
  brief: message`Spawn a steerable child Claude Code session in a visible terminal window.`,
});

//endregion

//region Session identity resolution

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
 * const identity = findByProcessTree();
 * if (identity !== null) console.log(identity.sessionId);
 * ```
 */
function findByProcessTree(): PidMapping | null {
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

      pid = Number.parseInt(ppidLine.split(/\s+/)[1] ?? '0', 10);
    } catch {
      // Cannot read /proc — platform limitation or process already exited.
      return null;
    }
  }

  return null;
}

/**
 * Scans all `.by-pid/` files and returns the most recently written one.
 *
 * Fallback for when the process tree walk fails, which happens inside
 * the Bash tool sandbox (separate PID namespace, so host PIDs from
 * `.by-pid/` don't appear in `/proc`).
 *
 * @returns Session identity from the most recently modified PID file, or `null` if none exist.
 *
 * @example
 * ```ts
 * const identity = findByMostRecent();
 * if (identity !== null) console.log(identity.sessionId);
 * ```
 */
function findByMostRecent(): PidMapping | null {
  let entries: string[] = [];

  try {
    entries = readdirSync(BY_PID_DIR);
  } catch {
    return null;
  }

  let newest: { mapping: PidMapping; mtime: number } | null = null;

  for (const filename of entries) {
    const filePath = join(BY_PID_DIR, filename);

    try {
      const mtime = statSync(filePath).mtimeMs;
      const raw = readFileSync(filePath, 'utf8');
      /* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted file written by our own SessionStart hook */
      const mapping = JSON.parse(raw) as PidMapping;

      if (newest === null || mtime > newest.mtime) {
        newest = { mapping, mtime };
      }
    } catch {
      // Skip unreadable files.
    }
  }

  return newest?.mapping ?? null;
}

/**
 * Finds the calling Claude session identity.
 *
 * Tries the process tree walk first (precise, works outside sandbox),
 * then falls back to the most recently modified `.by-pid/` file
 * (works inside sandbox where PIDs don't match the host namespace).
 *
 * @returns Session identity, or `null` if no coordination files exist.
 *
 * @example
 * ```ts
 * const identity = findCallingSession();
 * if (identity === null) throw new Error('No Claude session found');
 * ```
 */
function findCallingSession(): PidMapping | null {
  return findByProcessTree() ?? findByMostRecent();
}

//endregion

//region Spawn execution

/** Resolved session identity of the calling Claude instance. */
const identity = findCallingSession();

if (identity === null) {
  console.error('Error: Could not find calling Claude session. Ensure the claude-spawn plugin hooks are active and SessionStart has fired.');
  process.exitCode = 1;
} else {
  /** Unique identifier for this spawn, used to coordinate state between parent and child. */
  const spawnId = randomUUID();
  /** Working directory for the child session, defaulting to the current directory. */
  const cwd = args.cwd ?? process.cwd();

  /** Extra args split on whitespace, filtering empty strings. */
  const extraArgs = (args.extraArguments ?? '')
    .split(/\s+/)
    .filter(function nonEmpty(s) { return s.length > 0; });

  mkdirSync(SPAWNS_DIR, { recursive: true });

  /**
   * Pre-create the spawn state file before launching the child.
   * The child's SessionStart hook fills in `sessionId` and `transcriptPath`.
   * The child's Stop hook updates `lastMessage` and `status`.
   *
   * `sessionId` starts empty — the first SessionStart that sees it empty
   * claims ownership. Subsequent sessions with stale `CLAUDE_SPAWN_ID`
   * env vars see a non-empty `sessionId` and skip registration.
   */
  const initialState: SpawnState = {
    spawnId,
    sessionId: '',
    transcriptPath: '',
    parentSessionId: identity.sessionId,
    status: 'running',
    lastMessage: '',
  };

  writeFileSync(
    join(SPAWNS_DIR, `${spawnId}.json`),
    JSON.stringify(initialState),
  );

  /** Detached child process running the spawned Claude session in a terminal window. */
  const proc = spawn(
    'terminal-exec',
    ['--', 'claude', ...extraArgs, args.prompt],
    {
      cwd,
      env: {
        ...process.env,
        CLAUDE_SPAWN_ID: spawnId,
      },
      detached: true,
      stdio: 'ignore',
    },
  );

  proc.unref();

  console.log(JSON.stringify({ spawnId }));
}

//endregion
