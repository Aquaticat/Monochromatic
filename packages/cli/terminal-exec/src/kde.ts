/**
 * Reads KDE's `kdeglobals` to extract the `TerminalService` desktop entry ID.
 * Used as a fallback when no `xdg-terminals.list` config specifies a terminal.
 *
 * @module
 */

import { readFile, } from 'node:fs/promises';
import {
  l as parentLogger,
  tagged,
} from './log.ts';

/** Tagged logger for this module. */
const l = tagged({
  tag: 'kde',
  l: parentLogger,
},);

/**
 * Reads `TerminalService` from `~/.config/kdeglobals`.
 * This is the desktop entry filename that KDE System Settings writes
 * when the user selects a default terminal emulator.
 *
 * @returns Desktop entry ID (e.g. `com.mitchellh.ghostty.desktop`), or `null` if not configured.
 *
 * @example
 * ```ts
 * const id = await kdeTerminalService()
 * // 'com.mitchellh.ghostty.desktop'
 * ```
 */
export async function kdeTerminalService(): Promise<string | null> {
  const home = process.env['HOME'] ?? '/tmp';
  const configHome = process.env['XDG_CONFIG_HOME'] ?? `${home}/config`;
  const path = `${configHome}/kdeglobals`;

  let text = '';
  try {
    text = await readFile(
      path,
      'utf8',
    );
  }
  catch {
    l.debug('kdeglobals not found',);
    return null;
  }

  for (const rawLine of text.split('\n',)) {
    const line = rawLine.trim();
    if (line.startsWith('TerminalService=',)) {
      const value = line.slice('TerminalService='.length,).trim();
      if (value.length > 0) {
        l.debug(`kdeglobals TerminalService='${value}'`,);
        return value;
      }
    }
  }

  l.debug('no TerminalService in kdeglobals',);
  return null;
}
