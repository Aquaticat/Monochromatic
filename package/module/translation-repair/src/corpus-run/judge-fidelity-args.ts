import type { FidelityDamageKind, } from '../fidelity-damage.ts';
import { StatedRefusalError, } from '../stated-refusal.ts';

//region Judge fidelity arguments
// What the fidelity probe is asked on its command line, kept beside the probe
// so the probe itself stays under the file-length cap.

/**
 * How many trials one invocation runs by default.
 *
 * COUNTED IN ATTEMPTS, not in successes, so a failing roster cannot spend
 * without bound while the count a reader checks stays small.
 */
const DEFAULT_TRIAL_CAP = 16;

/**
 * Defects built for every pair when the caller names none.
 *
 * DELETION FIRST, since it is the reading already recorded and the one an
 * insertion result is compared against.
 */
export const DAMAGE_KINDS: readonly FidelityDamageKind[] = [
  'deletion',
  'insertion',
  'alteration',
];

/**
 * Defects each `--damage` spelling asks for.
 *
 * BOTH BY DEFAULT, because either fixture alone leaves a habit unmeasured: the
 * deletion cannot separate reading from preferring length, and the insertion
 * alone would not say the roster sees an omission at all. An unlisted spelling
 * reads as absent and the caller is told, rather than silently running
 * something it did not ask for.
 */
const DAMAGE_BY_NAME: Readonly<Record<string, readonly FidelityDamageKind[]>> = {
  '': DAMAGE_KINDS,
  deletion: ['deletion',],
  insertion: ['insertion',],
  alteration: ['alteration',],
};

/**
 * Reads `--only`, `--cap` and `--damage` from the command line.
 *
 * @internal
 *
 * @returns Entry ids to trial, empty for every entry, the trial cap, and which
 * defects to build
 *
 * @example
 * ```ts
 * const { onlyIds, cap, damageKinds, } = readFidelityArguments();
 * ```
 */
export function readFidelityArguments(): {
  readonly onlyIds: readonly string[];
  readonly cap: number;
  readonly damageKinds: readonly FidelityDamageKind[];
  readonly withContext: boolean;
} {
  /**
   * Arguments after the script path.
   */
  const args = process.argv
    .slice(2,);

  /**
   * Entry ids named after `--only`, comma separated.
   */
  const onlyAt = args.indexOf('--only',);

  /**
   * Cap named after `--cap`.
   */
  const capAt = args.indexOf('--cap',);

  /**
   * Cap as written, when one was named.
   */
  const capText = (capAt === (-1)) ? '' : (args[capAt + 1] ?? '');

  /**
   * Cap as a number, falling back when it is not one.
   */
  const cap = (capText === '')
    ? Number.NaN
    : Math.trunc(Number(capText,),);

  /**
   * Defect named after `--damage`, absent for both.
   */
  const damageAt = args.indexOf('--damage',);

  /**
   * Defect as written, when one was named.
   */
  const damageText = (damageAt === (-1)) ? '' : (args[damageAt + 1] ?? '');

  /**
   * Defects that spelling asks for, absent when it names none this probe builds.
   */
  const damageKinds = DAMAGE_BY_NAME[damageText];
  if (damageKinds === undefined)
    throw new StatedRefusalError({ says: `--damage takes deletion, insertion or alteration, not ${damageText}`, },);
  return {
    // `#107`: whether the sheet also carries the neighbouring sections' original,
    // which is the one thing that differs between a narrow run and a wide one.
    withContext: args.includes('--context',),
    damageKinds,
    onlyIds: (onlyAt === (-1))
      ? []
      : (args[onlyAt + 1] ?? '')
        .split(',',)
        .filter(function isNamed(id,): boolean {
          return id !== '';
        },),
    cap: Number.isNaN(cap,) ? DEFAULT_TRIAL_CAP : cap,
  };
}

//endregion Judge fidelity arguments
