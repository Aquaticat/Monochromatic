import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type {
  Candidate,
  CandidateProducer,
} from './candidate-select-model.ts';
import { CANDIDATE_NONE, } from './candidate-select-wire.ts';
import { selectBestCandidate, } from './candidate-select.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';
import {
  TRANSLATE_SELECTION_CRITERIA,
  TRANSLATE_SELECTION_TASK,
} from './translate-selection-sheet.ts';

//region Judge fidelity trial
// Whether the translate lane's judges can tell a faithful rendering from one
// that reads just as well and says less.
//
// WHY IT CANNOT BE READ OFF A CORPUS RUN. In production the judges decide
// between an incumbent and fresh renderings, and NOTHING KNOWS WHICH IS
// BETTER: that is the question they are being asked. A run therefore reports
// how often they replaced the archive, never how often they were right to. The
// trial supplies the missing half by constructing the answer.
//
// THE FIXTURE IS A DELETION, applied by `applySeededErrors` to a real slice of
// the archive, so one candidate states everything the other does MINUS one whole
// sentence. The damaged text is otherwise word for word the clean text, which is
// what makes it the right adversary: it cannot lose on fluency, register, or
// house style, only on coverage, which is the first criterion the sheet names.
// A judge that picks it has ranked something above saying what the original says.
//
// BOTH DIRECTIONS ARE RUN over the same pair, because one direction alone cannot
// tell a judge that reads from a judge that simply keeps what it is given.
// Preserving is right when the incumbent is the clean text and wrong when it is
// the damaged one, so a status-quo reflex scores half and a reader scores both.
//
// WHAT IT DOES NOT MEASURE: self-preference, since neither candidate is written
// by a model on the roster, and fluency-versus-faithfulness in the hard case,
// since a deletion is a coverage defect rather than a fluent paraphrase that
// quietly drops a qualifier. Both are recorded in `#84`.

/**
 * Which side of the ballot holds the clean text.
 *
 * `preserve` puts it on the incumbent, so keeping the incumbent is correct;
 * `replace` puts it on the fresh proposal, so replacing is correct.
 */
export type FidelityDirection = 'preserve' | 'replace';

/**
 * One constructed comparison with a known right answer.
 *
 * @example
 * ```ts
 * const trial: FidelityTrial = { trialId, direction: 'preserve', sourceText, cleanText, damagedText, cleanFirst: true, };
 * ```
 */
export type FidelityTrial = {
  /**
   * Stable handle this trial is reported under.
   */
  readonly trialId: string;

  /**
   * Which side the clean text sits on.
   */
  readonly direction: FidelityDirection;

  /**
   * Chinese original both candidates claim to render.
   */
  readonly sourceText: string;

  /**
   * Archive English as it stands, which states everything.
   */
  readonly cleanText: string;

  /**
   * Same English with one whole sentence deleted.
   */
  readonly damagedText: string;

  /**
   * Whether the clean text is listed first, so position can be read separately
   * from direction.
   */
  readonly cleanFirst: boolean;
};

/**
 * How one judge voted, in terms of the answer rather than the ballot position.
 *
 * @example
 * ```ts
 * const ballot: FidelityBallotRead = { modelId, picked: 'clean', reason: 'covers the last sentence', weight: 1, };
 * ```
 */
export type FidelityBallotRead = {
  /**
   * Judge that cast it.
   */
  readonly modelId: SyntheticModelId;

  /**
   * Which text it chose, or that it named no candidate.
   *
   * A JUDGE THAT DECLINES HAS NOT PICKED THE DELETION, which reading a ballot
   * as "clean or otherwise" would record. `CANDIDATE_NONE` is zero and the
   * ballot index is one-based, so the two are only distinguishable by asking.
   */
  readonly picked: 'clean' | 'damaged' | 'declined';

  /**
   * Its stated reason, kept because a judge that names coverage and still picks
   * the deletion is a different failure from one that never mentions coverage.
   */
  readonly reason: string;

  /**
   * Weight its ballot carried.
   */
  readonly weight: number;
};

/**
 * What one trial produced.
 *
 * @example
 * ```ts
 * const outcome: FidelityOutcome = { trialId, direction: 'preserve', verdict: 'clean', correct: true, ... };
 * ```
 */
export type FidelityOutcome = {
  /**
   * Trial this answers.
   */
  readonly trialId: string;

  /**
   * Direction it was run in.
   */
  readonly direction: FidelityDirection;

  /**
   * Whether the clean text was listed first.
   */
  readonly cleanFirst: boolean;

  /**
   * Which text the roster settled on, or that it refused to choose.
   */
  readonly verdict: 'clean' | 'damaged' | 'declined';

  /**
   * Whether that is the right answer, which only `clean` ever is. A DECLINE IS
   * NOT COUNTED CORRECT even in the `preserve` direction, where it happens to
   * leave the clean text in place: the judges did not identify the deletion,
   * they abstained, and scoring an abstention as a hit is how a silent panel
   * comes to look like a reliable one.
   */
  readonly correct: boolean;

  /**
   * Every judge's vote, in roster order.
   */
  readonly ballots: readonly FidelityBallotRead[];

  /**
   * Why the roster declined, empty when it chose.
   */
  readonly declineReason: string;
};

/**
 * Text one candidate carries.
 */
type FidelityValue = {
  /**
   * Candidate English.
   */
  readonly text: string;
};

/**
 * Producer label for the archive side of the ballot.
 */
const INCUMBENT_PRODUCER: CandidateProducer = {
  kind: 'incumbent',
  matched: [],
};

/**
 * Producer label for the proposed side.
 *
 * A COMPOSITE WITH NO CONTRIBUTORS, so no judge holds a stake in it and no
 * ballot is discounted as a self-vote. Naming a roster model instead would halve
 * one judge's weight on one side of the comparison and quietly tilt the very
 * number this trial exists to read; a constructed fixture genuinely has no
 * author among the judges, and this says so.
 */
const FIXTURE_PRODUCER: CandidateProducer = {
  kind: 'composite',
  contributors: [],
};

/**
 * Builds the ballot for one trial, clean text in the position the trial names.
 *
 * @param trial - constructed comparison
 *
 * @returns Candidates in ballot order
 *
 * @example
 * ```ts
 * const candidates = buildSlate({ trial, },);
 * ```
 */
function buildSlate(
  { trial, }: { readonly trial: FidelityTrial; },
): readonly Candidate<FidelityValue>[] {
  /**
   * Archive side of the comparison, clean when preserving is correct.
   */
  const incumbentText = (trial.direction === 'preserve') ? trial.cleanText : trial.damagedText;

  /**
   * Proposed side, holding whichever text the incumbent does not.
   */
  const freshText = (trial.direction === 'preserve') ? trial.damagedText : trial.cleanText;

  /**
   * Archive candidate.
   */
  const incumbent: Candidate<FidelityValue> = {
    producer: INCUMBENT_PRODUCER,
    value: { text: incumbentText, },
    rendered: incumbentText,
  };

  /**
   * Proposed candidate.
   */
  const fresh: Candidate<FidelityValue> = {
    producer: FIXTURE_PRODUCER,
    value: { text: freshText, },
    rendered: freshText,
  };

  /**
   * Whether the clean text belongs at position zero.
   */
  const cleanIsIncumbent = trial.direction === 'preserve';
  if (trial.cleanFirst === cleanIsIncumbent) {
    return [
      incumbent,
      fresh,
    ];
  }
  return [
    fresh,
    incumbent,
  ];
}

/**
 * Runs one constructed comparison past the production judges.
 *
 * @param client - injected model client
 *
 * @param trial - comparison with a known right answer
 *
 * @param judgeModelIds - roster asked
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - logger of the calling harness
 *
 * @returns Which text won, whether that is right, and every ballot
 *
 * @example
 * ```ts
 * const outcome = await runFidelityTrial({ client, trial, judgeModelIds, signal, perCallTimeoutMs, l, },);
 * ```
 */
export async function runFidelityTrial(
  {
    client,
    trial,
    judgeModelIds,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly trial: FidelityTrial;
    readonly judgeModelIds: readonly SyntheticModelId[];
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<FidelityOutcome> {
  /**
   * Logger tagged with this harness.
   */
  const fl = tagged({
    tag: runFidelityTrial.name,
    l,
  },);

  /**
   * Ballot in the order the judges see it.
   */
  const candidates = buildSlate({ trial, },);

  /**
   * Where the clean text sits on the ballot, ONE-BASED, which is how both a
   * ballot's `best` and the outcome's `selectedIndex` name a position. Derived
   * once and compared against twice, since the two readings drifting apart is
   * the whole failure this trial would otherwise report as a judge that cannot
   * read.
   */
  const cleanPosition = 1 + candidates.findIndex(function holdsCleanText(candidate,) {
    /**
     * English this candidate carries.
     */
    const carried = candidate.value
      .text;
    return carried === trial.cleanText;
  },);

  /**
   * Judges' verdict over the constructed pair, asked exactly what production
   * asks.
   */
  const outcome = await selectBestCandidate<FidelityValue>({
    client,
    candidates,
    judgeModelIds,
    task: TRANSLATE_SELECTION_TASK,
    criteria: TRANSLATE_SELECTION_CRITERIA,
    evidence: [
      {
        label: 'ORIGINAL (Chinese)',
        text: trial.sourceText,
      },
    ],
    signal,
    perCallTimeoutMs,
    l: fl,
  },);

  /**
   * Every ballot read as an answer rather than a position.
   */
  const ballots = outcome.ballots
    .map(function toRead(ballot,): FidelityBallotRead {
      // A DECLINE IS READ FIRST because `CANDIDATE_NONE` is zero, which is a
      // position no candidate occupies: leaving it to the comparison below would
      // record an abstention as a vote for whichever text is not the clean one.
      if (ballot.best === CANDIDATE_NONE) {
        return {
          modelId: ballot.modelId,
          picked: 'declined',
          reason: ballot.reason,
          weight: ballot.weight,
        };
      }
      return {
        modelId: ballot.modelId,
        picked: (ballot.best === cleanPosition) ? 'clean' : 'damaged',
        reason: ballot.reason,
        weight: ballot.weight,
      };
    },);

  if (outcome.kind === 'declined') {
    fl.info(`${trial.trialId} (${trial.direction}): roster declined`,);
    return {
      trialId: trial.trialId,
      direction: trial.direction,
      cleanFirst: trial.cleanFirst,
      verdict: 'declined',
      correct: false,
      ballots,
      declineReason: outcome.reason,
    };
  }

  /**
   * Which text the roster settled on.
   */
  const verdict = (outcome.selectedIndex === cleanPosition) ? 'clean' : 'damaged';
  fl.info(`${trial.trialId} (${trial.direction}): ${verdict}`,);
  return {
    trialId: trial.trialId,
    direction: trial.direction,
    cleanFirst: trial.cleanFirst,
    verdict,
    correct: verdict === 'clean',
    ballots,
    declineReason: '',
  };
}

//endregion Judge fidelity trial
