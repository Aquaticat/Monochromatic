/**
 * SessionStart hook handler for the claude-spawn plugin.
 *
 * Extracted from `index.ts` to keep each module under the 100-line limit.
 * Handles: PID-to-session mapping, child spawn ownership claims,
 * and auto-symlinking of the `spawn-claude` CLI.
 *
 * @module
 */

import { execFileSync, } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import {
  join,
  resolve,
} from 'node:path';

import {
  BY_PID_DIR,
  type PidMapping,
  SPAWNS_DIR,
  type SpawnState,
} from './paths.ts';

/**
 * Handles the SessionStart hook event.
 *
 * Writes PID-to-session mapping, claims spawn ownership for genuine child
 * sessions, and auto-symlinks the `spawn-claude` CLI into `~/.local/bin/`.
 *
 * @param sessionId - Claude Code session identifier from the hook event.
 *
 * @param transcriptPath - Absolute path to the session transcript file.
 *
 * @param hookDir - Value of `import.meta.dir` from the compiled hook entry point,
 *   used to resolve the plugin root for CLI symlinking.
 *
 * @returns String to write to stdout (empty JSON object or CLI setup warning text).
 *
 * @example
 * ```ts
 * const output = handleSessionStart({
 *   sessionId: event.session_id,
 *   transcriptPath: event.transcript_path,
 *   hookDir: import.meta.dir,
 * });
 * process.stdout.write(output);
 * ```
 */
export function handleSessionStart({ sessionId, transcriptPath, hookDir, }: {
  sessionId: string;
  transcriptPath: string;
  hookDir: string;
},): string {
  mkdirSync(BY_PID_DIR, { recursive: true, },);

  /** Maps this Claude process's PID to the session identity for CLI coordination. */
  const mapping: PidMapping = { sessionId, transcriptPath, };

  writeFileSync(
    join(BY_PID_DIR, String(process.ppid,),),
    JSON.stringify(mapping,),
  );

  //region Claim spawn ownership

  /**
   * Claim ownership of the spawn file if this is a genuine child session.
   *
   * The CLI pre-creates `{spawnId}.json` with `sessionId: ""`. The first
   * SessionStart that sees an empty `sessionId` fills it in. Sessions with
   * stale `CLAUDE_SPAWN_ID` env vars (inherited from the terminal after a
   * previous child exited) see a non-empty `sessionId` and skip.
   */
  const spawnId = process.env.CLAUDE_SPAWN_ID;

  if (spawnId !== undefined) {
    const jsonPath = join(SPAWNS_DIR, `${spawnId}.json`,);

    try {
      const raw = readFileSync(jsonPath, 'utf8',);
      /* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted file written by our own CLI */
      const state = JSON.parse(raw,) as SpawnState;

      if (state.sessionId === '') {
        /** Genuine child — claim ownership by filling in session identity. */
        const updated: SpawnState = { ...state, sessionId, transcriptPath, };
        writeFileSync(jsonPath, JSON.stringify(updated,),);
      }
    }
    catch {
      /** File missing (stale env, already `.reported`) or unreadable — skip. */
    }
  }

  //endregion

  //region Auto-setup spawn-claude CLI

  /** Auto-setup spawn-claude CLI if not already on PATH. */
  let cliWarning: string | null = null;

  /** Check if spawn-claude is already available. */
  let cliOnPath = false;
  try {
    execFileSync('which', ['spawn-claude',], { stdio: 'ignore', },);
    cliOnPath = true;
  }
  catch {
    // Not on PATH — attempt auto-setup.
  }

  if (!cliOnPath) {
    /**
     * Resolve plugin root from the compiled hook's location.
     * Hook binary: `${PLUGIN_ROOT}/dist/final/node/index.mjs`
     * CLI source:  `${PLUGIN_ROOT}/src/cli.ts`
     */
    const pluginRoot = resolve(hookDir, '..', '..', '..',);
    /** Absolute path to the CLI entry point that the symlink will target. */
    const cliSource = join(pluginRoot, 'src', 'cli.ts',);

    /** Standard XDG user-local bin directory. */
    const localBin = join(process.env.HOME ?? '/tmp', '.local', 'bin',);
    /** Destination path for the `spawn-claude` symlink in the user's local bin. */
    const symlinkPath = join(localBin, 'spawn-claude',);

    try {
      mkdirSync(localBin, { recursive: true, },);

      /** Unix permission bits for owner read/write/execute, group and others read/execute. */
      const EXECUTABLE_PERMISSION = 0o755;
      /** Ensure CLI source is executable (shebang: #!/usr/bin/env bun). */
      chmodSync(cliSource, EXECUTABLE_PERMISSION,);

      /** Remove stale symlink if it exists, then create a fresh one. */
      try {
        unlinkSync(symlinkPath,);
      }
      catch { /* Does not exist yet. */ }
      symlinkSync(cliSource, symlinkPath,);

      /** Verify ~/.local/bin is on PATH so the symlink is discoverable. */
      const pathDirs = (process.env.PATH ?? '').split(':',);
      cliWarning = pathDirs.includes(localBin,)
        ? null
        : [
          '[claude-spawn] Symlinked spawn-claude to ~/.local/bin/spawn-claude,',
          'but ~/.local/bin is not on PATH. Add it to your shell profile:',
          '  export PATH="$HOME/.local/bin:$PATH"',
        ]
          .join('\n',);
    }
    catch {
      cliWarning = [
        '[claude-spawn] Could not auto-setup spawn-claude CLI.',
        `Symlink target: ${cliSource}`,
        `Symlink path: ${symlinkPath}`,
        'Create the symlink manually or add the plugin directory to PATH.',
      ]
        .join('\n',);
    }
  }

  //endregion

  if (cliWarning !== null)
    return cliWarning;

  return JSON.stringify({},);
}
