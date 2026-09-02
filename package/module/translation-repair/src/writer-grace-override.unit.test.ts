/**
 * Tests for the window the writer rounds run under.
 *
 * THE CASE THAT MATTERS IS PRECEDENCE. The dial exists so a launch can hold the
 * reader rounds to a short window and still keep the writers it was seated on,
 * and a writer dial that lost to the round dial, or a blank one that did not
 * fall back to it, would run the writers under a window nobody chose while the
 * launch note claimed otherwise.
 *
 * The refusal rule is shared with the round dial through `readWindowDial`, so
 * this suite proves the writer dial reaches it and names ITS variable, and
 * leaves the rule's own edges to `grace-override.unit.test.ts`.
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
  resolveWriterGraceMs,
  STRAGGLER_GRACE_MS,
  STRAGGLER_GRACE_VAR,
  StatedRefusalError,
  WRITER_GRACE_VAR,
  WRITER_STAGE_LABELS,
  writerGraceOverrideNote,
  writerRoundGraceMs,
} from '../dist/final/node/index.mjs';

/**
 * Window the reader rounds are held to in the launch this dial was made for.
 */
const ROUND = 60_000;

/**
 * Window a launch would give its writers instead.
 */
const WRITER = 180_000;

await describe({
  name: resolveWriterGraceMs.name,
  children: [
    it({
      name: 'SPELLS the variable the way the documentation does, since an operator who exports a '
        + 'name nothing reads gets the round window and no complaint',
      fn: async () => {
        expect(WRITER_GRACE_VAR,).toBe('TRANSLATION_REPAIR_WRITER_GRACE_MS',);
      },
    },),

    it({
      name: 'FALLS BACK to the round window when the dial is unset or blank, which is every launch '
        + 'that did not ask for a writer window',
      fn: async () => {
        expect(resolveWriterGraceMs({
          fallback: ROUND,
          raw: '',
        },),).toBe(ROUND,);
        expect(resolveWriterGraceMs({
          fallback: ROUND,
          raw: '   ',
        },),).toBe(ROUND,);
      },
    },),

    it({
      name: 'HONORS a positive override, which is what lets one launch hold readers to one window '
        + 'and writers to another',
      fn: async () => {
        expect(resolveWriterGraceMs({
          fallback: ROUND,
          raw: String(WRITER,),
        },),).toBe(WRITER,);
      },
    },),

    it({
      name: 'REFUSES an unreadable value as a stated refusal naming ITS variable, not the round '
        + 'dial\'s, so the operator corrects the one they set',
      fn: async () => {
        /**
         * What the reader threw on a value nothing could read.
         */
        const refusal = caught(function readProse(): number {
          return resolveWriterGraceMs({
            fallback: ROUND,
            raw: 'three minutes',
          },);
        },);

        expect(refusal,).toBeInstanceOf(StatedRefusalError,);
        expect((refusal as Error).message,).toContain(WRITER_GRACE_VAR,);
        expect((refusal as Error).message,).not.toContain(STRAGGLER_GRACE_VAR,);
        expect((refusal as Error).message,).toContain('three minutes',);
      },
    },),
  ],
},);

await describe({
  name: writerGraceOverrideNote.name,
  children: [
    it({
      name: 'SAYS NOTHING when the writers share the round window, so an ordinary run carries no '
        + 'note claiming an override it did not make',
      fn: async () => {
        expect(writerGraceOverrideNote({
          writerMs: ROUND,
          roundMs: ROUND,
        },),).toBe('',);
      },
    },),

    it({
      name: 'NAMES BOTH WINDOWS, THE VARIABLE AND THE STAGES when they differ, so a reader of the '
        + 'log knows which rounds ran long without reading the shell that launched it',
      fn: async () => {
        /**
         * Note for a launch that gave its writers the longer window.
         */
        const note = writerGraceOverrideNote({
          writerMs: WRITER,
          roundMs: ROUND,
        },);

        expect(note,).toContain(WRITER_GRACE_VAR,);
        expect(note,).toContain(`${String(WRITER,)}ms`,);
        expect(note,).toContain(`${String(ROUND,)}ms`,);
        for (const label of WRITER_STAGE_LABELS)
          expect(note,).toContain(label,);
      },
    },),
  ],
},);

/**
 * Static clearer per dial, because deleting a computed key is what
 * `no-dynamic-delete` refuses and each dial has exactly one spelling.
 */
const CLEAR_DIAL: Record<string, () => void> = {
  [STRAGGLER_GRACE_VAR]: function clearRoundDial(): void {
    delete process.env.TRANSLATION_REPAIR_STRAGGLER_GRACE_MS;
  },
  [WRITER_GRACE_VAR]: function clearWriterDial(): void {
    delete process.env.TRANSLATION_REPAIR_WRITER_GRACE_MS;
  },
};

/**
 * Clears one dial's variable.
 *
 * @param variable - which dial
 *
 * @throws {@link Error} when no clearer is known for the variable, since a
 * case that thinks it cleared a dial and did not would test the wrong window
 *
 * @example
 * ```ts
 * clearDial({ variable: WRITER_GRACE_VAR, },);
 * ```
 */
function clearDial({ variable, }: { readonly variable: string; },): void {
  /**
   * Clearer for this dial, absent for a variable this suite does not know.
   */
  const clear = CLEAR_DIAL[variable];

  if (clear === undefined)
    throw new Error(`no clearer for ${variable}`,);
  clear();
}

/**
 * Sets or clears one window variable for one case, restoring it after.
 *
 * @param variable - which dial
 *
 * @param says - value to set, or nothing to clear the variable
 *
 * @returns Disposable that puts the variable back
 *
 * @example
 * ```ts
 * using dial = dialSaying({ variable: WRITER_GRACE_VAR, },);
 * ```
 */
function dialSaying(
  {
    variable,
    says,
  }: {
    readonly variable: string;
    readonly says?: string;
  },
): Disposable {
  /**
   * Value before the case, restored on dispose.
   */
  const before = process.env[variable];

  if (says === undefined)
    clearDial({ variable, },);
  else
    process.env[variable] = says;

  return {
    [Symbol.dispose]: () => {
      if (before === undefined)
        clearDial({ variable, },);
      else
        process.env[variable] = before;
    },
  };
}

await describe({
  name: writerRoundGraceMs.name,
  // ONE AT A TIME: every case writes the same process-wide variables.
  concurrency: 1,
  children: [
    it({
      name: 'RUNS writers under the built-in window when neither dial is set, which is every '
        + 'ordinary run and the case the built-in decision record describes',
      fn: async () => {
        using round = dialSaying({ variable: STRAGGLER_GRACE_VAR, },);
        using writer = dialSaying({ variable: WRITER_GRACE_VAR, },);

        expect(writerRoundGraceMs(),).toBe(STRAGGLER_GRACE_MS,);
        expect(round,).not.toBe(undefined,);
        expect(writer,).not.toBe(undefined,);
      },
    },),

    it({
      name: 'FOLLOWS the round dial when only it is set, so a launch that shortens every round '
        + 'shortens the writers too, exactly as before this dial existed',
      fn: async () => {
        using round = dialSaying({
          variable: STRAGGLER_GRACE_VAR,
          says: String(ROUND,),
        },);
        using writer = dialSaying({ variable: WRITER_GRACE_VAR, },);

        expect(writerRoundGraceMs(),).toBe(ROUND,);
        expect(round,).not.toBe(undefined,);
        expect(writer,).not.toBe(undefined,);
      },
    },),

    it({
      name: 'PREFERS the writer dial over the round dial when both are set, which is the launch '
        + 'this dial was made for',
      fn: async () => {
        using round = dialSaying({
          variable: STRAGGLER_GRACE_VAR,
          says: String(ROUND,),
        },);
        using writer = dialSaying({
          variable: WRITER_GRACE_VAR,
          says: String(WRITER,),
        },);

        expect(writerRoundGraceMs(),).toBe(WRITER,);
        expect(round,).not.toBe(undefined,);
        expect(writer,).not.toBe(undefined,);
      },
    },),

    it({
      name: 'REFUSES at the gather when the writer dial is unreadable, rather than running the '
        + 'writers under a window nobody chose',
      fn: async () => {
        using round = dialSaying({ variable: STRAGGLER_GRACE_VAR, },);
        using writer = dialSaying({
          variable: WRITER_GRACE_VAR,
          says: '180s',
        },);

        expect(
          caught(function readUnit(): number {
            return writerRoundGraceMs();
          },),
        ).toBeInstanceOf(StatedRefusalError,);
        expect(round,).not.toBe(undefined,);
        expect(writer,).not.toBe(undefined,);
      },
    },),
  ],
},);
