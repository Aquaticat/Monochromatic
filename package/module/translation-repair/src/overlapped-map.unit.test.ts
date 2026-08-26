/**
 * Tests for running items with a bounded number in flight.
 *
 * WHAT THESE PIN: at overlap 1 the helper is the sequential loop it replaced;
 * at a higher overlap items start in item order and never more than the
 * overlap at once; results come back in item order whatever order the items
 * finished in; a failure stops further items from starting, lets the ones in
 * flight finish, and throws the lowest position's error; and an overlap that
 * cannot bound anything is refused before any item runs.
 *
 * Every item waits at a gate the test opens, so completion order is the
 * test's to choose rather than the scheduler's.
 *
 * @module
 */

import { wait, } from '@monochromatic-dev/module-async-time/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  mapOverlapped,
  OverlapRefusedError,
} from '../dist/final/node/index.mjs';

//region Fixtures
// Gated items: each item's job records that it started, counts itself in
// flight, and returns once the test opens its gate.

/**
 * Items every case runs over, in the order results must come back.
 */
const ITEMS = [
  'a',
  'b',
  'c',
  'd',
] as const;

/**
 * What one gated run exposes to the assertions.
 */
type Gated = {
  /**
   * Positions in the order their jobs started.
   */
  readonly started: readonly number[];

  /**
   * Most jobs seen in flight at once.
   */
  readonly inFlight: { readonly peak: number; };

  /**
   * One gate per item; a job returns once its gate is opened, or throws once
   * its gate is broken.
   */
  readonly gates: readonly PromiseWithResolvers<string>[];

  /**
   * Job handed to the helper.
   */
  readonly oneItem: (row: {
    readonly item: string;
    readonly position: number;
  },) => Promise<string>;
};

/**
 * Builds the gated job and the records it fills.
 *
 * @param count - how many gates to build, one per item
 *
 * @returns Records and the job
 *
 * @example
 * ```ts
 * const run = gatedRun({ count: 3, },);
 * ```
 */
function gatedRun({ count, }: { readonly count: number; },): Gated {
  /**
   * Positions in start order, filled by the job.
   */
  const started: number[] = [];

  /**
   * Jobs in flight now and the most seen at once.
   */
  const inFlight = {
    now: 0,
    peak: 0,
  };

  /**
   * One gate per item.
   */
  const gates = Array.from(
    { length: count, },
    function openGate(): PromiseWithResolvers<string> {
      return Promise.withResolvers<string>();
    },
  );
  return {
    started,
    inFlight,
    gates,
    oneItem: async function waitsAtGate({
      item,
      position,
    },): Promise<string> {
      started.push(position,);
      inFlight.now += 1;
      inFlight.peak = Math.max(
        inFlight.peak,
        inFlight.now,
      );

      /**
       * What the test opened this gate with.
       */
      const answer = await nonNullishOrThrow(gates[position],).promise;
      inFlight.now -= 1;
      return `${item}:${answer}`;
    },
  };
}

/**
 * Lets every settled continuation run, so the records reflect what the
 * scheduler did with what the test just opened.
 *
 * @example
 * ```ts
 * await settle();
 * ```
 */
async function settle(): Promise<void> {
  await wait(0,);
}

/**
 * Resolves with what a run threw, or `undefined` when it finished.
 *
 * ATTACHED BEFORE ANY GATE IS OPENED in every failing case, so the rejection
 * is never unhandled between the moment it happens and the assertion.
 *
 * @param run - mapping under test
 *
 * @returns What it threw
 *
 * @example
 * ```ts
 * const failure = collected({ run, },);
 * ```
 */
async function collected({ run, }: { readonly run: Promise<unknown>; },): Promise<unknown> {
  try {
    await run;
    return undefined;
  }
  catch (error) {
    return error;
  }
}

//endregion Fixtures

await describe({
  name: mapOverlapped.name,
  children: [
    it({
      name: 'runs the items one at a time in item order at overlap 1, which is the loop it replaced',
      fn: async () => {
        const run = gatedRun({ count: 3, },);
        const mapping = mapOverlapped({
          items: ITEMS.slice(
            0,
            3,
          ),
          overlap: 1,
          oneItem: run.oneItem,
        },);
        await settle();
        expect(run.started,).toEqual([0,],);

        nonNullishOrThrow(run.gates[0],).resolve('one',);
        await settle();
        expect(run.started,).toEqual([
          0,
          1,
        ],);

        nonNullishOrThrow(run.gates[1],).resolve('two',);
        await settle();
        expect(run.started,).toEqual([
          0,
          1,
          2,
        ],);

        nonNullishOrThrow(run.gates[2],).resolve('three',);
        expect(await mapping,).toEqual([
          'a:one',
          'b:two',
          'c:three',
        ],);
        expect(run.inFlight
          .peak,).toBe(1,);
      },
    },),

    it({
      name: 'keeps no more than the overlap in flight, and starts items in item order',
      fn: async () => {
        const run = gatedRun({ count: 4, },);
        const mapping = mapOverlapped({
          items: ITEMS,
          overlap: 2,
          oneItem: run.oneItem,
        },);
        await settle();
        expect(run.started,).toEqual([
          0,
          1,
        ],);
        expect(run.inFlight
          .peak,).toBe(2,);

        nonNullishOrThrow(run.gates[0],).resolve('one',);
        await settle();
        expect(run.started,).toEqual([
          0,
          1,
          2,
        ],);

        nonNullishOrThrow(run.gates[1],).resolve('two',);
        nonNullishOrThrow(run.gates[2],).resolve('three',);
        await settle();
        nonNullishOrThrow(run.gates[3],).resolve('four',);
        expect(await mapping,).toEqual([
          'a:one',
          'b:two',
          'c:three',
          'd:four',
        ],);
        expect(run.inFlight
          .peak,).toBe(2,);
      },
    },),

    it({
      name: 'returns results in item order however the items finished',
      fn: async () => {
        const run = gatedRun({ count: 4, },);
        const mapping = mapOverlapped({
          items: ITEMS,
          overlap: 2,
          oneItem: run.oneItem,
        },);
        await settle();

        // The second item finishes first, so the second lane takes the third
        // item while the first item is still waiting.
        nonNullishOrThrow(run.gates[1],).resolve('two',);
        await settle();
        expect(run.started,).toEqual([
          0,
          1,
          2,
        ],);

        nonNullishOrThrow(run.gates[0],).resolve('one',);
        await settle();
        nonNullishOrThrow(run.gates[3],).resolve('four',);
        await settle();
        nonNullishOrThrow(run.gates[2],).resolve('three',);
        expect(await mapping,).toEqual([
          'a:one',
          'b:two',
          'c:three',
          'd:four',
        ],);
      },
    },),

    it({
      name: 'stops starting items after one fails, lets the one in flight finish, and throws that failure',
      fn: async () => {
        const run = gatedRun({ count: 4, },);
        const failure = collected({
          run: mapOverlapped({
            items: ITEMS,
            overlap: 2,
            oneItem: run.oneItem,
          },),
        },);
        await settle();

        /**
         * What the second item throws.
         */
        const fault = new Error('the second item broke',);
        nonNullishOrThrow(run.gates[1],).reject(fault,);
        await settle();
        // Nothing past the two already started is admitted.
        expect(run.started,).toEqual([
          0,
          1,
        ],);

        nonNullishOrThrow(run.gates[0],).resolve('one',);
        expect(await failure,).toBe(fault,);
        expect(run.started,).toEqual([
          0,
          1,
        ],);
        expect(run.inFlight
          .peak,).toBe(2,);
      },
    },),

    it({
      name: 'throws the LOWEST position`s failure when two fail, which is the one a sequential loop would have reached first',
      fn: async () => {
        const run = gatedRun({ count: 4, },);
        const failure = collected({
          run: mapOverlapped({
            items: ITEMS,
            overlap: 2,
            oneItem: run.oneItem,
          },),
        },);
        await settle();

        /**
         * What the second item throws, first in time.
         */
        const later = new Error('the second item broke first',);
        nonNullishOrThrow(run.gates[1],).reject(later,);
        await settle();

        /**
         * What the first item throws, second in time.
         */
        const earlier = new Error('the first item broke after it',);
        nonNullishOrThrow(run.gates[0],).reject(earlier,);
        expect(await failure,).toBe(earlier,);
        expect(run.started,).toEqual([
          0,
          1,
        ],);
      },
    },),

    it({
      name: 'admits every item at once when the overlap exceeds the count',
      fn: async () => {
        const run = gatedRun({ count: 3, },);
        const mapping = mapOverlapped({
          items: ITEMS.slice(
            0,
            3,
          ),
          overlap: 5,
          oneItem: run.oneItem,
        },);
        await settle();
        expect(run.started,).toEqual([
          0,
          1,
          2,
        ],);
        expect(run.inFlight
          .peak,).toBe(3,);

        nonNullishOrThrow(run.gates[2],).resolve('three',);
        nonNullishOrThrow(run.gates[1],).resolve('two',);
        nonNullishOrThrow(run.gates[0],).resolve('one',);
        expect(await mapping,).toEqual([
          'a:one',
          'b:two',
          'c:three',
        ],);
      },
    },),

    it({
      name: 'REFUSES an overlap below one or fractional before running anything',
      fn: async () => {
        const run = gatedRun({ count: 1, },);
        for (const overlap of [
          0,
          -1,
          1.5,
          Number.NaN,
        ]) {
          // oxlint-disable-next-line no-await-in-loop -- each refusal is checked in turn on the same fixture
          const refusal = await collected({
            run: mapOverlapped({
              items: ITEMS.slice(
                0,
                1,
              ),
              overlap,
              oneItem: run.oneItem,
            },),
          },);
          expect(refusal,).toBeInstanceOf(OverlapRefusedError,);
          expect((refusal as Error).message,).toContain(String(overlap,),);
        }
        expect(run.started,).toEqual([],);
      },
    },),

    it({
      name: 'maps no items to no results, running nothing',
      fn: async () => {
        const run = gatedRun({ count: 0, },);
        expect(await mapOverlapped({
          items: [],
          overlap: 3,
          oneItem: run.oneItem,
        },),).toEqual([],);
        expect(run.started,).toEqual([],);
      },
    },),
  ],
},);
