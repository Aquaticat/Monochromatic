/**
 * Tests for quota snapshot parsing.
 * Fixture mirrors the live-verified `/quotas` body shape with altered values.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  parseQuotaSnapshot,
  QuotaShapeError,
} from './synthetic-quota.ts';

/**
 * Recorded-shaped body with invented numbers;
 * carries the unmodeled blocks too, proving they are tolerated.
 */
const RECORDED_SHAPE = JSON.stringify({
  subscription: {
    limit: 640,
    requests: 3,
    renewsAt: '2026-07-17T03:00:00.000Z',
  },
  search: { hourly: { limit: 200, requests: 0, renewsAt: '2026-07-16T23:00:00.000Z', }, },
  freeToolCalls: { limit: 0, requests: 0, renewsAt: '2026-07-17T22:00:00.000Z', },
  weeklyTokenLimit: {
    nextRegenAt: '2026-07-17T00:10:00.000Z',
    percentRemaining: 87.5,
    maxCredits: '$32.00',
    remainingCredits: '$28.00',
    nextRegenCredits: '$0.64',
  },
  rollingFiveHourLimit: {
    nextTickAt: '2026-07-16T22:55:00.000Z',
    tickPercent: 0.05,
    remaining: 613.4,
    max: 640,
    limited: false,
  },
},);

await describe({
  name: parseQuotaSnapshot.name,
  children: [
    it({
      name: 'parses the recorded body shape into the typed snapshot',
      fn: async () => {
        expect(parseQuotaSnapshot({ bodyText: RECORDED_SHAPE, },),).toEqual({
          fiveHour: {
            remaining: 613.4,
            max: 640,
            limited: false,
            nextTickAt: '2026-07-16T22:55:00.000Z',
          },
          weekly: {
            percentRemaining: 87.5,
            nextRegenAt: '2026-07-17T00:10:00.000Z',
          },
        },);
      },
    },),

    it({
      name: 'throws QuotaShapeError on bodies that are not JSON',
      fn: async () => {
        /** Value caught from parse of an HTML error page. */
        let caught: unknown;
        try {
          parseQuotaSnapshot({ bodyText: '<html>maintenance</html>', },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught instanceof QuotaShapeError,).toBe(true,);
      },
    },),

    it({
      name: 'throws QuotaShapeError when the five-hour block is missing',
      fn: async () => {
        /** Value caught from parse of a body without the consumed block. */
        let caught: unknown;
        try {
          parseQuotaSnapshot({ bodyText: '{"weeklyTokenLimit":{}}', },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught instanceof QuotaShapeError,).toBe(true,);
      },
    },),

    it({
      name: 'throws QuotaShapeError when a consumed field is mistyped',
      fn: async () => {
        /** Body whose remaining count arrives as a string. */
        const mistyped = JSON.stringify({
          rollingFiveHourLimit: {
            nextTickAt: '2026-07-16T22:55:00.000Z',
            tickPercent: 0.05,
            remaining: '613',
            max: 640,
            limited: false,
          },
          weeklyTokenLimit: {
            nextRegenAt: '2026-07-17T00:10:00.000Z',
            percentRemaining: 87.5,
          },
        },);
        /** Value caught from parse of the mistyped body. */
        let caught: unknown;
        try {
          parseQuotaSnapshot({ bodyText: mistyped, },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught instanceof QuotaShapeError,).toBe(true,);
        expect(
          caught instanceof QuotaShapeError
            ? caught.message
            : '',
        ).toContain('remaining',);
      },
    },),
  ],
},);
