import {
  appendFile,
  mkdir,
  readFile,
} from 'node:fs/promises';
import { dirname, } from 'node:path';

import { isJsonRecord, } from '../json-guard.ts';

//region Window trial ledger
// What a window trial has already bought, kept on disk as it is bought.
//
// WHY IT EXISTS. `#108` judges each flagged slice three times, roughly 1760 real
// exchanges. The slice cache does not help: it is keyed and read by the DOCUMENT
// DRIVER, and this trial calls the stage directly, so nothing resumes. A run
// that dies at hour three would otherwise restart from zero.
//
// ONE LINE PER COMPLETED ARM, appended the moment it completes rather than
// batched at the end, because the failure this guards against is the process
// not reaching the end.
//
// WHAT MAKES A LINE SKIPPABLE is the protocol it was bought under, not just
// which slice it describes. A trial re-run after the rosters, the corpus pin or
// the code generation moved is asking a different question, and resuming across
// that boundary would silently mix two experiments into one tally. That is the
// same defect the slice cache's generation marker exists to prevent, and it is
// worse here because the output is a measurement rather than a document.

/**
 * One completed arm of one slice's trial.
 *
 * @example
 * ```ts
 * const row: WindowTrialRow = { protocol: 'abc123', entryId: 'Mittens', chunkIndex: 7, arm: 'wide', sliceClass: 'relocation', shipped: true, decision: 'judged', winnerText: '...', judgesHeard: 6, judgesSeated: 6, position: 2, };
 * ```
 */
export type WindowTrialRow = {
  /**
   * Digest of everything this arm was bought under: rosters, corpus pin, code
   * generation, and the trial's own version.
   *
   * A row whose protocol differs from the current one is NOT resumed, and is
   * not deleted either: it is another experiment's evidence and the file is
   * append-only.
   */
  readonly protocol: string;

  /**
   * Corpus entry the slice belongs to.
   */
  readonly entryId: string;

  /**
   * Slice position within that entry's preparation.
   */
  readonly chunkIndex: number;

  /**
   * Which arm this row is: the two narrow runs are what the run-to-run band is
   * measured from, so they are distinguishable rather than pooled.
   */
  readonly arm: string;

  /**
   * Class the displacement screen flagged this slice as, or the control label.
   */
  readonly sliceClass: string;

  /**
   * Whether this arm replaced the archive's wording.
   */
  readonly shipped: boolean;

  /**
   * How the round ended, so a decline is distinguishable from a keep.
   */
  readonly decision: string;

  /**
   * Winning text, kept because two arms can both replace and choose
   * differently, which a boolean cannot show.
   */
  readonly winnerText: string;

  /**
   * Judges whose ballot arrived and validated.
   *
   * RECORDED BECAUSE A LOST VOICE LOOKS LIKE A KEPT ARCHIVE. The fan-out retries
   * to a quorum of half the roster and then proceeds, so an arm three judges
   * timed out on is written as an ordinary decision. The wide arm sends the
   * longest sheets under the same deadline, which means degradation lands
   * asymmetrically on exactly the arm under test: unrecorded, it would read as
   * the window making judges conservative.
   */
  readonly judgesHeard: number;

  /**
   * Judges the arm seated, which {@link WindowTrialRow.judgesHeard} is read
   * against.
   */
  readonly judgesSeated: number;

  /**
   * Which of this slice's three calls this arm was, zero-based.
   *
   * RECORDED BECAUSE THE POSITION IS ASSIGNED, not fixed. The wide arm used to
   * be third on every slice, which aliased it onto anything that drifts across
   * a slice's calls; it now sits at a position derived from the slice, and this
   * field is what lets the effect of position be estimated rather than assumed
   * away.
   */
  readonly position: number;
};

/**
 * Identity of one arm, which is what resumption skips on.
 *
 * THE ARM IS PART OF IT, so the two narrow runs of one slice are distinct keys.
 * Pooling them would erase the run-to-run band, which is the only thing the
 * narrow-to-wide difference can be read against.
 *
 * ENCODED RATHER THAN JOINED. Every caller must build the key through this
 * function, because a key is only useful if two builders agree on it and a
 * hand-joined one silently does not: an earlier version of this file joined on a
 * NUL byte while the runner joined on a space, which renders identically in most
 * readers and matched nothing, so every resumed run re-bought arms it already
 * held. Encoding also means an entry id containing the separator cannot forge
 * another slice's key.
 *
 * @param row - arm to identify, or enough of one
 *
 * @returns Key unique to this protocol, entry, slice and arm together
 *
 * @example
 * ```ts
 * const key = trialKey({ row, },);
 * ```
 */
export function trialKey(
  { row, }: {
    readonly row: Pick<WindowTrialRow, 'protocol' | 'entryId' | 'chunkIndex' | 'arm'>;
  },
): string {
  return JSON.stringify([
    row.protocol,
    row.entryId,
    row.chunkIndex,
    row.arm,
  ],);
}

/**
 * Whether a parsed line is a usable row.
 *
 * @param value - parsed JSON of one line
 *
 * @returns True when every field this ledger reads is present and typed
 *
 * @example
 * ```ts
 * if (isWindowTrialRow(parsed,)) rows.push(parsed,);
 * ```
 */
function isWindowTrialRow(value: unknown,): value is WindowTrialRow {
  return isJsonRecord(value,)
    && ((typeof value.protocol) === 'string')
    && ((typeof value.entryId) === 'string')
    && ((typeof value.chunkIndex) === 'number')
    && ((typeof value.arm) === 'string')
    && ((typeof value.sliceClass) === 'string')
    && ((typeof value.shipped) === 'boolean')
    && ((typeof value.decision) === 'string')
    && ((typeof value.winnerText) === 'string')
    && ((typeof value.judgesHeard) === 'number')
    && ((typeof value.judgesSeated) === 'number')
    && ((typeof value.position) === 'number');
}

/**
 * Reads every completed arm from a ledger, tolerating a torn final line.
 *
 * A TORN LAST LINE IS EXPECTED rather than exceptional: the process this guards
 * against is one killed mid-append, so the last line may be a fragment. It is
 * dropped and the arm is re-bought, which costs one arm. A torn line ANYWHERE
 * ELSE would mean interleaved writers, which this refuses rather than repairs,
 * because a ledger two runs appended to concurrently cannot be trusted to say
 * what was bought.
 *
 * @param path - ledger file
 *
 * @returns Rows in the order they were appended, empty when the file is absent
 *
 * @throws {@link SyntaxError} when a line other than the last fails to parse,
 * which means something other than a clean kill wrote to this file
 *
 * @example
 * ```ts
 * const rows = await readTrialLedger({ path, },);
 * ```
 */
export async function readTrialLedger(
  { path, }: { readonly path: string; },
): Promise<readonly WindowTrialRow[]> {
  /**
   * Whole ledger, absent when nothing has been bought yet.
   */
  const text = await readLedgerText({ path, },);
  if (text === '')
    return [];

  /**
   * Every non-empty line, in append order.
   */
  const lines = text.split('\n',)
    .filter(function present(line,): boolean {
      return line.trim() !== '';
    },);

  return lines.flatMap(function toRow(
    line,
    lineIndex,
  ): readonly WindowTrialRow[] {
    /**
     * Whether this is the last line, which is the only one allowed to be torn.
     */
    const isLast = lineIndex === (lines.length - 1);
    try {
      /**
       * Parsed line, guarded before it is trusted.
       */
      const parsed: unknown = JSON.parse(line,);
      return isWindowTrialRow(parsed,) ? [parsed,] : [];
    }
    catch (error) {
      if (isLast && (error instanceof SyntaxError))
        return [];
      throw error;
    }
  },);
}

/**
 * Reads a ledger's text, reporting an absent file as empty.
 *
 * @param path - ledger file
 *
 * @returns File contents, empty when it does not exist
 *
 * @example
 * ```ts
 * const text = await readLedgerText({ path, },);
 * ```
 */
async function readLedgerText(
  { path, }: { readonly path: string; },
): Promise<string> {
  try {
    return await readFile(
      path,
      'utf8',
    );
  }
  catch (error) {
    // Absent is the ordinary state before the first arm is bought.
    if (Error.isError(error,)
      && ('code' in error)
      && (error.code === 'ENOENT'))
      return '';
    throw error;
  }
}

/**
 * Appends one completed arm.
 *
 * CALLED THE MOMENT THE ARM COMPLETES, never batched. What this protects
 * against is the process not reaching the end, so anything held in memory to
 * write later is exactly what is lost.
 *
 * @param path - ledger file
 *
 * @param row - arm that completed
 *
 * @example
 * ```ts
 * await appendTrialRow({ path, row, },);
 * ```
 */
export async function appendTrialRow(
  {
    path,
    row,
  }: {
    readonly path: string;
    readonly row: WindowTrialRow;
  },
): Promise<void> {
  await mkdir(
    dirname(path,),
    { recursive: true, },
  );
  await appendFile(
    path,
    `${JSON.stringify(row,)}\n`,
  );
}

/**
 * Arms already bought under one protocol, as keys a runner skips on.
 *
 * ROWS FROM ANOTHER PROTOCOL ARE IGNORED rather than removed. They were bought
 * under different rosters, a different corpus pin or different code, so they
 * answer a different question; counting them would mix two experiments, and
 * deleting them would discard evidence this run has no claim over.
 *
 * @param rows - every row the ledger holds
 *
 * @param protocol - digest this run is buying under
 *
 * @returns Keys of arms this run may skip
 *
 * @example
 * ```ts
 * const done = completedArms({ rows, protocol, },);
 * ```
 */
export function completedArms(
  {
    rows,
    protocol,
  }: {
    readonly rows: readonly WindowTrialRow[];
    readonly protocol: string;
  },
): ReadonlySet<string> {
  return new Set(rows
    .filter(function underThisProtocol(row,): boolean {
      return row.protocol === protocol;
    },)
    .map(function toKey(row,): string {
      return trialKey({ row, },);
    },),);
}

//endregion Window trial ledger
