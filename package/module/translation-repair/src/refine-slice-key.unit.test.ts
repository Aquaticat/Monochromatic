/**
 * Tests for what makes two runs' refinements the same refinement.
 *
 * WHAT THESE PIN is the half of a cache that fails silently. A key that is too
 * WIDE discards settled work on an unrelated change, which is expensive and
 * obvious. A key that is too NARROW returns a rewrite reached under a different
 * question, and nothing looks wrong: the slice text matches, so the key
 * matches, and a run publishes wording it never bought.
 *
 * The INCUMBENT is the member that looks wrong. It reaches no prompt in this
 * stage at all, and it is in the key because the settlement stores a `changed`
 * flag computed against it and drops the confirmed set wherever a rewrite
 * lands back on the archive wording. A key blind to it returns a verdict
 * reached against wording this run no longer carries, and the resume then
 * throws rather than correcting itself.
 *
 * The DEFINITIONS are the case this stage adds over the others. They are
 * collected from the whole assembled document rather than from this slice, so a
 * neighbouring slice settling differently changes what this rewriter is shown.
 * A key blind to that resumes a stale rewrite after its neighbour moves, which
 * is the failure `#126` already recorded once at the accuracy window.
 *
 * Content fixtures are cat-themed invention. No corpus content appears here.
 * Model identifiers come from the catalog, because `SyntheticModelId` is a
 * closed union and an invented one does not typecheck.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type AdjudicatedIssue,
  refineRunShape,
  refineSliceKey,
} from '../dist/final/node/index.mjs';

/**
 * Roster this run asks, as the phase assembles one.
 */
const RUN_SHAPE = refineRunShape({
  refinerModelIds: ['hf:zai-org/GLM-5.2',],
  judgeModelIds: ['hf:Qwen/Qwen3.8-27B',],
  checkerModelIds: ['hf:moonshotai/Kimi-K3',],
},);

/**
 * One accepted claim, whose wording reaches the checkers.
 */
const ISSUE = {
  issueId: 'adjudicated/one',
  status: 'accepted',
  severity: 'major',
  claims: [],
  tallies: {},
} as unknown as AdjudicatedIssue;

/**
 * Every input the key covers, as one run supplies them.
 */
const BASE = {
  runShape: RUN_SHAPE,
  sourceText: '猫猫每天下午都在窗台上晒太阳。',
  repairedText: 'The cat sunbathes on the windowsill every afternoon.',
  incumbentText: 'The cat suns herself on the windowsill each afternoon.',
  definitions: '[nap]: https://example.invalid/nap',
  declaredNames: ['Mimi',],
  issues: [ISSUE,],
  resolvedIssueIds: ['adjudicated/one',],
  nonTranslationStanding: false,
} as const;

await describe({
  name: refineSliceKey.name,
  children: [
    it({
      name: 'ANSWERS THE SAME KEY for the same question asked twice, which is '
        + 'the property the whole resume rests on: without it every run rebuys '
        + 'a lane it already paid for',
      fn: async () => {
        expect(refineSliceKey(BASE,),).toBe(refineSliceKey(BASE,),);
      },
    },),

    it({
      name: 'MOVES WHEN THE DEFINITIONS MOVE, which is what separates this key '
        + 'from the accuracy pass\'s own. Definitions come from the whole '
        + 'assembled document, so a neighbouring slice settling differently '
        + 'changes what this rewriter is shown, and a key blind to it resumes a '
        + 'rewrite made against a page that no longer exists',
      fn: async () => {
        expect(
          refineSliceKey({
            ...BASE,
            definitions: '[nap]: https://example.invalid/elsewhere',
          },),
        ).not.toBe(refineSliceKey(BASE,),);
      },
    },),

    it({
      name: 'MOVES WHEN THE ACCURACY TEXT MOVES, since that text is both what '
        + 'the rewriter is handed and what the damage probe measures against',
      fn: async () => {
        expect(
          refineSliceKey({
            ...BASE,
            repairedText: 'The cat sunbathes on the sill each afternoon.',
          },),
        ).not.toBe(refineSliceKey(BASE,),);
      },
    },),

    it({
      name: 'MOVES WHEN ONLY THE INCUMBENT MOVES, which reads like a mistake '
        + 'until the stored record is read: no rewriter, judge or checker is '
        + 'ever shown the archive wording, but the settlement computes '
        + '`changed` against it and drops the confirmed set wherever a rewrite '
        + 'lands back on it. A field no model reads still belongs in a key '
        + 'whose record is computed from it',
      fn: async () => {
        expect(
          refineSliceKey({
            ...BASE,
            incumbentText: 'The cat suns herself on the sill each afternoon.',
          },),
        ).not.toBe(refineSliceKey(BASE,),);
      },
    },),

    it({
      name: 'MOVES WHEN THE SOURCE MOVES, because the source is the standard '
        + 'every rewrite is judged faithful against',
      fn: async () => {
        expect(
          refineSliceKey({
            ...BASE,
            sourceText: '猫猫每天早上都在窗台上晒太阳。',
          },),
        ).not.toBe(refineSliceKey(BASE,),);
      },
    },),

    it({
      name: 'MOVES WHEN THE CONFIRMED SET MOVES, because it decides what a '
        + 'rollback is measured against: the same rewrite ships under one set '
        + 'and is rolled back under another',
      fn: async () => {
        expect(
          refineSliceKey({
            ...BASE,
            resolvedIssueIds: [],
          },),
        ).not.toBe(refineSliceKey(BASE,),);
      },
    },),

    it({
      name: 'MOVES WHEN AN ISSUE IS REWORDED under an unchanged identifier, '
        + 'because the checkers read the wording rather than the name',
      fn: async () => {
        expect(
          refineSliceKey({
            ...BASE,
            issues: [
              {
                ...ISSUE,
                severity: 'minor',
              } as unknown as AdjudicatedIssue,
            ],
          },),
        ).not.toBe(refineSliceKey(BASE,),);
      },
    },),

    it({
      name: 'MOVES WHEN THE NON-TRANSLATION VERDICT FLIPS, since that decides '
        + 'whether the lane runs at all and a resumed slice must not skip a '
        + 'rewrite this run would have bought',
      fn: async () => {
        expect(
          refineSliceKey({
            ...BASE,
            nonTranslationStanding: true,
          },),
        ).not.toBe(refineSliceKey(BASE,),);
      },
    },),

    it({
      name: 'MOVES WHEN THE DECLARED NAMES MOVE, because they are the guard a '
        + 'rewrite is held to rather than decoration on the prompt',
      fn: async () => {
        expect(
          refineSliceKey({
            ...BASE,
            declaredNames: ['Mimi', 'Momo',],
          },),
        ).not.toBe(refineSliceKey(BASE,),);
      },
    },),
  ],
},);

await describe({
  name: refineRunShape.name,
  children: [
    it({
      name: 'SEPARATES TWO REWRITER ROSTERS, so a resumed slice cannot return '
        + 'wording a voice this run never asked produced',
      fn: async () => {
        expect(
          refineRunShape({
            refinerModelIds: ['hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',],
            judgeModelIds: ['hf:Qwen/Qwen3.8-27B',],
            checkerModelIds: ['hf:moonshotai/Kimi-K3',],
          },),
        ).not.toBe(RUN_SHAPE,);
      },
    },),

    it({
      name: 'SEPARATES TWO CHECKER ROSTERS even though checkers never rewrite '
        + 'anything. They decide whether a rewrite is rolled back for breaking '
        + 'a confirmed repair, so a different checker roster ships wording this '
        + 'one refused',
      fn: async () => {
        expect(
          refineRunShape({
            refinerModelIds: ['hf:zai-org/GLM-5.2',],
            judgeModelIds: ['hf:Qwen/Qwen3.8-27B',],
            checkerModelIds: ['hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',],
          },),
        ).not.toBe(RUN_SHAPE,);
      },
    },),

    it({
      name: 'SEPARATES TWO IDENTITY CONTEXTS, which is front-matter-derived '
        + 'prompt content that varies per pair and measurably changes what a '
        + 'rewriter produces',
      fn: async () => {
        expect(
          refineRunShape({
            refinerModelIds: ['hf:zai-org/GLM-5.2',],
            judgeModelIds: ['hf:Qwen/Qwen3.8-27B',],
            checkerModelIds: ['hf:moonshotai/Kimi-K3',],
            identityContext: 'Mimi is the cat.',
          },),
        ).not.toBe(RUN_SHAPE,);
      },
    },),

    it({
      name: 'MOVES WHEN THE WINDOW MOVES. The damage probe inside the '
        + 'settlement is shown the passages either side, and its findings ride '
        + 'in the cached record, so a slice audited against its neighbours was '
        + 'asked a different question from the same slice audited alone and '
        + 'nothing else records which it was',
      fn: async () => {
        expect(
          refineSliceKey({
            ...BASE,
            neighbouringSourceText: '邻居的橘猫在门口等鱼干。',
          },),
        ).not.toBe(refineSliceKey(BASE,),);
      },
    },),

    it({
      name: 'DISTINGUISHES THE TWO SIDES OF THE WINDOW carrying identical '
        + 'text, which is `#126` exactly: spread bare into a positional array '
        + 'a source-only window and an incumbent-only window hash the same, '
        + 'and one cached audit then serves two different questions. '
        + 'Asymmetric windows are real, since a neighbour that is an insertion '
        + 'anchor has original text and no archive text',
      fn: async () => {
        /**
         * Text placed on one side of the window and then the other, so only
         * the LABEL differs between the two keys.
         */
        const nearby = '邻居的橘猫在门口等鱼干。';

        expect(
          refineSliceKey({
            ...BASE,
            neighbouringSourceText: nearby,
          },),
        ).not.toBe(
          refineSliceKey({
            ...BASE,
            neighbouringIncumbentText: nearby,
          },),
        );
      },
    },),

    it({
      name: 'READS AN EMPTY WINDOW AS AN ABSENT ONE, because a slice with no '
        + 'neighbours is asked exactly what a caller without the parameter '
        + 'asks: `introduced-defect-wire` renders no nearby block for either. '
        + 'Keying them apart would rebuy every document-edge slice to reach '
        + 'the identical answer',
      fn: async () => {
        expect(
          refineSliceKey({
            ...BASE,
            neighbouringSourceText: '',
            neighbouringIncumbentText: '',
          },),
        ).toBe(refineSliceKey(BASE,),);
      },
    },),

    it({
      name: 'READS AN ABSENT IDENTITY CONTEXT AS AN EMPTY ONE rather than as a '
        + 'separate question, so a pair declaring nothing resumes across runs '
        + 'instead of rebuying its whole lane',
      fn: async () => {
        expect(
          refineRunShape({
            refinerModelIds: ['hf:zai-org/GLM-5.2',],
            judgeModelIds: ['hf:Qwen/Qwen3.8-27B',],
            checkerModelIds: ['hf:moonshotai/Kimi-K3',],
            identityContext: '',
          },),
        ).toBe(RUN_SHAPE,);
      },
    },),
  ],
},);
