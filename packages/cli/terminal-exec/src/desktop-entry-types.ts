/**
 * Types and constants for desktop entry parsing.
 *
 * @module
 */

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
export const ESCAPE_MAP: Record<string, string> = {
  s: ' ',
  n: '\n',
  t: '\t',
  r: '\r',
  '\\': '\\',
};

/**
 * Mutable version of {@link DesktopEntry} used during parsing.
 */
export type MutableDesktopEntry = {
  exec: string;
  isTerminal: boolean;
  hidden: boolean;
  tryExec: string;
  onlyShowIn: string[];
  notShowIn: string[];
  execArg: string;
  appIdArg: string;
  titleArg: string;
  dirArg: string;
  holdArg: string;
};

/**
 * Expands desktop entry string escapes (`\s`, `\n`, `\t`, `\r`, `\\`).
 *
 * @param s - Raw value from a desktop entry key.
 *
 * @returns Expanded string with escapes resolved.
 */
export function expandEscapes({ s, }: { s: string; },): string {
  return s.replaceAll(
    /\\(.)/g,
    function replaceEscape(_match, char: string,) {
    return ESCAPE_MAP[char] ?? char;
  },
  );
}

/**
 * Creates a fresh mutable desktop entry with default values.
 *
 * @returns Empty mutable desktop entry
 */
export function createEmptyEntry(): MutableDesktopEntry {
  return {
    exec: '',
    isTerminal: false,
    hidden: false,
    tryExec: '',
    onlyShowIn: [],
    notShowIn: [],
    execArg: '',
    appIdArg: '',
    titleArg: '',
    dirArg: '',
    holdArg: '',
  };
}
