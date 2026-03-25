/**
 * Validates desktop entry candidates for use as terminal emulators.
 * Checks Categories, Hidden, TryExec, Exec executability, and OnlyShowIn/NotShowIn.
 *
 * @module
 */

import type { DesktopEntry, } from './desktop-entry.ts';
import {
  l as parentLogger,
  tagged,
} from './log.ts';
import { tokenizeExec, } from './tokenize.ts';

/** Tagged logger for this module. */
const l = tagged({
  tag: 'validate',
  l: parentLogger,
},);

/**
 * Checks if an executable exists in `$PATH` using Bun's `which`.
 *
 * @param name - Executable name or absolute path.
 *
 * @returns `true` if the executable is found.
 */
function executableExists({ name, }: { name: string; },): boolean {
  if (name.startsWith('/',))
    return Bun.file(name,).size > 0;
  return Bun.which(name,) !== null;
}

/**
 * Result of validating a desktop entry for terminal emulator use.
 */
export type ValidatedEntry = {
  /** Tokenized Exec command as an argument array. */
  readonly execTokens: readonly string[];
  /** Resolved TerminalArgExec value (from entry, default, or `-e`). */
  readonly execArg: string;
  /** TerminalArgAppId value. */
  readonly appIdArg: string;
  /** TerminalArgTitle value. */
  readonly titleArg: string;
  /** TerminalArgDir value. */
  readonly dirArg: string;
  /** TerminalArgHold value. */
  readonly holdArg: string;
};

/**
 * Validates a parsed desktop entry as a usable terminal emulator.
 *
 * @param entry - Parsed desktop entry.
 *
 * @param entryId - Desktop entry ID for logging and default lookups.
 *
 * @param desktops - Current desktop names for OnlyShowIn/NotShowIn checks.
 *
 * @param isFallback - Whether this is a fallback entry (enables ShowIn checks).
 *
 * @param execArgDefault - Default TerminalArgExec from config, if any.
 *
 * @returns Validated entry with tokenized Exec, or `null` if the entry fails validation.
 */
export function validateEntry({
  entry,
  entryId,
  desktops,
  isFallback,
  execArgDefault,
}: {
  entry: DesktopEntry;
  entryId: string;
  desktops: readonly string[];
  isFallback: boolean;
  execArgDefault: string;
},): ValidatedEntry | null {
  if (!entry.isTerminal) {
    l.debug(`${entryId}: not a TerminalEmulator`,);
    return null;
  }

  if (entry.hidden) {
    l.debug(`${entryId}: hidden`,);
    return null;
  }

  //region OnlyShowIn / NotShowIn (fallback entries only)
  if (isFallback) {
    if (entry.onlyShowIn.length > 0) {
      const shown = entry.onlyShowIn.some(function matchDesktop(d,) {
        return desktops.includes(d.toLowerCase(),);
      },);
      if (!shown) {
        l.debug(`${entryId}: OnlyShowIn does not match current desktops`,);
        return null;
      }
    }
    if (entry.notShowIn.length > 0) {
      const hidden = entry.notShowIn.some(function matchDesktop(d,) {
        return desktops.includes(d.toLowerCase(),);
      },);
      if (hidden) {
        l.debug(`${entryId}: NotShowIn matches current desktop`,);
        return null;
      }
    }
  }
  //endregion

  if (entry.tryExec.length > 0 && !executableExists({ name: entry.tryExec, },)) {
    l.debug(`${entryId}: TryExec '${entry.tryExec}' not found`,);
    return null;
  }

  const execTokens = tokenizeExec({ exec: entry.exec, },);
  if (execTokens === null || execTokens.length === 0) {
    l.debug(`${entryId}: Exec tokenization failed or empty`,);
    return null;
  }

  const [firstToken,] = execTokens;
  if (firstToken === undefined)
    throw new Error('unreachable — length checked above',);
  if (!executableExists({ name: firstToken, },)) {
    l.debug(`${entryId}: Exec[0] '${firstToken}' not found in PATH`,);
    return null;
  }

  /** Resolve TerminalArgExec: entry value \> config default \> `-e`. */
  const resolvedExecArg = entry.execArg.length > 0
    ? entry.execArg
    : (execArgDefault.length > 0
      ? execArgDefault
      : '-e');

  l.debug(`${entryId}: validated, execArg='${resolvedExecArg}'`,);

  return {
    execTokens,
    execArg: resolvedExecArg,
    appIdArg: entry.appIdArg,
    titleArg: entry.titleArg,
    dirArg: entry.dirArg,
    holdArg: entry.holdArg,
  };
}
