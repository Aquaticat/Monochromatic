/**
 * Tokenizes desktop entry `Exec` values following the freedesktop Desktop Entry Specification.
 * Handles double-quote escaping, `%` field code stripping, and rejects unquoted shell metacharacters.
 *
 * @module
 */

import {
  l as parentLogger,
  tagged,
} from './log.ts';

/** Tagged logger for this module. */
const l = tagged({
  tag: 'tokenize',
  l: parentLogger,
},);

/** Shell metacharacters that are invalid unquoted in Exec values. */
const UNQUOTED_REJECT = new Set([
  '$',
  '`',
  '>',
  '<',
  '|',
  '&',
  ';',
  '(',
  ')',
],);

/** Recognized `%` field codes to strip from Exec values. */
const FIELD_CODES = new Set([
  'f',
  'F',
  'u',
  'U',
  'i',
  'c',
  'k',
  'd',
  'D',
  'n',
  'N',
  'v',
  'm',
],);

/**
 * Tokenizes a desktop entry `Exec` value into an argument array.
 * Strips `%` field codes and rejects lines with unquoted shell metacharacters.
 *
 * @param exec - Raw Exec value from the desktop entry.
 *
 * @returns Array of argument tokens, or `null` if the value contains invalid syntax.
 *
 * @example
 * ```ts
 * tokenizeExec({ exec: '/usr/bin/ghostty --gtk-single-instance=true' })
 * // ['/usr/bin/ghostty', '--gtk-single-instance=true']
 * ```
 */
export function tokenizeExec({ exec, }: { exec: string; },): readonly string[] | null {
  const tokens: string[] = [];
  let current = '';
  let inQuote = false;
  let i = 0;

  while (i < exec.length) {
    const ch = exec[i];
    if (ch === undefined)
      break;

    if (inQuote) {
      if (ch === '"') {
        inQuote = false;
        i++;
        continue;
      }
      if (ch === '\\' && i + 1 < exec.length) {
        const next = exec[i + 1];
        if (next === undefined)
          break; // unreachable (length checked above)
        if (next === '"' || next === '`' || next === '$' || next === '\\') {
          current += next;
          i += 2;
          continue;
        }
      }
      current += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuote = true;
      i++;
      continue;
    }

    if (ch === ' ' || ch === '\t') {
      if (current.length > 0) {
        tokens.push(current,);
        current = '';
      }
      i++;
      continue;
    }

    if (UNQUOTED_REJECT.has(ch,)) {
      l.debug(`rejected unquoted character '${ch}' in exec: ${exec}`,);
      return null;
    }

    //region % field code stripping
    if (ch === '%' && i + 1 < exec.length) {
      const next = exec[i + 1];
      if (next === undefined)
        break; // unreachable (length checked above)
      if (next === '%') {
        current += '%';
        i += 2;
        continue;
      }
      if (FIELD_CODES.has(next,)) {
        i += 2;
        continue;
      }
    }
    //endregion

    current += ch;
    i++;
  }

  if (inQuote) {
    l.debug(`unterminated quote in exec: ${exec}`,);
    return null;
  }

  if (current.length > 0)
    tokens.push(current,);

  l.debug(`tokenized: ${JSON.stringify(tokens,)}`,);
  return tokens;
}
