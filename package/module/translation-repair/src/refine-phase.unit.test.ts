/**
 * Tests for the naturalness phase: when it runs, when it rolls back, and that
 * a refinement-only change reaches the shipped text.
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import { wait, } from '@monochromatic-dev/module-async-time/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type ChunkPair,
  type ChunkRepairOutcome,
  type IssueAuthorship,
  messageText,
  OverlapRefusedError,
  persistRefinePhaseSlice,
  type RefinedSliceSettlement,
  type RepairModels,
  type RosterModelId,
  runRefinePhase,
  type SliceCache,
  type SyntheticClient,
  UnpreparedSliceError,
} from '../dist/final/node/index.mjs';

/**
 * Logger for the phase under test.
 */
const l = tagged({ tag: 'refine-phase-test', },);

/**
 * Repaired slice text, one long single-line paragraph so it is eligible.
 */
const REPAIRED_TEXT =
  'The cat is doing the sunbathing on the windowsill in every afternoon, and when the light is moving across the floor she is following it without any hurry at all.';

/**
 * Smoother rendering of the same content.
 */
const SMOOTH_TEXT =
  'The cat sunbathes on the windowsill every afternoon, and when the light moves across the floor she follows it without hurry.';

/**
 * Original the refinement is checked against.
 */
const SOURCE_TEXT = '猫猫每天下午都在窗台上晒太阳。';

/**
 * Editor named as the author of `T1` where a case sets one.
 *
 * KEPT OUT OF THE REFINER ROSTER so a stored authorship carries two
 * distinguishable ids, which is what lets an assertion tell a union of both
 * stages apart from either stage alone.
 */
const EDITOR_WHO_DID_NOT_REFINE: RosterModelId = 'minimax-m3';

/**
 * Refiner the scripted client answers as, which is the fixture's other editor.
 */
const REFINER_THAT_REWROTE: RosterModelId = 'hf:zai-org/GLM-5.3-Flash';

/**
 * Roster with the lane on, refiners disjoint from checkers.
 */
const MODELS: RepairModels = {
  criticModelIds: ['hf:zai-org/GLM-5.3-Flash',],
  panelModelIds: ['hf:zai-org/GLM-5.3-Flash',],
  editorModelIds: [
    REFINER_THAT_REWROTE,
    EDITOR_WHO_DID_NOT_REFINE,
  ],
  judgeModelIds: [
    'hf:zai-org/GLM-5.3-Flash',
    'hf:Qwen/Qwen3.8-27B',
    'hf:moonshotai/Kimi-K3',
    'deepseek-v4-pro-0813',
  ],
  refinerModelIds: [REFINER_THAT_REWROTE,],
  checkerModelIds: [
    'hf:Qwen/Qwen3.8-27B',
    'hf:moonshotai/Kimi-K3',
    'deepseek-v4-pro-0813',
  ],
};

/**
 * Slice pair covering the whole fixture translation.
 */
const SLICES: readonly ChunkPair[] = [
  {
    source: {
      sliceIndex: 0,
      text: SOURCE_TEXT,
      startOffset: 0,
      endOffset: SOURCE_TEXT.length,
      nodes: [],
    },
    target: {
      sliceIndex: 0,
      text: REPAIRED_TEXT,
      startOffset: 0,
      endOffset: REPAIRED_TEXT.length,
      nodes: [],
    },
  },
];

/**
 * Authorship of hand-written fixture text: no model wrote it, so no checker
 * in a case that leaves this alone is judging its own work.
 */
const NO_MODEL_WROTE_THE_FIXTURE: IssueAuthorship = {
  perIssue: {},
  everyIssue: [],
};

/**
 * Successful refiner calls in flight and peak observed by fixture.
 */
type RefinerConcurrency = {
  now: number;
  peak: number;
  started: number;
};

/**
 * Delays refiner answers so a test can observe driver overlap.
 *
 * First refiner waits longer than second, making completion order differ from
 * input order when both are active.
 *
 * @param inner - client providing scripted answers
 *
 * @param activity - mutable test instrument for active refiner calls
 *
 * @returns Client forwarding every call after measuring refiners
 *
 * @example
 * ```ts
 * const client = measuringRefiners({ inner, activity, },);
 * ```
 */
function measuringRefiners(
  {
    inner,
    activity,
  }: {
    readonly inner: SyntheticClient;
    readonly activity: RefinerConcurrency;
  },
): SyntheticClient {
  return {
    chatText: inner.chatText,
    chatJson: async (request) => {
      if (request.responseFormat
        ?.json_schema
        .name
        === 'refine_report') {
        /**
         * Start position deciding deterministic delay.
         */
        const startPosition = activity.started;
        activity.started += 1;
        activity.now += 1;
        activity.peak = Math.max(
          activity.peak,
          activity.now,
        );
        await wait(startPosition === 0 ? 20 : 5,);
        activity.now -= 1;
      }
      return await inner.chatJson(request,);
    },
    quotas: inner.quotas,
  };
}

/**
 * Builds one settled accuracy outcome.
 *
 * @param resolvedIssueIds - issues the checkers confirmed in `T1`
 *
 * @param authorship - who wrote `T1`, which the phase must union with its
 * own refiners on any slice where the rewrite ships
 *
 * @returns Outcome the phase refines
 *
 * @example
 * ```ts
 * const outcome = settledOutcome({ resolvedIssueIds: [], authorship, },);
 * ```
 */
function settledOutcome(
  {
    resolvedIssueIds,
    authorship,
  }: {
    readonly resolvedIssueIds: readonly string[];
    readonly authorship: IssueAuthorship;
  },
): ChunkRepairOutcome {
  return {
    sliceIndex: 0,
    repairedText: REPAIRED_TEXT,
    changed: false,
    issues: resolvedIssueIds.map(function toIssue(issueId,) {
      return {
        issueId,
        status: 'accepted' as const,
        severity: 'major' as const,
        claims: [],
        tallies: {},
      };
    },),
    resolvedIssueIds,
    candidateResolvedIssueIds: [],
    // No checker round in this fixture, so nothing was said about any issue.
    checkerReadings: {},
    recheckReadings: {},
    repairRegions: [],
    authorship,
    accuracyPatchSelected: false,
    refined: false,
    rounds: [],
    droppedDeclaredNames: [],
    nonTranslationVotes: 0,
    nonTranslationContradicted: false,
    nonTranslationStanding: false,
    heardCritics: 1,
    heardCriticIds: [],
    claimAttributions: [],
    findings: [],
  };
}

/**
 * Client scripting the rewriter, the judges, and the recheck.
 *
 * @param checkerVerdict - verdict every checker casts during the recheck
 *
 * @returns Client usable by the phase
 *
 * @example
 * ```ts
 * const client = scriptedPhase({ checkerVerdict: 'fixed', },);
 * ```
 */
function scriptedPhase(
  {
    checkerVerdict,
  }: {
    readonly checkerVerdict: string;
  },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused by the phase',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      /**
       * Stage name from the structured-output constraint.
       */
      const stage = request.responseFormat
        ?.json_schema
        .name
        ?? '';

      /**
       * User prompt, for counting the issues a checker sheet lists.
       */
      const asked = request.messages.at(-1,);
      const content = (asked === undefined) ? '' : messageText({ message: asked, },);

      /**
       * Scripted reply for the stage.
       */
      const scripted: unknown = stage === 'refine_report'
        ? {
          rewrites: [
            {
              paragraph: 1,
              newText: SMOOTH_TEXT,
            },
          ],
        }
        : stage === 'candidate_ballot'
        ? {
          best: 1,
          reason: 'scripted',
        }
        // The naturalness probe answers a DIFFERENT schema from the checker,
        // and the checker-shaped fallback below fails its guard. That failure
        // is swallowed as a lost voice, so without this branch the probe would
        // report nothing heard and a case asserting it ran would pass for the
        // wrong reason.
        : stage === 'introduced_defect_report'
        ? {
          checks: [
            {
              region: 1,
              verdict: 'no-introduced-defect-found',
              category: '',
              severity: '',
              evidence: '',
              omittedText: '',
              reason: '',
            },
          ],
        }
        : {
          checks: [...Array.from(
            { length: content.split('\nISSUE ',).length - 1, },
          ).keys(),]
            .map(function toCheck(index,) {
              return {
                issue: index + 1,
                verdict: checkerVerdict,
              };
            },),
        };
      if (!request.validate(scripted,))
        throw new Error(`stub script failed the ${stage} guard`,);
      return {
        kind: 'ok',
        value: scripted,
        rawText: JSON.stringify(scripted,),
      };
    },
    quotas: async () => {
      throw new Error('quotas unused by the phase',);
    },
  };
}

/**
 * Runs the phase over one settled outcome.
 *
 * @param resolvedIssueIds - issues the checkers confirmed in `T1`
 *
 * @param checkerVerdict - verdict the recheck receives
 *
 * @param models - roster override, defaulting to the lane-on roster
 *
 * @param authorship - who wrote `T1`, defaulting to nobody
 *
 * @returns Phase result
 *
 * @example
 * ```ts
 * const phase = await runPhase({ resolvedIssueIds: [], checkerVerdict: 'fixed', },);
 * ```
 */
async function runPhase(
  {
    resolvedIssueIds,
    checkerVerdict,
    models = MODELS,
    authorship = NO_MODEL_WROTE_THE_FIXTURE,
  }: {
    readonly resolvedIssueIds: readonly string[];
    readonly checkerVerdict: string;
    readonly models?: RepairModels;
    readonly authorship?: IssueAuthorship;
  },
) {
  return runRefinePhase({
    declaredNames: [],
    client: scriptedPhase({ checkerVerdict, },),
    targetText: REPAIRED_TEXT,
    slices: SLICES,
    outcomes: [settledOutcome({ resolvedIssueIds, authorship, },),],
    models,
    signal: new AbortController().signal,
    perCallTimeoutMs: 1_000,
    l,
  },);
}

await describe({
  name: runRefinePhase.name,
  children: [
    it({
      name: 'ships a refinement-only change and marks the slice changed, which '
        + 'is what puts it into the assembled document',
      fn: async () => {
        // No accepted issue at all: the lane's primary target, and the case a
        // lane placed at the bottom of repairChunk would never have reached.
        const phase = await runPhase({
          resolvedIssueIds: [],
          checkerVerdict: 'fixed',
        },);
        expect(phase.outcomes[0]?.repairedText,).toBe(SMOOTH_TEXT,);
        expect(phase.outcomes[0]?.changed,).toBe(true,);
      },
    },),

    it({
      name: 'rolls the whole slice back to T1 when the recheck finds a '
        + 'previously resolved issue no longer resolved',
      fn: async () => {
        /** Recheck where the checkers now say the issue is not fixed. */
        const phase = await runPhase({
          resolvedIssueIds: ['adjudicated/one',],
          checkerVerdict: 'not-fixed',
        },);
        expect(phase.outcomes[0]?.repairedText,).toBe(REPAIRED_TEXT,);
        expect(phase.outcomes[0]?.changed,).toBe(false,);
        expect(
          phase.findings
            .some(function namesRollback(finding,) {
              return finding.includes('refine-rolled-back',)
                && finding.includes('adjudicated/one',);
            },),
        ).toBe(true,);
      },
    },),

    it({
      name: 'keeps a refinement whose recheck confirms the issue survived',
      fn: async () => {
        /** Recheck where the checkers confirm the issue is still fixed. */
        const phase = await runPhase({
          resolvedIssueIds: ['adjudicated/one',],
          checkerVerdict: 'fixed',
        },);
        expect(phase.outcomes[0]?.repairedText,).toBe(SMOOTH_TEXT,);
        expect(
          phase.findings
            .some(function namesRecheck(finding,) {
              return finding.includes('refine-recheck-passed',);
            },),
        ).toBe(true,);
      },
    },),

    it({
      name: 'KEEPS THE BALLOTS THAT CAUSED A ROLLBACK, which is the one round '
        + 'whose evidence decides what a reader sees: `refine-rolled-back` names '
        + 'the issue and nothing else said who called it a regression, so a '
        + 'slice that lost its rewrite could not be re-read at all',
      fn: async function aRollbackKeepsItsEvidence() {
        const phase = await runPhase({
          resolvedIssueIds: ['adjudicated/one',],
          checkerVerdict: 'not-fixed',
        },);

        /** The recheck round, as the outcome now carries it. */
        const reading = phase.outcomes[0]?.recheckReadings['adjudicated/one'];
        expect(reading?.configuredCheckers,).toBe(MODELS.checkerModelIds.length,);
        expect(reading?.ballots.length,).toBe(MODELS.checkerModelIds.length,);
        expect(
          reading?.ballots
            .every(function saidNotFixed(ballot,) {
              return ballot.verdict === 'not-fixed';
            },),
        ).toBe(true,);
        expect(reading?.tally.resolved,).toBe(false,);

        // THE DECIDING ROUND IS UNTOUCHED. This fixture's accuracy stage bought
        // no checker round, so a recheck landing in the wrong field would be
        // visible here as a reading this outcome never earned.
        expect(Object.keys(phase.outcomes[0]?.checkerReadings ?? {},).length,).toBe(0,);
      },
    },),

    it({
      name: 'KEEPS the ballots of a recheck that CLEARED as well, so agreement '
        + 'and rollback leave the same kind of evidence and a reader cannot '
        + 'mistake an unrecorded round for a unanimous one',
      fn: async function apassingRecheckKeepsItsEvidence() {
        const phase = await runPhase({
          resolvedIssueIds: ['adjudicated/one',],
          checkerVerdict: 'fixed',
        },);
        const reading = phase.outcomes[0]?.recheckReadings['adjudicated/one'];
        expect(reading?.ballots.length,).toBe(MODELS.checkerModelIds.length,);
        expect(reading?.tally.resolved,).toBe(true,);

        // The refiner is disjoint from every checker in this roster, so no
        // ballot here is a self-vote and the tally runs at full weight.
        expect(
          reading?.ballots
            .some(function judgedItsOwnWork(ballot,) {
              return ballot.wroteTheText;
            },),
        ).toBe(false,);
      },
    },),

    it({
      name: 'BUYS NO RECHECK on a slice with no confirmed issue, which is the '
        + 'common case, so an empty reading means the round never ran rather '
        + 'than a round that said nothing',
      fn: async function nothingProvedBuysNoRound() {
        const phase = await runPhase({
          resolvedIssueIds: [],
          checkerVerdict: 'fixed',
        },);

        // The rewrite still shipped; it simply had nothing to re-prove.
        expect(phase.outcomes[0]?.repairedText,).toBe(SMOOTH_TEXT,);
        expect(Object.keys(phase.outcomes[0]?.recheckReadings ?? {},).length,).toBe(0,);
      },
    },),

    it({
      name: 'STORES BOTH STAGES ON A RECORD WHOSE REWRITE SHIPPED, so what the '
        + 'record says about its own text stays true. The recheck already unions '
        + 'the two for its own weighting, but that union lives in an argument and '
        + 'dies with the call: left unstored, the record credits the editor with '
        + 'words a refiner replaced, and a later reader would let that refiner '
        + 'certify its own rewrite at full weight',
      fn: async function bothStagesRideTheStoredRecord() {
        const phase = await runPhase({
          resolvedIssueIds: [],
          checkerVerdict: 'fixed',
          authorship: {
            perIssue: {},
            everyIssue: [EDITOR_WHO_DID_NOT_REFINE,],
          },
        },);

        // The rewrite shipped, so both stages wrote what this record carries.
        expect(phase.outcomes[0]?.repairedText,).toBe(SMOOTH_TEXT,);
        expect(phase.outcomes[0]?.authorship.everyIssue.toSorted(),).toStrictEqual(
          [
            EDITOR_WHO_DID_NOT_REFINE,
            REFINER_THAT_REWROTE,
          ].toSorted(),
        );
      },
    },),

    it({
      name: 'NAMES NO REFINER ON A SLICE IT ROLLED BACK, which is the control '
        + 'proving the union above is not stored unconditionally. The rewrite '
        + 'those refiners produced is exactly the text the rollback threw away, '
        + 'and naming them would discount a checker over words no reader saw',
      fn: async function aRolledBackRewriteAddsNobody() {
        const phase = await runPhase({
          resolvedIssueIds: ['adjudicated/one',],
          checkerVerdict: 'not-fixed',
          authorship: {
            perIssue: {},
            everyIssue: [EDITOR_WHO_DID_NOT_REFINE,],
          },
        },);

        // T1 came back, so its editor alone answers for this record.
        expect(phase.outcomes[0]?.repairedText,).toBe(REPAIRED_TEXT,);
        expect(phase.outcomes[0]?.authorship.everyIssue,).toStrictEqual(
          [EDITOR_WHO_DID_NOT_REFINE,],
        );
      },
    },),

    it({
      name: 'AUDITS the rewrite it accepted, attaching a refinement probe '
        + 'report to the refined outcome. retainsResolvedIssues only proves a '
        + 'rewrite did not UNDO a confirmed repair; a rewrite can leave every '
        + 'confirmed repair standing and still damage the wording around it, '
        + 'and before this the lane was the one stage that could change shipped '
        + 'text with nothing asking',
      fn: async () => {
        const phase = await runPhase({
          resolvedIssueIds: [],
          checkerVerdict: 'fixed',
        },);

        expect(phase.outcomes[0]?.refined,).toBe(true,);
        /**
         * Report the lane attached for its own rewrite.
         */
        const report = phase.outcomes[0]
          ?.refinementDefects;
        expect(report,).toBeDefined();
        // Heard rather than lost: a report of zero heard probers is what a
        // silently broken wiring also produces, so the count is the assertion.
        expect(report
          ?.heardProbers,).toBeGreaterThan(0,);
        expect(report
          ?.regions
          .length,).toBe(1,);
        expect(report
          ?.regions[0]
          ?.envelopeId,).toBe('refinement/0',);
      },
    },),

    it({
      name: 'attaches NO refinement report when the lane changed nothing, so '
        + 'an absent report means no rewrite happened rather than a rewrite '
        + 'nobody checked',
      fn: async () => {
        /** Roster with the lane off. */
        const laneOff: RepairModels = {
          ...MODELS,
          refinerModelIds: [],
        };
        const phase = await runPhase({
          resolvedIssueIds: [],
          checkerVerdict: 'fixed',
          models: laneOff,
        },);

        expect(phase.outcomes[0]?.refined,).toBe(false,);
        expect(phase.outcomes[0]?.refinementDefects,).toBeUndefined();
      },
    },),

    it({
      name: 'is off entirely when no refiner roster is configured, spending no '
        + 'calls and returning the outcomes untouched',
      fn: async () => {
        /** Roster with the lane off. */
        const laneOff: RepairModels = {
          ...MODELS,
          refinerModelIds: [],
        };
        const phase = await runPhase({
          resolvedIssueIds: [],
          checkerVerdict: 'fixed',
          models: laneOff,
        },);
        expect(phase.outcomes[0]?.repairedText,).toBe(REPAIRED_TEXT,);
        expect(phase.outcomes[0]?.changed,).toBe(false,);
        expect(phase.findings.length,).toBe(0,);
      },
    },),

    it({
      name: 'REFUSES invalid overlap while the refiner lane is off, so disabling '
        + 'work cannot make invalid caller configuration valid',
      fn: async () => {
        /**
         * Calls made before refusal, which must stay at zero.
         */
        const calls = { count: 0, };

        /**
         * Roster turning naturalness lane off.
         */
        const laneOff: RepairModels = {
          ...MODELS,
          refinerModelIds: [],
        };
        await expect(runRefinePhase({
          declaredNames: [],
          client: countingClient({
            inner: scriptedPhase({ checkerVerdict: 'fixed', },),
            calls,
          },),
          targetText: REPAIRED_TEXT,
          slices: SLICES,
          outcomes: [settledOutcome({
            resolvedIssueIds: [],
            authorship: NO_MODEL_WROTE_THE_FIXTURE,
          },),],
          models: laneOff,
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          overlap: 0,
          l,
        },),)
          .rejects
          .toThrow(OverlapRefusedError,);
        expect(calls.count,).toBe(0,);
      },
    },),

    it({
      name: 'runs two refinement slices at once when overlap is 2, after a serial '
        + 'positive control proves the refiner instrument distinguishes one from two, '
        + 'and still returns outcomes in input order when the second refiner answers first',
      fn: async () => {
        /**
         * Two prepared slices carrying independently refinable paragraphs.
         */
        const twoSlices: readonly ChunkPair[] = [
          ...SLICES,
          {
            source: {
              sliceIndex: 1,
              text: SOURCE_TEXT,
              startOffset: SOURCE_TEXT.length + 2,
              endOffset: (SOURCE_TEXT.length * 2) + 2,
              nodes: [],
            },
            target: {
              sliceIndex: 1,
              text: REPAIRED_TEXT,
              startOffset: REPAIRED_TEXT.length + 2,
              endOffset: (REPAIRED_TEXT.length * 2) + 2,
              nodes: [],
            },
          },
        ];

        /**
         * Accuracy outcomes corresponding to prepared input order.
         */
        const firstOutcome = settledOutcome({
          resolvedIssueIds: [],
          authorship: NO_MODEL_WROTE_THE_FIXTURE,
        },);
        const outcomes: readonly ChunkRepairOutcome[] = [
          firstOutcome,
          {
            ...firstOutcome,
            sliceIndex: 1,
          },
        ];

        /**
         * Serial positive-control activity.
         */
        const serial: RefinerConcurrency = {
          now: 0,
          peak: 0,
          started: 0,
        };
        await runRefinePhase({
          declaredNames: [],
          client: measuringRefiners({
            inner: scriptedPhase({ checkerVerdict: 'fixed', },),
            activity: serial,
          },),
          targetText: `${REPAIRED_TEXT}\n\n${REPAIRED_TEXT}`,
          slices: twoSlices,
          outcomes,
          models: MODELS,
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          overlap: 1,
          l,
        },);

        /**
         * Overlapped activity.
         */
        const overlapped: RefinerConcurrency = {
          now: 0,
          peak: 0,
          started: 0,
        };
        const phase = await runRefinePhase({
          declaredNames: [],
          client: measuringRefiners({
            inner: scriptedPhase({ checkerVerdict: 'fixed', },),
            activity: overlapped,
          },),
          targetText: `${REPAIRED_TEXT}\n\n${REPAIRED_TEXT}`,
          slices: twoSlices,
          outcomes,
          models: MODELS,
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          overlap: 2,
          l,
        },);
        expect(serial.peak,).toBe(1,);
        expect(overlapped.peak,).toBe(2,);
        expect(phase.outcomes.map(function toIndex(outcome,) {
          return outcome.sliceIndex;
        },),).toEqual([
          0,
          1,
        ],);
      },
    },),

    it({
      name: 'reports rewriters asked when ANY overlapped slice asked, even when '
        + 'the last slice in document order was ineligible and asked nobody',
      fn: async () => {
        /**
         * Eligible first outcome followed by non-translation standing outcome.
         */
        const eligible = settledOutcome({
          resolvedIssueIds: [],
          authorship: NO_MODEL_WROTE_THE_FIXTURE,
        },);
        const ineligible: ChunkRepairOutcome = {
          ...eligible,
          sliceIndex: 1,
          nonTranslationStanding: true,
        };

        /**
         * Second prepared pair matching ineligible outcome index.
         */
        const second: ChunkPair = {
          source: {
            sliceIndex: 1,
            text: SOURCE_TEXT,
            startOffset: SOURCE_TEXT.length + 2,
            endOffset: (SOURCE_TEXT.length * 2) + 2,
            nodes: [],
          },
          target: {
            sliceIndex: 1,
            text: REPAIRED_TEXT,
            startOffset: REPAIRED_TEXT.length + 2,
            endOffset: (REPAIRED_TEXT.length * 2) + 2,
            nodes: [],
          },
        };
        const phase = await runRefinePhase({
          declaredNames: [],
          client: scriptedPhase({ checkerVerdict: 'fixed', },),
          targetText: `${REPAIRED_TEXT}\n\n${REPAIRED_TEXT}`,
          slices: [
            ...SLICES,
            second,
          ],
          outcomes: [
            eligible,
            ineligible,
          ],
          models: MODELS,
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          overlap: 2,
          l,
        },);
        expect(phase.askedRewriters,).toBe(true,);
      },
    },),

    it({
      name: 'reports a refinement that lands back on the ARCHIVE wording as '
        + 'unchanged, since the rewriter is measured against the accuracy text '
        + 'and can move off it right back onto the words the archive already '
        + 'had. Stamped changed, that slice enters the shipped set carrying the '
        + 'archive wording, which assembly refuses, so a run the models got '
        + 'right would fail the whole document',
      fn: async () => {
        /**
         * Slices whose archive wording is the SMOOTH text, so the accuracy
         * stage moved off it and the refinement lands back on it.
         */
        const archiveSlices: readonly ChunkPair[] = [
          {
            source: {
              sliceIndex: 0,
              text: SOURCE_TEXT,
              startOffset: 0,
              endOffset: SOURCE_TEXT.length,
              nodes: [],
            },
            target: {
              sliceIndex: 0,
              text: SMOOTH_TEXT,
              startOffset: 0,
              endOffset: SMOOTH_TEXT.length,
              nodes: [],
            },
          },
        ];

        /**
         * Accuracy outcome that changed the archive wording and had an issue
         * confirmed resolved in the text it produced.
         */
        const accuracy: ChunkRepairOutcome = {
          ...settledOutcome({ resolvedIssueIds: ['issue-1',], authorship: NO_MODEL_WROTE_THE_FIXTURE, },),
          changed: true,
        };

        /**
         * Phase over that outcome, whose rewriter returns the archive wording.
         */
        const phase = await runRefinePhase({
          declaredNames: [],
          client: scriptedPhase({ checkerVerdict: 'fixed', },),
          targetText: SMOOTH_TEXT,
          slices: archiveSlices,
          outcomes: [accuracy,],
          models: MODELS,
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          l,
        },);
        expect(phase.outcomes[0]?.repairedText,).toBe(SMOOTH_TEXT,);
        expect(phase.outcomes[0]?.changed,).toBe(false,);
        // Nothing this slice returns differs from the archive, so nothing it
        // returns can have resolved anything: crediting the issue here would
        // count a repair no reader saw.
        expect(phase.outcomes[0]?.resolvedIssueIds,).toEqual([],);
      },
    },),

    it({
      name: 'REFUSES an outcome naming a slice the preparation never produced before buying any call, '
        + 'where it used to refine against an empty original and be refused by the step afterwards',
      fn: async () => {
        /**
         * Calls made, which must stay at zero.
         */
        const calls = { count: 0, };

        await expect(runRefinePhase({
          declaredNames: [],
          client: countingClient({
            inner: scriptedPhase({ checkerVerdict: 'fixed', },),
            calls,
          },),
          targetText: REPAIRED_TEXT,
          slices: SLICES,
          outcomes: [
            {
              ...settledOutcome({ resolvedIssueIds: [], authorship: NO_MODEL_WROTE_THE_FIXTURE, },),
              sliceIndex: SLICES.length + 2,
            },
          ],
          models: MODELS,
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          l,
        },),).rejects.toThrow(UnpreparedSliceError,);
        expect(calls.count,).toBe(0,);
      },
    },),

    it({
      name: 'THROWS on an abort that lands during a slice and persists nothing for it, the check the '
        + 'accuracy pass makes before its own write',
      fn: async () => {
        /**
         * Cache that must stay empty.
         */
        const stored = new Map<string, RefinedSliceSettlement>();

        /**
         * Abort raised from inside the first call, after which the scripted
         * client still answers, so the stage settles and the guard before the
         * write is what has to refuse.
         */
        const controller = new AbortController();

        /**
         * Scripted client whose first exchange aborts the run.
         */
        const inner = scriptedPhase({ checkerVerdict: 'fixed', },);

        await expect(runRefinePhase({
          declaredNames: [],
          client: {
            chatText: inner.chatText,
            chatJson: async (request) => {
              controller.abort(new Error('the operator stopped the run',),);
              return await inner.chatJson(request,);
            },
            quotas: inner.quotas,
          },
          targetText: REPAIRED_TEXT,
          slices: SLICES,
          outcomes: [settledOutcome({ resolvedIssueIds: [], authorship: NO_MODEL_WROTE_THE_FIXTURE, },),],
          models: MODELS,
          refineCache: memoryRefineCache({ stored, },),
          signal: controller.signal,
          perCallTimeoutMs: 1_000,
          l,
        },),).rejects.toThrow(Error,);
        expect(stored.size,).toBe(0,);
      },
    },),

    it({
      name: 'REFUSES persistence after caller abort even when model work returned a '
        + 'complete settlement, preserving the final defense against future stages that settle silence',
      fn: async () => {
        /**
         * Exact caller abort reason whose identity must surface.
         */
        const stopped = new Error('caller stopped refinement',);
        const controller = new AbortController();
        controller.abort(stopped,);

        /**
         * Cache that aborted settlement must not reach.
         */
        const stored = new Map<string, RefinedSliceSettlement>();
        await expect(persistRefinePhaseSlice({
          key: 'refine-persistence-guard-fixture',
          settled: {
            outcome: settledOutcome({
              resolvedIssueIds: [],
              authorship: NO_MODEL_WROTE_THE_FIXTURE,
            },),
            findings: [],
          },
          sliceIndex: 0,
          refineCache: memoryRefineCache({ stored, },),
          signal: controller.signal,
          l,
        },),)
          .rejects
          .toBe(stopped,);
        expect(stored.size,).toBe(0,);
      },
    },),

    it({
      name: 'DOES NOT CACHE a refinement whose rewriter stage heard nobody, so a '
        + 'provider outage is reconsidered rather than resumed as a decision',
      fn: async () => {
        /**
         * Cache writes made by this run.
         */
        const stored = new Map<string, RefinedSliceSettlement>();

        /**
         * Refiner calls proving eligible work was attempted.
         */
        const calls = { count: 0, };

        /**
         * Scripted client with only rewriters unavailable.
         */
        const inner = scriptedPhase({ checkerVerdict: 'fixed', },);
        const phase = await runRefinePhase({
          declaredNames: [],
          client: {
            chatText: inner.chatText,
            chatJson: async (request) => {
              if (request.responseFormat
                ?.json_schema
                .name
                === 'refine_report') {
                calls.count += 1;
                throw new Error('refiner provider is unavailable',);
              }
              return await inner.chatJson(request,);
            },
            quotas: inner.quotas,
          },
          targetText: REPAIRED_TEXT,
          slices: SLICES,
          outcomes: [settledOutcome({
            resolvedIssueIds: [],
            authorship: NO_MODEL_WROTE_THE_FIXTURE,
          },),],
          models: MODELS,
          refineCache: memoryRefineCache({ stored, },),
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          overlap: 2,
          l,
        },);
        expect(calls.count,).toBeGreaterThan(0,);
        expect(phase.askedRewriters,).toBe(true,);
        expect(stored.size,).toBe(0,);
      },
    },),
  ],
},);

/**
 * Counts every model call a client is asked to make.
 *
 * WHAT IT IS FOR: a resumed slice is only resumed if it bought NOTHING. Reading
 * the returned text alone cannot tell a cache hit from a rewriter that happened
 * to answer the same way twice, and the scripted client here answers the same
 * way every time by construction, so the text would match either way.
 *
 * @param inner - client doing the actual scripted answering
 *
 * @param calls - counter this bumps on every structured call
 *
 * @returns Client forwarding to `inner` and counting
 *
 * @example
 * ```ts
 * const client = countingClient({ inner, calls, },);
 * ```
 */
function countingClient(
  {
    inner,
    calls,
  }: {
    readonly inner: SyntheticClient;
    readonly calls: { count: number; };
  },
): SyntheticClient {
  return {
    chatText: inner.chatText,
    chatJson: async (request) => {
      calls.count += 1;
      return await inner.chatJson(request,);
    },
    quotas: inner.quotas,
  };
}

/**
 * In-memory refinement cache behaving as the disk-backed one does.
 *
 * @param stored - map surviving between the two runs of a case
 *
 * @returns Cache resuming from `stored` and writing back into it
 *
 * @example
 * ```ts
 * const cache = memoryRefineCache({ stored, },);
 * ```
 */
function memoryRefineCache(
  { stored, }: { readonly stored: Map<string, RefinedSliceSettlement>; },
): SliceCache<RefinedSliceSettlement> {
  return {
    resumed: stored,
    persist: async ({ key, serialized, },) => {
      stored.set(
        key,
        JSON.parse(serialized,) as RefinedSliceSettlement,
      );
    },
  };
}

/**
 * Runs the phase once against a shared cache, counting what it bought.
 *
 * @param stored - cache contents carried between runs
 *
 * @returns Phase result beside the number of calls this run made
 *
 * @example
 * ```ts
 * const first = await runCachedPhase({ stored, },);
 * ```
 */
async function runCachedPhase(
  { stored, }: { readonly stored: Map<string, RefinedSliceSettlement>; },
) {
  /**
   * Calls this run made, which is what separates a resume from a rebuy.
   */
  const calls = { count: 0, };

  /**
   * What the phase settled this run.
   */
  const phase = await runRefinePhase({
    declaredNames: [],
    client: countingClient({
      inner: scriptedPhase({ checkerVerdict: 'fixed', },),
      calls,
    },),
    targetText: REPAIRED_TEXT,
    slices: SLICES,
    outcomes: [settledOutcome({ resolvedIssueIds: [], authorship: NO_MODEL_WROTE_THE_FIXTURE, },),],
    models: MODELS,
    refineCache: memoryRefineCache({ stored, },),
    signal: new AbortController().signal,
    perCallTimeoutMs: 1_000,
    l,
  },);
  return {
    phase,
    calls: calls.count,
  };
}

await describe({
  name: `${runRefinePhase.name} resume`,
  children: [
    it({
      name: 'REPUBLISHES THE SAME TEXT WITHOUT BUYING ANYTHING on a second run '
        + 'over one cache, which is the whole defect: the accuracy pass persists '
        + 'before this phase runs, so a resumed entry replayed accuracy from disk '
        + 'and then rebought the rewrite, publishing different text at 7 of 18 '
        + 'repair-lane slices across two runs on identical inputs',
      fn: async () => {
        /**
         * Cache both runs share, as one entry directory would be.
         */
        const stored = new Map<string, RefinedSliceSettlement>();

        const first = await runCachedPhase({ stored, },);
        const second = await runCachedPhase({ stored, },);

        // The positive control: the first run must have bought something, or a
        // second run buying nothing would prove only that the lane never ran.
        expect(first.calls,).toBeGreaterThan(0,);
        expect(second.calls,).toBe(0,);

        expect(first.phase.outcomes[0]?.repairedText,).toBe(SMOOTH_TEXT,);
        expect(second.phase.outcomes[0]?.repairedText,).toBe(SMOOTH_TEXT,);
        expect(second.phase.outcomes[0]?.refined,).toBe(true,);
        expect(second.phase.outcomes[0]?.changed,).toBe(true,);
      },
    },),

    it({
      name: 'REPORTS NO REWRITER ASKED on the resumed run, because that answer '
        + 'decides whether a run overtaken by an abort may call itself finished. '
        + 'A resumed slice asked nobody anything, and carrying the stored answer '
        + 'would report a previous run\'s purchase as this one\'s',
      fn: async () => {
        const stored = new Map<string, RefinedSliceSettlement>();

        const first = await runCachedPhase({ stored, },);
        const second = await runCachedPhase({ stored, },);

        expect(first.phase.askedRewriters,).toBe(true,);
        expect(second.phase.askedRewriters,).toBe(false,);
      },
    },),

    it({
      name: 'CARRIES THE FINDINGS BACK with the resumed slice, so a scorecard '
        + 'reads the same telemetry whether the entry was bought or resumed',
      fn: async () => {
        const stored = new Map<string, RefinedSliceSettlement>();

        const first = await runCachedPhase({ stored, },);
        const second = await runCachedPhase({ stored, },);

        expect(second.phase.findings,).toStrictEqual(first.phase.findings,);
      },
    },),
  ],
},);
