/**
 * Desktop entry key application logic.
 *
 * Applies parsed key-value pairs from a `.desktop` file to a mutable result object.
 *
 * @module
 */

import {
  type DesktopEntry,
  expandEscapes,
} from './desktop-entry-types.ts';

/**
 * Maps a parsed key-value pair to the desktop-entry field(s) it sets.
 *
 * @param key - Desktop entry key name.
 *
 * @param value - Raw value string.
 *
 * @returns Partial entry with the field(s) this key sets; empty object for unrecognized keys.
 *
 * @example
 * ```ts
 * applyKey({ key: 'Exec', value: '/usr/bin/xterm' }); // { exec: '/usr/bin/xterm' }
 * applyKey({ key: 'Unknown', value: 'x' });           // {}
 * ```
 */
export function applyKey({
  key,
  value,
}: {
  readonly key: string;
  readonly value: string;
},): Partial<DesktopEntry> {
  if (key === 'Exec')
    return { exec: value, };
  if (key === 'Categories') {
    return {
      isTerminal: value.split(';',)
        .some(function matchTerminal(cat,) {
        return cat === 'TerminalEmulator';
      },),
    };
  }
  if (key === 'Hidden')
    return { hidden: value.toLowerCase()
      === 'true', };
  if (key === 'TryExec')
    return { tryExec: expandEscapes({ s: value, },), };
  if (key === 'OnlyShowIn') {
    return {
      onlyShowIn: value.split(';',)
        .filter(function nonEmpty(s,) {
        return s.length > 0;
      },),
    };
  }
  if (key === 'NotShowIn') {
    return {
      notShowIn: value.split(';',)
        .filter(function nonEmpty(s,) {
        return s.length > 0;
      },),
    };
  }
  if ((key === 'X-TerminalArgExec') || (key === 'TerminalArgExec'))
    return { execArg: expandEscapes({ s: value, },), };
  if ((key === 'X-TerminalArgAppId') || (key === 'TerminalArgAppId'))
    return { appIdArg: expandEscapes({ s: value, },), };
  if ((key === 'X-TerminalArgTitle') || (key === 'TerminalArgTitle'))
    return { titleArg: expandEscapes({ s: value, },), };
  if ((key === 'X-TerminalArgDir') || (key === 'TerminalArgDir'))
    return { dirArg: expandEscapes({ s: value, },), };
  if ((key === 'X-TerminalArgHold') || (key === 'TerminalArgHold'))
    return { holdArg: expandEscapes({ s: value, },), };
  return {};
}
