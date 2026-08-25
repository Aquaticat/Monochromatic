import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  listCorpusPeople,
  readCorpusFile,
} from '../corpus-source.ts';
import { listCoverageCandidates, } from '../coverage-candidates.ts';
import { parseDocument, } from '../parse-document.ts';
import {
  coverageControlHolds,
  type CoverageControlCase,
} from './coverage-control.ts';
import {
  createRunClient,
  RUN_CORPUS_PIN,
  RUN_PER_CALL_TIMEOUT_MS,
  RUN_ROSTER,
} from './run-config.ts';
import { reportingRefusals, } from './cli-refusal.ts';
import { StatedRefusalError, } from '../stated-refusal.ts';

//region Coverage control probe
// `#106`: can the coverage roster vote absence at all.
//
// The block-scale reading it produced is ninety-six answers with not one vote
// for absence. Read as a fact about the corpus, that says the translations
// carry everything. Read as a fact about the instrument, it says the evidence
// rule admits any non-empty quote, so absence is unreachable and the count
// means nothing. This runner separates the two.
//
// It asks the roster about real passages, DELETES THE SPANS THE ROSTER ITSELF
// ANCHORED ON, and asks again. Nothing else can choose the damage: coverage
// candidates are exactly the passages the aligners refuse to pair, so no
// pairing exists to say which target text renders one.
//
// SPENDS QUOTA, two roster rounds per case. Point `TRANSLATION_REPAIR_RUNS_DIR`
// at a throwaway directory.

/**
 * Cases gathered before the control is called.
 *
 * MORE THAN THE CONTROL WILL USE, because a case is only damageable if the
 * roster returns `carried` with evidence, which is not known until it is asked.
 * Offering spares keeps a run from ending with nothing measured.
 */
const CASES_OFFERED = 8;

/**
 * Entry ids named on the command line, empty when none were.
 *
 * @returns Ids to restrict the walk to
 *
 * @example
 * ```ts
 * const onlyIds = readOnlyIds();
 * ```
 */
function readOnlyIds(): readonly string[] {
  /**
   * Arguments after the runner path.
   */
  const args = process.argv
    .slice(2,);

  /**
   * Where the flag sits, or absent.
   */
  const onlyAt = args.indexOf('--only',);

  if (onlyAt === (-1))
    return [];

  return (args[onlyAt + 1] ?? '')
    .split(',',)
    .filter(function isNamed(id,): boolean {
      return id !== '';
    },);
}

/**
 * Collects passages to try, walking entries until enough are gathered.
 *
 * @param onlyIds - entries to restrict the walk to, empty for all
 *
 * @returns Cases the control may try
 *
 * @example
 * ```ts
 * const cases = await gatherCases({ onlyIds, },);
 * ```
 */
async function gatherCases(
  { onlyIds, }: { readonly onlyIds: readonly string[]; },
): Promise<readonly CoverageControlCase[]> {
  /**
   * Cases found so far.
   */
  const cases: CoverageControlCase[] = [];

  /**
   * Entries to walk.
   */
  const entryIds = (await listCorpusPeople({ pin: RUN_CORPUS_PIN, },))
    .filter(function isWanted(entryId,): boolean {
      return (onlyIds.length === 0) || onlyIds.includes(entryId,);
    },);

  for (const entryId of entryIds) {
    if (cases.length >= CASES_OFFERED)
      break;

    /**
     * Original side at the pin.
     */
    // oxlint-disable-next-line eslint/no-await-in-loop -- sequential by design: the walk stops as soon as enough cases are found, and reading every entry up front would read the whole corpus to use a few pages of it
    const sourceText = await readCorpusFile({
      pin: RUN_CORPUS_PIN,
      relPath: `people/${entryId}/page.md`,
    },);

    /**
     * Translation at the pin.
     */
    // oxlint-disable-next-line eslint/no-await-in-loop -- paired with the read above; the two sides of one entry are read together or not at all
    const targetText = await readCorpusFile({
      pin: RUN_CORPUS_PIN,
      relPath: `people/${entryId}/page.en.md`,
    },);

    /**
     * Translation parsed once, since every case for this entry shares it.
     */
    const translation = parseDocument({ text: targetText, },);

    /**
     * Passages this entry's aligners refuse to pair.
     */
    const candidates = listCoverageCandidates({
      source: parseDocument({ text: sourceText, },),
      target: translation,
    },);

    for (const candidate of candidates) {
      if (cases.length >= CASES_OFFERED)
        break;

      cases.push({
        where: `${entryId} ${
          (candidate.scale === 'section')
            ? `section ${String(candidate.sourceIndex,)}`
            : `pair ${String(candidate.pairIndex,)} block ${String(candidate.sourceIndex,)}`
        }`,
        sourcePassage: candidate.sourceText,
        translation,
      },);
    }
  }

  return cases;
}

/**
 * Runs the control and reports what it found.
 *
 * @throws Error when no entry offered a single passage to ask about, since a
 * run that measured nothing must not be reported as one that measured a null
 *
 * @example
 * ```ts
 * await main();
 * ```
 */
async function main(): Promise<void> {
  /**
   * Logger for the run.
   */
  const l = tagged({ tag: 'coverage-control', },);

  /**
   * Client every call goes through.
   */
  const client = createRunClient();

  /**
   * Cancellation shared by every call, never fired.
   */
  const { signal, } = new AbortController();

  /**
   * Entries the caller named.
   */
  const onlyIds = readOnlyIds();

  /**
   * Passages to try.
   */
  const cases = await gatherCases({ onlyIds, },);

  if (cases.length === 0)
    throw new StatedRefusalError({
      says: 'coverage control probe refused: no walked entry offered a passage the aligners '
        + 'declined to pair, so there was nothing to ask the roster about',
    },);

  console.log(
    `COVERAGE control offering ${String(cases.length,)} cases to a roster of ${
      String(RUN_ROSTER.length,)
    }`,
  );

  /**
   * What deleting each rendering did.
   */
  const control = await coverageControlHolds({
    client,
    cases,
    modelIds: RUN_ROSTER,
    signal,
    exchangeTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l,
  },);

  /**
   * Whether an absence vote proved reachable, with the cases it was read over.
   */
  const {
    held,
    rows,
    refusals,
    sawAbsenceOnTarget,
    sawAbsenceOnDecoy,
  } = control;

  /**
   * Cases the roster declined to call covered before anything was damaged.
   *
   * REPORTED SEPARATELY FROM ANCHORING FAILURES because these are the wire
   * voting absence on text nobody touched, which is a stronger reading than any
   * damaged case can give.
   */
  const notCarried = refusals
    .filter(function declinedUndamaged(refusal,): boolean {
      return refusal.reason === 'not-carried';
    },);

  console.log(
    `COVERAGE control ${held ? 'HELD' : 'DID NOT HOLD'} over ${
      String(rows.length,)
    } damaged cases: absence votes appeared on ${
      String(sawAbsenceOnTarget,)
    } targeted cuts and on ${String(sawAbsenceOnDecoy,)} equally large cuts taken elsewhere`,
  );
  console.log(
    `COVERAGE control ${String(refusals.length,)} cases could not be damaged: ${
      String(notCarried.length,)
    } because the roster never called them covered, ${
      String(refusals.length - notCarried.length,)
    } because its evidence could not be found in the page`,
  );

  if (notCarried.length > 0)
    console.log(
      'THE ROSTER DECLINED TO CALL THOSE PASSAGES COVERED WITH NO DAMAGE DONE, which is an '
        + 'absence reading on standing corpus text rather than on a page this probe cut.',
    );
  if (held) {
    console.log(
      'The roster voted absence once the rendering it pointed at was gone, so an absence '
        + 'vote is reachable and a run that produced none is reporting the corpus rather '
        + 'than the instrument.',
    );
    return;
  }

  if (rows.length === 0) {
    console.log(
      'NOTHING WAS DAMAGED on this entry, so it says nothing either way about whether a '
        + 'deleted rendering is noticed. Read its refusals above instead: they are what the '
        + 'roster says about this page as it stands.',
    );
    return;
  }

  console.log(
    'THE ROSTER DID NOT VOTE ABSENCE even with the rendering it pointed at deleted, or it '
      + 'voted absence on an unrelated cut of the same size. Either way its coverage readings '
      + 'here are a property of the wire rather than of the translation.',
  );
}

if (import.meta.main)
  await reportingRefusals({
    what: 'coverage-control-probe',
    run: main,
  },);

//endregion Coverage control probe
