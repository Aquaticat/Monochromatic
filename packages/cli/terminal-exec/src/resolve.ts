/**
 * Main terminal resolution algorithm.
 * Dispatches to platform-specific resolution:
 *
 * **Linux/FreeBSD** (XDG):
 * 1. Explicit entries from `xdg-terminals.list` config files
 * 2. KDE `kdeglobals` TerminalService fallback (when no explicit entries exist)
 * 3. All `TerminalEmulator`-category desktop entries as fallback
 *
 * **Windows**:
 * 1. Windows Terminal (`wt.exe`)
 * 2. `cmd.exe`
 *
 * @module
 */

import { parseConfigFiles } from './config.ts';
import { parseDesktopEntry } from './desktop-entry.ts';
import { kdeTerminalService } from './kde.ts';
import { l as parentLogger, tagged } from './log.ts';
import { scanEntries } from './scan.ts';
import type { ValidatedEntry } from './validate.ts';
import { validateEntry } from './validate.ts';
import { resolveWindowsTerminal } from './windows.ts';
import { applicationDirs, configPaths, currentDesktops } from './xdg-paths.ts';

const l = tagged({ tag: 'resolve', l: parentLogger });

/**
 * Successful terminal resolution result.
 */
export type ResolvedTerminal = ValidatedEntry & {
  /** Desktop entry ID (Linux) or executable name (Windows) that was selected. */
  readonly entryId: string;
};

/**
 * Resolves the preferred terminal emulator for the current platform.
 *
 * @returns Resolved terminal entry, or `null` if no valid terminal is found.
 *
 * @example
 * ```ts
 * const terminal = await resolveTerminal()
 * // Linux: terminal.entryId === 'com.mitchellh.ghostty.desktop'
 * // Windows: terminal.entryId === 'wt.exe'
 * ```
 */
export async function resolveTerminal(): Promise<ResolvedTerminal | null> {
  if (process.platform === 'win32') {
    l.debug('platform: win32');
    return resolveWindowsTerminal();
  }

  l.debug(`platform: ${process.platform} (XDG)`);
  return resolveXdgTerminal();
}

/**
 * Resolves the terminal emulator using the XDG Desktop Entry Specification.
 * Used on Linux, FreeBSD, and other Unix-like systems.
 *
 * @returns Resolved terminal entry, or `null` if no valid terminal is found.
 */
async function resolveXdgTerminal(): Promise<ResolvedTerminal | null> {
  const desktops = currentDesktops();
  const configs = configPaths({ desktops });
  const config = await parseConfigFiles({ paths: configs });

  const dirs = applicationDirs();
  const { registry, fallbackIds } = await scanEntries({ dirs });

  //region Build candidate list: explicit entries, then KDE fallback, then fallback scan
  let explicitIds = [...config.entryIds];

  if (explicitIds.length === 0) {
    l.debug('no explicit entries in config, checking kdeglobals');
    const kdeId = await kdeTerminalService();
    if (kdeId !== null) {
      explicitIds = [kdeId];
      l.debug(`using KDE TerminalService '${kdeId}' as explicit entry`);
    }
  }

  /** Fallback IDs with exclusions applied. */
  const filteredFallbackIds = fallbackIds.filter(function notExcluded(id) {
    return !config.excludedIds.has(id);
  });
  //endregion

  //region Try explicit entries first (bypass OnlyShowIn/NotShowIn)
  for (const entryId of explicitIds) {
    const result = await tryEntry({ entryId, registry, desktops, isFallback: false, config });
    if (result !== null) {
      return { ...result, entryId };
    }
  }
  //endregion

  //region Try fallback entries
  for (const entryId of filteredFallbackIds) {
    const result = await tryEntry({ entryId, registry, desktops, isFallback: true, config });
    if (result !== null) {
      return { ...result, entryId };
    }
  }
  //endregion

  l.debug('no valid terminal emulator found');
  return null;
}

/**
 * Attempts to resolve a single entry ID into a validated terminal.
 *
 * @param entryId - Desktop entry ID to try.
 * @param registry - Entry registry from scanning.
 * @param desktops - Current desktop names.
 * @param isFallback - Whether this is a fallback entry.
 * @param config - Parsed config for execarg defaults.
 * @returns Validated entry or `null`.
 */
async function tryEntry({ entryId, registry, desktops, isFallback, config }: {
  entryId: string;
  registry: ReadonlyMap<string, { readonly id: string; readonly path: string }>;
  desktops: ReadonlyArray<string>;
  isFallback: boolean;
  config: { readonly execArgDefaults: ReadonlyMap<string, string> };
}): Promise<ValidatedEntry | null> {
  const reg = registry.get(entryId);
  if (reg === undefined) {
    l.debug(`entry '${entryId}' not found in registry`);
    return null;
  }

  const entry = await parseDesktopEntry({ path: reg.path });
  if (entry === null) {
    return null;
  }

  return validateEntry({
    entry,
    entryId,
    desktops,
    isFallback,
    execArgDefault: config.execArgDefaults.get(entryId) ?? '',
  });
}
