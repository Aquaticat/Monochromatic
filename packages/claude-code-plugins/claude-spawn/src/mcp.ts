#!/usr/bin/env bun

/**
 * MCP server that spawns steerable Claude Code sessions in terminal windows.
 *
 * Launches child Claude sessions via `terminal-exec`, passing environment
 * variables that enable the companion hooks to forward results
 * back to the parent session automatically.
 *
 * @module
 */

import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

import { createMcpServer, defineTool, serve } from '@monochromatic-dev/mcp-stdio';

import { BY_PID_DIR, SPAWNS_DIR } from './paths.ts';
import type { PidMapping } from './paths.ts';

export {};

//region Session identity resolution

/**
 * Reads the calling session's identity from the PID coordination file.
 * The SessionStart hook writes this file keyed by Claude's PID;
 * since MCP servers are children of the Claude process, `process.ppid`
 * gives the correct key.
 *
 * @returns Session identity, or `null` if the coordination file is missing.
 */
function readOwnSessionId(): PidMapping | null {
  try {
    const pidFile = join(BY_PID_DIR, String(process.ppid));
    const raw = readFileSync(pidFile, 'utf8');
    /* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted file written by our own SessionStart hook */
    return JSON.parse(raw) as PidMapping;
  } catch {
    return null;
  }
}

//endregion

//region Tool definition

/** MCP tool: spawn a Claude Code session in a visible terminal window. */
const spawnTool = defineTool('spawn_claude', {
  description: [
    'Spawns a new Claude Code session in a visible terminal window.',
    'Returns a spawnId immediately.',
    'The child session self-reports its results via shared hooks.',
    'Results appear in your context automatically when the child session ends.',
    'You can also Read the child transcript JSONL directly using the path',
    'from ~/.claude/spawn-results/spawns/{spawnId}.json at any time.',
  ].join(' '),
  inputSchema: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'Initial prompt for the spawned Claude session.',
      },
      cwd: {
        type: 'string',
        description: 'Working directory for the child session. Defaults to current directory.',
      },
      extraArguments: {
        type: 'string',
        description: 'Additional CLI arguments passed directly to the claude command (e.g. "--model sonnet --allowedTools Edit,Bash").',
      },
    },
    required: ['prompt'],
  },
  handler: async function handleSpawnClaude(args) {
    const prompt = String(args.prompt);
    const cwd = typeof args.cwd === 'string' ? args.cwd : process.cwd();
    const extraArguments = typeof args.extraArguments === 'string' ? args.extraArguments : '';

    const identity = readOwnSessionId();
    if (identity === null) {
      return {
        content: [{
          type: 'text',
          text: 'Error: SessionStart hook has not written the PID coordination file yet. Ensure the claude-spawn plugin hooks are active.',
        }],
        isError: true,
      };
    }

    const spawnId = randomUUID();

    /** Extra args split on whitespace, filtering empty strings. */
    const extraArgs = extraArguments
      .split(/\s+/)
      .filter(function nonEmpty(s) { return s.length > 0; });

    mkdirSync(SPAWNS_DIR, { recursive: true });

    const proc = Bun.spawn(
      ['terminal-exec', '--', 'claude', ...extraArgs, prompt],
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

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ spawnId }),
      }],
    };
  },
});

//endregion

//region Server setup

/** MCP server instance exposing the spawn_claude tool. */
const server = createMcpServer(
  { name: 'claude-spawn', version: '0.1.0' },
  [spawnTool],
);

await serve(server);

//endregion
