/**
 * Desktop entry key application logic.
 *
 * Applies parsed key-value pairs from a `.desktop` file to a mutable result object.
 *
 * @module
 */

import {
  expandEscapes,
  type MutableDesktopEntry,
} from './desktop-entry-types.ts';

/**
 * Applies a parsed key-value pair to the result object.
 *
 * @param key - Desktop entry key name.
 *
 * @param value - Raw value string.
 *
 * @param result - Mutable result object to populate.
 *
 * @example
 * ```ts
 * const result = createEmptyEntry();
 * applyKey({ key: 'Exec', value: '/usr/bin/xterm', result });
 * ```
 */
export function applyKey({
  key,
  value,
  result,
}: {
  key: string;
  value: string;
  result: MutableDesktopEntry;
},): void {
  if (key === 'Exec')
    result.exec = value;
  else if (key === 'Categories') {
    result.isTerminal = value.split(';',).some(function matchTerminal(cat,) {
      return cat === 'TerminalEmulator';
    },);
  }
  else if (key === 'Hidden')
    result.hidden = value.toLowerCase() === 'true';
  else if (key === 'TryExec')
    result.tryExec = expandEscapes({ s: value, },);
  else if (key === 'OnlyShowIn') {
    result.onlyShowIn = value.split(';',).filter(function nonEmpty(s,) {
      return s.length > 0;
    },);
  }
  else if (key === 'NotShowIn') {
    result.notShowIn = value.split(';',).filter(function nonEmpty(s,) {
      return s.length > 0;
    },);
  }
  else if ((key === 'X-TerminalArgExec') || (key === 'TerminalArgExec'))
    result.execArg = expandEscapes({ s: value, },);
  else if ((key === 'X-TerminalArgAppId') || (key === 'TerminalArgAppId'))
    result.appIdArg = expandEscapes({ s: value, },);
  else if ((key === 'X-TerminalArgTitle') || (key === 'TerminalArgTitle'))
    result.titleArg = expandEscapes({ s: value, },);
  else if ((key === 'X-TerminalArgDir') || (key === 'TerminalArgDir'))
    result.dirArg = expandEscapes({ s: value, },);
  else if ((key === 'X-TerminalArgHold') || (key === 'TerminalArgHold'))
    result.holdArg = expandEscapes({ s: value, },);
}
