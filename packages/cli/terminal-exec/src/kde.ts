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
 * Reads a UTF-8 text file, returning `null` when the read fails.
 * Used to fold the kdeglobals-not-found branch into a single null-check at the call site.
 *
 * @param path - Absolute filesystem path to read.
 *
 * @returns File contents as a UTF-8 string, or `null` when the file is missing or unreadable.
 *
 * @example
 * ```ts
 * const text = await readFileOrNull({ path: '/home/alice/.config/kdeglobals' })
 * // text === '[General]\nTerminalService=...\n' when present, null otherwise
 * ```
 */
async function readFileOrNull(
  { path, }: { readonly path: string; },
): Promise<string | null> {
  try {
    return await readFile(
      path,
      'utf8',
    );
  }
  catch {
    return null;
  }
}

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
  /** HOME envar fallback keeps path construction deterministic on systems where HOME is unset. */
  const home = process.env.HOME
    ?? '/tmp';
  /** XDG config base; defaults under HOME per the spec. */
  const configHome = process.env.XDG_CONFIG_HOME
    ?? `${home}/config`;
  /** KDE's global settings file; source of the TerminalService key. */
  const path = `${configHome}/kdeglobals`;

  /** Null when kdeglobals is absent or unreadable; the catch path is the only failure mode. */
  const text = await readFileOrNull({ path, },);
  if (text === null) {
    l.debug('kdeglobals not found',);
    return null;
  }

  for (const rawLine of text.split('\n',)) {
    /** Whitespace tolerance before the prefix check. */
    const line = rawLine.trim();
    if (line.startsWith('TerminalService=',)) {
      /** Payload after the key, trimmed of stray whitespace before the empty check. */
      const value = line.slice('TerminalService='.length,)
        .trim();
      if (value.length
        > 0) {
        l.debug(`kdeglobals TerminalService='${value}'`,);
        return value;
      }
    }
  }

  l.debug('no TerminalService in kdeglobals',);
  return null;
}
