#!/usr/bin/env bun

/**
 * Claude Code hook handler for the claude-spawn plugin.
 *
 * A single binary that handles all hook events:
 * - **SessionStart**: writes PID-to-session mapping; registers child spawn state;
 *   auto-symlinks `spawn-claude` CLI; **consumes** completed children via stdout text
 * - **UserPromptSubmit**: **consumes** completed children via stdout text
 * - **Stop**: updates child's `lastMessage` (child sessions); **consumes** completed
 *   children by blocking with reason text (parent sessions)
 * - **SessionEnd**: no-op (kept for future use)
 * - **Best-effort hooks** (PreToolUse, PostToolUse, etc.): reads completed children
 *   without consuming and returns `additionalContext` — may be silently dropped by
 *   Claude Code for plugin-defined hooks (anthropics/claude-code#18427)
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

//region SessionStart — write PID mapping, register child, consume via stdout

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

  /**
   * Consume completed children via stdout text — reliable delivery path.
   * SessionStart supports both stdout text and `additionalContext`; stdout is preferred
   * because plugin-defined hooks may silently drop `additionalContext`.
   */
  const childContext = checkCompletedChildren({ parentSessionId: event.session_id, consume: true });

  /** Combined context from CLI setup warnings and completed children. */
  const contexts = [cliWarning, childContext].filter(function nonNull(v): v is string { return v !== null; });

  if (contexts.length > 0) {
    /** Output as plain stdout text for reliable delivery. */
    process.stdout.write(contexts.join('\n\n---\n\n'));
  } else {
    process.stdout.write(JSON.stringify({}));
  }

//endregion

//region UserPromptSubmit — consume via stdout text

} else if (event.hook_event_name === 'UserPromptSubmit') {
  /**
   * Consume completed children via stdout text — reliable delivery path.
   * UserPromptSubmit supports both stdout text and `additionalContext`; stdout is preferred
   * because plugin-defined hooks may silently drop `additionalContext`.
   */
  const context = checkCompletedChildren({ parentSessionId: event.session_id, consume: true });

  if (context !== null) {
    /** Output as plain stdout text for reliable delivery. */
    process.stdout.write(context);
  } else {
    process.stdout.write(JSON.stringify({}));
  }

//endregion

//region Stop — update child lastMessage; consume via blocking reason on parent

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

  /**
   * On parent sessions: consume completed children by blocking with reason text.
   * The `reason` field is reliably delivered to Claude as feedback.
   * Skip when `stop_hook_active` is true to prevent infinite block loops.
   */
  if (!event.stop_hook_active) {
    const context = checkCompletedChildren({ parentSessionId: event.session_id, consume: true });

    if (context !== null) {
      /** Block the stop and deliver spawn results as the reason. */
      const output = {
        decision: 'block' as const,
        reason: context,
      };
      process.stdout.write(JSON.stringify(output));
      /* Return early — do not emit empty pass-through. */
      process.exit(0);
    }
  }

  /** Pass-through: no completed children or already in a stop-hook continuation. */
  const output: HookOutputBase = {};
  process.stdout.write(JSON.stringify(output));

//endregion

//region SessionEnd — no-op (status already set by Stop hook)

} else if (event.hook_event_name === 'SessionEnd') {
  /** Empty pass-through output for the session end event. */
  const output: HookOutputBase = {};
  process.stdout.write(JSON.stringify(output));

//endregion

//region Best-effort hooks — non-consuming additionalContext injection

} else {
  /**
   * Non-consuming read: returns completed children without renaming files.
   * If Claude Code actually processes the `additionalContext` (not guaranteed for
   * plugin-defined hooks), the result will be surfaced early. The consuming hooks
   * (UserPromptSubmit, Stop) will still pick up and consume the same results later.
   */
  const context = checkCompletedChildren({ parentSessionId: event.session_id, consume: false });

  if (context !== null) {
    /** Hook output carrying completed child results as additional context (best-effort). */
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
