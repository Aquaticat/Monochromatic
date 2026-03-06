/**
 * Reads and parses canary history from the sibling inference-canary package.
 *
 * Re-exports types so downstream modules only import from this package.
 */
import { readFile, } from 'node:fs/promises';

import { HISTORY_PATH, } from '@monochromatic-dev/dev-script-inference-canary/src/paths.ts';

import type { HistoryEntry, HistoryFile, OpenRouterModelId, } from '@monochromatic-dev/dev-script-inference-canary/src/history-types.ts';

export type { HistoryEntry, HistoryFile, OpenRouterModelId, };

/**
 * Reads the JSONL history file from the inference-canary package.
 * Returns empty history when the file does not exist (first run).
 * Skips malformed lines with a warning.
 * @returns parsed history entries
 */
export async function readHistory(): Promise<HistoryFile> {
  try {
    const raw = await readFile(HISTORY_PATH, 'utf8');
    const entries = raw.split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        try {
          return JSON.parse(line) as HistoryEntry;
        } catch {
          console.error(`[viewer] skipping malformed history line: ${line.slice(0, 80)}`);
          return;
        }
      })
      .filter((entry): entry is HistoryEntry => entry !== undefined);
    return { entries, };
  } catch (error) {
    const isEnoent = error instanceof Error && 'code' in error && error.code === 'ENOENT';
    if (!isEnoent) {
      console.error('[viewer] failed to read history file:', error);
    }
    return { entries: [], };
  }
}

export { HISTORY_PATH, };
