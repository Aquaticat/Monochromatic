/**
 * Parses `.desktop` files following the freedesktop Desktop Entry Specification.
 * Extracts terminal-relevant keys: Exec, Categories, TryExec, Hidden,
 * OnlyShowIn, NotShowIn, and X-TerminalArg* fields.
 *
 * @module
 */

import { l as parentLogger, tagged } from './log.ts';

const l = tagged({ tag: 'desktop-entry', l: parentLogger });

/**
 * Parsed result from a `.desktop` file containing terminal-relevant fields.
 */
export type DesktopEntry = {
  /** Raw Exec value from the desktop entry. */
  readonly exec: string;
  /** Whether `TerminalEmulator` appears in Categories. */
  readonly isTerminal: boolean;
  /** Hidden flag. */
  readonly hidden: boolean;
  /** TryExec binary path, if specified. */
  readonly tryExec: string;
  /** OnlyShowIn desktop list. */
  readonly onlyShowIn: readonly string[];
  /** NotShowIn desktop list. */
  readonly notShowIn: readonly string[];
  /** X-TerminalArgExec or TerminalArgExec value. */
  readonly execArg: string;
  /** X-TerminalArgAppId or TerminalArgAppId value. */
  readonly appIdArg: string;
  /** X-TerminalArgTitle or TerminalArgTitle value. */
  readonly titleArg: string;
  /** X-TerminalArgDir or TerminalArgDir value. */
  readonly dirArg: string;
  /** X-TerminalArgHold or TerminalArgHold value. */
  readonly holdArg: string;
};

/** Desktop entry string escapes per the spec. */
const ESCAPE_MAP: Record<string, string> = {
  's': ' ',
  'n': '\n',
  't': '\t',
  'r': '\r',
  '\\': '\\',
};

/**
 * Expands desktop entry string escapes (`\s`, `\n`, `\t`, `\r`, `\\`).
 *
 * @param s - Raw value from a desktop entry key.
 *
 * @returns Expanded string with escapes resolved.
 */
export function expandEscapes({ s }: { s: string }): string {
  return s.replaceAll(/\\(.)/g, function replaceEscape(_match, char: string) {
    return ESCAPE_MAP[char] ?? char;
  });
}

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
export async function parseDesktopEntry({ path }: { path: string }): Promise<DesktopEntry | null> {
  const file = Bun.file(path);
  if (!await file.exists()) {
    return null;
  }

  const text = await file.text();
  const result: {
    exec: string; isTerminal: boolean; hidden: boolean; tryExec: string;
    onlyShowIn: string[]; notShowIn: string[];
    execArg: string; appIdArg: string; titleArg: string; dirArg: string; holdArg: string;
  } = {
    exec: '', isTerminal: false, hidden: false, tryExec: '',
    onlyShowIn: [], notShowIn: [],
    execArg: '', appIdArg: '', titleArg: '', dirArg: '', holdArg: '',
  };

  let inDesktopEntry = false;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();

    if (line.startsWith('[')) {
      inDesktopEntry = line === '[Desktop Entry]';
      if (!inDesktopEntry && result.exec.length > 0) {
        break;
      }
      continue;
    }

    if (!inDesktopEntry) {
      continue;
    }

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) {
      continue;
    }

    const key = line.slice(0, eqIdx).trim();
    const value = line.slice(eqIdx + 1).trim();

    applyKey({ key, value, result });
  }

  l.debug(`parsed '${path}': exec='${result.exec}', isTerminal=${String(result.isTerminal)}`);
  return result;
}

/**
 * Applies a parsed key-value pair to the result object.
 *
 * @param key - Desktop entry key name.
 *
 * @param value - Raw value string.
 *
 * @param result - Mutable result object to populate.
 */
function applyKey({ key, value, result }: {
  key: string; value: string;
  result: {
    exec: string; isTerminal: boolean; hidden: boolean; tryExec: string;
    onlyShowIn: string[]; notShowIn: string[];
    execArg: string; appIdArg: string; titleArg: string; dirArg: string; holdArg: string;
  };
}): void {
  if (key === 'Exec') {
    result.exec = value;
  } else if (key === 'Categories') {
    result.isTerminal = value.split(';').some(function matchTerminal(cat) { return cat === 'TerminalEmulator'; });
  } else if (key === 'Hidden') {
    result.hidden = value.toLowerCase() === 'true';
  } else if (key === 'TryExec') {
    result.tryExec = expandEscapes({ s: value });
  } else if (key === 'OnlyShowIn') {
    result.onlyShowIn = value.split(';').filter(function nonEmpty(s) { return s.length > 0; });
  } else if (key === 'NotShowIn') {
    result.notShowIn = value.split(';').filter(function nonEmpty(s) { return s.length > 0; });
  } else if (key === 'X-TerminalArgExec' || key === 'TerminalArgExec') {
    result.execArg = expandEscapes({ s: value });
  } else if (key === 'X-TerminalArgAppId' || key === 'TerminalArgAppId') {
    result.appIdArg = expandEscapes({ s: value });
  } else if (key === 'X-TerminalArgTitle' || key === 'TerminalArgTitle') {
    result.titleArg = expandEscapes({ s: value });
  } else if (key === 'X-TerminalArgDir' || key === 'TerminalArgDir') {
    result.dirArg = expandEscapes({ s: value });
  } else if (key === 'X-TerminalArgHold' || key === 'TerminalArgHold') {
    result.holdArg = expandEscapes({ s: value });
  }
}
