import type { SheetIdentity, } from './repair-grade-read.ts';
import type { SampleManifest, } from './sample-manifest.ts';

//region Sheet binding
// The one check both scorers run before joining a graded sheet to a manifest.
//
// Kept in one place because the two scorers ask the same question and had two
// copies of half the answer: `score-probe` compared seed and corpus pin, and
// `score-agreement` compared nothing at all, so it would happily score any
// sheet against whatever pre-grades sat under the default seed.
//
// The join is BY POSITION. Nothing in a sheet names an issue: the sheets print
// no issue ids, deliberately, because a 64-hex string is noise a human has to
// read past. So the sheet's header is the only evidence available that these
// grades are about these items, and everything this module can check lives
// there.

/**
 * How firmly a sheet was tied to the manifest it is being scored against.
 *
 * @example
 * ```ts
 * const strength: SheetBindingStrength = 'digest';
 * ```
 */
export type SheetBindingStrength =
  | 'digest'
  | 'header-only';

/**
 * Refuses a sheet and manifest that do not describe one draw.
 *
 * Seed and corpus pin are checked first and always, because a disagreement
 * there is unambiguous. They are not sufficient on their own: the draw is
 * deterministic in its seed but not in its POOL, and the pool grows with every
 * entry that settles, so one seed at one corpus commit names different item
 * sets at different times. Equal item counts do not help either, since two
 * unrelated draws of the same size match on count and mislabel every verdict.
 *
 * @param identity - what the sheet's header declares
 *
 * @param manifest - manifest the grades would be joined against
 *
 * @param sheetLabel - which sheet this is, for the failure message
 *
 * @returns Which check actually held, so a caller can report a weak binding
 * rather than implying a strong one
 *
 * @throws {@link Error} when the two describe different draws, since joining
 * them by position would mislabel every verdict rather than fail
 *
 * @example
 * ```ts
 * const strength = assertSheetMatchesManifest({ identity, manifest, sheetLabel: 'repair sheet', },);
 * ```
 */
export function assertSheetMatchesManifest(
  {
    identity,
    manifest,
    sheetLabel,
  }: {
    readonly identity: SheetIdentity;
    readonly manifest: SampleManifest;
    readonly sheetLabel: string;
  },
): SheetBindingStrength {
  if (identity.seed !== manifest.seed)
    throw new Error(
      `${sheetLabel} and manifest belong to different draws: sheet says seed ${
        JSON.stringify(identity.seed,)
      }, manifest says ${JSON.stringify(manifest.seed,)}. Item counts can `
        + 'match across unrelated draws of the same size, so position is not '
        + 'evidence they describe the same items.',
    );

  if (identity.corpusSha !== manifest.corpusSha)
    throw new Error(
      `${sheetLabel} and manifest were produced against different corpus `
        + `commits: sheet says ${JSON.stringify(identity.corpusSha,)}, manifest `
        + `says ${JSON.stringify(manifest.corpusSha,)}. The same entry can `
        + 'carry different text at two commits, so the grades and the '
        + 'artifacts would be about different documents.',
    );

  // Absent on either side means one of them predates the binding, which is
  // true of every sheet drawn before it existed and is not a fault. Refusing
  // those would strand graded sheets that nothing can redraw, since a final
  // draw refuses to overwrite itself precisely because it may already carry
  // hours of grading.
  if ((identity.drawDigest === '') || (manifest.drawDigest === undefined))
    return 'header-only';

  if (identity.drawDigest !== manifest.drawDigest)
    throw new Error(
      `${sheetLabel} and manifest carry different draw digests: sheet says ${
        JSON.stringify(identity.drawDigest,)
      }, manifest says ${JSON.stringify(manifest.drawDigest,)}. They agree on `
        + 'seed and corpus pin, which is exactly the case the digest exists '
        + 'for: the draw is deterministic in its seed but not in its pool, so '
        + 'the same seed drawn after another entry settled names a different '
        + 'set of items at the same positions.',
    );

  return 'digest';
}

/**
 * Sentence explaining what a weak binding did and did not establish.
 *
 * Printed rather than silent, so a run scored under the older check never reads
 * as one the digest confirmed.
 */
export const HEADER_ONLY_BINDING_NOTE: string =
  'NOTE sheet and manifest agree on seed and corpus pin, but one of them '
  + 'carries no draw digest, so this join rests on the file names and the '
  + 'header rather than on the items. Draws taken before the digest existed '
  + 'read this way, and are scoreable; a NEW draw reading this way means the '
  + 'digest was dropped somewhere and the pairing is unproven.';

//endregion Sheet binding
