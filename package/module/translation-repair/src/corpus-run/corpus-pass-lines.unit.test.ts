/**
 Tests for the lines a corpus pass prints: the restriction, the pairs it could
 not read, the START line, every limit a launch changed, the required
 providers, the plan and the closing line. Each is read whole.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type CorpusPinSetting,
  passDoneLine,
  passIncompleteLine,
  passLaunchLines,
  passOnlyLines,
  passPlanLine,
  passRequiredLines,
  passStartLine,
} from '../../dist/final/node/index.mjs';

/**
 Corpus pin neither half of which a launch overrode.
 */
const BUILT_IN_PIN: CorpusPinSetting = {
  pin: {
    cloneDir: '/clones/cats',
    commitSha: 'a'.repeat(40,),
  },
  cloneDirSource: 'fallback',
  commitSource: 'fallback',
};

/**
 Limits no launch changed: the built-in ceiling, a room for one exchange,
 the built-in allowance, no window note and the built-in pin.
 */
const UNCHANGED = {
  hardCapMs: 25_200_000,
  builtInCapMinutes: 420,
  perCallMs: 360_000,
  spendCeilingUsd: 20,
  graceNote: '',
  writerNote: '',
  pinSetting: BUILT_IN_PIN,
} as const;

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: passOnlyLines.name,
      children: [
        it({
          name: 'SAYS NOTHING for a pass restricted to no entry',
          fn: async () => {
            expect(passOnlyLines({ onlyIds: new Set<string>(), },),).toEqual([],);
          },
        },),
        it({
          name: 'NAMES ONE ENTRY the pass was restricted to, with what bypassing the ordering means',
          fn: async () => {
            expect(passOnlyLines({ onlyIds: new Set(['tabby',],), },),).toEqual([
              'ONLY tabby (ordering is bypassed; run this into a throwaway TRANSLATION_REPAIR_RUNS_DIR so a '
              + 'hand-picked entry never enters a pool later draws treat as natural accumulation)',
            ],);
          },
        },),
        it({
          name: 'NAMES SEVERAL ENTRIES in code point order, whatever order they were written in, so two runs of '
            + 'one selection log alike',
          fn: async () => {
            expect(passOnlyLines({ onlyIds: new Set([
              '😺',
              'mittens',
              'Tabby',
            ],), },),).toEqual([
              'ONLY Tabby,mittens,😺 (ordering is bypassed; run this into a throwaway TRANSLATION_REPAIR_RUNS_DIR '
              + 'so a hand-picked entry never enters a pool later draws treat as natural accumulation)',
            ],);
          },
        },),
      ],
    },),

    describe({
      name: passIncompleteLine.name,
      children: [
        it({
          name: 'NAMES AN ENTRY whose English page is absent, with what the read said',
          fn: async () => {
            expect(passIncompleteLine({ gap: {
              id: 'mittens',
              side: 'target',
              detail: 'missing-object',
            }, },),).toBe('INCOMPLETE mittens: target page absent at the pin (missing-object)',);
          },
        },),
        it({
          name: 'NAMES AN ENTRY whose original page is absent',
          fn: async () => {
            expect(passIncompleteLine({ gap: {
              id: 'biscuit',
              side: 'source',
              detail: 'missing-object',
            }, },),).toBe('INCOMPLETE biscuit: source page absent at the pin (missing-object)',);
          },
        },),
      ],
    },),

    describe({
      name: passStartLine.name,
      children: [
        it({
          name: 'REPORTS the tip, the pipeline and its files, the pending and the finished counts and both ceilings',
          fn: async () => {
            expect(passStartLine({ facts: {
              tip: 'deadbeef',
              pipelineDigest: 'sha256-tree-v1:cafe',
              fileCount: 189,
              pending: 1,
              done: 0,
              softBudgetMs: 259_200_000,
              hardCapMs: 25_200_000,
            }, },),).toBe(
              'START tip=deadbeef pipeline=sha256-tree-v1:cafe files=189 pending=1 done=0 soft=259200000ms '
              + 'hard=25200000ms',
            );
          },
        },),
        it({
          name: 'REPORTS several pending and finished entries',
          fn: async () => {
            expect(passStartLine({ facts: {
              tip: 'deadbeef',
              pipelineDigest: 'sha256-tree-v1:cafe',
              fileCount: 1,
              pending: 12,
              done: 3,
              softBudgetMs: 60_000,
              hardCapMs: 90_000,
            }, },),).toBe(
              'START tip=deadbeef pipeline=sha256-tree-v1:cafe files=1 pending=12 done=3 soft=60000ms hard=90000ms',
            );
          },
        },),
      ],
    },),

    describe({
      name: passLaunchLines.name,
      children: [
        it({
          name: 'SAYS NOTHING when no limit was changed and one exchange fits in the ceiling',
          fn: async () => {
            expect(passLaunchLines(UNCHANGED,),).toEqual([],);
          },
        },),
        it({
          name: 'NAMES A CEILING OF SEVERAL MINUTES in the plural, and a fractional one too',
          fn: async () => {
            expect(passLaunchLines({
              ...UNCHANGED,
              hardCapMs: 600_000,
            },),).toEqual([
              'CAP OVERRIDDEN by TRANSLATION_REPAIR_HARD_CAP_MINUTES: entries run under 10 minutes rather than '
              + 'the built-in 420',
            ],);
            expect(passLaunchLines({
              ...UNCHANGED,
              hardCapMs: 450_000,
            },),).toEqual([
              'CAP OVERRIDDEN by TRANSLATION_REPAIR_HARD_CAP_MINUTES: entries run under 7.5 minutes rather than '
              + 'the built-in 420',
            ],);
          },
        },),
        it({
          name: 'NAMES A CEILING OF ONE MINUTE in the singular, and warns that it is no longer than one exchange',
          fn: async () => {
            expect(passLaunchLines({
              ...UNCHANGED,
              hardCapMs: 60_000,
            },),).toEqual([
              'CAP OVERRIDDEN by TRANSLATION_REPAIR_HARD_CAP_MINUTES: entries run under 1 minute rather than '
              + 'the built-in 420',
              'CAP TOO TIGHT: an attempt runs 60000ms, which is not longer than the 360000ms one model exchange is '
              + 'allowed. Attempts are cut before an exchange can return, so no slice caches, every attempt '
              + 'reports no progress, and the queue drops the entry as stalled after its second try. Raise the '
              + 'ceiling above one exchange to buy anything, or keep it here to exercise the stall path '
              + 'deliberately.',
            ],);
          },
        },),
        it({
          name: 'WARNS of a ceiling equal to one exchange, which does not outlast it, without naming it overridden '
            + 'when it is the built-in',
          fn: async () => {
            expect(passLaunchLines({
              ...UNCHANGED,
              perCallMs: 25_200_000,
            },),).toEqual([
              'CAP TOO TIGHT: an attempt runs 25200000ms, which is not longer than the 25200000ms one model '
              + 'exchange is allowed. Attempts are cut before an exchange can return, so no slice caches, every '
              + 'attempt reports no progress, and the queue drops the entry as stalled after its second try. '
              + 'Raise the ceiling above one exchange to buy anything, or keep it here to exercise the stall '
              + 'path deliberately.',
            ],);
          },
        },),
        it({
          name: 'NAMES AN OVERRIDDEN SPEND ALLOWANCE',
          fn: async () => {
            expect(passLaunchLines({
              ...UNCHANGED,
              spendCeilingUsd: 5,
            },),).toEqual([
              'SPEND CEILING OVERRIDDEN by TRANSLATION_REPAIR_RUN_SPEND_CEILING_USD: new entries stop once this '
              + 'run has spent 5 USD on openrouter rather than the built-in 20',
            ],);
          },
        },),
        it({
          name: 'PRINTS BOTH WINDOW NOTES as the entry file handed them, and a corpus pin a launch overrode',
          fn: async () => {
            expect(passLaunchLines({
              ...UNCHANGED,
              graceNote: 'STRAGGLER GRACE OVERRIDDEN: a window',
              writerNote: 'WRITER GRACE OVERRIDDEN: another window',
              pinSetting: {
                pin: {
                  cloneDir: '/clones/cats',
                  commitSha: 'b'.repeat(40,),
                },
                cloneDirSource: 'TRANSLATION_REPAIR_CORPUS_CLONE_DIR',
                commitSource: 'fallback',
              },
            },),).toEqual([
              'STRAGGLER GRACE OVERRIDDEN: a window',
              'WRITER GRACE OVERRIDDEN: another window',
              `CORPUS PIN OVERRIDDEN: clone /clones/cats from TRANSLATION_REPAIR_CORPUS_CLONE_DIR, commit ${
                'b'.repeat(40,)
              } from fallback`,
            ],);
          },
        },),
        it({
          name: 'ORDERS the lines cap, spend, windows, pin, then the warning',
          fn: async () => {
            expect(passLaunchLines({
              hardCapMs: 120_000,
              builtInCapMinutes: 420,
              perCallMs: 360_000,
              spendCeilingUsd: 1,
              graceNote: 'grace',
              writerNote: 'writer',
              pinSetting: {
                pin: {
                  cloneDir: '/clones/cats',
                  commitSha: 'c'.repeat(40,),
                },
                cloneDirSource: 'fallback',
                commitSource: 'TRANSLATION_REPAIR_CORPUS_COMMIT',
              },
            },).map(function firstWord(line,): string {
              return line.split(' ',)[0] ?? '';
            },),).toEqual([
              'CAP',
              'SPEND',
              'grace',
              'writer',
              'CORPUS',
              'CAP',
            ],);
          },
        },),
      ],
    },),

    describe({
      name: passRequiredLines.name,
      children: [
        it({
          name: 'SAYS NOTHING when no provider was required',
          fn: async () => {
            expect(passRequiredLines({ providers: [], },),).toEqual([],);
          },
        },),
        it({
          name: 'NAMES ONE REQUIRED PROVIDER as wet',
          fn: async () => {
            expect(passRequiredLines({ providers: ['hyper',], },),).toEqual(['REQUIRED-PROVIDERS hyper status=wet',],);
          },
        },),
        it({
          name: 'NAMES SEVERAL REQUIRED PROVIDERS in the order they were required',
          fn: async () => {
            expect(passRequiredLines({ providers: [
              'openrouter',
              'hyper',
            ], },),).toEqual(['REQUIRED-PROVIDERS openrouter,hyper status=wet',],);
          },
        },),
      ],
    },),

    describe({
      name: passPlanLine.name,
      children: [
        it({
          name: 'NAMES NO ENTRY for a plan with nothing pending',
          fn: async () => {
            expect(passPlanLine({
              tip: 'deadbeef',
              pipelineDigest: 'sha256-tree-v1:cafe',
              pendingIds: [],
              previewCount: 5,
            },),).toBe('PLAN ok tip=deadbeef pipeline=sha256-tree-v1:cafe client=constructed pending=0 first=',);
          },
        },),
        it({
          name: 'NAMES THE ONE ENTRY of a plan with one pending',
          fn: async () => {
            expect(passPlanLine({
              tip: 'deadbeef',
              pipelineDigest: 'sha256-tree-v1:cafe',
              pendingIds: ['tabby',],
              previewCount: 5,
            },),).toBe('PLAN ok tip=deadbeef pipeline=sha256-tree-v1:cafe client=constructed pending=1 first=tabby',);
          },
        },),
        it({
          name: 'PREVIEWS ONLY THE FIRST ENTRIES of a longer plan, and counts them all',
          fn: async () => {
            expect(passPlanLine({
              tip: 'deadbeef',
              pipelineDigest: 'sha256-tree-v1:cafe',
              pendingIds: [
                'a',
                'b',
                'c',
              ],
              previewCount: 2,
            },),).toBe('PLAN ok tip=deadbeef pipeline=sha256-tree-v1:cafe client=constructed pending=3 first=a,b',);
          },
        },),
      ],
    },),

    describe({
      name: passDoneLine.name,
      children: [
        it({
          name: 'REPORTS what the pass finished of what it set out to run, the artifacts present and the time taken',
          fn: async () => {
            expect(passDoneLine({
              processed: 1,
              pending: 2,
              total: 40,
              target: 92,
              elapsedMs: 5,
            },),).toBe('DONE processed=1 of pending=2; artifacts=40/92 elapsed=5ms',);
          },
        },),
      ],
    },),
  ],
},);
