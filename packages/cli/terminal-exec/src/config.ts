/**
 * Parses `xdg-terminals.list` config files to extract explicit terminal preferences,
 * exclusions, and TerminalArgExec defaults.
 *
 * @module
 */

import {
  l as parentLogger,
  tagged,
} from './log.ts';

/** Tagged logger for this module. */
const l = tagged({ tag: 'config', l: parentLogger, },);

/**
 * Result of parsing all config files.
 */
export type ConfigResult = {
  /** Explicitly listed entry IDs in priority order. */
  readonly entryIds: readonly string[];
  /** Entry IDs excluded from fallback scanning. */
  readonly excludedIds: ReadonlySet<string>;
  /** Default TerminalArgExec values keyed by entry ID. */
  readonly execArgDefaults: ReadonlyMap<string, string>;
};

/**
 * Reads and parses all xdg-terminals.list config files.
 * Lines starting with `#` or empty lines are ignored.
 * Lines starting with `-` exclude an entry ID from fallback.
 * Lines starting with `/` are directives (e.g. `/execarg_default:id:arg`).
 * All other lines are explicit entry ID preferences.
 *
 * @param paths - Config file paths in descending priority order.
 *
 * @returns Parsed configuration with entries, exclusions, and defaults.
 *
 * @example
 * ```ts
 * const config = await parseConfigFiles({ paths: ['/home/user/.config/xdg-terminals.list'] })
 * // config.entryIds === ['com.mitchellh.ghostty.desktop']
 * ```
 */
export async function parseConfigFiles(
  { paths, }: { paths: readonly string[]; },
): Promise<ConfigResult> {
  const entryIds: string[] = [];
  const excludedIds = new Set<string>();
  /** Tracks IDs that have been explicitly included via `+`, preventing later `-` from excluding them. */
  const includedIds = new Set<string>();
  const execArgDefaults = new Map<string, string>();

  for (const path of paths) {
    const file = Bun.file(path,);
    /* oxlint-disable-next-line no-await-in-loop -- sequential: config files override in priority order */
    if (!await file.exists())
      continue;

    l.debug(`reading config '${path}'`,);
    /* oxlint-disable-next-line no-await-in-loop -- sequential: config files override in priority order */
    const text = await file.text();

    for (const rawLine of text.split('\n',)) {
      const line = rawLine.trim();
      if (line.length === 0 || line.startsWith('#',))
        continue;

      if (line.startsWith('/',)) {
        parseDirective({ line, execArgDefaults, },);
        continue;
      }

      if (line.startsWith('-',)) {
        const id = line.slice(1,);
        if (!includedIds.has(id,)) {
          excludedIds.add(id,);
          l.debug(`excluding entry '${id}' from fallback`,);
        }
        continue;
      }

      if (line.startsWith('+',)) {
        const id = line.slice(1,);
        includedIds.add(id,);
        excludedIds.delete(id,);
        continue;
      }

      entryIds.push(line,);
      l.debug(`explicit entry '${line}'`,);
    }
  }

  return { entryIds, excludedIds, execArgDefaults, };
}

/**
 * Parses a `/`-prefixed directive line from a config file.
 *
 * @param line - Raw directive line including the leading `/`.
 *
 * @param execArgDefaults - Mutable map to populate with `/execarg_default` entries.
 */
function parseDirective(
  { line, execArgDefaults, }: { line: string; execArgDefaults: Map<string, string>; },
): void {
  const EXECARG_PREFIX = '/execarg_default:';
  if (line.startsWith(EXECARG_PREFIX,)) {
    const rest = line.slice(EXECARG_PREFIX.length,);
    const colonIdx = rest.indexOf(':',);
    if (colonIdx !== -1) {
      const entryId = rest.slice(0, colonIdx,);
      const defaultArg = rest.slice(colonIdx + 1,);
      execArgDefaults.set(entryId, defaultArg,);
      l.debug(`added TerminalArgExec default '${defaultArg}' for '${entryId}'`,);
    }
  }
}
