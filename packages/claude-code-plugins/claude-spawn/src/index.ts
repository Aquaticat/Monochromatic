#!/usr/bin/env bun

/**
 * Claude Code hook handler for the claude-spawn plugin.
 *
 * A single binary that handles all hook events:
 * - **SessionStart**: writes PID-to-session mapping; registers child spawn state
 * - **Stop**: updates child's `lastMessage` and marks it as `"stopped"` so the parent can pick up the result
 * - **SessionEnd**: no-op (kept for future use)
 * - **All `additionalContext` hooks**: checks for completed children and injects results
 *
 * @module
 */

import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import type {
  HookInput,
  HookOutputBase,
} from '@monochromatic-dev/claude-code-plugins-hook-types';
import {
  readStdin,
} from '@monochromatic-dev/claude-code-plugins-hook-utils';

import { checkCompletedChildren } from './inject.ts';
import { BY_PID_DIR, SPAWNS_DIR } from './paths.ts';
import type { PidMapping, SpawnState } from './paths.ts';

export {};

//region Stdin

/** Raw JSON string read from stdin containing the hook event payload. */
const raw = await readStdin();

/* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted input from Claude Code hook system */
const event = JSON.parse(raw) as HookInput;

//endregion

//region SessionStart — write PID mapping and register child

if (event.hook_event_name === 'SessionStart') {
  mkdirSync(BY_PID_DIR, { recursive: true });

  /** Maps this Claude process's PID to the session identity for CLI coordination. */
  const mapping: PidMapping = {
    sessionId: event.session_id,
    transcriptPath: event.transcript_path,
  };

  writeFileSync(
    join(BY_PID_DIR, String(process.ppid)),
    JSON.stringify(mapping),
  );

  /** Register as a child session if spawned by the CLI tool. */
  const spawnId = process.env.CLAUDE_SPAWN_ID;
  const parentSessionId = process.env.CLAUDE_SPAWNED_BY_SESSION;

  if (spawnId !== undefined && parentSessionId !== undefined) {
    mkdirSync(SPAWNS_DIR, { recursive: true });

    const state: SpawnState = {
      spawnId,
      sessionId: event.session_id,
      transcriptPath: event.transcript_path,
      parentSessionId,
      status: 'running',
      lastMessage: '',
    };

    writeFileSync(
      join(SPAWNS_DIR, `${spawnId}.json`),
      JSON.stringify(state),
    );
  }

  /** Inject any completed children from previous sessions into context. */
  const context = checkCompletedChildren({ parentSessionId: event.session_id });

  const output = context !== null
    ? { hookSpecificOutput: { hookEventName: 'SessionStart' as const, additionalContext: context } }
    : {};

  process.stdout.write(JSON.stringify(output));

//endregion

//region Stop — update lastMessage on child sessions

} else if (event.hook_event_name === 'Stop') {
  const spawnId = process.env.CLAUDE_SPAWN_ID;

  if (spawnId !== undefined && event.last_assistant_message !== undefined) {
    const filePath = join(SPAWNS_DIR, `${spawnId}.json`);

    try {
      const existing = readFileSync(filePath, 'utf8');
      /* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted file written by our own SessionStart hook */
      const state = JSON.parse(existing) as SpawnState;

      const updated: SpawnState = { ...state, lastMessage: event.last_assistant_message, status: 'stopped' };
      writeFileSync(filePath, JSON.stringify(updated));
    } catch {
      /** File missing or unreadable — SessionStart hook may not have run yet. */
    }
  }

  /** Pass-through: never block stops from this hook. */
  const output: HookOutputBase = {};
  process.stdout.write(JSON.stringify(output));

//endregion

//region SessionEnd — no-op (status already set by Stop hook)

} else if (event.hook_event_name === 'SessionEnd') {
  const output: HookOutputBase = {};
  process.stdout.write(JSON.stringify(output));

//endregion

//region All other hooks — inject completed children

} else {
  const context = checkCompletedChildren({ parentSessionId: event.session_id });

  if (context !== null) {
    const output = {
      hookSpecificOutput: {
        hookEventName: event.hook_event_name,
        additionalContext: context,
      },
    };
    process.stdout.write(JSON.stringify(output));
  } else {
    const output: HookOutputBase = {};
    process.stdout.write(JSON.stringify(output));
  }
}

//endregion
