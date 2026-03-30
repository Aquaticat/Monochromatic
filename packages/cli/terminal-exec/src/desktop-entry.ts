/**
 * Parses `.desktop` files following the freedesktop Desktop Entry Specification.
 * Extracts terminal-relevant keys: Exec, Categories, TryExec, Hidden,
 * OnlyShowIn, NotShowIn, and X-TerminalArg* fields.
 *
 * @module
 */

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
  { path, }: { path: string; },
): Promise<DesktopEntry | null> {
  const file = Bun.file(path,);
  if (!await file.exists())
    return null;

  const text = await file.text();
  const result = createEmptyEntry();

  let inDesktopEntry = false;

  for (const rawLine of text.split('\n',)) {
    const line = rawLine.trim();

    if (line.startsWith('[',)) {
      inDesktopEntry = line === '[Desktop Entry]';
      if (!inDesktopEntry && result.exec.length > 0)
        break;
      continue;
    }

    if (!inDesktopEntry)
      continue;

    const eqIdx = line.indexOf('=',);
    if (eqIdx === -1)
      continue;

    const key = line
      .slice(
        0,
        eqIdx,
      )
      .trim();
    const value = line.slice(eqIdx + 1,).trim();

    applyKey({
      key,
      value,
      result,
    },);
  }

  l.debug(
    `parsed '${path}': exec='${result.exec}', isTerminal=${String(result.isTerminal,)}`,
  );
  return result;
}
