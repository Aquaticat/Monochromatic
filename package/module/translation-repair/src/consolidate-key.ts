import type { SliceSyntax, } from './chunk-document.ts';
import type { ConsolidationPolishConfig, } from './consolidation-polish.ts';
import { hashContent, } from './document-node.ts';
import type { LaneContestBallot, } from './lane-contest-wire.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Consolidate key
// What makes two runs' consolidations the SAME consolidation, for cache
// purposes.
//
// Split from the driver for the reason `lane-contest-key.ts` gives: the key is
// the one piece of a driver testable without a client, and a reader of the
// driver does not want the cache reasoning in the middle of it.

/**
 * Generation of the consolidation cache.
 *
 * MOVES WHEN THE QUESTION MOVES: either sheet, either schema, the structural
 * guard, the validity floor, the gate's settling rule, or the wrap. Every one
 * of those changes what a voice is asked or how its answer is read.
 *
 * IT MOVES FOR THE WRAP TOO, which is the case worth naming. The wrap runs
 * after both rounds and looks like a recording change, but it can demote a
 * consolidation to the standing text, which is a different settlement and not a
 * different way of writing the same one.
 *
 * VERSION 3 adds target-authoritative contributor spelling to producer,
 * selector, validity floor and gate. Version 2 settlements did not answer it.
 *
 * VERSION 4 adds body naturalness polish after fidelity gate. Earlier
 * settlements never bought that stage and cannot resume as though they did.
 *
 * VERSION 5 gives final polish every structurally eligible body paragraph and
 * makes target contributor public identities explicit in producer rule.
 */
export const CONSOLIDATE_CACHE_VERSION = 5;

/**
 * What a line-structured slice appends to its key material.
 *
 * APPENDED, NEVER INSERTED, and only when the rule governs. A prose slice
 * therefore hashes exactly the material it hashed before this mark existed,
 * so every prose consolidation already settled stays resumable. Only the
 * governed slices, whose producer sheet genuinely gained a rule, are re-bought.
 *
 * NOT A CACHE VERSION BUMP, which would have been correct and wasteful: it
 * would discard the prose settlements too, and they were bought under a sheet
 * identical to the one they would be re-bought under.
 */
const LINE_STRUCTURED_KEY_MARK = 'line-structured';

/**
 * What a slice carrying picture readings labels them with.
 *
 * LABELLED AND PAIRED, unlike the mark above it, because this append carries
 * CONTENT rather than a fact. A bare append of the readings could collide with
 * the mark for a reading whose words happen to be `line-structured`, and a
 * label in front of them costs one array element to make that impossible.
 */
const PICTURE_KEY_LABEL = 'pictures';

/**
 * What a slice carrying a window labels its ORIGINAL side with.
 *
 * TWO LABELS RATHER THAN ONE, because the two sides are independently absent:
 * a slice can stand beside a section the archive never translated, and folding
 * them under a single label would let a source-only window and an
 * incumbent-only one collide.
 *
 * SPELLED AS `translateSliceKey` SPELLS IT, so a reader tracing one window
 * through both keys meets the same two words.
 */
const NEIGHBOURING_SOURCE_KEY_LABEL = 'neighbouring';

/**
 * What a slice carrying a window labels its ARCHIVE side with.
 */
const NEIGHBOURING_INCUMBENT_KEY_LABEL = 'neighbouring-incumbent';

/**
 * Everything about this run that changes what the voices are ASKED.
 *
 * Without it a resumed slice could return a settlement reached by a different
 * roster and nothing would look wrong, since the texts match and so the key
 * matches. Identity context belongs here for the same reason the contest gives:
 * it is front-matter-derived prompt content that varies per pair and measurably
 * changes the answer.
 *
 * `perCallTimeoutMs` is deliberately ABSENT, on the reasoning every other lane
 * gives: it changes how long a voice has to answer, not what it is asked.
 *
 * @param modelIds - roster asked to produce, judge and gate
 *
 * @param identityContext - names and handles both documents declare
 *
 * @param polishConfig - naturalness roles and document guard facts
 *
 * @returns Stable string for the key
 *
 * @example
 * ```ts
 * const runShape = consolidateRunShape({ modelIds, identityContext, },);
 * ```
 */
export function consolidateRunShape(
  {
    modelIds,
    identityContext,
    polishConfig,
  }: {
    readonly modelIds: readonly RosterModelId[];
    readonly identityContext?: string;
    readonly polishConfig?: ConsolidationPolishConfig;
  },
): string {
  return JSON.stringify([
    modelIds,
    identityContext ?? '',
    ...((polishConfig === undefined)
      ? []
      : [
        polishConfig.refinerModelIds,
        polishConfig.judgeModelIds,
        polishConfig.gateModelIds,
        polishConfig.declaredNames,
        polishConfig.definitions,
      ]),
  ],);
}

/**
 * Cross-run key for one consolidated slice.
 *
 * THE CONTEST BALLOTS ARE IN IT, which is what separates this key from the
 * contest's own. The consolidation sheet shows the producers what the contest
 * judges said about each lane, as claims rather than as verdicts, so two
 * consolidations over identical candidates and different ballots are not the
 * same question and must not resume into one another.
 *
 * THE STANDING TEXT IS IN IT SEPARATELY from the two lane renderings, because
 * it is not derivable from them here: the contest may have declined, in which
 * case nothing stands, and the deciding half behaves differently.
 *
 * THE SLICE INDEX IS NOT IN IT, matching every other lane. Where a slice sits
 * changes nothing a voice is asked, and keeping the index would discard every
 * settled consolidation after a renumbering.
 *
 * @param runShape - what this run asks, from {@link consolidateRunShape}
 *
 * @param sourceText - slice original, which is the standard
 *
 * @param incumbentText - archive rendering, which is the structural standard
 *
 * @param syntax - syntax role changing producer, judge and gate policies
 *
 * @param repairText - what the repair lane would ship
 *
 * @param translateText - what the translate lane would ship
 *
 * @param standingText - what ships today, empty where the contest declined
 *
 * @param ballots - what the contest judges said, shown to the producers
 *
 * @param lineStructured - whether the enclosing chunk is line-structured,
 * which decides whether the producer sheet carries the rule against merging
 * lines, and so decides what was bought
 *
 * @param pictureContext - what the pictures this slice and its neighbours
 * show were read to say, absent where none were read
 *
 * @param neighbouringSourceText - original of the passages either side, absent
 * where the slice stands alone, since the window is shown to the producers
 *
 * @param neighbouringIncumbentText - archive rendering of the passages either
 * side, absent for the same reason
 *
 * @returns Hash keying this slice's settlement
 *
 * @example
 * ```ts
 * const key = consolidateSliceKey({ runShape, sourceText, incumbentText, repairText, translateText, standingText, ballots, lineStructured, },);
 * ```
 */
export function consolidateSliceKey(
  {
    runShape,
    sourceText,
    incumbentText,
    syntax,
    repairText,
    translateText,
    standingText,
    ballots,
    lineStructured,
    pictureContext,
    neighbouringSourceText,
    neighbouringIncumbentText,
  }: {
    readonly runShape: string;
    readonly sourceText: string;
    readonly incumbentText: string;
    readonly syntax?: SliceSyntax;
    readonly repairText: string;
    readonly translateText: string;
    readonly standingText: string;
    readonly ballots: readonly LaneContestBallot[];
    readonly lineStructured: boolean;
    readonly pictureContext?: string;
    readonly neighbouringSourceText?: string;
    readonly neighbouringIncumbentText?: string;
  },
): string {
  return hashContent({
    content: JSON.stringify([
      'consolidate',
      CONSOLIDATE_CACHE_VERSION,
      runShape,
      sourceText,
      incumbentText,
      ...((syntax === undefined)
        ? []
        : [
          'syntax',
          syntax,
        ]),
      repairText,
      translateText,
      standingText,
      ballots,
      ...(lineStructured ? [LINE_STRUCTURED_KEY_MARK,] : []),
      // THE READING'S WORDS RATHER THAN ITS OWN KEY, matching
      // `translate-slice-key.ts` exactly, and for its reason: what changes a
      // producer's answer is the words it was shown, so two runs that read one
      // picture into different words asked different questions however identical
      // their texts were.
      //
      // APPENDED AND ONLY WHEN PRESENT, so a slice near no readable picture
      // hashes the array it always hashed. Most slices carry no pictures, and
      // discarding their settled consolidations to record an absence would buy
      // the corpus nothing.
      ...(((pictureContext === undefined) || (pictureContext === ''))
        ? []
        : [
          PICTURE_KEY_LABEL,
          pictureContext,
        ]),
      // THE WINDOW, on the same terms and for the same reason: the judges of a
      // consolidation read the passages either side from 2026-08-22, and a
      // settlement decided without them answered a different question.
      //
      // AFTER THE PICTURES RATHER THAN BEFORE, which is where the sibling
      // `translateSliceKey` puts the same two fields. Appending is this file's
      // own convention and the labels make position irrelevant to correctness,
      // so the orders differ and neither is wrong; a reader comparing the two
      // keys side by side should not read the difference as a defect.
      //
      // UNLIKE THE PICTURE APPEND, THIS IS NOT CHEAP. Most slices carry no
      // picture, so that field left almost every settled consolidation
      // resumable. Nearly every slice of a multi-slice document HAS a window,
      // so nearly every settlement keyed before this is re-bought. That is the
      // correct outcome rather than a regrettable one: resuming them would
      // return answers to a question nobody asked, which is `#95`.
      ...(((neighbouringSourceText === undefined) || (neighbouringSourceText === ''))
        ? []
        : [
          NEIGHBOURING_SOURCE_KEY_LABEL,
          neighbouringSourceText,
        ]),
      ...(((neighbouringIncumbentText === undefined) || (neighbouringIncumbentText === ''))
        ? []
        : [
          NEIGHBOURING_INCUMBENT_KEY_LABEL,
          neighbouringIncumbentText,
        ]),
    ],),
  },);
}

//endregion Consolidate key
