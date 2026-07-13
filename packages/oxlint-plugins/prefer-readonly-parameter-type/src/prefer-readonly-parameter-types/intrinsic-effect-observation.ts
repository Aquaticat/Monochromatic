import type { IntrinsicEffectEntry, } from './intrinsic-effect-catalog.ts';

/**
 * Tests whether audited intrinsic has no direct or callback-mediated effect.
 *
 * @param effect - Exact audited intrinsic effect.
 *
 * @returns Whether callable is fully observational.
 *
 * @example
 * ```ts
 * intrinsicEffectIsObservational(effect);
 * ```
 */
export function intrinsicEffectIsObservational(
  effect: IntrinsicEffectEntry,
): boolean {
  /**
   * Number of direct receiver or argument mutation targets.
   */
  const targetCount = effect.targets
    .length;
  return (targetCount === 0)
    && (effect.callbacks === undefined);
}
