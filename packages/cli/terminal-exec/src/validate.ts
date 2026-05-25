/**
 * Validates desktop entry candidates for use as terminal emulators.
 * Checks Categories, Hidden, TryExec, Exec executability, and OnlyShowIn/NotShowIn.
 *
 * @module
 */

import {
  access,
  stat,
} from 'node:fs/promises';
import {
  delimiter,
  resolve,
} from 'node:path';
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
 * Checks if an executable exists in `$PATH` using platform-native resolution.
 *
 * @param name - Executable name or absolute path.
 *
 * @returns `true` if the executable is found.
 */
async function executableExists({ name, }: { readonly name: string; },): Promise<boolean> {
  if (name.startsWith('/',)) {
    try {
      await stat(name,);
      return true;
    }
    catch {
      return false;
    }
  }
  return await which(name,) !== null;
}

/**
 * Cross-runtime `which` implementation.
 * Resolves an executable name by searching directories in `$PATH`.
 *
 * @param name - Executable name to find.
 *
 * @returns Absolute path if found, or `null`.
 */
async function which(name: string,): Promise<string | null> {
  /** Empty PATH fallback yields no candidates, which falls through to null cleanly. */
  const pathEnv = process.env.PATH
    ?? '';
  /** Split on the platform PATH delimiter; colon on POSIX. */
  const dirs = pathEnv.split(delimiter,);
  for (const dir of dirs) {
    /** Absolute path candidate fed to access() inside the loop. */
    const candidate = resolve(
      dir,
      name,
    );
    try {
      /* oxlint-disable-next-line no-await-in-loop -- sequential PATH walk must check one dir at a time */
      await access(candidate,);
      return candidate;
    }
    catch {
      continue;
    }
  }
  return null;
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
 *
 * @example
 * ```ts
 * const validated = validateEntry({
 *   entry, entryId: 'org.xterm', desktops: ['kde'],
 *   isFallback: false, execArgDefault: '-e',
 * });
 * ```
 */
export async function validateEntry({
  entry,
  entryId,
  desktops,
  isFallback,
  execArgDefault,
}: {
  readonly entry: DesktopEntry;
  readonly entryId: string;
  readonly desktops: readonly string[];
  readonly isFallback: boolean;
  readonly execArgDefault: string;
},): Promise<ValidatedEntry | null> {
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
    if (entry.onlyShowIn
      .length
      > 0) {
      /** Whether any OnlyShowIn entry matches the current desktops list. */
      const shown = entry.onlyShowIn
        .some(function matchDesktop(d,) {
        return desktops.includes(d.toLowerCase(),);
      },);
      if (!shown) {
        l.debug(`${entryId}: OnlyShowIn does not match current desktops`,);
        return null;
      }
    }
    if (entry.notShowIn
      .length
      > 0) {
      /** Whether any NotShowIn entry matches the current desktops list. */
      const hidden = entry.notShowIn
        .some(function matchDesktop(d,) {
        return desktops.includes(d.toLowerCase(),);
      },);
      if (hidden) {
        l.debug(`${entryId}: NotShowIn matches current desktop`,);
        return null;
      }
    }
  }
  //endregion

  if ((entry.tryExec
    .length
    > 0)
    && (!await executableExists({ name: entry.tryExec, },)))
  {
    l.debug(`${entryId}: TryExec '${entry.tryExec}' not found`,);
    return null;
  }

  /** Argv form of the Exec line; null or empty disqualifies the entry. */
  const execTokens = tokenizeExec({ exec: entry.exec, },);
  if ((execTokens === null) || (execTokens.length
    === 0)) {
    l.debug(`${entryId}: Exec tokenization failed or empty`,);
    return null;
  }

  /** Executable token, the only one we PATH-check before validating. */
  const [firstToken,] = execTokens;
  if (firstToken === undefined)
    throw new Error('unreachable: length checked above',);
  if (!await executableExists({ name: firstToken, },)) {
    l.debug(`${entryId}: Exec[0] '${firstToken}' not found in PATH`,);
    return null;
  }

  /** Resolve TerminalArgExec: entry value \> config default \> `-e`. */
  const resolvedExecArg = entry.execArg
    .length
    > 0
    ? entry.execArg
    : (execArgDefault.length
      > 0
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
