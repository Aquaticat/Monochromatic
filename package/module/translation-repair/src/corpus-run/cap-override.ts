//region Cap override
// Lets one invocation run under a different per-entry ceiling than the built-in
// one, without rebuilding.
//
// TWO USES, and only one of them is testing. `#196`'s second way out is to
// raise the cap for entries above some slice count, and any such rule needs the
// ceiling to be settable before it can be a rule at all. The other is that the
// re-attempt queue only does anything to an entry the cap CUTS, so verifying it
// against the ceiling it ships with means finding an entry that needs thirteen
// hours. A lowered ceiling reproduces the same path in one.
//
// AN UNSET VARIABLE IS NOT AN OVERRIDE AND NEITHER IS AN EMPTY ONE. An
// exported-but-empty variable is an ordinary shell accident, and `run-config.ts`
// already carries the scar from treating one as meaningful.
//
// ANYTHING ELSE THROWS rather than falling back. A ceiling is what stops a
// runaway entry, so a misspelled value silently becoming the default would let
// an operator believe they had bounded a run that is not bounded the way they
// think. The failure has to be loud.

/**
 * Environment variable overriding the per-entry ceiling, in minutes.
 */
export const HARD_CAP_VAR = 'TRANSLATION_REPAIR_HARD_CAP_MINUTES';

/**
 * Raised when the override is present but is not a usable number of minutes.
 */
export class HardCapOverrideError extends Error {
  /**
   * Names the variable, what it held, and why that cannot be a ceiling.
   *
   * @param value - what the variable held, quoted back
   *
   * @example
   * ```ts
   * throw new HardCapOverrideError({ value: 'soon', },);
   * ```
   */
  constructor({ value, }: { readonly value: string; },) {
    super(
      `${HARD_CAP_VAR} must be a positive number of minutes; received ${JSON.stringify(value,)}.`
        + ' This is the ceiling that stops one entry running away with a whole pass, so an'
        + ' unreadable value is refused rather than quietly replaced by the default: an operator'
        + ' who set it believes the run is bounded the way they asked for.',
    );
    this.name = 'HardCapOverrideError';
  }
}

/**
 * Reads the per-entry ceiling this invocation runs under.
 *
 * @param fallback - built-in ceiling, used when nothing overrides it
 *
 * @param raw - override text; tests pass their own. UNSET AND EMPTY COLLAPSE TO
 * ONE VALUE here rather than being distinguished, because this module already
 * treats them alike: neither is an override. That is why the parameter is a
 * plain string and the environment read supplies `''` for an absent variable
 *
 * @returns Minutes one entry may run before its exchanges abort
 *
 * @throws {@link HardCapOverrideError} when the override is present and is not
 * a positive finite number
 *
 * @example
 * ```ts
 * const minutes = resolveHardCapMinutes({ fallback: HARD_CAP_MINUTES, },);
 * ```
 */
export function resolveHardCapMinutes(
  {
    fallback,
    raw = process.env[HARD_CAP_VAR] ?? '',
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
   * a leading number out of `30minutes` and would accept a typo as 30.
   */
  const minutes = Number(raw,);

  if ((!Number.isFinite(minutes,)) || (minutes <= 0))
    throw new HardCapOverrideError({ value: raw, },);

  return minutes;
}

//endregion Cap override
