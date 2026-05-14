/**
 * Scans XDG application directories for `.desktop` files.
 * Derives entry IDs from file paths following the Desktop Entry Specification
 * (subdirectory separators become dashes in the ID).
 *
 * @module
 */

import type { Dirent, } from 'node:fs';
import { readdir, } from 'node:fs/promises';
import {
  join,
  relative,
} from 'node:path';

import {
  l as parentLogger,
  tagged,
} from './log.ts';

/** Tagged logger for this module. */
const l = tagged({
  tag: 'scan',
  l: parentLogger,
},);

/**
 * Registry entry mapping an entry ID to its filesystem path.
 * When the same ID appears in multiple directories, the highest-priority
 * directory (last in the ascending-priority list) wins.
 */
export type EntryRegistration = {
  /** Desktop entry ID, e.g. `com.mitchellh.ghostty.desktop`. */
  readonly id: string;
  /** Absolute path to the `.desktop` file. */
  readonly path: string;
};

/**
 * Recursively finds all `.desktop` files in a directory.
 *
 * @param dir - Absolute path to the applications directory.
 *
 * @returns Array of absolute file paths.
 */
async function findDesktopFiles({ dir, }: { dir: string; },): Promise<readonly string[]> {
  /** Mutable accumulator filled by the inner walk function. */
  const results: string[] = [];

  /**
   * Recursively collects `.desktop` file paths under `current`.
   *
   * @param current - Directory to walk.
   */
  async function walk({ current, }: { current: string; },): Promise<void> {
    /** Empty default lets the catch path return early without restructuring. */
    let entries: Dirent[] = [];
    try {
      entries = await readdir(
        current,
        { withFileTypes: true, },
      );
    }
    catch {
      return;
    }
    for (const entry of entries) {
      /** Absolute candidate for recursion or `.desktop` matching. */
      const fullPath = join(
        current,
        entry.name,
      );
      if (entry.isDirectory()) {
        /* oxlint-disable-next-line no-await-in-loop -- recursive directory walk must be sequential */
        await walk({ current: fullPath, },);
      }
      else if (entry.name.endsWith('.desktop',)) {
        results.push(fullPath,);
      }
    }
  }
  await walk({ current: dir, },);
  return results;
}

/**
 * Scans all application directories for `.desktop` files and builds a registry.
 * Directories are provided in ascending priority order; later directories
 * override earlier ones for duplicate entry IDs.
 *
 * @param dirs - Application directory paths in ascending priority order.
 *
 * @returns Map of entry ID to registration, and ordered fallback ID list (highest priority first).
 *
 * @example
 * ```ts
 * const { registry, fallbackIds } = await scanEntries({
 *   dirs: ['/usr/share/applications/', '~/.local/share/applications/']
 * })
 * ```
 */
export async function scanEntries({ dirs, }: { dirs: readonly string[]; },): Promise<{
  readonly registry: ReadonlyMap<string, EntryRegistration>;
  readonly fallbackIds: readonly string[];
}> {
  /** Mutable map; later dirs override earlier for same ID. */
  const registry = new Map<string, EntryRegistration>();
  /** Tracks insertion order per directory for fallback priority. */
  const allIds: string[] = [];

  for (const dir of dirs) {
    /* oxlint-disable no-await-in-loop -- sequential: later dirs override earlier for same ID */
    /** Desktop files in one directory; one batch per priority level. */
    const files = await findDesktopFiles({ dir, },);
    /* oxlint-enable no-await-in-loop */
    for (const filePath of files) {
      /** Subpath used to derive the entry id. */
      const rel = relative(
        dir,
        filePath,
      );
      /** Entry id per spec: subdir separators become dashes. */
      const id = rel.replaceAll(
        '/',
        '-',
      );
      registry.set(
        id,
        {
          id,
          path: filePath,
        },
      );
      /** Remove previous occurrence so re-adding puts it at the end (higher priority). */
      const prevIdx = allIds.indexOf(id,);
      if (prevIdx !== -1) {
        allIds.splice(
          prevIdx,
          1,
        );
      }
      allIds.push(id,);
    }
  }

  /** Reverse so highest-priority entries come first in fallback ordering. */
  const fallbackIds = allIds.toReversed();

  l.debug(
    `scanned ${String(registry.size,)} entries, ${
      String(fallbackIds.length,)
    } fallback candidates`,
  );
  return {
    registry,
    fallbackIds,
  };
}
