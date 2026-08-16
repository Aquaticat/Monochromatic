/**
 * Tests for one slice's three arms.
 *
 * WHAT THESE PIN is the property the whole trial rests on: the slate is bought
 * ONCE and all three arms judge that same slate. Until `#109` split the stage,
 * asking a slice twice resampled the candidates, so two answers differed in the
 * slate as well as the evidence and no reading could say which moved the
 * verdict. A regression here would not fail loudly; it would produce a
 * confident number from a confounded comparison, which is worse.
 *
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import { mkdtemp, } from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  armOrderFor,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type ChunkPair,
  completedArms,
  readTrialLedger,
  runSliceArms,
  type SyntheticClient,
  type SyntheticModelId,
  TRIAL_ARMS,
  trialKey,
} from '../../dist/final/node/index.mjs';

/**
 * Logger the arms write to.
 */
const l = tagged({ tag: 'window-trial-slice-test', },);

/**
 * Schema name the producing half asks translators for.
 */
const TRANSLATE_SCHEMA = 'translation_report';

/**
 * Rosters every case uses.
 */
const MODELS = {
  translatorModelIds: ['hf:cat/Cat-A',
    'hf:cat/Cat-B',].map(function toId(id,) {
    return id as unknown as SyntheticModelId;
  },),
  judgeModelIds: ['hf:cat/Cat-A',
    'hf:cat/Cat-B',
    'hf:cat/Cat-C',].map(function toId(id,) {
    return id as unknown as SyntheticModelId;
  },),
};

/**
 * Builds one slice pair carrying given texts.
 *
 * @param chunkIndex - position in the document
 *
 * @param source - original wording
 *
 * @param target - archive wording
 *
 * @returns Pair shaped like one preparation produces
 *
 * @example
 * ```ts
 * const pair = pairOf({ chunkIndex: 0, source: '猫。', target: 'Cat.', },);
 * ```
 */
function pairOf(
  {
    chunkIndex,
    source,
    target,
  }: {
    readonly chunkIndex: number;
    readonly source: string;
    readonly target: string;
  },
): ChunkPair {
  return {
    source: {
      chunkIndex,
      nodes: [],
      startOffset: 0,
      endOffset: source.length,
      text: source,
    },
    target: {
      chunkIndex,
      nodes: [],
      startOffset: 0,
      endOffset: target.length,
      text: target,
    },
  };
}

/**
 * Three-slice document, so the middle slice has a neighbour either way.
 */
const SLICES: readonly ChunkPair[] = [
  pairOf({
    chunkIndex: 0,
    source: '小猫在窗台上睡觉。',
    target: 'The cat sleeps on the windowsill.',
  },),
  pairOf({
    chunkIndex: 1,
    source: '猫猫在窗台上打盹，尾巴垂在暖气片旁边。',
    target: 'The cat is doing the sleeping, with tail by the radiator.',
  },),
  pairOf({
    chunkIndex: 2,
    source: '傍晚她回到炉火旁。',
    target: 'In the evening she returns to the fire.',
  },),
];

/**
 * Client whose translators drift on every call, so a rebought slate would show.
 *
 * @returns Client plus the judge sheets and translator call count
 *
 * @example
 * ```ts
 * const rig = driftingClient();
 * ```
 */
function driftingClient(): {
  readonly client: SyntheticClient;
  readonly judgeSheets: string[];
  readonly served: { count: number; };
} {
  /**
   * Translator calls served, which drives the drift and is itself the evidence
   * that the slate was bought once.
   */
  const served = { count: 0, };

  /**
   * Sheets the judges received.
   */
  const judgeSheets: string[] = [];

  return {
    served,
    judgeSheets,
    client: {
      chatText: async () => {
        throw new Error('chatText unused',);
      },
      quotas: async () => {
        throw new Error('quotas unused',);
      },
      chatJson: async <ValueT,>(
        request: ChatJsonRequest<ValueT>,
      ): Promise<ChatJsonOutcome<ValueT>> => {
        if (request.responseFormat
          ?.json_schema
          .name === TRANSLATE_SCHEMA) {
          served.count += 1;

          /**
           * Rendering that differs on every call.
           */
          const value: unknown = {
            translation: `A fresh rendering number ${String(served.count,)}.`,
          };
          if (!request.validate(value,)) {
            return {
              kind: 'schema-mismatch',
              rawText: JSON.stringify(value,),
              detail: 'reply failed the wire guard',
            };
          }
          return {
            kind: 'ok',
            value,
            rawText: JSON.stringify(value,),
          };
        }

        judgeSheets.push(request.messages
          .map(function toContent(message,) {
            return message.content;
          },)
          .join('\n',),);

        /**
         * Ballot declining everything, so the archive stands and no case here
         * depends on which candidate wins.
         */
        const ballot: unknown = {
          best: 0,
          reason: 'fixture',
        };
        if (!request.validate(ballot,)) {
          return {
            kind: 'schema-mismatch',
            rawText: JSON.stringify(ballot,),
            detail: 'reply failed the wire guard',
          };
        }
        return {
          kind: 'ok',
          value: ballot as ValueT,
          rawText: JSON.stringify(ballot,),
        };
      },
    },
  };
}

/**
 * Fresh throwaway ledger path.
 *
 * @returns Path inside a new temporary directory
 *
 * @example
 * ```ts
 * const path = await freshLedger();
 * ```
 */
async function freshLedger(): Promise<string> {
  return join(
    await mkdtemp(join(
      tmpdir(),
      'window-slice-',
    ),),
    'trial.jsonl',
  );
}

/**
 * Arms already bought, keyed the way the ledger keys them.
 *
 * THROUGH `trialKey` RATHER THAN A LITERAL, because a test that spells the key
 * itself agrees with nothing: the runner and the ledger once disagreed on the
 * separator and every hand-written fixture passed anyway.
 *
 * @param arms - arms to mark bought for the slice every case uses
 *
 * @returns Key set shaped like `completedArms` returns
 *
 * @example
 * ```ts
 * const done = doneFor({ arms: [TRIAL_ARMS.wide,], },);
 * ```
 */
function doneFor(
  { arms, }: { readonly arms: readonly string[]; },
): ReadonlySet<string> {
  return new Set(arms.map(function toKey(arm,) {
    return trialKey({ row: {
      protocol: 'protocol-one',
      entryId: 'Mittens',
      chunkIndex: 1,
      arm,
    }, },);
  },),);
}

await describe({
  name: runSliceArms.name,
  children: [
    it({
      name: 'BUYS THE SLATE ONCE AND JUDGES IT THREE TIMES, which is the property the whole trial '
        + 'rests on. The translators here drift on every call, so a rebought slate would show as a '
        + 'second round of translator calls and as different candidate text between arms',
      fn: async () => {
        const rig = driftingClient();
        const rows = await runSliceArms({
          client: rig.client,
          slices: SLICES,
          chunkIndex: 1,
          sliceClass: 'relocation',
          entryId: 'Mittens',
          protocol: 'protocol-one',
          ledgerPath: await freshLedger(),
          done: new Set<string>(),
          models: MODELS,
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 5_000,
          l,
        },);

        expect(rows.length,).toBe(3,);
        // Two translators, called once each. A second production would double it.
        expect(rig.served
          .count,).toBe(MODELS.translatorModelIds.length,);
        // Three arms times three judges.
        expect(rig.judgeSheets
          .length,).toBe(3 * MODELS.judgeModelIds.length,);
      },
    },),
    it({
      name: 'shows the surrounding original to the WIDE arm only, so the three arms differ in '
        + 'exactly the evidence under test and in nothing else',
      fn: async () => {
        const rig = driftingClient();
        await runSliceArms({
          client: rig.client,
          slices: SLICES,
          chunkIndex: 1,
          sliceClass: 'relocation',
          entryId: 'Mittens',
          protocol: 'protocol-one',
          ledgerPath: await freshLedger(),
          done: new Set<string>(),
          models: MODELS,
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 5_000,
          l,
        },);

        /**
         * Sheets carrying the wider window.
         */
        const wide = rig.judgeSheets
          .filter(function carries(sheet,) {
            return sheet.includes('SURROUNDING ORIGINAL',);
          },);
        expect(wide.length,).toBe(MODELS.judgeModelIds.length,);
      },
    },),
    it({
      name: 'APPENDS EACH ARM AS IT COMPLETES rather than at the end, so a kill costs one arm and '
        + 'not the slice: every row is on disk before the next arm is bought',
      fn: async () => {
        const rig = driftingClient();
        const ledgerPath = await freshLedger();
        await runSliceArms({
          client: rig.client,
          slices: SLICES,
          chunkIndex: 1,
          sliceClass: 'relocation',
          entryId: 'Mittens',
          protocol: 'protocol-one',
          ledgerPath,
          done: new Set<string>(),
          models: MODELS,
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 5_000,
          l,
        },);

        expect((await readTrialLedger({ path: ledgerPath, },)).map(function toArm(row,) {
          return row.arm;
        },),).toEqual([...armOrderFor({
          protocol: 'protocol-one',
          entryId: 'Mittens',
          chunkIndex: 1,
        },),],);
      },
    },),
    it({
      name: 'BUYS NOTHING AT ALL for a slice whose three arms the ledger already holds, not even '
        + 'the slate: producing is the expensive half, and paying for it to throw it away would '
        + 'cost most of what resumption is meant to save',
      fn: async () => {
        const rig = driftingClient();
        const rows = await runSliceArms({
          client: rig.client,
          slices: SLICES,
          chunkIndex: 1,
          sliceClass: 'relocation',
          entryId: 'Mittens',
          protocol: 'protocol-one',
          ledgerPath: await freshLedger(),
          done: doneFor({
            arms: [TRIAL_ARMS.narrowFirst,
              TRIAL_ARMS.narrowSecond,
              TRIAL_ARMS.wide,],
          },),
          models: MODELS,
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 5_000,
          l,
        },);

        expect(rows.length,).toBe(0,);
        expect(rig.served
          .count,).toBe(0,);
        expect(rig.judgeSheets
          .length,).toBe(0,);
      },
    },),
    it({
      name: 'BUYS NOTHING FOR A PARTLY BOUGHT SLICE, which is the resumption path that would '
        + 'otherwise re-introduce the confound `#109` was split to remove: the slate cannot be '
        + 'reproduced, so finishing the remaining arms here would judge different candidates from '
        + 'the arms already on disk while the ledger showed a complete triple',
      fn: async () => {
        const rig = driftingClient();
        const rows = await runSliceArms({
          client: rig.client,
          slices: SLICES,
          chunkIndex: 1,
          sliceClass: 'relocation',
          entryId: 'Mittens',
          protocol: 'protocol-one',
          ledgerPath: await freshLedger(),
          // A kill after the first two arms.
          done: doneFor({
            arms: [TRIAL_ARMS.narrowFirst,
              TRIAL_ARMS.narrowSecond,],
          },),
          models: MODELS,
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 5_000,
          l,
        },);

        expect(rows.length,).toBe(0,);
        expect(rig.served
          .count,).toBe(0,);
        expect(rig.judgeSheets
          .length,).toBe(0,);
      },
    },),
    it({
      name: 'RESUMES OFF ITS OWN LEDGER, buying nothing the first run already wrote. This goes '
        + 'through the real file rather than a hand-written key set, which is the only way to '
        + 'catch the two key builders disagreeing: they did, on a NUL separator against a space, '
        + 'and every fixture that spelled the key itself passed while no live run ever resumed',
      fn: async () => {
        const ledgerPath = await freshLedger();

        /**
         * First run, which buys all three arms and writes them.
         */
        const first = driftingClient();
        await runSliceArms({
          client: first.client,
          slices: SLICES,
          chunkIndex: 1,
          sliceClass: 'relocation',
          entryId: 'Mittens',
          protocol: 'protocol-one',
          ledgerPath,
          done: new Set<string>(),
          models: MODELS,
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 5_000,
          l,
        },);

        /**
         * Second run, resuming off exactly what the first wrote.
         */
        const second = driftingClient();
        const rows = await runSliceArms({
          client: second.client,
          slices: SLICES,
          chunkIndex: 1,
          sliceClass: 'relocation',
          entryId: 'Mittens',
          protocol: 'protocol-one',
          ledgerPath,
          done: completedArms({
            rows: await readTrialLedger({ path: ledgerPath, },),
            protocol: 'protocol-one',
          },),
          models: MODELS,
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 5_000,
          l,
        },);

        expect(rows.length,).toBe(0,);
        expect(second.served
          .count,).toBe(0,);
        expect(second.judgeSheets
          .length,).toBe(0,);
      },
    },),
    it({
      name: 'records the PANEL EACH ARM DECIDED ON, since the fan-out proceeds once half the '
        + 'roster answers and an arm that lost judges is otherwise written as an ordinary keep',
      fn: async () => {
        const rig = driftingClient();
        const rows = await runSliceArms({
          client: rig.client,
          slices: SLICES,
          chunkIndex: 1,
          sliceClass: 'relocation',
          entryId: 'Mittens',
          protocol: 'protocol-one',
          ledgerPath: await freshLedger(),
          done: new Set<string>(),
          models: MODELS,
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 5_000,
          l,
        },);

        for (const row of rows) {
          expect(row.judgesSeated,).toBe(MODELS.judgeModelIds.length,);
          expect(row.judgesHeard,).toBe(MODELS.judgeModelIds.length,);
        }
      },
    },),
    it({
      name: 'REFUSES a slice with no neighbouring section before spending anything, since its wide '
        + 'arm would be its narrow arm and the pair would report a false null',
      fn: async () => {
        const rig = driftingClient();

        /**
         * Attempt on a lone slice, which has no window to widen to.
         */
        const attempt = runSliceArms({
          client: rig.client,
          slices: [SLICES[1] as ChunkPair,],
          chunkIndex: 0,
          sliceClass: 'relocation',
          entryId: 'Mittens',
          protocol: 'protocol-one',
          ledgerPath: await freshLedger(),
          done: new Set<string>(),
          models: MODELS,
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 5_000,
          l,
        },);
        await expect(attempt,).rejects
          .toBeInstanceOf(RangeError,);
        // And it refused before buying anything.
        expect(rig.served
          .count,).toBe(0,);
      },
    },),
  ],
},);
