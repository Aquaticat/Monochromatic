/**
 * Resolves the default terminal emulator on Windows.
 * Checks for Windows Terminal (`wt.exe`) first, then falls back to `cmd.exe`.
 *
 * @module
 */

import {
  l as parentLogger,
  tagged,
} from './log.ts';
import type { ResolvedTerminal, } from './resolve.ts';

/** Tagged logger for this module. */
const l = tagged({
  tag: 'windows',
  l: parentLogger,
},);

/**
 * Resolves the terminal emulator on Windows.
 *
 * Resolution order:
 * 1. Windows Terminal (`wt.exe`) -- default on Windows 11+, widely installed on Windows 10
 * 2. `cmd.exe` -- always available
 *
 * @returns Resolved terminal entry.
 *
 * @example
 * ```ts
 * const terminal = resolveWindowsTerminal()
 * // terminal.execTokens === ['wt.exe'] or ['cmd.exe']
 * ```
 */
export function resolveWindowsTerminal(): ResolvedTerminal {
  if (Bun.which('wt.exe',) !== null) {
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
