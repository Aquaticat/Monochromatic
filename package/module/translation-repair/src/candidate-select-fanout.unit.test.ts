/**
 * Tests for the selection fan-out: when a judge bench is too thin for the
 * window to carry a unanimous self-written slate.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  FANOUT_SPARE,
  MIN_SELECTION_WEIGHT,
  SELF_VOTE_WEIGHT,
  selectionFanOut,
} from '../dist/final/node/index.mjs';

/**
 * Seats whose self-votes alone reach the minimum.
 */
const SEATS_CARRYING_MINIMUM = Math.ceil(MIN_SELECTION_WEIGHT / SELF_VOTE_WEIGHT,);

/**
 * Smallest bench whose window holds those seats: the window is half the bench
 * rounded up plus the spare, so an odd bench one short of twice the seats
 * less the spare already carries it.
 */
const THINNEST_WINDOWED_BENCH = (2 * (SEATS_CARRYING_MINIMUM - FANOUT_SPARE)) - 1;

await describe({
  name: selectionFanOut.name,
  children: [
    it({
      name: 'ASKS the whole bench where the window\'s self-votes alone fall short of the minimum, and the '
        + 'window from the first bench whose window carries it, so a four-seat review still ships a '
        + 'unanimous revision',
      fn: async () => {
        expect(selectionFanOut({ judgeCount: THINNEST_WINDOWED_BENCH - 1, },),).toBe('whole-bench',);
        expect(selectionFanOut({ judgeCount: THINNEST_WINDOWED_BENCH, },),).toBe('window',);
        expect(selectionFanOut({ judgeCount: THINNEST_WINDOWED_BENCH + 2, },),).toBe('window',);
      },
    },),
    it({
      name: 'HONOURS a whole-bench request on any bench, since a fixture scripting every seat reads its '
        + 'tally over the bench it wrote',
      fn: async () => {
        expect(selectionFanOut({ judgeCount: THINNEST_WINDOWED_BENCH + 2, requested: 'whole-bench', },),)
          .toBe('whole-bench',);
        expect(selectionFanOut({ judgeCount: THINNEST_WINDOWED_BENCH + 2, requested: 'window', },),)
          .toBe('window',);
      },
    },),
  ],
},);
