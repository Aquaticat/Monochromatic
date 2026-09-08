import type { FootnoteRelabel, } from './archive-footnote-relabel.ts';
import { scanGfmReferenceLiterals, } from './footnote-graph.ts';

//region Archive footnote relabel closure
// A RELABEL MUST BE CLOSED OVER THE ARCHIVE'S LABELS. The fourth
// `yuki418330012` launch of 2026-09-08 read one definition pair off the roster
// (the other never reached agreement), mapped `[^2]` to `[^1]` alone, and the
// archive came out with two `[^1]` notes: the map said nothing about the
// archive's own `[^1]`, which the rewrite then collided with. A map whose
// target label the archive already carries must also move that label away,
// or it is not a relabel but a merge.
//
// COMPLETED BY ELIMINATION where that is forced: when exactly one label is
// left unmapped on each side, the two are each other's, since both documents
// reference the same notes. Anything less forced leaves the archive standing,
// named.

/**
 * Whether the map closes, and the map when it does.
 *
 * @example
 * ```ts
 * const closure: RelabelClosure = closeFootnoteRelabel({ map, archiveLabels, originalLabels, },);
 * ```
 */
export type RelabelClosure = {
  /**
   * Every target label the archive carries is itself moved away.
   */
  readonly kind: 'closed';

  /**
   * The map, with any pair completed by elimination added.
   */
  readonly map: readonly FootnoteRelabel[];
} | {
  /**
   * The map would collide with a label the archive carries and does not move.
   */
  readonly kind: 'open';

  /**
   * Which labels, and why the map could not be completed.
   */
  readonly detail: string;
};

/**
 * Distinct labels a text carries, references and definition openers alike,
 * in order of first appearance.
 *
 * @param text - document to read
 *
 * @returns Labels, each once
 *
 * @example
 * ```ts
 * documentLabels({ text: 'A[^2].\n\n[^1]: one\n\n[^2]: two\n', },);
 * // => ['2', '1']
 * ```
 */
export function documentLabels(
  { text, }: { readonly text: string; },
): readonly string[] {
  return [
    ...new Set(
      scanGfmReferenceLiterals({ slice: text, },)
        .map(function toIdentifier(hit,): string {
          return hit.identifier;
        },),
    ),
  ];
}

/**
 * Closes a relabel over the archive's labels: completes the one pair
 * elimination forces, then refuses any map whose target label the archive
 * carries and does not move.
 *
 * @param map - relabel read off the evidence
 *
 * @param archiveLabels - every label the archive carries
 *
 * @param originalLabels - every label the original carries
 *
 * @returns The closed map, or why the archive stands
 *
 * @example
 * ```ts
 * closeFootnoteRelabel({ map: [ { from: '2', to: '1', }, ], archiveLabels: [ '1', '2', ], originalLabels: [ '2', '1', ], },);
 * // => { kind: 'closed', map: [ { from: '2', to: '1', }, { from: '1', to: '2', }, ], }
 * ```
 */
export function closeFootnoteRelabel(
  {
    map,
    archiveLabels,
    originalLabels,
  }: {
    readonly map: readonly FootnoteRelabel[];
    readonly archiveLabels: readonly string[];
    readonly originalLabels: readonly string[];
  },
): RelabelClosure {
  /**
   * Archive labels the map moves.
   */
  const moved = new Set(map.map(function toFrom(relabel,): string {
    return relabel.from;
  },),);
  /**
   * Original labels the map lands on.
   */
  const landed = new Set(map.map(function toTo(relabel,): string {
    return relabel.to;
  },),);
  /**
   * Archive labels the map says nothing about.
   */
  const archiveLeft = archiveLabels.filter(function isUnmoved(label,): boolean {
    return !moved.has(label,);
  },);
  /**
   * Original labels nothing lands on.
   */
  const originalLeft = originalLabels.filter(function isUnlanded(label,): boolean {
    return !landed.has(label,);
  },);
  /**
   * The archive label elimination would force, when one is left.
   */
  const [archiveOnly,] = archiveLeft;
  /**
   * The original label elimination would force, when one is left.
   */
  const [originalOnly,] = originalLeft;
  /**
   * Whether elimination forces one pair that is not the identity.
   */
  const forced = (archiveLeft.length === 1)
    && (originalLeft.length === 1)
    && (archiveOnly !== undefined)
    && (originalOnly !== undefined)
    && (archiveOnly !== originalOnly);
  /**
   * Map with that pair added where forced.
   */
  const completed = (forced
    && (archiveOnly !== undefined)
    && (originalOnly !== undefined))
    ? [
      ...map,
      {
        from: archiveOnly,
        to: originalOnly,
      },
    ]
    : map;
  /**
   * Archive labels the completed map moves.
   */
  const movedNow = new Set(completed.map(function toFrom(relabel,): string {
    return relabel.from;
  },),);
  /**
   * Target labels the archive carries and the map does not move away.
   */
  const collisions = completed
    .map(function toTo(relabel,): string {
      return relabel.to;
    },)
    .filter(function collides(label,): boolean {
      return (archiveLabels.includes(label,)) && (!movedNow.has(label,));
    },);
  /**
   * The collisions, spelled.
   */
  const spelled = collisions
    .map(function spell(label,): string {
      return `[^${label}]`;
    },)
    .join(', ',);
  if (collisions.length > 0)
    return {
      kind: 'open',
      detail: `the map lands on ${spelled} which the archive carries and the map does not move (${
        String(archiveLeft.length,)
      } archive labels and ${String(originalLeft.length,)} original labels unaccounted for)`,
    };
  return {
    kind: 'closed',
    map: completed,
  };
}

//endregion Archive footnote relabel closure
