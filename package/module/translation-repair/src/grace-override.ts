import { StatedRefusalError, } from './stated-refusal.ts';

//region Grace override
// Lets one invocation run its stage rounds under a different straggler window
// than the built-in one, without rebuilding.
//
// ONE USE, and it is measurement. `#229` ranks lengthening the window as the
// first lever left against lost voices, since every cut stream in the last
// production run was a model still reasoning when the window closed, and the
// only way to price a longer window is a run under one matched against a run
// at the built-in window. The dial makes those two runs one build apart, the
// way `TRANSLATION_REPAIR_SLICE_OVERLAP` does for the overlap measurement.
//
// AN UNSET VARIABLE IS NOT AN OVERRIDE AND NEITHER IS AN EMPTY ONE, for the
// reason `cap-override.ts` gives: an exported-but-empty variable is a shell
// accident rather than an intention.
//
// ANYTHING ELSE REFUSES rather than falling back, and it refuses as a STATED
// refusal. The whole point of the dial is that two runs differ in it and in
// nothing else, so a mistyped value that quietly became the built-in window
// would produce two matched runs and a recorded conclusion that the window
// buys nothing. That is an operator's input to correct, not a fault to locate,
// so the command declines in one line and prints no frames for it.

/**
 * Environment variable overriding the straggler window, in milliseconds.
 */
export const STRAGGLER_GRACE_VAR = 'TRANSLATION_REPAIR_STRAGGLER_GRACE_MS';

/**
 * Straggler window the editor calibration runs under when nobody set one.
 *
 * FIVE MINUTES, DECIDED ON MEASUREMENT (`doc/decision/translation-repair-calibration-overlap.md`):
 * under four slices in flight, arm D ran this window at the same normalized
 * cost as arm B's built-in window and cut 2 voices against B's 7, because the
 * wait a longer window adds is what overlap fills. The corpus pass keeps
 * `STRAGGLER_GRACE_MS` until `#261` gives it overlap too.
 */
export const CALIBRATION_STRAGGLER_GRACE_MS = 300_000;

/**
 * Where a calibration's window came from.
 */
export type CalibrationGrace = {
  /**
   * Milliseconds the rounds wait on stragglers after quorum.
   */
  readonly effectiveMs: number;

  /**
   * `calibration-default` when nothing was set and the calibration's own window
   * was adopted; `override` when a launch set the variable.
   */
  readonly source: 'calibration-default' | 'override';
};

/**
 * Reads the straggler window this invocation's rounds run under.
 *
 * @param fallback - built-in window, used when nothing overrides it
 *
 * @param raw - override text; tests pass their own, and the environment read
 * supplies `''` for an absent variable, since unset and empty are alike here
 *
 * @returns Milliseconds a round keeps waiting on stragglers after quorum
 *
 * @throws {@link StatedRefusalError} when the override is present and is not
 * a positive finite number of milliseconds
 *
 * @example
 * ```ts
 * const graceMs = resolveStragglerGraceMs({ fallback: STRAGGLER_GRACE_MS, },);
 * ```
 */
export function resolveStragglerGraceMs(
  {
    fallback,
    raw = process.env[STRAGGLER_GRACE_VAR] ?? '',
  }: {
    readonly fallback: number;
    readonly raw?: string;
  },
): number {
  if (raw.trim() === '')
    return fallback;

  /**
   * Override read as a number, which `Number` reports as NaN for anything that
   * is not one. `Number` rather than `parseFloat`, because `parseFloat` reads
   * a leading number out of `300s` and would accept a typo as 300.
   */
  const ms = Number(raw,);

  if ((!Number.isFinite(ms,)) || (ms <= 0))
    throw new StatedRefusalError({
      says: `${STRAGGLER_GRACE_VAR} must be a positive number of milliseconds, and `
        + `${JSON.stringify(raw,)} is not; leave it unset to run under the built-in window`,
    },);

  return ms;
}

/**
 * Explains which window a run is under when it is not the built-in one.
 *
 * PRINTED BY THE DRIVERS RATHER THAN THE ROUND, because a run must never hide
 * which window it ran under: a round's own log names the window only when it
 * cuts a voice, and a run that cut nobody under a longer window is exactly the
 * run the measurement wants to hear about.
 *
 * @param effectiveMs - window the rounds run under
 *
 * @param builtInMs - window the code ships with
 *
 * @returns Note naming both windows, or nothing when they agree
 *
 * @example
 * ```ts
 * const note = graceOverrideNote({ effectiveMs, builtInMs: STRAGGLER_GRACE_MS, },);
 * ```
 */
export function graceOverrideNote(
  {
    effectiveMs,
    builtInMs,
  }: {
    readonly effectiveMs: number;
    readonly builtInMs: number;
  },
): string {
  if (effectiveMs === builtInMs)
    return '';

  return `STRAGGLER GRACE OVERRIDDEN by ${STRAGGLER_GRACE_VAR}: rounds abandon stragglers `
    + `${String(effectiveMs,)}ms after quorum rather than the built-in ${String(builtInMs,)}ms`;
}

/**
 * Puts the editor calibration under its own window unless a launch set one.
 *
 * THROUGH THE VARIABLE, DELIBERATELY. Every stage round reads its window off
 * `resolveStragglerGraceMs` with the built-in fallback, and threading a second
 * fallback through every stage the calibration drives would touch a dozen
 * signatures for one caller. Setting the variable when it is unset gives the
 * calibration's rounds the decided window by the path a launch already has,
 * and a launch that set the variable is honored as an override, refused if
 * unreadable, exactly as before.
 *
 * @returns Window the calibration's rounds run under, and where it came from
 *
 * @throws {@link StatedRefusalError} when a launch set the variable to
 * something that is not a positive finite number of milliseconds
 *
 * @example
 * ```ts
 * const grace = adoptCalibrationGrace();
 * console.log(`straggler window ${String(grace.effectiveMs,)}ms (${grace.source})`,);
 * ```
 */
export function adoptCalibrationGrace(): CalibrationGrace {
  /**
   * What the launch set, empty when it set nothing.
   */
  const written = process.env[STRAGGLER_GRACE_VAR] ?? '';

  if (written.trim() === '') {
    process.env[STRAGGLER_GRACE_VAR] = String(CALIBRATION_STRAGGLER_GRACE_MS,);
    return {
      effectiveMs: CALIBRATION_STRAGGLER_GRACE_MS,
      source: 'calibration-default',
    };
  }
  return {
    effectiveMs: resolveStragglerGraceMs({
      fallback: CALIBRATION_STRAGGLER_GRACE_MS,
      raw: written,
    },),
    source: 'override',
  };
}

//endregion Grace override
