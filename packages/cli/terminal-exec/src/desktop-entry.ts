/**
 * Parses `.desktop` files following the freedesktop Desktop Entry Specification.
 * Extracts terminal-relevant keys: Exec, Categories, TryExec, Hidden,
 * OnlyShowIn, NotShowIn, and X-TerminalArg* fields.
 *
 * @module
 */

import { readFile, } from 'node:fs/promises';
import { applyKey, } from './desktop-entry-apply.ts';
import {
  createEmptyEntry,
  type DesktopEntry,
} from './desktop-entry-types.ts';
import {
  l as parentLogger,
  tagged,
} from './log.ts';

export type { DesktopEntry, } from './desktop-entry-types.ts';
export { expandEscapes, } from './desktop-entry-types.ts';

/** Tagged logger for this module. */
const l = tagged({
  tag: 'desktop-entry',
  l: parentLogger,
},);

/**
 * Parses a `.desktop` file and extracts terminal-relevant keys.
 * Only reads keys from the `[Desktop Entry]` section (not actions).
 *
 * @param path - Absolute path to the `.desktop` file.
 *
 * @returns Parsed desktop entry, or `null` if the file cannot be read.
 *
 * @example
 * ```ts
 * const entry = await parseDesktopEntry({ path: '/usr/share/applications/com.mitchellh.ghostty.desktop' })
 * // entry.exec === '/usr/bin/ghostty --gtk-single-instance=true'
 * // entry.isTerminal === true
 * ```
 */
export async function parseDesktopEntry(
  { path, }: { readonly path: string; },
): Promise<DesktopEntry | null> {
  /** Empty default lets the catch return null without restructuring the read path. */
  let text = '';
  try {
    text = await readFile(
      path,
      'utf8',
    );
  }
  catch {
    return null;
  }

  /** Mutated by applyKey calls below; one accumulator per parsed file. */
  const result = createEmptyEntry();

  /** Section gate; toggled on each `[Section]` line so non-Desktop Entry sections are skipped. */
  let inDesktopEntry = false;

  for (const rawLine of text.split('\n',)) {
    /** Whitespace tolerance before prefix checks. */
    const line = rawLine.trim();

    if (line.startsWith('[',)) {
      inDesktopEntry = line === '[Desktop Entry]';
      if ((!inDesktopEntry) && (result.exec
        .length
        > 0))
        break;
      continue;
    }

    if (!inDesktopEntry)
      continue;

    /** Separator index; -1 means a non-key line that must be skipped. */
    const eqIdx = line.indexOf('=',);
    if (eqIdx === (-1))
      continue;

    /** Normalized key name passed to applyKey for dispatch. */
    const key = line
      .slice(
        0,
        eqIdx,
      )
      .trim();
    /** Payload after `=`, trimmed before applyKey stores it. */
    const value = line.slice(eqIdx + 1,)
      .trim();

    Object.assign(
      result,
      applyKey({
        key,
        value,
      },),
    );
  }

  l.debug(
    `parsed '${path}': exec='${result.exec}', isTerminal=${String(result.isTerminal,)}`,
  );
  return result;
}
