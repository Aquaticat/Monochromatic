/**
 Tests for how one drawn slice's refusal is handled.
 
 WHAT THESE PIN is that a slice which cannot be tried does not end the run. A
 refusal leaves no ledger row, so a walk that aborted on one would redraw the
 same slice on every resumption, reach it, and die at it again, never getting
 to the slices behind it. The distinction matters more than it looks: a
 refusal and a completed slice that owed nothing are both empty, and only one
 of them is a fault.
 
 Fixtures are cat-themed invention mirroring corpus structure only.
 
 @module
 */

import { join, } from 'node:path';

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
  runPick,
  type SyntheticClient,
  type RosterModelId,
  trialKey,
} from '../../dist/final/node/index.mjs';
import { scratchDir, } from '../scratch-dir.test-fixture.ts';
import { slicePairOf, } from './slice-pair-of.test-fixture.ts';

/**
 Logger the pick writes to.
 */
const l = tagged({ tag: 'window-trial-pick-test', },);

/**
 Rosters every case uses.
 */
const MODELS = {
  translatorModelIds: ['hf:cat/Cat-A',].map(function toId(id,) {
    return id as unknown as RosterModelId;
  },),
  judgeModelIds: ['hf:cat/Cat-A',
    'hf:cat/Cat-B',].map(function toId(id,) {
    return id as unknown as RosterModelId;
  },),
};

/**
 Lone slice, which has no neighbour to widen to and so must refuse.
 */
const LONE: readonly ChunkPair[] = [
  slicePairOf({
    sliceIndex: 0,
    source: '猫猫在窗台上打盹。',
    target: 'The cat naps on the windowsill.',
  },),
];

/**
 Client that raises on every exchange.
 
 @param error - failure every exchange raises
 
 @returns Client the pick calls through
 
 @example
 ```ts
 const client = throwingClient({ error: new Error('provider refused', ), },);
 ```
 */
function throwingClient(
  { error, }: { readonly error: Error; },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused',);
    },
    quotas: async () => {
      throw new Error('quotas unused',);
    },
    chatJson: async <ValueT,>(
      _request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      throw error;
    },
  };
}

/**
 Ledger path nested inside a case-owned directory.

 @param dir - case-owned directory the ledger lives under

 @returns Path inside that directory

 @example
 ```ts
 const path = freshLedger({ dir: scratch.path, },);
 ```
 */
function freshLedger({ dir, }: { readonly dir: string; },): string {
  return join(
    dir,
    'trial.jsonl',
  );
}

await describe({
  name: runPick.name,
  children: [
    it({
      name: 'REPORTS A REFUSAL RATHER THAN RAISING IT, so one unwidenable slice cannot wedge the '
        + 'walk: a refusal writes no ledger row, so an aborting run would redraw the same slice, '
        + 'walk to it and die at it on every restart, never reaching the slices behind it',
      fn: async () => {
        await using scratch = await scratchDir({ prefix: 'window-pick-', },);
        const outcome = await runPick({
          client: throwingClient({ error: new Error('unused', ), },),
          slices: LONE,
          pick: {
            entryId: 'Mittens',
            sliceIndex: 0,
            sliceClass: 'relocation',
          },
          entryId: 'Mittens',
          protocol: 'protocol-one',
          ledgerPath: freshLedger({ dir: scratch.path, },),
          done: new Set<string>(),
          models: MODELS,
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 5_000,
          l,
        },);

        expect(outcome.kind,).toBe('refused',);
      },
    },),
    it({
      name: 'reports a slice the ledger already holds as bought with no rows, so a resumed run '
        + 'walks past it without counting it as a refusal',
      fn: async () => {
        await using scratch = await scratchDir({ prefix: 'window-pick-', },);
        const outcome = await runPick({
          client: throwingClient({ error: new Error('unused', ), },),
          slices: LONE,
          pick: {
            entryId: 'Mittens',
            sliceIndex: 0,
            sliceClass: 'relocation',
          },
          entryId: 'Mittens',
          protocol: 'protocol-one',
          ledgerPath: freshLedger({ dir: scratch.path, },),
          done: new Set(['narrow-a',
            'narrow-b',
            'wide',].map(function toKey(arm,) {
            return trialKey({ row: {
              protocol: 'protocol-one',
              entryId: 'Mittens',
              sliceIndex: 0,
              arm,
            }, },);
          },),),
          models: MODELS,
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 5_000,
          l,
        },);

        expect(outcome.kind,).toBe('bought',);
        expect((outcome.kind === 'bought') ? outcome.rows.length : -1,).toBe(0,);
      },
    },),
  ],
},);
