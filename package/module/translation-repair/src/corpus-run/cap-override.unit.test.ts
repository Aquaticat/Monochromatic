/**
 * Tests for the per-entry ceiling an invocation runs under.
 *
 * The ceiling is what stops one entry running away with a whole pass, so the
 * case that matters most is the one where the override is WRONG. Falling back
 * to the default there would leave an operator believing a run is bounded the
 * way they asked for when it is bounded some other way, and nothing downstream
 * could tell them otherwise: an artifact records no ceiling.
 *
 * The empty-string case is the other one worth having, and this package already
 * carries the scar. `resolveRunsDir` had the same shape, and an
 * exported-but-empty variable is an ordinary shell accident rather than an
 * intention.
 *
 * The override text is injected rather than the environment mutated, so no case
 * here can leak into another.
 *
 * @module
 */

import {
  caught,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  capOutlastsOneCall,
  capTooTightNote,
  HARD_CAP_VAR,
  HardCapOverrideError,
  resolveHardCapMinutes,
} from '../../dist/final/node/index.mjs';

/**
 * Built-in ceiling these cases fall back to, standing in for the shipped one.
 */
const FALLBACK = 420;

await describe({
  name: resolveHardCapMinutes.name,
  children: [
    it({
      name: 'SPELLS the variable the way the documentation does. Earlier in '
        + 'this work a sibling key was written as TRANSLATION_REPAIR_HYPER_API_KEY '
        + 'when the real name carried CHARM, and nothing failed until a live '
        + 'probe did: an operator who exports a name nothing reads gets the '
        + 'default and no complaint',
      fn: async () => {
        expect(HARD_CAP_VAR,).toBe('TRANSLATION_REPAIR_HARD_CAP_MINUTES',);
      },
    },),

    it({
      name: 'USES the built-in ceiling when nothing overrides it, which is '
        + 'every ordinary run',
      fn: async () => {
        expect(resolveHardCapMinutes({
          fallback: FALLBACK,
          raw: '',
        },),).toBe(FALLBACK,);
      },
    },),

    it({
      name: 'HONORS a positive override, which is what lets the re-attempt '
        + 'queue be exercised against an entry that fits in one run',
      fn: async () => {
        expect(resolveHardCapMinutes({
          fallback: FALLBACK,
          raw: '15',
        },),).toBe(15,);
      },
    },),

    it({
      name: 'IGNORES an empty override and falls back, since an '
        + 'exported-but-empty variable is a shell accident rather than an '
        + 'intention',
      fn: async () => {
        expect(resolveHardCapMinutes({
          fallback: FALLBACK,
          raw: '   ',
        },),).toBe(FALLBACK,);
      },
    },),

    it({
      name: 'REFUSES a value that is not a number rather than falling back, '
        + 'because a typo silently becoming the default leaves an operator '
        + 'believing the run is bounded the way they asked for',
      fn: async () => {
        expect(
          caught(function readTypo(): number {
            return resolveHardCapMinutes({
              fallback: FALLBACK,
              raw: 'soon',
            },);
          },),
        ).toBeInstanceOf(HardCapOverrideError,);
      },
    },),

    it({
      name: 'REFUSES a trailing-unit value such as `30m`, which `parseFloat` '
        + 'would have read as 30 and accepted: the number is right and the '
        + 'operator\'s belief about what they set is not',
      fn: async () => {
        expect(
          caught(function readUnit(): number {
            return resolveHardCapMinutes({
              fallback: FALLBACK,
              raw: '30m',
            },);
          },),
        ).toBeInstanceOf(HardCapOverrideError,);
      },
    },),

    it({
      name: 'REFUSES zero and negatives, which would cut every entry before it '
        + 'bought a single slice and leave the queue dropping all of them',
      fn: async () => {
        expect(
          caught(function readZero(): number {
            return resolveHardCapMinutes({
              fallback: FALLBACK,
              raw: '0',
            },);
          },),
        ).toBeInstanceOf(HardCapOverrideError,);
      },
    },),
  ],
},);

await describe({
  name: capOutlastsOneCall.name,
  children: [
    it({
      name: 'ACCEPTS a ceiling longer than one exchange, which is the only shape that can buy a slice',
      fn: async () => {
        expect(capOutlastsOneCall({
          capMs: 420_000,
          perCallMs: 360_000,
        },),).toBe(true,);
      },
    },),
    it({
      name:
        'REFUSES a ceiling equal to one exchange, because the attempt ends at the same instant the '
        + 'exchange is allowed to and nothing has returned yet',
      fn: async () => {
        expect(capOutlastsOneCall({
          capMs: 360_000,
          perCallMs: 360_000,
        },),).toBe(false,);
      },
    },),
    it({
      name:
        'REFUSES the ceiling a live run actually used, five minutes against a six minute exchange, '
        + 'which cached nothing across two attempts and reported STALLED',
      fn: async () => {
        expect(capOutlastsOneCall({
          capMs: 300_000,
          perCallMs: 360_000,
        },),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: capTooTightNote.name,
  children: [
    it({
      name: 'NAMES BOTH NUMBERS, so a reader can tell which one to move without reading the source',
      fn: async () => {
        /**
         * Note built over the ceiling and exchange deadline of the live run.
         */
        const note = capTooTightNote({
          capMs: 300_000,
          perCallMs: 360_000,
        },);

        expect(note.includes('300000',),).toBe(true,);
        expect(note.includes('360000',),).toBe(true,);
      },
    },),
    it({
      name:
        'SAYS WHAT FOLLOWS rather than only that something is wrong: no slice caches, so the queue '
        + 'reads no progress and drops the entry',
      fn: async () => {
        /**
         * Same note, read for its consequence clause.
         */
        const note = capTooTightNote({
          capMs: 300_000,
          perCallMs: 360_000,
        },);

        expect(note.includes('no slice caches',),).toBe(true,);
        expect(note.includes('stalled',),).toBe(true,);
      },
    },),
  ],
},);
