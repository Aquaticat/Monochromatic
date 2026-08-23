import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from '../chat-contract.ts';
import { runCoverageStage, } from '../coverage-stage.ts';
import type { CoverageVerdict, } from '../coverage-verdict.ts';
import { parseDocument, } from '../parse-document.ts';
import type { SyntheticModelId, } from '../synthetic-catalog.ts';
import type { AnchorTarget, } from '../validate-issue.ts';
import { decoyCut, } from './coverage-control-decoy.ts';

//region Coverage control
// Whether the coverage roster can vote absence AT ALL, asked before its
// unanimity is read as evidence of anything.
//
// `#106` records ninety-six block-scale answers carrying not one vote for
// absence. TWO DIFFERENT THINGS PRODUCE EXACTLY THAT READING: a translation
// that genuinely carries every passage, and a wire whose evidence rule admits
// any non-empty quote, so nothing can ever be found missing. Nothing recorded
// separates them, and the second would make the null an artifact of the
// instrument rather than a fact about the corpus.
//
// THE DAMAGE IS THE ROSTER'S OWN EVIDENCE. Coverage candidates are by
// construction the passages the aligners REFUSE to pair, so nothing outside the
// roster's own answer says which target text renders one. Asking first and then
// deleting exactly the spans it pointed at is the only cut known to remove the
// rendering, rather than some text that happened to sit near it.
//
// SPENDS QUOTA: two roster rounds per case.

/**
 * Cases the control is tried on.
 *
 * Several rather than one, because a single case answered by a coin is
 * indistinguishable from a wire that works; few rather than many, because this
 * gates a reading rather than being the measurement itself.
 */
const CONTROL_CASES = 3;

/**
 * One passage, with the translation it is asked about.
 */
export type CoverageControlCase = {
  /**
   * Where the passage sits, in the terms the probe's rows print.
   */
  readonly where: string;

  /**
   * Original-side text whose coverage is in question.
   */
  readonly sourcePassage: string;

  /**
   * Whole translation, undamaged, as the first round sees it.
   */
  readonly translation: AnchorTarget;
};

/**
 * What deleting one passage's rendering did to its verdict.
 */
export type CoverageControlRow = {
  /**
   * Where the passage sits.
   */
  readonly where: string;

  /**
   * Verdict before the rendering was deleted, always `carried`, since the
   * control skips cases it cannot damage.
   */
  readonly before: CoverageVerdict['kind'];

  /**
   * Verdict once the rendering was gone.
   */
  readonly after: CoverageVerdict['kind'];

  /**
   * Voices reporting nothing rendered the passage, before the deletion.
   */
  readonly absentBefore: number;

  /**
   * Voices reporting nothing rendered the passage, after it.
   *
   * THIS IS THE NUMBER THE CONTROL TURNS ON, rather than the verdict kind: the
   * recorded null is about ballots, not about how they were rolled up, so a
   * wire that produces a single absence vote it did not produce before has
   * shown the vote to be reachable.
   */
  readonly absentAfter: number;

  /**
   * Verdict when an EQUALLY LARGE cut was taken where the roster did not point,
   * or `no-room` when the page had nowhere to take one clear of the anchored
   * spans.
   *
   * A sound wire keeps saying `carried` here: the rendering is untouched, so
   * nothing about the passage changed. This is what separates a wire that reads
   * the passage from one that answers `absent` to any damaged document.
   */
  readonly decoy: CoverageVerdict['kind'] | 'no-room';

  /**
   * Voices reporting nothing rendered the passage, after the decoy cut.
   */
  readonly absentAfterDecoy: number;

  /**
   * Offset the decoy cut was taken at, or `-1` when there was no room.
   *
   * KEPT so a decoy that does move the verdict can be diagnosed rather than
   * guessed at: a cut landing on a title or a frontmatter block is structural
   * damage of a different kind, and its offset is what says so.
   */
  readonly decoyAt: number;

  /**
   * Spans deleted from the translation.
   */
  readonly removedSpans: number;

  /**
   * Characters the deletion took out, so a cut that removed almost nothing
   * cannot be mistaken for one that removed a passage.
   */
  readonly removedChars: number;
};

/**
 * Decoy round reduced to what the row records.
 *
 * The no-room case is given the shape of a verdict so the row does not have to
 * branch twice over one condition, once per field.
 */
type DecoyReading = {
  /**
   * Verdict kind, or `no-room` when the page had nowhere to take the cut.
   */
  readonly kind: CoverageVerdict['kind'] | 'no-room';

  /**
   * Voices reporting nothing rendered the passage.
   */
  readonly absent: number;
};

/**
 * Whether the wire proved able to see the damage, with its working.
 */
export type CoverageControlResult = {
  /**
   * Whether a majority of tried cases voted absence once their rendering was
   * deleted.
   */
  readonly held: boolean;

  /**
   * Cases where deleting the anchored spans produced absence votes that were
   * not there before.
   */
  readonly sawAbsenceOnTarget: number;

  /**
   * Cases where the equally large cut taken ELSEWHERE also produced them,
   * which a sound wire keeps at zero.
   */
  readonly sawAbsenceOnDecoy: number;

  /**
   * Every case the control managed to damage and re-ask.
   */
  readonly rows: readonly CoverageControlRow[];
};

/**
 * Deletes named spans from a document, or reports that none were there.
 *
 * Exported so the cut can be tested directly. This decides what the control is
 * actually asking about, and a version that quietly returned the text unchanged
 * would turn the whole gate into a formality that passes whatever it is handed.
 *
 * @internal
 *
 * @param text - document to cut from
 *
 * @param spans - exact document text of each region to remove
 *
 * @returns Text with every span gone, or blank when no span was present
 *
 * @example
 * ```ts
 * const damaged = withoutSpans({ text, spans, },);
 * ```
 */
export function withoutSpans(
  {
    text,
    spans,
  }: {
    readonly text: string;
    readonly spans: readonly string[];
  },
): string {
  /**
   * Spans worth cutting, longest first.
   *
   * ORDER MATTERS: a short span sitting inside a longer one would be gone
   * already by the time its own turn came, and the count of what was removed
   * would then depend on which order the roster happened to answer in.
   */
  const ordered = spans
    .filter(function isCuttable(span,): boolean {
      return span !== '';
    },)
    .toSorted(function longestFirst(
      left,
      right,
    ): number {
      return right.length - left.length;
    },);

  /**
   * Document with every span taken out, all occurrences of each.
   */
  const cut = ordered.reduce(
    function without(
      standing,
      span,
    ): string {
      return standing
        .split(span,)
        .join('',);
    },
    text,
  );

  if (cut === text)
    return '';

  return cut;
}

/**
 * Asks one case before and after its rendering is deleted.
 *
 * @param client - injected model client
 *
 * @param probe - passage and the translation it is asked about
 *
 * @param modelIds - roster asked, the same one the reading under test used
 *
 * @param signal - cancellation
 *
 * @param exchangeTimeoutMs - deadline per exchange
 *
 * @param l - logger
 *
 * @returns Row for this case, or nothing when it could not be damaged
 *
 * @example
 * ```ts
 * const row = await tryCase({ client, probe, modelIds, signal, exchangeTimeoutMs, l, },);
 * ```
 */
async function tryCase(
  {
    client,
    probe,
    modelIds,
    signal,
    exchangeTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly probe: CoverageControlCase;
    readonly modelIds: readonly SyntheticModelId[];
    readonly signal: AbortSignal;
    readonly exchangeTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<CoverageControlRow | 'undamageable'> {
  /**
   * What the roster says about the passage as it stands.
   */
  const before = await runCoverageStage({
    client,
    modelIds,
    sourcePassage: probe.sourcePassage,
    translation: probe.translation,
    signal,
    exchangeTimeoutMs,
    l,
  },);

  /**
   * That answer's verdict, read out once so no expression walks two members of
   * it at a time.
   */
  const { verdict: beforeVerdict, } = before;

  // Only a `carried` case can have its rendering deleted, because only that
  // verdict claims there is one. Anything else is already the wire declining to
  // say the passage is covered, which is not what needs proving.
  if (beforeVerdict.kind !== 'carried')
    return 'undamageable';

  /**
   * Spans the roster anchored on, which are exactly what the cut removes.
   */
  const { evidence, } = beforeVerdict;

  /**
   * Translation as it stands, kept so the size of the cut can be reported.
   */
  const { text: standingText, } = probe.translation;

  /**
   * Translation with every span the roster anchored on taken out.
   */
  const damagedText = withoutSpans({
    text: standingText,
    spans: evidence,
  },);

  if (damagedText === '')
    return 'undamageable';

  /**
   * What the roster says once the rendering it pointed at is gone.
   */
  const after = await runCoverageStage({
    client,
    modelIds,
    sourcePassage: probe.sourcePassage,
    translation: parseDocument({ text: damagedText, },),
    signal,
    exchangeTimeoutMs,
    l,
  },);

  /**
   * Verdict once the rendering was gone.
   */
  const { verdict: afterVerdict, } = after;

  /**
   * Characters the targeted cut took, which the decoy cut matches exactly.
   */
  const removedChars = standingText.length - damagedText.length;

  /**
   * Where an equally large cut can be taken clear of the anchored spans.
   */
  const {
    span: decoySpan,
    at: decoyAt,
  } = decoyCut({
    text: standingText,
    avoid: evidence,
    chars: removedChars,
  },);

  /**
   * What the roster says with that unrelated cut made instead.
   *
   * SPLICED BY OFFSET rather than by text, so exactly as many characters go as
   * the targeted cut took. Deleting by span would take every occurrence and the
   * two cuts would stop being the same size.
   */
  const decoyAnswer = (decoySpan === '')
    ? 'no-room' as const
    : await runCoverageStage({
      client,
      modelIds,
      sourcePassage: probe.sourcePassage,
      translation: parseDocument({
        text: standingText.slice(
          0,
          decoyAt,
        ) + standingText.slice(decoyAt + decoySpan.length,),
      },),
      signal,
      exchangeTimeoutMs,
      l,
    },);

  /**
   * That answer read as a verdict.
   */
  const decoyVerdict = (function readDecoy(): DecoyReading {
    if (decoyAnswer === 'no-room')
      return {
        kind: 'no-room',
        absent: 0,
      };

    /**
     * Verdict the decoy round returned.
     */
    const { verdict, } = decoyAnswer;

    return {
      kind: verdict.kind,
      absent: verdict.absent,
    };
  })();

  return {
    where: probe.where,
    before: beforeVerdict.kind,
    after: afterVerdict.kind,
    absentBefore: beforeVerdict.absent,
    absentAfter: afterVerdict.absent,
    decoy: decoyVerdict.kind,
    absentAfterDecoy: decoyVerdict.absent,
    decoyAt,
    removedSpans: evidence.length,
    removedChars,
  };
}

/**
 * Asks whether deleting a passage's rendering changes what the roster votes.
 *
 * @throws Error when no offered case could be damaged, since a control that
 * asked nothing must not be reported as one that held
 *
 * @param client - injected model client
 *
 * @param cases - passages to try, of which the first few damageable ones are used
 *
 * @param modelIds - roster asked
 *
 * @param signal - cancellation
 *
 * @param exchangeTimeoutMs - deadline per exchange
 *
 * @param l - logger
 *
 * @returns Whether the wire voted absence once the rendering was gone
 *
 * @example
 * ```ts
 * const control = await coverageControlHolds({ client, cases, modelIds, signal, exchangeTimeoutMs, l, },);
 * ```
 */
export async function coverageControlHolds(
  {
    client,
    cases,
    modelIds,
    signal,
    exchangeTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly cases: readonly CoverageControlCase[];
    readonly modelIds: readonly SyntheticModelId[];
    readonly signal: AbortSignal;
    readonly exchangeTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<CoverageControlResult> {
  /**
   * Cases that were damaged and re-asked.
   */
  const rows: CoverageControlRow[] = [];

  for (const probe of cases) {
    if (rows.length >= CONTROL_CASES)
      break;

    /**
     * This case's before and after, or a refusal.
     */
    // oxlint-disable-next-line eslint/no-await-in-loop -- sequential by design: this gate decides whether a reading may be trusted, and the cases must meet the same provider conditions as each other for their agreement to mean anything
    const row = await tryCase({
      client,
      probe,
      modelIds,
      signal,
      exchangeTimeoutMs,
      l,
    },);

    if (row === 'undamageable') {
      console.log(`COVERAGE control ${probe.where}: not damageable, skipped`,);
      continue;
    }

    rows.push(row,);
    console.log(
      `COVERAGE control ${row.where}: ${row.before} -> ${row.after}, absence votes ${
        String(row.absentBefore,)
      } -> ${String(row.absentAfter,)}, cut ${String(row.removedSpans,)} spans of ${
        String(row.removedChars,)
      } chars; DECOY of the same size at ${String(row.decoyAt,)}: ${row.decoy}, absence votes ${
        String(row.absentAfterDecoy,)
      }`,
    );
  }

  if (rows.length === 0)
    throw new Error(
      'coverage control refused: no offered case reached a `carried` verdict with deletable '
        + 'evidence, so the roster was never asked about a passage whose rendering was known '
        + 'to be gone and nothing was measured',
    );

  /**
   * Cases where deleting the rendering produced absence votes that were not
   * there before.
   */
  const sawAbsenceOnTarget = rows
    .filter(function noticed(row,): boolean {
      return row.absentAfter > row.absentBefore;
    },)
    .length;

  /**
   * Cases where the cut taken ELSEWHERE produced them too.
   */
  const sawAbsenceOnDecoy = rows
    .filter(function criedWolf(row,): boolean {
      return row.absentAfterDecoy > row.absentBefore;
    },)
    .length;

  // A MAJORITY RATHER THAN UNANIMITY on the targeted cut, for the same reason
  // the editor width control uses one: a passage may be genuinely paraphrased
  // somewhere else in the document, and demanding a clean sweep would fail a
  // working wire on it.
  //
  // BOTH HALVES ARE REQUIRED. A wire that votes absence on the targeted cut has
  // only shown the vote reachable; one that votes it on the decoy too is
  // answering the damage rather than the question, and its absence votes carry
  // no information about coverage either way.
  return {
    held: ((sawAbsenceOnTarget * 2) > rows.length) && ((sawAbsenceOnDecoy * 2) <= rows.length),
    sawAbsenceOnTarget,
    sawAbsenceOnDecoy,
    rows,
  };
}

//endregion Coverage control
