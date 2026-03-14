#!/usr/bin/env bun

/**
 * Claude Code hook handler for the claude-spawn plugin.
 *
 * A single binary that handles all hook events:
 * - **SessionStart**: writes PID-to-session mapping; registers child spawn state; auto-symlinks `spawn-claude` CLI to `~/.local/bin/` if not on PATH
 * - **Stop**: updates child's `lastMessage` and marks it as `"stopped"` so the parent can pick up the result
 * - **SessionEnd**: no-op (kept for future use)
 * - **All `additionalContext` hooks**: checks for completed children and injects results
 *
 * @module
 */

import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

import type {
  HookInput,
  HookOutputBase,
} from '@monochromatic-dev/claude-code-plugins-hook-types';
import {
  readStdin,
} from '@monochromatic-dev/claude-code-plugins-hook-utils';

import { checkCompletedChildren } from './inject.ts';
import { BY_PID_DIR, SPAWNS_DIR, type PidMapping, type SpawnState } from './paths.ts';

export {};

//region Stdin

/** Raw JSON string read from stdin containing the hook event payload. */
const raw = await readStdin();

/** Parsed hook event payload deserialized from stdin. */
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

  /** Spawn identifier set by the CLI when launching a child session. */
  const spawnId = process.env.CLAUDE_SPAWN_ID;
  /** Session ID of the parent that spawned this child session. */
  const parentSessionId = process.env.CLAUDE_SPAWNED_BY_SESSION;

  if (spawnId !== undefined && parentSessionId !== undefined) {
    mkdirSync(SPAWNS_DIR, { recursive: true });

    /** Initial spawn state persisted for parent session coordination. */
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

  /** Auto-setup spawn-claude CLI if not already on PATH. */
  let cliWarning: string | null = null;

  /** Check if spawn-claude is already available. */
  let cliOnPath = false;
  try {
    execFileSync('which', ['spawn-claude'], { stdio: 'ignore' });
    cliOnPath = true;
  } catch {
    // Not on PATH — attempt auto-setup.
  }

  if (!cliOnPath) {
    /**
     * Resolve plugin root from the compiled hook's location.
     * Hook binary: `${PLUGIN_ROOT}/dist/final/node/index.mjs`
     * CLI source:  `${PLUGIN_ROOT}/src/cli.ts`
     */
    const pluginRoot = resolve(import.meta.dir, '..', '..', '..');
    /** Absolute path to the CLI entry point that the symlink will target. */
    const cliSource = join(pluginRoot, 'src', 'cli.ts');

    /** Standard XDG user-local bin directory. */
    const localBin = join(process.env.HOME ?? '/tmp', '.local', 'bin');
    /** Destination path for the `spawn-claude` symlink in the user's local bin. */
    const symlinkPath = join(localBin, 'spawn-claude');

    try {
      mkdirSync(localBin, { recursive: true });

      /** Unix permission bits for owner read/write/execute, group and others read/execute. */
      const EXECUTABLE_PERMISSION = 0o755;
      /** Ensure CLI source is executable (shebang: #!/usr/bin/env bun). */
      chmodSync(cliSource, EXECUTABLE_PERMISSION);

      /** Remove stale symlink if it exists, then create a fresh one. */
      try { unlinkSync(symlinkPath); } catch { /* Does not exist yet. */ }
      symlinkSync(cliSource, symlinkPath);

      /** Verify ~/.local/bin is on PATH so the symlink is discoverable. */
      const pathDirs = (process.env.PATH ?? '').split(':');
      cliWarning = pathDirs.includes(localBin)
        ? null
        : [
          '[claude-spawn] Symlinked spawn-claude to ~/.local/bin/spawn-claude,',
          'but ~/.local/bin is not on PATH. Add it to your shell profile:',
          '  export PATH="$HOME/.local/bin:$PATH"',
        ].join('\n');
    } catch {
      cliWarning = [
        '[claude-spawn] Could not auto-setup spawn-claude CLI.',
        `Symlink target: ${cliSource}`,
        `Symlink path: ${symlinkPath}`,
        'Create the symlink manually or add the plugin directory to PATH.',
      ].join('\n');
    }
  }

  /** Additional context from completed child sessions, if any. */
  const childContext = checkCompletedChildren({ parentSessionId: event.session_id });

  /** Combined additional context from CLI setup and completed children. */
  const contexts = [cliWarning, childContext].filter(function nonNull(v): v is string { return v !== null; });

  /** Hook output, optionally carrying setup warnings and child results as additional context. */
  const output = contexts.length > 0
    ? { hookSpecificOutput: { hookEventName: 'SessionStart' as const, additionalContext: contexts.join('\n\n---\n\n') } }
    : {};

  process.stdout.write(JSON.stringify(output));

//endregion

//region Stop — update lastMessage on child sessions

} else if (event.hook_event_name === 'Stop') {
  /** Spawn identifier from the environment, present only in child sessions. */
  const spawnId = process.env.CLAUDE_SPAWN_ID;

  if (spawnId !== undefined && event.last_assistant_message !== undefined) {
    /** Path to this child's spawn state JSON file. */
    const filePath = join(SPAWNS_DIR, `${spawnId}.json`);

    try {
      /** Raw JSON content of the existing spawn state file. */
      const existing = readFileSync(filePath, 'utf8');
      /** Previously persisted spawn state to update with the final message. */
      /* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted file written by our own SessionStart hook */
      const state = JSON.parse(existing) as SpawnState;

      /** Updated spawn state with the final assistant message and stopped status. */
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
  /** Empty pass-through output for the session end event. */
  const output: HookOutputBase = {};
  process.stdout.write(JSON.stringify(output));

//endregion

//region All other hooks — inject completed children

} else {
  /** Additional context from completed child sessions, if any. */
  const context = checkCompletedChildren({ parentSessionId: event.session_id });

  if (context !== null) {
    /** Hook output carrying completed child results as additional context. */
    const output = {
      hookSpecificOutput: {
        hookEventName: event.hook_event_name,
        additionalContext: context,
      },
    };
    process.stdout.write(JSON.stringify(output));
  } else {
    /** Empty pass-through output when no children have completed. */
    const output: HookOutputBase = {};
    process.stdout.write(JSON.stringify(output));
  }
}

//endregion
