/**
 * JSONL read/write for canary history.
 *
 * JSONL (one JSON object per line) is ideal for append-only history: appending is a
 * single write with no read-parse-rewrite cycle, and a crash mid-write loses only one line.
 */
import { appendFile, readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import type { HistoryEntry, HistoryFile, } from './history-types.ts';

/** History file path, relative to this package's root */
const PACKAGE_DIR = new URL('..', import.meta.url).pathname;

/** Absolute path to the JSONL history file */
const HISTORY_PATH = join(PACKAGE_DIR, 'canary-history.jsonl');

/**
 * Reads the JSONL history file from disk, parsing each line as a HistoryEntry.
 * Returns an empty history if the file doesn't exist yet. Silently skips malformed lines.
 * @returns parsed history
 */
export async function readHistory(): Promise<HistoryFile> {
  try {
    /** Raw JSONL file content -- one JSON object per non-empty line */
    const raw = await readFile(HISTORY_PATH, 'utf8');
    /** Parsed entries; malformed lines are logged and skipped rather than crashing */
    const entries = raw.split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        try {
          return JSON.parse(line) as HistoryEntry;
        } catch {
          console.log(`[history] skipping malformed line: ${line.slice(0, 80)}`);
          return undefined;
        }
      })
      .filter((entry): entry is HistoryEntry => entry !== undefined);
    return { entries, };
  } catch {
    return { entries: [], };
  }
}

/**
 * Appends new entries to the JSONL history file (one line per entry).
 * @param entries - new entries to add
 */
export async function appendHistory(entries: readonly HistoryEntry[]): Promise<void> {
  const lines = entries.map((entry) => JSON.stringify(entry)).join('\n');
  await appendFile(HISTORY_PATH, `${lines}\n`, 'utf8');
  console.log(`[history] saved ${String(entries.length)} entries`);
}
