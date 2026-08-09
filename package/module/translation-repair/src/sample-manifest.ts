import {
  ArtifactParseError,
  requireArray,
  requireCount,
  requireRecord,
  requireString,
} from './artifact-guard.ts';
import { computeDrawDigest, } from './sample-draw-identity.ts';
import type { GradingCandidate, } from './sample-grading.ts';

//region Sample manifest
// What sat at each sheet position, recorded WHEN THE DRAW HAPPENS.
//
// Without this the join is not merely awkward, it is impossible. Sheet items
// are numbered positions; probe telemetry and checker verdicts are keyed by
// issue id; and the sheets deliberately print no issue id, because a 64-hex
// string on a grading sheet is noise a human has to read past. Re-running the
// draw does not recover the mapping either: the draw is deterministic in its
// seed but not in its POOL, and the pool grows with every entry that settles,
// so a draw taken at fifteen entries stops reproducing as soon as the sixteenth
// lands.
//
// So the mapping exists only in the instant the sheets are written, and if it
// is not written down then, every measurement that needs to join a human grade
// to a machine verdict is lost with it. That includes the whole reason the
// introduced-defect probe records anything.
//
// Identifiers only, no corpus text: this file lives beside the sheets, outside
// git, under the same rule they do.

/**
 * One drawn item's identity at its sheet position.
 *
 * @example
 * ```ts
 * const item: SampleManifestItem = { position: 1, entryId: 'Kitten', issueId: 'adjudicated/nap', };
 * ```
 */
export type SampleManifestItem = {
  /**
   * One-based sheet position, identical on both sheets.
   */
  readonly position: number;

  /**
   * Corpus entry the issue came from.
   */
  readonly entryId: string;

  /**
   * Adjudicated issue at this position, the key every machine verdict uses.
   */
  readonly issueId: string;
};

/**
 * Everything needed to join a graded sheet back to the run that produced it.
 *
 * @example
 * ```ts
 * const manifest: SampleManifest = buildSampleManifest({ sample, seed, corpusSha, },);
 * ```
 */
export type SampleManifest = {
  /**
   * Draw seed, so a manifest cannot be paired with another draw's sheets.
   */
  readonly seed: string;

  /**
   * Corpus commit the entries were read at.
   */
  readonly corpusSha: string;

  /**
   * Fingerprint of this exact draw, absent on manifests written before the
   * binding existed.
   *
   * Optional rather than defaulted to an empty string, because absence and a
   * value are genuinely different states and the scorers act differently on
   * them. A manifest drawn before this field existed can still be scored, under
   * the weaker seed-and-pin check and a printed note saying so; a manifest that
   * carries a digest disagreeing with its own items is malformed and refused.
   */
  readonly drawDigest?: string;

  /**
   * Items in sheet order.
   */
  readonly items: readonly SampleManifestItem[];
};

/**
 * Records what sat at each sheet position.
 *
 * @param sample - drawn candidates, in the order both sheets render them
 *
 * @param seed - draw seed
 *
 * @param corpusSha - pinned corpus commit
 *
 * @returns Manifest to write beside the sheets
 *
 * @example
 * ```ts
 * const manifest = buildSampleManifest({ sample, seed, corpusSha, },);
 * ```
 */
export function buildSampleManifest(
  {
    sample,
    seed,
    corpusSha,
  }: {
    readonly sample: readonly GradingCandidate[];
    readonly seed: string;
    readonly corpusSha: string;
  },
): SampleManifest {
  /**
   * Items in sheet order, which is the order the digest is taken over.
   */
  const items: readonly SampleManifestItem[] = sample.map(function toItem(
    candidate,
    index,
  ): SampleManifestItem {
    return {
      position: index + 1,
      entryId: candidate.entryId,
      issueId: candidate.issueId,
    };
  },);

  return {
    seed,
    corpusSha,
    drawDigest: computeDrawDigest({
      seed,
      corpusSha,
      items,
    },),
    items,
  };
}

/**
 * Reads a manifest back, throwing rather than skipping a malformed item.
 *
 * Strict for the reason `artifact-read.ts` is strict: a dropped item shifts
 * every later position silently, which turns a join into a mislabelling rather
 * than a gap anyone would notice.
 *
 * @param value - parsed manifest JSON
 *
 * @returns Manifest as written
 *
 * @throws {@link ArtifactParseError} when any field is malformed
 *
 * @example
 * ```ts
 * const manifest = parseSampleManifest({ value: JSON.parse(text,), },);
 * ```
 */
export function parseSampleManifest(
  { value, }: { readonly value: unknown; },
): SampleManifest {
  /**
   * Manifest as a record.
   */
  const manifest = requireRecord({
    value,
    path: 'manifest',
  },);

  /**
   * Draw seed as written.
   */
  const seed = requireString({
    value: manifest.seed,
    path: 'manifest.seed',
  },);

  /**
   * Corpus commit as written.
   */
  const corpusSha = requireString({
    value: manifest.corpusSha,
    path: 'manifest.corpusSha',
  },);

  /**
   * Items in the order they were written, which is the order they are scored.
   */
  const items = requireArray({
    value: manifest.items,
    path: 'manifest.items',
  },)
    .map(function toItem(
      entry,
      index,
    ): SampleManifestItem {
      /**
       * Item as a record.
       */
      const item = requireRecord({
        value: entry,
        path: `manifest.items[${String(index,)}]`,
      },);

      /**
       * Position as written, before it is checked against where it sits.
       */
      const position = requireCount({
        value: item.position,
        path: `manifest.items[${String(index,)}].position`,
      },);

      // Both scorers read grades off the sheet by ARRAY ORDER and then take
      // the issue id from the item at the same index, so a manifest whose
      // recorded position disagrees with where the item sits describes one
      // join while the code performs another. `requireCount` alone admits
      // zero and admits any ordering, so nothing else here would notice.
      if (position !== (index + 1))
        throw new ArtifactParseError({
          path: `manifest.items[${String(index,)}].position`,
          reason: `${String(index + 1,)}, matching where the item sits, not ${
            String(position,)
          }`,
        },);

      return {
        position,
        entryId: requireString({
          value: item.entryId,
          path: `manifest.items[${String(index,)}].entryId`,
        },),
        issueId: requireString({
          value: item.issueId,
          path: `manifest.items[${String(index,)}].issueId`,
        },),
      };
    },);

  if (manifest.drawDigest === undefined)
    return {
      seed,
      corpusSha,
      items,
    };

  /**
   * Digest as the manifest declares it.
   */
  const declared = requireString({
    value: manifest.drawDigest,
    path: 'manifest.drawDigest',
  },);

  /**
   * Digest these items actually produce.
   */
  const recomputed = computeDrawDigest({
    seed,
    corpusSha,
    items,
  },);

  // Recomputed rather than trusted. A stored digest that is never checked
  // against its own contents proves only that two files carry the same string:
  // edit the items and leave the digest alone, and a sheet carrying the stale
  // digest still matches. The digest has to be a fact about the items.
  if (declared !== recomputed)
    throw new ArtifactParseError({
      path: 'manifest.drawDigest',
      reason: `${recomputed}, the digest of the items recorded beside it, not ${declared}`,
    },);

  return {
    seed,
    corpusSha,
    drawDigest: declared,
    items,
  };
}

//endregion Sample manifest
