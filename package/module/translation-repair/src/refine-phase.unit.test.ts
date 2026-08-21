/**
 * Tests for the naturalness phase: when it runs, when it rolls back, and that
 * a refinement-only change reaches the shipped text.
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

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
  messageText,
  type RepairModels,
  runRefinePhase,
  type SyntheticClient,
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
 * Roster with the lane on, refiners disjoint from checkers.
 */
const MODELS: RepairModels = {
  criticModelIds: ['hf:zai-org/GLM-5.2',],
  panelModelIds: ['hf:zai-org/GLM-5.2',],
  editorModelIds: ['hf:zai-org/GLM-5.2',],
  judgeModelIds: [
    'hf:zai-org/GLM-5.2',
    'hf:Qwen/Qwen3.8-27B',
    'hf:moonshotai/Kimi-K3',
    'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
  ],
  refinerModelIds: ['hf:zai-org/GLM-5.2',],
  checkerModelIds: [
    'hf:Qwen/Qwen3.8-27B',
    'hf:moonshotai/Kimi-K3',
    'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
  ],
};

/**
 * Slice pair covering the whole fixture translation.
 */
const SLICES: readonly ChunkPair[] = [
  {
    source: {
      chunkIndex: 0,
      text: SOURCE_TEXT,
      startOffset: 0,
      endOffset: SOURCE_TEXT.length,
      nodes: [],
    },
    target: {
      chunkIndex: 0,
      text: REPAIRED_TEXT,
      startOffset: 0,
      endOffset: REPAIRED_TEXT.length,
      nodes: [],
    },
  },
];

/**
 * Builds one settled accuracy outcome.
 *
 * @param resolvedIssueIds - issues the checkers confirmed in `T1`
 *
 * @returns Outcome the phase refines
 *
 * @example
 * ```ts
 * const outcome = settledOutcome({ resolvedIssueIds: [], },);
 * ```
 */
function settledOutcome(
  {
    resolvedIssueIds,
  }: {
    readonly resolvedIssueIds: readonly string[];
  },
): ChunkRepairOutcome {
  return {
    chunkIndex: 0,
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
    repairRegions: [],
    accuracyPatchSelected: false,
    refined: false,
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
  }: {
    readonly resolvedIssueIds: readonly string[];
    readonly checkerVerdict: string;
    readonly models?: RepairModels;
  },
) {
  return runRefinePhase({
    declaredNames: [],
    client: scriptedPhase({ checkerVerdict, },),
    targetText: REPAIRED_TEXT,
    slices: SLICES,
    outcomes: [settledOutcome({ resolvedIssueIds, },),],
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
              chunkIndex: 0,
              text: SOURCE_TEXT,
              startOffset: 0,
              endOffset: SOURCE_TEXT.length,
              nodes: [],
            },
            target: {
              chunkIndex: 0,
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
          ...settledOutcome({ resolvedIssueIds: ['issue-1',], },),
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
  ],
},);
