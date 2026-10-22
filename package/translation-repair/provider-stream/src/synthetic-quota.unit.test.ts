/**
 Tests for quota snapshot parsing.
 Fixture mirrors the live-verified `/quotas` body shape with altered values.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  parseQuotaSnapshot,
  QuotaShapeError,
} from '../dist/final/node/index.mjs';

/**
 Recorded-shaped body with invented numbers;
 carries the unmodeled blocks too, proving they are tolerated.
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

/**
 Body shaped like the live reading of 2026-10-19 (14:35 UTC), whose top-level keys were exactly `subscription`, `search`,
 `freeToolCalls` and `weeklyTokenLimit`, with no five-hour block. The inner fields of `weeklyTokenLimit` were not observed in
 that reading, so they are the ones of 2026-07-16 ASSUMED, with invented numbers.
 */
const NO_FIVE_HOUR_SHAPE = JSON.stringify({
  subscription: { limit: 640, requests: 3, renewsAt: '2026-10-20T03:00:00.000Z', },
  search: { hourly: { limit: 200, requests: 0, renewsAt: '2026-10-19T23:00:00.000Z', }, },
  freeToolCalls: { limit: 0, requests: 0, renewsAt: '2026-10-20T22:00:00.000Z', },
  weeklyTokenLimit: {
    nextRegenAt: '2026-10-19T17:57:00.000Z',
    percentRemaining: 64.5,
  },
},);

/**
 A five-hour block of the shape of 2026-07-16, as JSON text.
 */
const FIVE_HOUR_TEXT = '{"remaining":613.4,"max":640,"limited":false,"nextTickAt":"2026-07-16T22:55:00.000Z"}';

/**
 A weekly block of the shape of 2026-07-16, as JSON text.
 */
const WEEKLY_TEXT = '{"percentRemaining":87.5,"nextRegenAt":"2026-07-17T00:10:00.000Z"}';

/**
 Message a body is refused with.

 @param bodyText - raw body handed to the parser

 @returns The refusal message, `not a shape error` for any other failure, empty when the body was accepted
 */
function refusalOf({ bodyText, }: { readonly bodyText: string; },): string {
  try {
    parseQuotaSnapshot({ bodyText, },);
  }
  catch (error) {
    return (error instanceof QuotaShapeError) ? error.message : 'not a shape error';
  }
  return '';
}

await describe({
  name: parseQuotaSnapshot.name,
  children: [
    it({
      name: 'parses a body WITHOUT the five-hour block into a snapshot with no five-hour window, as the live reading of '
        + '2026-10-19 shaped it, and keeps the weekly block',
      fn: async () => {
        /**
         Snapshot read from the body that has no five-hour key.
         */
        const snapshot = parseQuotaSnapshot({ bodyText: NO_FIVE_HOUR_SHAPE, },);
        expect(snapshot,).toEqual({
          weekly: {
            percentRemaining: 64.5,
            nextRegenAt: '2026-10-19T17:57:00.000Z',
          },
        },);
        // ABSENT rather than present and undefined: the property must not exist at all.
        expect(Object.hasOwn(
          snapshot,
          'fiveHour',
        ),).toBe(false,);
      },
    },),

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
      name: 'REFUSES a body that has neither limit block\'s fields, naming the weekly field and the weekly block\'s own keys',
      fn: async () => {
        expect(refusalOf({ bodyText: '{"weeklyTokenLimit":{}}', },),).toBe(
          'Synthetic /quotas body violated expectations: weeklyTokenLimit.percentRemaining is not a number; received '
            + 'weeklyTokenLimit:object; weeklyTokenLimit holds {}',
        );
      },
    },),

    it({
      name: 'REFUSES a body without the weekly block even when it carries a five-hour block, since the weekly budget always decides',
      fn: async () => {
        expect(refusalOf({ bodyText: `{"rollingFiveHourLimit":${FIVE_HOUR_TEXT}}`, },),).toBe(
          'Synthetic /quotas body violated expectations: weeklyTokenLimit is not an object; received rollingFiveHourLimit:object',
        );
        expect(refusalOf({ bodyText: '{"subscription":{"limit":1}}', },),).toBe(
          'Synthetic /quotas body violated expectations: weeklyTokenLimit is not an object; received subscription:object',
        );
      },
    },),

    it({
      name: 'REFUSES a five-hour key that is PRESENT but no object, null included, as before: only an absent key means no window',
      fn: async () => {
        /**
         Refusals for the key carrying each kind of value that is no object, beside a valid weekly block.
         */
        const refusals = [
          'null',
          '[]',
          '"full"',
          '5',
          'true',
        ].map(function refused(value,): string {
          return refusalOf({ bodyText: `{"rollingFiveHourLimit":${value},"weeklyTokenLimit":${WEEKLY_TEXT}}`, },);
        },);
        expect(refusals,).toEqual([
          'Synthetic /quotas body violated expectations: rollingFiveHourLimit is not an object; received '
            + 'rollingFiveHourLimit:null, weeklyTokenLimit:object',
          'Synthetic /quotas body violated expectations: rollingFiveHourLimit is not an object; received '
            + 'rollingFiveHourLimit:array, weeklyTokenLimit:object',
          'Synthetic /quotas body violated expectations: rollingFiveHourLimit is not an object; received '
            + 'rollingFiveHourLimit:string, weeklyTokenLimit:object',
          'Synthetic /quotas body violated expectations: rollingFiveHourLimit is not an object; received '
            + 'rollingFiveHourLimit:number, weeklyTokenLimit:object',
          'Synthetic /quotas body violated expectations: rollingFiveHourLimit is not an object; received '
            + 'rollingFiveHourLimit:boolean, weeklyTokenLimit:object',
        ],);
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

    it({
      name: 'throws QuotaShapeError when a body parses to no JSON object',
      fn: async () => {
        /** Value caught from parse of a JSON array where the object goes. */
        let caught: unknown;
        try {
          parseQuotaSnapshot({ bodyText: '[1,2]', },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught instanceof QuotaShapeError,).toBe(true,);
        expect(
          caught instanceof QuotaShapeError
            ? caught.message
            : '',
        ).toBe('Synthetic /quotas body violated expectations: body is not a JSON object; received array',);
      },
    },),

    it({
      name: 'throws QuotaShapeError when the weekly block is not an object',
      fn: async () => {
        /** Body whose weekly block arrives as a string. */
        const bodyText = '{"rollingFiveHourLimit":{"remaining":613.4,"max":640,"limited":false,"nextTickAt":"2026-07-16T22:55:00.000Z"},"weeklyTokenLimit":"nope"}';
        /** Value caught from parse of the mistyped body. */
        let caught: unknown;
        try {
          parseQuotaSnapshot({ bodyText, },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught instanceof QuotaShapeError,).toBe(true,);
        expect(
          caught instanceof QuotaShapeError
            ? caught.message
            : '',
        ).toBe('Synthetic /quotas body violated expectations: weeklyTokenLimit is not an object; received '
          + 'rollingFiveHourLimit:object, weeklyTokenLimit:string',);
      },
    },),

    it({
      name: 'throws QuotaShapeError on each mistyped five-hour field, naming the field it refused',
      fn: async () => {
        /**
         Five-hour fields mistyped one at a time, each naming its own
         refusal.
         */
        const variants: readonly {
          readonly bodyText: string;
          readonly message: string;
        }[] = [
          {
            bodyText: '{"rollingFiveHourLimit":{"remaining":613.4,"max":"640","limited":false,"nextTickAt":"2026-07-16T22:55:00.000Z"},"weeklyTokenLimit":{"percentRemaining":87.5,"nextRegenAt":"2026-07-17T00:10:00.000Z"}}',
            message: 'Synthetic /quotas body violated expectations: rollingFiveHourLimit.max is not a number; received '
              + 'rollingFiveHourLimit:object, weeklyTokenLimit:object; rollingFiveHourLimit holds '
              + 'remaining:number, max:string, limited:boolean, nextTickAt:string',
          },
          {
            bodyText: '{"rollingFiveHourLimit":{"remaining":613.4,"max":640,"limited":"false","nextTickAt":"2026-07-16T22:55:00.000Z"},"weeklyTokenLimit":{"percentRemaining":87.5,"nextRegenAt":"2026-07-17T00:10:00.000Z"}}',
            message: 'Synthetic /quotas body violated expectations: rollingFiveHourLimit.limited is not a boolean; received '
              + 'rollingFiveHourLimit:object, weeklyTokenLimit:object; rollingFiveHourLimit holds '
              + 'remaining:number, max:number, limited:string, nextTickAt:string',
          },
          {
            bodyText: '{"rollingFiveHourLimit":{"remaining":613.4,"max":640,"limited":false,"nextTickAt":5},"weeklyTokenLimit":{"percentRemaining":87.5,"nextRegenAt":"2026-07-17T00:10:00.000Z"}}',
            message: 'Synthetic /quotas body violated expectations: rollingFiveHourLimit.nextTickAt is not a string; received '
              + 'rollingFiveHourLimit:object, weeklyTokenLimit:object; rollingFiveHourLimit holds '
              + 'remaining:number, max:number, limited:boolean, nextTickAt:number',
          },
        ];
        for (const { bodyText, message, } of variants) {
          /** Value caught from parse of the mistyped body. */
          let caught: unknown;
          try {
            parseQuotaSnapshot({ bodyText, },);
          }
          catch (error) {
            caught = error;
          }
          expect(caught instanceof QuotaShapeError,).toBe(true,);
          expect(
            caught instanceof QuotaShapeError
              ? caught.message
              : '',
          ).toBe(message,);
        }
      },
    },),

    it({
      name: 'throws QuotaShapeError on each mistyped weekly field, naming the field it refused',
      fn: async () => {
        /**
         Weekly fields mistyped one at a time, each naming its own
         refusal.
         */
        const variants: readonly {
          readonly bodyText: string;
          readonly message: string;
        }[] = [
          {
            bodyText: '{"rollingFiveHourLimit":{"remaining":613.4,"max":640,"limited":false,"nextTickAt":"2026-07-16T22:55:00.000Z"},"weeklyTokenLimit":{"percentRemaining":"87.5","nextRegenAt":"2026-07-17T00:10:00.000Z"}}',
            message: 'Synthetic /quotas body violated expectations: weeklyTokenLimit.percentRemaining is not a number; received '
              + 'rollingFiveHourLimit:object, weeklyTokenLimit:object; weeklyTokenLimit holds '
              + 'percentRemaining:string, nextRegenAt:string',
          },
          {
            bodyText: '{"rollingFiveHourLimit":{"remaining":613.4,"max":640,"limited":false,"nextTickAt":"2026-07-16T22:55:00.000Z"},"weeklyTokenLimit":{"percentRemaining":87.5,"nextRegenAt":5}}',
            message: 'Synthetic /quotas body violated expectations: weeklyTokenLimit.nextRegenAt is not a string; received '
              + 'rollingFiveHourLimit:object, weeklyTokenLimit:object; weeklyTokenLimit holds '
              + 'percentRemaining:number, nextRegenAt:number',
          },
        ];
        for (const { bodyText, message, } of variants) {
          /** Value caught from parse of the mistyped body. */
          let caught: unknown;
          try {
            parseQuotaSnapshot({ bodyText, },);
          }
          catch (error) {
            caught = error;
          }
          expect(caught instanceof QuotaShapeError,).toBe(true,);
          expect(
            caught instanceof QuotaShapeError
              ? caught.message
              : '',
          ).toBe(message,);
        }
      },
    },),
    it({
      name: 'NAMES THE TOP-LEVEL KEYS OF A REFUSED BODY AND THE JSON TYPE OF EACH, and for a body that is no object the type of '
        + 'the value, and never a value',
      fn: async () => {
        expect([
          refusalOf({ bodyText: '{}', },),
          refusalOf({ bodyText: '{"rollingFiveHourLimit":"full","weeklyTokenLimit":5,"search":null,"x":[1],"y":true}', },),
          refusalOf({ bodyText: '[1,2]', },),
          refusalOf({ bodyText: '{"weeklyTokenLimit":{"percentRemaining":87}}', },),
          refusalOf({ bodyText: '<html>maintenance</html>', },),
        ],).toEqual([
          'Synthetic /quotas body violated expectations: weeklyTokenLimit is not an object; received {}',
          'Synthetic /quotas body violated expectations: rollingFiveHourLimit is not an object; received '
            + 'rollingFiveHourLimit:string, weeklyTokenLimit:number, search:null, x:array, y:boolean',
          'Synthetic /quotas body violated expectations: body is not a JSON object; received array',
          'Synthetic /quotas body violated expectations: weeklyTokenLimit.nextRegenAt is not a string; received '
            + 'weeklyTokenLimit:object; weeklyTokenLimit holds percentRemaining:number',
          'Synthetic /quotas body violated expectations: body is not valid JSON',
        ],);
      },
    },),

    it({
      name: 'NAMES THE KEYS AND TYPES OF THE WEEKLY BLOCK when a field inside it is refused on a body with no five-hour block, so '
        + 'the next live reading shows the block\'s real fields if they changed, and never a value',
      fn: async () => {
        /**
         The 2026-10-19 body with the weekly block reshaped: the inner names are others, and the values are private.
         */
        const reshaped = JSON.stringify({
          subscription: { limit: 640, },
          weeklyTokenLimit: {
            percentLeft: 64.5,
            resetsAt: '2026-10-19T17:57:00.000Z',
            note: 'whiskers-private-note',
            tiers: [1, 2,],
            extra: null,
          },
        },);
        /**
         The message the reshaped body is refused with.
         */
        const message = refusalOf({ bodyText: reshaped, },);
        expect(message,).toBe(
          'Synthetic /quotas body violated expectations: weeklyTokenLimit.percentRemaining is not a number; received '
            + 'subscription:object, weeklyTokenLimit:object; weeklyTokenLimit holds '
            + 'percentLeft:number, resetsAt:string, note:string, tiers:array, extra:null',
        );
        expect(['whiskers-private-note', '64.5', '2026-10-19',].filter(function appears(value,): boolean {
          return message.includes(value,);
        },),).toEqual([],);
      },
    },),

    it({
      name: 'LEAVES THE OTHER BLOCK OUT of the keys it describes: a refused five-hour field describes the five-hour block alone',
      fn: async () => {
        expect(refusalOf({
          bodyText: `{"rollingFiveHourLimit":{"remaining":"x","max":1},"weeklyTokenLimit":${WEEKLY_TEXT}}`,
        },),).toBe(
          'Synthetic /quotas body violated expectations: rollingFiveHourLimit.remaining is not a number; received '
            + 'rollingFiveHourLimit:object, weeklyTokenLimit:object; rollingFiveHourLimit holds remaining:string, max:number',
        );
      },
    },),

    it({
      name: 'BOUNDS WHAT A REFUSED BODY CAN PUT IN THE MESSAGE: key names are cut to forty characters of printable ASCII, each other '
        + 'character shown as a question mark, and more than twenty keys are listed as twenty and a count of the rest',
      fn: async () => {
        /**
         A body of twenty-two keys, the first of them longer than the bound and the second written in another script.
         */
        const wide: Record<string, unknown> = {
          ['a'.repeat(45,)]: 1,
          '\u732B\u0000': 'x',
        };
        for (let at = 0; at < 20; at += 1)
          wide[`k${String(at,)}`] = at;
        expect(refusalOf({ bodyText: JSON.stringify(wide,), },),).toBe(
          `Synthetic /quotas body violated expectations: weeklyTokenLimit is not an object; received ${'a'.repeat(40,)}:number, `
            + '??:string, k0:number, k1:number, k2:number, k3:number, k4:number, k5:number, k6:number, k7:number, k8:number, k9:number, '
            + 'k10:number, k11:number, k12:number, k13:number, k14:number, k15:number, k16:number, k17:number, and 2 more',
        );
      },
    },),

    it({
      name: 'BOUNDS THE KEYS OF A REFUSED BLOCK THE SAME WAY: forty printable ASCII characters a name, twenty names, and a count of the rest',
      fn: async () => {
        /**
         A weekly block of twenty-three keys: the refused field first, then a name longer than the bound, a name in another script,
         and twenty more.
         */
        const crowded: Record<string, unknown> = {
          percentRemaining: 'x',
          ['a'.repeat(45,)]: 1,
          '\u732B\u0000': 'x',
        };
        for (let at = 0; at < 20; at += 1)
          crowded[`k${String(at,)}`] = at;
        expect(refusalOf({ bodyText: JSON.stringify({ weeklyTokenLimit: crowded, },), },),).toBe(
          'Synthetic /quotas body violated expectations: weeklyTokenLimit.percentRemaining is not a number; received '
            + 'weeklyTokenLimit:object; weeklyTokenLimit holds percentRemaining:string, '
            + `${'a'.repeat(40,)}:number, ??:string, k0:number, k1:number, k2:number, k3:number, k4:number, k5:number, k6:number, `
            + 'k7:number, k8:number, k9:number, k10:number, k11:number, k12:number, k13:number, k14:number, k15:number, k16:number, '
            + 'and 3 more',
        );
      },
    },),
  ],
},);
