/**
 * Builds XDG-compliant search paths for terminal config files and application directories.
 *
 * Follows the proposed Default Terminal Execution Specification:
 * config files are searched with optional desktop-environment-specific prefixes,
 * and application directories follow the XDG Base Directory Specification ordering.
 *
 * @module
 */

import {
  l as parentLogger,
  tagged,
} from './log.ts';

/** Tagged logger for this module. */
const l = tagged({ tag: 'xdg-paths', l: parentLogger, },);

/**
 * Builds ordered list of xdg-terminals.list config file paths to search.
 * Desktop-specific variants (e.g. `kde-xdg-terminals.list`) are checked before
 * the generic `xdg-terminals.list` for each config directory.
 *
 * @param desktops - Lowercased desktop names from `$XDG_CURRENT_DESKTOP`.
 *
 * @returns Config file paths in descending priority order (first match wins).
 *
 * @example
 * ```ts
 * const paths = configPaths(['kde'])
 * // ~/.config/kde-xdg-terminals.list, ~/.config/xdg-terminals.list, ...
 * ```
 */
export function configPaths(
  { desktops, }: { desktops: readonly string[]; },
): readonly string[] {
  const home = Bun.env['HOME'] ?? '/tmp';
  const configHome = Bun.env['XDG_CONFIG_HOME'] ?? `${home}/.config`;
  const configDirs = (Bun.env['XDG_CONFIG_DIRS'] ?? '/etc/xdg').split(':',);
  const dataDirs = (Bun.env['XDG_DATA_DIRS'] ?? '/usr/local/share:/usr/share').split(
    ':',
  );

  const paths: string[] = [];

  //region Config directories (XDG_CONFIG_HOME + XDG_CONFIG_DIRS)
  for (const dir of [configHome, ...configDirs,]) {
    for (const desktop of desktops)
      paths.push(`${dir}/${desktop}-xdg-terminals.list`,);
    paths.push(`${dir}/xdg-terminals.list`,);
  }
  //endregion

  //region Data directories (XDG_DATA_DIRS/xdg-terminal-exec/)
  for (const dir of dataDirs) {
    for (const desktop of desktops)
      paths.push(`${dir}/xdg-terminal-exec/${desktop}-xdg-terminals.list`,);
    paths.push(`${dir}/xdg-terminal-exec/xdg-terminals.list`,);
  }
  //endregion

  l.debug(`config paths: ${JSON.stringify(paths,)}`,);
  return paths;
}

/**
 * Builds ordered list of XDG application directories.
 * Returned in ascending priority order (last directory's entries override earlier ones
 * for duplicate entry IDs).
 *
 * @returns Application directory paths, each with trailing `/`.
 *
 * @example
 * ```ts
 * const dirs = applicationDirs()
 * // ['/usr/share/applications/', '/usr/local/share/applications/', '~/.local/share/applications/']
 * ```
 */
export function applicationDirs(): readonly string[] {
  const home = Bun.env['HOME'] ?? '/tmp';
  const dataHome = Bun.env['XDG_DATA_HOME'] ?? `${home}/.local/share`;
  const dataDirs = (Bun.env['XDG_DATA_DIRS'] ?? '/usr/local/share:/usr/share').split(
    ':',
  );

  /** Ascending priority: system dirs first, user dir last */
  const dirs = [
    ...dataDirs.toReversed().map(function ensureTrailingSlash(dir,) {
      return `${dir.replace(/\/+$/, '',)}/applications/`;
    },),
    `${dataHome}/applications/`,
  ];

  l.debug(`application dirs: ${JSON.stringify(dirs,)}`,);
  return dirs;
}

/**
 * Extracts lowercased desktop names from `$XDG_CURRENT_DESKTOP`.
 *
 * @returns Array of desktop name strings, e.g. `['kde']`.
 */
export function currentDesktops(): readonly string[] {
  const raw = Bun.env['XDG_CURRENT_DESKTOP'] ?? '';
  return raw
    .split(':',)
    .filter(function nonEmpty(s,) {
      return s.length > 0;
    },)
    .map(function lower(s,) {
      return s.toLowerCase();
    },);
}
