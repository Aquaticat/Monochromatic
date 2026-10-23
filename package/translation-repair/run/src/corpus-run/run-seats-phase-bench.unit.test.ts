/**
 Tests that the seat reader judges each phase against the bench the phase's stage seats, not a neighbouring one.

 THE SHAPE, from the re-check of fix round 9 of the Claude route: the lane contest's row read the wide bench while
 the contest judges with the late bench (`seats.lateJudges`), and Haiku is on the wide bench only, so a Claude hold
 was waited out for a quorum the contest never gained. The same mismatch stood in the other rows that read a bench
 the stage does not seat: the preparation and the insertion admission ask the whole roster (`seats.roster`), the
 page consistency pass and the consolidation gate ask the late bench, and the lanes phase seats the slate select
 judges (`seats.selectJudges`) beside the wide bench. Each case reads one phase over a view where the bench the stage
 seats stands short and the bench the row used to read does not, with no hold running, so the reading takes one
 dryness read and writes the shortfall warning, which names the bench.

 Fixtures are cat-themed invention; every view is scripted and no HTTP is made.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import type { BudgetView, } from '@monochromatic-dev/translation-repair-provider';
import { providerRecord, } from '@monochromatic-dev/translation-repair-shared-contract/ts';
import {
  levelCapturingLogger,
} from '@monochromatic-dev/translation-repair-test-fixture/ts/capturing-logger.test-fixture.ts';
import {
  metersAllWet,
} from '@monochromatic-dev/translation-repair-provider/ts/meter-states.test-fixture.ts';
import { type JudgeSeatPhase, readJudgeSeats, } from '../../dist/final/node/index.mjs';
import { shortWarningOf, } from './run-seats-short-warning.test-fixture.ts';

/**
 Synthetic, Bedrock, DeepSeek and Xiaomi wet and the rest dry: the wide bench is 5 of 8 reachable against a quorum of
 4, and the roster is 5 of 10 against a quorum of 6.
 */
const ROSTER_SHORT: BudgetView = {
  neuralwatt: true,
  synthetic: false,
  bedrock: false,
  deepseek: false,
  xiaomi: false,
  anthropic: true,
  hyper: true,
  openrouter: true,
};

/**
 NeuralWatt, DeepSeek, Xiaomi and OpenRouter wet and the rest dry: the wide bench is 4 of 7 against a quorum of 4, the
 select judges are 4 of 8 against a quorum of 5, and the editors, refiners and translators are each at their quorum.
 */
const SELECT_SHORT: BudgetView = {
  neuralwatt: false,
  synthetic: true,
  bedrock: true,
  deepseek: false,
  xiaomi: false,
  anthropic: true,
  hyper: true,
  openrouter: false,
};

/**
 NeuralWatt and Bedrock wet and every other provider dry: the wide bench is 3 of 8, and the slate and the late bench
 are each 3 of 7, against a quorum of 4.
 */
const GATE_SHORT: BudgetView = {
  neuralwatt: false,
  synthetic: true,
  bedrock: false,
  deepseek: true,
  xiaomi: true,
  anthropic: true,
  hyper: true,
  openrouter: true,
};

/**
 Reads one phase's seats over a scripted view with no hold running.

 @param phase - phase the seats are read for

 @param view - dryness every read returns

 @returns What the reading logged, one entry per line, and how many dryness reads it took

 @example
 ```ts
 const { lines, reads, } = await readOver({ phase: 'preparation', view: ROSTER_SHORT, },);
 ```
 */
async function readOver(
  {
    phase,
    view,
  }: {
    readonly phase: JudgeSeatPhase;
    readonly view: BudgetView;
  },
): Promise<{ readonly lines: readonly string[]; readonly reads: number; }> {
  /**
   What the reading logged.
   */
  const lines: string[] = [];
  /**
   Dryness reads taken so far.
   */
  const counted = { reads: 0, };
  await readJudgeSeats({
    client: {
      providerDryness: async () => {
        counted.reads += 1;
        return view;
      },
      providerMeterStates: metersAllWet,
      providerHolds: () => providerRecord({ of: () => 0, },),
    },
    phase,
    signal: new AbortController().signal,
    l: levelCapturingLogger({ lines, },),
    pollMs: 5,
  },);
  return { lines, reads: counted.reads, };
}

await describe({
  name: 'the seat reader and the bench each phase\'s stage seats',
  concurrency: 1,
  children: [
    it({
      name: 'READS THE ROSTER IN THE PREPARATION, which pairs blocks and reviews the archive with `seats.roster`: '
        + 'the wide bench is 5 of 8 and fine, the roster is 5 of 10 against a quorum of 6, and the warning says so',
      fn: async () => {
        const { lines, } = await readOver({ phase: 'preparation', view: ROSTER_SHORT, },);
        expect(shortWarningOf({ lines, phase: 'preparation', },),).toContain('roster 5 of 10 reachable, quorum 6',);
      },
    },),

    it({
      name: 'READS THE ROSTER IN THE INSERTION ADMISSION, which asks the roster whether the archive covers a passage: '
        + 'the same view, the same warning',
      fn: async () => {
        const { lines, } = await readOver({ phase: 'insertion admission', view: ROSTER_SHORT, },);
        expect(shortWarningOf({ lines, phase: 'insertion admission', },),).toContain(
          'roster 5 of 10 reachable, quorum 6',
        );
      },
    },),

    it({
      name: 'READS THE SELECT JUDGES IN THE LANES PHASE, whose repair and translate lanes slate-judge with '
        + '`seats.selectJudges`: the wide bench is 4 of 7 and at its quorum, the select judges are 4 of 8 against a '
        + 'quorum of 5, and the warning says so',
      fn: async () => {
        const { lines, } = await readOver({ phase: 'lanes', view: SELECT_SHORT, },);
        expect(shortWarningOf({ lines, phase: 'lanes', },),).toContain('select 4 of 8 reachable, quorum 5',);
      },
    },),

    it({
      name: 'NAMES THE LATE BENCH IN THE CONSOLIDATION, whose polish gate is `seats.lateJudges`: the warning says '
        + 'late 3 of 7 beside the slate and names no wide bench, which the consolidation seats nowhere',
      fn: async () => {
        const { lines, } = await readOver({ phase: 'consolidation', view: GATE_SHORT, },);
        const warning = shortWarningOf({ lines, phase: 'consolidation', },);
        expect(warning,).toContain('slate 3 of 7 reachable, quorum 4',);
        expect(warning,).toContain(' late 3 of 7 reachable, quorum 4',);
        expect(warning,).not.toContain('wide',);
      },
    },),

    it({
      name: 'NAMES THE LATE BENCH IN THE PAGE CONSISTENCY PASS, which asks `seats.lateJudges` beside the writers: the '
        + 'warning says late 3 of 7 and names no wide bench',
      fn: async () => {
        const { lines, } = await readOver({ phase: 'page consistency', view: GATE_SHORT, },);
        const warning = shortWarningOf({ lines, phase: 'page consistency', },);
        expect(warning,).toContain(' late 3 of 7 reachable, quorum 4',);
        expect(warning,).not.toContain('wide',);
      },
    },),
  ],
},);
