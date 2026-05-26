/**
 * Resolves the default terminal emulator on Windows.
 * Checks for Windows Terminal (`wt.exe`) first, then falls back to `cmd.exe`.
 *
 * @module
 */

import {
  delimiter,
  resolve,
} from 'node:path';
import {
  l as parentLogger,
  tagged,
} from './log.ts';
import {
  ABSENT,
  type Maybe,
} from './maybe.ts';
import type { ResolvedTerminal, } from './resolve.ts';

/** Tagged logger for this module. */
const l = tagged({
  tag: 'windows',
  l: parentLogger,
},);

/**
 * Cross-runtime `which` for Windows.
 * Resolves an executable by searching directories in `$PATH`.
 *
 * @param name - Executable name to find.
 *
 * @returns Absolute path if found, or {@link ABSENT}.
 */
async function which(name: string,): Promise<Maybe<string>> {
  /** Dynamic import keeps the Windows-only path cold on other platforms. */
  const { access, } = await import('node:fs/promises');
  /** Empty PATH fallback yields an empty dirs list, which returns null cleanly. */
  const pathEnv = process.env
    .PATH
    ?? '';
  /** Per-platform PATH delimiter; semicolon on Windows. */
  const dirs = pathEnv.split(delimiter,);
  for (const dir of dirs) {
    /** Absolute path candidate to access-check inside the loop. */
    const candidate = resolve(
      dir,
      name,
    );
    try {
      /* oxlint-disable-next-line no-await-in-loop -- sequential PATH walk must check one dir at a time */
      await access(candidate,);
      return candidate;
    }
    catch {
      continue;
    }
  }
  return ABSENT;
}

/**
 * Resolves the terminal emulator on Windows.
 *
 * Resolution order:
 * 1. Windows Terminal (`wt.exe`): default on Windows 11+, widely installed on Windows 10
 * 2. `cmd.exe`: always available
 *
 * @returns Resolved terminal entry.
 *
 * @example
 * ```ts
 * const terminal = await resolveWindowsTerminal()
 * // terminal.execTokens === ['wt.exe'] or ['cmd.exe']
 * ```
 */
export async function resolveWindowsTerminal(): Promise<ResolvedTerminal> {
  if (await which('wt.exe',) !== ABSENT) {
    l.debug('found Windows Terminal (wt.exe)',);
    return {
      entryId: 'wt.exe',
      execTokens: ['wt.exe',],
      execArg: '--',
      appIdArg: '',
      titleArg: '--title',
      dirArg: '--startingDirectory',
      holdArg: '',
    };
  }

  l.debug('Windows Terminal not found, falling back to cmd.exe',);
  return {
    entryId: 'cmd.exe',
    execTokens: ['cmd.exe',],
    execArg: '/c',
    appIdArg: '',
    titleArg: '',
    dirArg: '',
    holdArg: '/k',
  };
}
