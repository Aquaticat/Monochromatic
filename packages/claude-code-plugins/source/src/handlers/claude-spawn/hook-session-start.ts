/**
 * SessionStart hook handler for the claude-spawn plugin.
 *
 * Handles: PID-to-session mapping, child spawn ownership claims, and
 * auto-symlinking of the `spawn-claude` CLI.
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
 * Sentinel returned by {@link autoSetupCli} when CLI setup succeeded or was
 * unnecessary, so there is no warning to surface.
 *
 * A unique symbol rather than `null`: the caller narrows on identity
 * (`=== NO_WARNING`), keeping the warning text free of a nullish union.
 */
const NO_WARNING: unique symbol = Symbol('claude-spawn/cli-setup-ok',);

/**
 * Handles the SessionStart hook event.
 *
 * Writes PID-to-session mapping, claims spawn ownership for genuine child
 * sessions, and auto-symlinks the `spawn-claude` CLI into `~/.local/bin/`.
 *
 * @param sessionId - Claude Code session identifier from hook event
 *
 * @param transcriptPath - absolute path to session transcript file
 *
 * @param hookDir - value of `import.meta.dirname` from compiled hook entry point,
 *   used to resolve plugin root for CLI symlinking
 *
 * @returns string to write to stdout (empty JSON object or CLI setup warning)
 *
 * @example
 * ```ts
 * const output = handleSessionStart({
 *   sessionId: event.session_id,
 *   transcriptPath: event.transcript_path,
 *   hookDir: import.meta.dirname,
 * });
 * process.stdout.write(output);
 * ```
 */
function handleSessionStart({
  sessionId,
  transcriptPath,
  hookDir,
}: {
  readonly sessionId: string;
  readonly transcriptPath: string;
  readonly hookDir: string;
},): string {
  mkdirSync(
    BY_PID_DIR,
    { recursive: true, },
  );

  /**
   * Maps this Claude process's PID to the session identity for CLI coordination.
   */
  const mapping: PidMapping = {
    sessionId,
    transcriptPath,
  };

  writeFileSync(
    join(
      BY_PID_DIR,
      String(process.ppid,),
    ),
    JSON.stringify(mapping,),
  );

  /**
   * Claim ownership of the spawn file if this is a genuine child session.
   *
   * The CLI pre-creates `{spawnId}.json` with `sessionId: ""`. The first
   * SessionStart that sees an empty `sessionId` fills it in. Sessions with
   * stale `CLAUDE_SPAWN_ID` env vars (inherited from the terminal after a
   * previous child exited) see a non-empty `sessionId` and skip.
   */
  const spawnId = process.env
    .CLAUDE_SPAWN_ID;

  if (spawnId !== undefined) {
    /**
     * Path to the spawn-state JSON pre-created by the CLI for this child.
     */
    const jsonPath = join(
      SPAWNS_DIR,
      `${spawnId}.json`,
    );

    try {
      /**
       * Existing spawn-state text on disk; parsed below before deciding to claim.
       */
      const raw = readFileSync(
        jsonPath,
        'utf8',
      );
      /* oxlint-disable typescript/no-unsafe-type-assertion -- trusted file written by our own CLI */
      /**
       * Parsed spawn state; an empty `sessionId` field signals an unclaimed slot.
       */
      const state = JSON.parse(raw,) as SpawnState;
      /* oxlint-enable typescript/no-unsafe-type-assertion */

      if (state.sessionId
        === '') {
        /**
         * Genuine child: claim ownership by filling in session identity.
         */
        const updated: SpawnState = {
          ...state,
          sessionId,
          transcriptPath,
        };
        writeFileSync(
          jsonPath,
          JSON.stringify(updated,),
        );
      }
    }
    catch {
      /**
       * File missing (stale env, already `.reported`) or unreadable: skip.
       */
    }
  }

  /**
   * Warning text from CLI auto-setup, or `NO_WARNING` when setup succeeded or was unnecessary.
   */
  const cliWarning = autoSetupCli(hookDir,);
  if (cliWarning !== NO_WARNING)
    return cliWarning;

  return JSON.stringify({},);
}

/**
 * Detects whether `spawn-claude` is already discoverable on PATH.
 *
 * @returns `true` if `which` finds `spawn-claude`, `false` otherwise
 *
 * @example
 * ```ts
 * if (cliIsOnPath()) skipAutoSetup();
 * ```
 */
function cliIsOnPath(): boolean {
  try {
    execFileSync(
      'which',
      ['spawn-claude',],
      { stdio: 'ignore', },
    );
    return true;
  }
  catch {
    return false;
  }
}

/**
 * Symlinks the CLI source into `~/.local/bin/spawn-claude` and returns a
 * human-readable warning when the result is incomplete (PATH missing or
 * symlink failure).
 *
 * @param hookDir - directory of the compiled hook entry point, used to derive plugin root
 *
 * @returns warning text to print to stdout, or `NO_WARNING` when setup either succeeded or was unnecessary
 *
 * @example
 * ```ts
 * const warning = autoSetupCli(import.meta.dirname);
 * if (warning !== NO_WARNING) console.warn(warning);
 * ```
 */
function autoSetupCli(hookDir: string,): string | typeof NO_WARNING {
  if (cliIsOnPath())
    return NO_WARNING;

  /**
   * Resolve plugin root from the compiled hook's location.
   * Hook binary: `${PLUGIN_ROOT}/dist/final/node/index.mjs`
   * CLI source:  `${PLUGIN_ROOT}/src/cli.ts`
   */
  const pluginRoot = resolve(
    hookDir,
    '..',
    '..',
    '..',
  );
  /**
   * Absolute path to CLI entry point that the symlink will target.
   */
  const cliSource = join(
    pluginRoot,
    'src',
    'cli.ts',
  );

  /**
   * Standard XDG user-local bin directory.
   */
  const localBin = join(
    process.env
      .HOME
      ?? '/tmp',
    '.local',
    'bin',
  );
  /**
   * Destination path for the `spawn-claude` symlink in user's local bin.
   */
  const symlinkPath = join(
    localBin,
    'spawn-claude',
  );

  try {
    mkdirSync(
      localBin,
      { recursive: true, },
    );

    /**
     * Unix permission bits for owner rwx, group/others rx.
     */
    const EXECUTABLE_PERMISSION = 0o755;
    /**
     * Ensure CLI source is executable (shebang: #!/usr/bin/env bun).
     */
    chmodSync(
      cliSource,
      EXECUTABLE_PERMISSION,
    );

    /**
     * Remove stale symlink if it exists, then create a fresh one.
     */
    try {
      unlinkSync(symlinkPath,);
    }
    catch { /* Does not exist yet. */ }
    symlinkSync(
      cliSource,
      symlinkPath,
    );

    /**
     * Verify ~/.local/bin is on PATH so the symlink is discoverable.
     */
    const pathDirs = (process.env
      .PATH
      ?? '').split(':',);
    return pathDirs.includes(localBin,)
      ? NO_WARNING
      : [
        '[claude-spawn] Symlinked spawn-claude to ~/.local/bin/spawn-claude,',
        'but ~/.local/bin is not on PATH. Add it to your shell profile:',
        '  export PATH="$HOME/.local/bin:$PATH"',
      ]
        .join('\n',);
  }
  catch {
    return [
      '[claude-spawn] Could not auto-setup spawn-claude CLI.',
      `Symlink target: ${cliSource}`,
      `Symlink path: ${symlinkPath}`,
      'Create the symlink manually or add the plugin directory to PATH.',
    ]
      .join('\n',);
  }
}

export { handleSessionStart, };
