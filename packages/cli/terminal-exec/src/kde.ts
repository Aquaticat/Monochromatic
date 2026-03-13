/**
 * Reads KDE's `kdeglobals` to extract the `TerminalService` desktop entry ID.
 * Used as a fallback when no `xdg-terminals.list` config specifies a terminal.
 *
 * @module
 */

import { l as parentLogger, tagged } from './log.ts';

const l = tagged({ tag: 'kde', l: parentLogger });

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
  const home = Bun.env['HOME'] ?? '/tmp';
  const configHome = Bun.env['XDG_CONFIG_HOME'] ?? `${home}/.config`;
  const path = `${configHome}/kdeglobals`;

  const file = Bun.file(path);
  if (!await file.exists()) {
    l.debug('kdeglobals not found');
    return null;
  }

  const text = await file.text();

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('TerminalService=')) {
      const value = line.slice('TerminalService='.length).trim();
      if (value.length > 0) {
        l.debug(`kdeglobals TerminalService='${value}'`);
        return value;
      }
    }
  }

  l.debug('no TerminalService in kdeglobals');
  return null;
}
