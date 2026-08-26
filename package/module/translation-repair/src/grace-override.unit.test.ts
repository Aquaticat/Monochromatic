/**
 * Tests for the straggler window an invocation's rounds run under.
 *
 * THE CASE THAT MATTERS IS THE WRONG OVERRIDE. The dial exists so two runs can
 * differ in the window and in nothing else, and a value it cannot read that
 * quietly became the built-in window would produce two matched runs and a
 * recorded conclusion that a longer window buys nothing. That is not a failed
 * measurement, it is a wrong one, and it would be believed.
 *
 * The empty-string case is the other one worth having, for the reason the cap
 * override's suite gives: an exported-but-empty variable is a shell accident.
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
  adoptCalibrationGrace,
  CALIBRATION_STRAGGLER_GRACE_MS,
  graceOverrideNote,
  resolveStragglerGraceMs,
  STRAGGLER_GRACE_VAR,
  StatedRefusalError,
} from '../dist/final/node/index.mjs';

/**
 * Built-in window these cases fall back to, standing in for the shipped one.
 */
const FALLBACK = 180_000;

/**
 * Longer window a measurement run would ask for.
 */
const LONGER = 300_000;

await describe({
  name: resolveStragglerGraceMs.name,
  children: [
    it({
      name: 'SPELLS the variable the way the documentation does, since an operator who exports a '
        + 'name nothing reads gets the built-in window and no complaint',
      fn: async () => {
        expect(STRAGGLER_GRACE_VAR,).toBe('TRANSLATION_REPAIR_STRAGGLER_GRACE_MS',);
      },
    },),

    it({
      name: 'USES the built-in window when nothing overrides it, which is every ordinary run',
      fn: async () => {
        expect(resolveStragglerGraceMs({
          fallback: FALLBACK,
          raw: '',
        },),).toBe(FALLBACK,);
      },
    },),

    it({
      name: 'HONORS a positive override, which is what makes a longer-window run one build apart '
        + 'from its matched control',
      fn: async () => {
        expect(resolveStragglerGraceMs({
          fallback: FALLBACK,
          raw: '300000',
        },),).toBe(LONGER,);
      },
    },),

    it({
      name: 'IGNORES an empty override and falls back, since an exported-but-empty variable is a '
        + 'shell accident rather than an intention',
      fn: async () => {
        expect(resolveStragglerGraceMs({
          fallback: FALLBACK,
          raw: '   ',
        },),).toBe(FALLBACK,);
      },
    },),

    it({
      name: 'REFUSES a value that is not a number rather than falling back, as a stated refusal '
        + 'naming the variable and the value, because a typo silently becoming the built-in window '
        + 'would compare two matched runs and conclude the window buys nothing',
      fn: async () => {
        /**
         * What the reader threw on a value nothing could read.
         */
        const refusal = caught(function readProse(): number {
          return resolveStragglerGraceMs({
            fallback: FALLBACK,
            raw: 'five minutes',
          },);
        },);

        expect(refusal,).toBeInstanceOf(StatedRefusalError,);
        expect((refusal as Error).message,).toContain(STRAGGLER_GRACE_VAR,);
        expect((refusal as Error).message,).toContain('five minutes',);
      },
    },),

    it({
      name: 'REFUSES a trailing-unit value such as `300s`, which `parseFloat` would have read as '
        + '300 and accepted: the number is right and the operator\'s belief about what they set '
        + 'is not',
      fn: async () => {
        expect(
          caught(function readUnit(): number {
            return resolveStragglerGraceMs({
              fallback: FALLBACK,
              raw: '300s',
            },);
          },),
        ).toBeInstanceOf(StatedRefusalError,);
      },
    },),

    it({
      name: 'REFUSES zero and negatives, which would abandon every straggler the instant quorum '
        + 'stood and lose the very voices the window exists to keep',
      fn: async () => {
        expect(
          caught(function readZero(): number {
            return resolveStragglerGraceMs({
              fallback: FALLBACK,
              raw: '0',
            },);
          },),
        ).toBeInstanceOf(StatedRefusalError,);
        expect(
          caught(function readNegative(): number {
            return resolveStragglerGraceMs({
              fallback: FALLBACK,
              raw: '-1000',
            },);
          },),
        ).toBeInstanceOf(StatedRefusalError,);
      },
    },),
  ],
},);

await describe({
  name: graceOverrideNote.name,
  children: [
    it({
      name: 'SAYS NOTHING when the run is under the built-in window, so an ordinary run carries no '
        + 'note claiming an override it did not make',
      fn: async () => {
        expect(graceOverrideNote({
          effectiveMs: FALLBACK,
          builtInMs: FALLBACK,
        },),).toBe('',);
      },
    },),

    it({
      name: 'NAMES BOTH WINDOWS AND THE VARIABLE when they differ, so a reader of the log can tell '
        + 'which run this was without reading the shell that launched it',
      fn: async () => {
        /**
         * Note for a run under the longer window.
         */
        const note = graceOverrideNote({
          effectiveMs: LONGER,
          builtInMs: FALLBACK,
        },);

        expect(note,).toContain(STRAGGLER_GRACE_VAR,);
        expect(note,).toContain('300000ms',);
        expect(note,).toContain('built-in 180000ms',);
      },
    },),
  ],
},);

/**
 * Sets or clears the window variable for one case, restoring it after.
 *
 * @param says - value to set, or nothing to clear the variable
 *
 * @returns Disposable that puts the variable back
 *
 * @example
 * ```ts
 * using dial = windowSaying({},);
 * ```
 */
function windowSaying({ says, }: { readonly says?: string; },): Disposable {
  /**
   * Value before the case, restored on dispose.
   */
  const before = process.env[STRAGGLER_GRACE_VAR];

  if (says === undefined)
    delete process.env.TRANSLATION_REPAIR_STRAGGLER_GRACE_MS;
  else
    process.env[STRAGGLER_GRACE_VAR] = says;

  return {
    [Symbol.dispose]: () => {
      if (before === undefined)
        delete process.env.TRANSLATION_REPAIR_STRAGGLER_GRACE_MS;
      else
        process.env[STRAGGLER_GRACE_VAR] = before;
    },
  };
}

await describe({
  name: adoptCalibrationGrace.name,
  // ONE AT A TIME: every case writes the same process-wide variable.
  concurrency: 1,
  children: [
    it({
      name: 'ADOPTS the calibration window through the variable when nothing was set, so every stage '
        + 'round the calibration drives reads it by the path a launch already has',
      fn: async () => {
        using dial = windowSaying({},);

        expect(adoptCalibrationGrace(),).toStrictEqual({
          effectiveMs: CALIBRATION_STRAGGLER_GRACE_MS,
          source: 'calibration-default',
        },);
        expect(process.env[STRAGGLER_GRACE_VAR],).toBe(String(CALIBRATION_STRAGGLER_GRACE_MS,),);
        expect(resolveStragglerGraceMs({ fallback: FALLBACK, },),).toBe(CALIBRATION_STRAGGLER_GRACE_MS,);
        expect(dial,).not.toBe(undefined,);
      },
    },),

    it({
      name: 'HONORS a launch that set the variable, as an override, and leaves it as set',
      fn: async () => {
        using dial = windowSaying({ says: '180000', },);

        expect(adoptCalibrationGrace(),).toStrictEqual({
          effectiveMs: FALLBACK,
          source: 'override',
        },);
        expect(process.env[STRAGGLER_GRACE_VAR],).toBe('180000',);
        expect(dial,).not.toBe(undefined,);
      },
    },),

    it({
      name: 'REFUSES an unreadable launch value the way the dial does, instead of adopting over it',
      fn: async () => {
        using dial = windowSaying({ says: 'five minutes', },);

        const refusal = caught(function adoptsProse() {
          adoptCalibrationGrace();
        },);

        expect(refusal,).toBeInstanceOf(StatedRefusalError,);
        expect((refusal as Error).message,).toContain(STRAGGLER_GRACE_VAR,);
        expect(dial,).not.toBe(undefined,);
      },
    },),
  ],
},);
