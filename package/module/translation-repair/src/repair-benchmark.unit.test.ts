/**
 * Tests for restoration grading and the milestone-two repair benchmark.
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  applySeededErrors,
  computeRepairScorecard,
  contentWords,
  DEFAULT_JUDGE_MODEL_IDS,
  gradeSeedDetection,
  hashContent,
  measureSeedRestoration,
  type RepairAttemptRecord,
  type RepairModels,
  type repairTranslation,
  runRepairBenchmark,
  type runRestorationJudge,
  type SeededErrorSpec,
  SYNTHETIC_MODELS,
} from '../dist/final/neutral/index.mjs';

/**
 * Clean fixture translation the seed deletes from.
 */
const CLEAN_TEXT =
  'The cat naps in the sun. The cat also chases crimson butterflies across the meadow. The bowl stays full.';

/**
 * Deletion seed removing the butterfly sentence.
 */
const BUTTERFLY_SEED: SeededErrorSpec = {
  id: 'seed/omission-0',
  category: 'accuracy/omission',
  kind: 'deletion',
  needle: ' The cat also chases crimson butterflies across the meadow.',
  replacement: '',
};

/**
 * Fixture text with the butterfly sentence already deleted.
 */
const SEEDED_TEXT = 'The cat naps in the sun. The bowl stays full.';

/**
 * Role roster; identities only matter as distinct voices.
 */
const MODELS: RepairModels = {
  criticModelIds: ['hf:zai-org/GLM-5.2',],
  panelModelIds: ['hf:zai-org/GLM-5.2',],
  editorModelId: 'hf:zai-org/GLM-5.2',
  checkerModelIds: ['hf:zai-org/GLM-5.2',],
};

/**
 * Client stand-in; the injected repair seam keeps it uncalled.
 */
const UNUSED_CLIENT = {
  chatText: async () => {
    throw new Error('unused',);
  },
  chatJson: async () => {
    throw new Error('unused',);
  },
  quotas: async () => {
    throw new Error('unused',);
  },
};

await describe({
  name: contentWords.name,
  children: [
    it({
      name: 'collects distinct long words and drops short ones',
      fn: async () => {
        /** Vocabulary of a short sentence. */
        const words = contentWords({ text: 'The cat naps; the CAT chases butterflies!', },);
        expect(words.has('chases',),).toBe(true,);
        expect(words.has('butterflies',),).toBe(true,);
        expect(words.has('naps',),).toBe(true,);
        expect(words.has('cat',),).toBe(false,);
        expect(words.has('the',),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: measureSeedRestoration.name,
  children: [
    it({
      name: 'grades a re-translated restoration as restored',
      fn: async () => {
        /** Repair wording differs but restores the distinctive vocabulary. */
        const grade = measureSeedRestoration({
          needle: BUTTERFLY_SEED.needle,
          seededText: SEEDED_TEXT,
          repairedText:
            'The cat naps in the sun. The cat loves to chase crimson butterflies over the meadow. The bowl stays full.',
        },);
        expect(grade.measurable,).toBe(true,);
        // Disappeared vocabulary: also, chases, crimson, butterflies,
        // across, meadow; the repair returns crimson, butterflies, meadow.
        expect(grade.restored,).toBe(true,);
        expect(grade.returnedWords,).toBe(3,);
      },
    },),

    it({
      name: 'grades an untouched text as not restored',
      fn: async () => {
        /** Repair that never brought the sentence back. */
        const grade = measureSeedRestoration({
          needle: BUTTERFLY_SEED.needle,
          seededText: SEEDED_TEXT,
          repairedText: SEEDED_TEXT,
        },);
        expect(grade.measurable,).toBe(true,);
        expect(grade.restored,).toBe(false,);
        expect(grade.returnedWords,).toBe(0,);
      },
    },),

    it({
      name: 'marks a needle whose vocabulary survives elsewhere as unmeasurable',
      fn: async () => {
        /** Needle repeating vocabulary the seeded text keeps. */
        const grade = measureSeedRestoration({
          needle: 'The bowl stays full.',
          seededText: SEEDED_TEXT,
          repairedText: SEEDED_TEXT,
        },);
        expect(grade.measurable,).toBe(false,);
        expect(grade.restored,).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: computeRepairScorecard.name,
  children: [
    it({
      name: 'rates restoration over measurable seeds and reports coverage',
      fn: async () => {
        /** Two dispatched attempts and one budget skip. */
        const records: readonly RepairAttemptRecord[] = [
          {
            entryId: 'whiskers',
            outcomeKind: 'ok',
            status: 'repaired',
            seedJudgments: {
              'seed/omission-0': {
                verdict: 'restored',
                judged: true,
                votes: 3,
              },
              'seed/omission-1': {
                verdict: 'partial',
                judged: true,
                votes: 3,
              },
            },
            seedGrades: {
              'seed/omission-0': {
                measurable: true,
                disappearedWords: 6,
                returnedWords: 4,
                restored: true,
              },
              'seed/omission-1': {
                measurable: false,
                disappearedWords: 0,
                returnedWords: 0,
                restored: false,
              },
            },
            seedDetection: {
              'seed/omission-0': true,
              'seed/omission-1': true,
            },
            issueCount: 3,
            resolvedIssueCount: 2,
            detail: '',
          },
          {
            entryId: 'mittens',
            outcomeKind: 'ok',
            status: 'unchanged',
            seedJudgments: {
              // One judged absent, one that never reached quorum.
              'seed/omission-0': {
                verdict: 'absent',
                judged: true,
                votes: 3,
              },
              'seed/omission-1': {
                verdict: 'absent',
                judged: false,
                votes: 0,
              },
            },
            seedGrades: {
              'seed/omission-0': {
                measurable: true,
                disappearedWords: 5,
                returnedWords: 0,
                restored: false,
              },
            },
            seedDetection: { 'seed/omission-0': false, },
            issueCount: 1,
            resolvedIssueCount: 0,
            detail: '',
          },
          {
            entryId: 'shadow',
            outcomeKind: 'skipped',
            seedJudgments: {},
            seedGrades: {},
            seedDetection: {},
            issueCount: 0,
            resolvedIssueCount: 0,
            detail: 'run-budget-exhausted',
          },
        ];
        /** Scorecard over the mixed records. */
        const scorecard = computeRepairScorecard({ records, },);
        expect(scorecard.dispatchedEntries,).toBe(2,);
        expect(scorecard.coverage,).toBe(2 / 3,);
        // Judge denominator excludes the unjudged (no-quorum) seed: 3 judged.
        expect(scorecard.judgedSeeds,).toBe(3,);
        expect(scorecard.restoredSeeds,).toBe(1,);
        expect(scorecard.partialSeeds,).toBe(1,);
        expect(scorecard.seededRepairRate,).toBe(1 / 3,);
        expect(scorecard.seededRepairRateLenient,).toBe(2 / 3,);
        // Lexical grade kept for comparison: 2 measurable, 1 restored.
        expect(scorecard.lexicalUniverse,).toBe(2,);
        expect(scorecard.lexicalRestoredSeeds,).toBe(1,);
        expect(scorecard.lexicalRepairRate,).toBe(1 / 2,);
        expect(scorecard.plantedSeeds,).toBe(3,);
        expect(scorecard.detectedSeeds,).toBe(2,);
        expect(scorecard.seedDetectionRate,).toBe(2 / 3,);
        expect(scorecard.statusCounts.repaired,).toBe(1,);
        expect(scorecard.statusCounts.unchanged,).toBe(1,);
      },
    },),
  ],
},);

await describe({
  name: gradeSeedDetection.name,
  children: [
    it({
      name: 'marks seeds with accepted issues at their region and only those',
      fn: async () => {
        /** Sectioned fixture translation the seed deletes from. */
        const sectionedTarget = `## Introduction

The cat naps in the sun. The cat also chases crimson butterflies across the meadow. The bowl stays full.
`;
        /** Deletion planted into the sectioned fixture. */
        const { seededText, applications, } = applySeededErrors({
          text: sectionedTarget,
          specs: [BUTTERFLY_SEED,],
        },);
        /** Application region of the planted seed. */
        const [application,] = applications;
        if (application === undefined)
          throw new Error('fixture planting failed',);
        /** Accepted issue anchored at the deletion point. */
        const nearIssue = {
          chunkIndex: 0,
          resolved: false,
          issue: {
            issueId: 'adjudicated/near',
            status: 'accepted' as const,
            severity: 'major' as const,
            claims: [
              {
                claimId: 'issue/near',
                claim: {
                  category: 'accuracy/omission' as const,
                  severity: 'major' as const,
                  summary: 'The butterfly sentence is missing.',
                  spans: [
                    {
                      side: 'target' as const,
                      nodeId: 'block/1',
                      nodeHash: hashContent({ content: 'invented', },),
                      startOffset: application.startOffset,
                      endOffset: application.startOffset + 10,
                      quotedText: seededText.slice(
                        application.startOffset,
                        application.startOffset + 10,
                      ),
                    },
                  ],
                },
              },
            ],
            tallies: {},
          },
        };
        /** Detection with the accepted near issue. */
        const detected = gradeSeedDetection({
          sourceText: '## 简介\n\n猫猫在太阳下打盹。猫猫也追蝴蝶。碗是满的。\n',
          seededText,
          applications,
          issues: [nearIssue,],
        },);
        expect(detected[BUTTERFLY_SEED.id],).toBe(true,);
        /** Detection when the same issue is rejected. */
        const rejected = gradeSeedDetection({
          sourceText: '## 简介\n\n猫猫在太阳下打盹。猫猫也追蝴蝶。碗是满的。\n',
          seededText,
          applications,
          issues: [
            {
              ...nearIssue,
              issue: {
                ...nearIssue.issue,
                status: 'rejected' as const,
              },
            },
          ],
        },);
        expect(rejected[BUTTERFLY_SEED.id],).toBe(false,);
      },
    },),
  ],
},);

/**
 * Judge stub ruling every reference restored through the seam.
 */
const restoringJudge: typeof runRestorationJudge = async ({ references, },) => 
  Object.fromEntries(references.map(function toVerdict(reference,) {
    return [
      reference.seedId,
      {
        verdict: 'restored' as const,
        judged: true,
        votes: 3,
      },
    ];
  },),)
;

await describe({
  name: runRepairBenchmark.name,
  children: [
    it({
      name: 'grades a scripted restoring repair through the seam',
      fn: async () => {
        /** Scripted repair that restores the butterfly sentence. */
        const restoringRepair: typeof repairTranslation = async ({ targetText, },) => (
          {
            repairedText: `${targetText} The cat also chases crimson butterflies across the meadow.`,
            status: 'repaired',
            issues: [],
            findings: [],
          }
        );
        /** Benchmark over one entry. */
        const { records, scorecard, } = await runRepairBenchmark({
          client: UNUSED_CLIENT,
          entries: [
            {
              entryId: 'whiskers',
              sourceText: '猫猫在太阳下打盹。猫猫也追蝴蝶。碗是满的。',
              targetText: CLEAN_TEXT,
              seeds: [BUTTERFLY_SEED,],
            },
          ],
          models: MODELS,
          signal: new AbortController().signal,
          repair: restoringRepair,
          judge: restoringJudge,
        },);
        expect(records[0]?.outcomeKind,).toBe('ok',);
        expect(records[0]?.seedJudgments['seed/omission-0']?.verdict,).toBe('restored',);
        expect(records[0]?.seedGrades['seed/omission-0']?.restored,).toBe(true,);
        expect(scorecard.seededRepairRate,).toBe(1,);
        expect(scorecard.coverage,).toBe(1,);
      },
    },),

    it({
      name: 'skips entries the budget cannot fit and records thrown repairs as errors',
      fn: async () => {
        /** Scripted repair that always throws. */
        const throwingRepair: typeof repairTranslation = async () => {
          throw new Error('scripted transport collapse',);
        };
        /** Benchmark whose budget is already exhausted at start. */
        const skipped = await runRepairBenchmark({
          client: UNUSED_CLIENT,
          entries: [
            {
              entryId: 'whiskers',
              sourceText: '猫',
              targetText: CLEAN_TEXT,
              seeds: [BUTTERFLY_SEED,],
            },
          ],
          models: MODELS,
          signal: new AbortController().signal,
          runBudgetMs: 0,
          repair: throwingRepair,
          judge: restoringJudge,
        },);
        expect(skipped.records[0]?.outcomeKind,).toBe('skipped',);
        expect(skipped.scorecard.coverage,).toBe(0,);
        /** Benchmark whose repair throws. */
        const errored = await runRepairBenchmark({
          client: UNUSED_CLIENT,
          entries: [
            {
              entryId: 'whiskers',
              sourceText: '猫',
              targetText: CLEAN_TEXT,
              seeds: [BUTTERFLY_SEED,],
            },
          ],
          models: MODELS,
          signal: new AbortController().signal,
          repair: throwingRepair,
          judge: restoringJudge,
        },);
        expect(errored.records[0]?.outcomeKind,).toBe('error',);
        expect(errored.records[0]?.detail,).toContain('scripted transport collapse',);
      },
    },),
  ],
},);

await describe({
  name: 'DEFAULT_JUDGE_MODEL_IDS',
  children: [
    it({
      name: 'names only cataloged models, distinctly',
      fn: async () => {
        for (const modelId of DEFAULT_JUDGE_MODEL_IDS)
          expect(SYNTHETIC_MODELS[modelId]?.id,).toBe(modelId,);
        expect(new Set(DEFAULT_JUDGE_MODEL_IDS,).size,)
          .toBe(DEFAULT_JUDGE_MODEL_IDS.length,);
      },
    },),
  ],
},);
