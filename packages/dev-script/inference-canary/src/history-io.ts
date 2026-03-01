/**
 * JSONL read/write for canary history.
 *
 * JSONL (one JSON object per line) is ideal for append-only history: appending is a
 * single write with no read-parse-rewrite cycle, and a crash mid-write loses only one line.
 */
import { appendFile, readFile, } from 'node:fs/promises';

import { HISTORY_PATH, } from './paths.ts';

import type { HistoryEntry, HistoryFile, } from './history-types.ts';

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
          /** Maximum characters to show from a malformed line in the log */
          const MALFORMED_LINE_PREVIEW_LENGTH = 80;
          console.log(`[history] skipping malformed line: ${line.slice(0, MALFORMED_LINE_PREVIEW_LENGTH)}`);
          return;
        }
      })
      .filter((entry): entry is HistoryEntry => entry !== undefined);
    return { entries, };
  } catch (error) {
    // ENOENT is expected on first run; log anything else so real I/O errors are visible
    const isEnoent = error instanceof Error && 'code' in error && error.code === 'ENOENT';
    if (!isEnoent) console.error('[history] failed to read history file:', error);
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
