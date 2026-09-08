import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  type ArchiveOriginalReading,
  archiveOriginalReadingOf,
} from '../archive-original-note.ts';
import { parseDocument, } from '../parse-document.ts';
import { writeDeclinedEntry, } from './declined-entries.ts';
import type {
  CorpusPair,
  EntryOutcome,
} from './pass-entry-contract.ts';
import type { PipelineDigest, } from './pipeline-digest.ts';
import { RUN_CORPUS_PIN, } from './run-config.ts';

//region Pass decline
// The one way an entry leaves the pass without an artifact and without a
// failure: the archive's note says the whole page is the author's own English
// (the owner's rule of 2026-09-08, `archive-original-note.ts`), so nothing is
// bought and the archive stands. Split out of `pass-entry.ts` at its line
// budget.

/**
 * Reads what an entry's archive notes say about whose text the page is.
 *
 * @param entry - corpus pair, text already read
 *
 * @returns The reading, off the archive as inherited
 *
 * @example
 * ```ts
 * const reading = entryArchiveOriginalOf({ entry, },);
 * ```
 */
export function entryArchiveOriginalOf(
  { entry, }: { readonly entry: CorpusPair; },
): ArchiveOriginalReading {
  return archiveOriginalReadingOf({
    document: parseDocument({ text: entry.targetText, },),
  },);
}

/**
 * Records that the pipeline declined an entry, and says so on the run log and
 * the tally.
 *
 * RECORDED, NEVER SILENT: the record is what the next pass skips on, and the
 * archive page stands as the output, untouched.
 *
 * @param entry - entry declined
 *
 * @param declinedDir - directory the record is written into
 *
 * @param tip - repository head the pass runs at
 *
 * @param pipelineDigest - built pipeline that declined it
 *
 * @param note - the archive's note that decided it
 *
 * @param startedAt - when the entry started, for the tally's duration
 *
 * @returns The declined outcome
 *
 * @example
 * ```ts
 * return recordEntryDecline({ entry, declinedDir, tip, pipelineDigest, note, startedAt: t0, },);
 * ```
 */
export async function recordEntryDecline(
  {
    entry,
    declinedDir,
    tip,
    pipelineDigest,
    note,
    startedAt,
  }: {
    readonly entry: CorpusPair;
    readonly declinedDir: string;
    readonly tip: string;
    readonly pipelineDigest: PipelineDigest;
    readonly note: string;
    readonly startedAt: number;
  },
): Promise<EntryOutcome> {
  await writeDeclinedEntry({
    declinedDir,
    record: {
      id: entry.id,
      tip,
      pipelineDigest,
      corpusSha: RUN_CORPUS_PIN.commitSha,
      timestamp: new Date().toISOString(),
      reason: 'archive-original',
      note,
    },
  },);
  tagged({ tag: entry.id, },)
    .info(
      `ARCHIVE ORIGINAL entry=${entry.id}: the archive's note says the whole page is the author's own `
        + `English (${note}), so the pipeline declines to repair it and the archive stands`,
    );
  console.log(
    `TALLY ${entry.id} status=DECLINED reason=archive-original ms=${String(Date.now() - startedAt,)}`,
  );
  return { kind: 'declined', };
}

//endregion Pass decline
