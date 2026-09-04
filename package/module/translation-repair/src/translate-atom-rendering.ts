import type { ProtectedAtom, } from './protected-atom.ts';
import {
  describeAtom,
  mergeAtoms,
} from './translate-atom-floor.ts';

//region Rewritten renderings
// WHERE THE PAGE RENDERS A REFERENCE ANOTHER WAY, a candidate owes one
// rendering, not both. Decided by the owner on 2026-09-04 ("Either
// rendering") after the luxuanwen3 pass of that day stopped at its first
// paragraph: the original links twitter.com, the archive's page links x.com,
// and the per-key maximum of `mergeAtoms` owed a candidate both, so the
// archive's own paragraph was ineligible and no proposal could pass. Measured
// over the pinned corpus: eight of ninety-three entries carry a link the
// archive rewrote (a moved domain, a trailing slash, a same-language
// Wikipedia article); footnotes never diverge both ways.
//
// A REWRITE IS READ OFF THE SET DIFFERENCE, per atom kind: atoms only the
// original carries and atoms only the page carries, of the same kind, form
// one pool, and the candidate owes exactly the larger side's count from it.
// That is the block rule's arithmetic (the page is a floor, the original
// sets the ceiling with it) applied to references. A kind that diverges in
// one direction only is an addition or a drop and stays owed as before;
// carrying both renderings is refused, since a link the original carries
// once and the page carries once is one link on the page.

/**
 * Atoms of one kind the original and the page render differently.
 */
export type AtomRenderingPool = {
  /**
   * Atom kind every member shares.
   */
  readonly kind: ProtectedAtom['kind'];

  /**
   * Keys only the original carries, repeated per copy.
   */
  readonly fromSource: readonly string[];

  /**
   * Keys only the page carries, repeated per copy.
   */
  readonly fromPage: readonly string[];

  /**
   * Copies a candidate must draw from the pool, the larger side's count.
   */
  readonly owed: number;
};

/**
 * One atom by kind and exact key.
 */
type KeyedAtom = {
  /**
   * Atom kind.
   */
  readonly kind: ProtectedAtom['kind'];

  /**
   * Exact key from {@link describeAtom}.
   */
  readonly key: string;
};

/**
 * Keys one side carries and the other does not, keeping copies.
 *
 * @param atoms - atoms of the side being read
 *
 * @param other - atoms of the side compared against
 *
 * @returns Keys absent from the other side, one per copy
 *
 * @example
 * ```ts
 * const onlyHere = keysAbsentFrom({ atoms: source, other: page, },);
 * ```
 */
function keysAbsentFrom(
  {
    atoms,
    other,
  }: {
    readonly atoms: readonly ProtectedAtom[];
    readonly other: readonly ProtectedAtom[];
  },
): readonly KeyedAtom[] {
  /**
   * Keys the other side carries at all.
   */
  const otherKeys = new Set(other.map(function toKey(atom,): string {
    return describeAtom(atom,);
  },),);
  return atoms
    .map(function toKeyed(atom,): KeyedAtom {
      return {
        kind: atom.kind,
        key: describeAtom(atom,),
      };
    },)
    .filter(function isAbsent(keyed,): boolean {
      return !otherKeys.has(keyed.key,);
    },);
}

/**
 * Pools of atoms the original and the page render differently, one per
 * kind that diverges in both directions.
 *
 * @param page - atoms the text being replaced carries
 *
 * @param source - atoms the original carries
 *
 * @returns One pool per kind with members on both sides, in kind order of
 * first appearance in the original
 *
 * @example
 * ```ts
 * const pools = renderingPoolsOf({ page: page.atoms, source: expected.atoms, },);
 * ```
 */
export function renderingPoolsOf(
  {
    page,
    source,
  }: {
    readonly page: readonly ProtectedAtom[];
    readonly source: readonly ProtectedAtom[];
  },
): readonly AtomRenderingPool[] {
  /**
   * Original's members the page lacks.
   */
  const sourceOnly = keysAbsentFrom({
    atoms: source,
    other: page,
  },);
  /**
   * Page's members the original lacks.
   */
  const pageOnly = keysAbsentFrom({
    atoms: page,
    other: source,
  },);
  /**
   * Kinds that diverge in both directions, in original order.
   */
  const kinds = [...new Set(sourceOnly.map(function toKind(keyed,): ProtectedAtom['kind'] {
    return keyed.kind;
  },),),].filter(function divergesBothWays(kind,): boolean {
    return pageOnly.some(function isKind(keyed,): boolean {
      return keyed.kind === kind;
    },);
  },);
  return kinds.map(function toPool(kind,): AtomRenderingPool {
    /**
     * Original's keys of this kind.
     */
    const fromSource = sourceOnly
      .filter(function isKind(keyed,): boolean {
        return keyed.kind === kind;
      },)
      .map(function toKey(keyed,): string {
        return keyed.key;
      },);
    /**
     * Page's keys of this kind.
     */
    const fromPage = pageOnly
      .filter(function isKind(keyed,): boolean {
        return keyed.kind === kind;
      },)
      .map(function toKey(keyed,): string {
        return keyed.key;
      },);
    return {
      kind,
      fromSource,
      fromPage,
      owed: Math.max(
        fromSource.length,
        fromPage.length,
      ),
    };
  },);
}

/**
 * Findings for atoms the candidate owes and did not carry, invented, or
 * drew from a rendering pool in the wrong number.
 *
 * Compared as a MULTISET rather than in order, because a translation
 * reorders clauses legitimately and a link moving within a sentence is not
 * damage. What is damage is a reference that stopped existing, one that
 * appeared from nowhere, or both renderings of one reference side by side.
 *
 * @param page - atoms the text being replaced carries
 *
 * @param source - atoms the original carries
 *
 * @param candidate - atoms the candidate carries
 *
 * @param referenceName - what a finding calls the merged reference
 *
 * @returns One finding per missing or invented atom, and one per pool drawn
 * from in the wrong number
 *
 * @example
 * ```ts
 * const findings = atomFindings({ page, source, candidate, referenceName: 'ORIGINAL', },);
 * ```
 */
export function atomFindings(
  {
    page,
    source,
    candidate,
    referenceName,
  }: {
    readonly page: readonly ProtectedAtom[];
    readonly source: readonly ProtectedAtom[];
    readonly candidate: readonly ProtectedAtom[];
    readonly referenceName: string;
  },
): readonly string[] {
  /**
   * Pools of renderings the two references disagree on.
   */
  const pools = renderingPoolsOf({
    page,
    source,
  },);
  /**
   * Pool each pooled key belongs to.
   */
  const poolOfKey = new Map<string, AtomRenderingPool>(
    pools.flatMap(function toEntries(pool,): readonly (readonly [
      string,
      AtomRenderingPool,
    ])[] {
      return [
        ...pool.fromSource,
        ...pool.fromPage,
      ].map(function toEntry(key,): readonly [
        string,
        AtomRenderingPool,
      ] {
        return [
          key,
          pool,
        ];
      },);
    },),
  );
  /**
   * How many times the candidate carries each atom.
   */
  const remaining = new Map<string, number>();
  for (const atom of candidate) {
    /**
     * Key identifying this atom exactly.
     */
    const key = describeAtom(atom,);
    remaining.set(
      key,
      (remaining.get(key,) ?? 0) + 1,
    );
  }
  /**
   * Copies the candidate drew from each pool.
   */
  const drawn = new Map<AtomRenderingPool, number>();
  /**
   * Atoms the references have that the candidate did not carry through.
   */
  const missing: string[] = [];
  for (const atom of mergeAtoms({
    page,
    source,
  },)) {
    /**
     * Key identifying this atom exactly.
     */
    const key = describeAtom(atom,);
    /**
     * Copies still unaccounted for on the candidate side.
     */
    const left = remaining.get(key,) ?? 0;
    /**
     * Pool this key belongs to, when the references disagree on it.
     */
    const pool = poolOfKey.get(key,);
    if (left === 0) {
      if (pool === undefined)
        missing.push(`The ${referenceName} carries ${key} and your translation does not.`,);
      continue;
    }
    remaining.set(
      key,
      left - 1,
    );
    if (pool !== undefined)
      drawn.set(
        pool,
        (drawn.get(pool,) ?? 0) + 1,
      );
  }
  /**
   * Pools drawn from in the wrong number.
   */
  const misdrawn = pools
    .filter(function isMisdrawn(pool,): boolean {
      return (drawn.get(pool,) ?? 0) !== pool.owed;
    },)
    .map(function toFinding(pool,): string {
      /**
       * Original's renderings, listed.
       */
      const fromSource = pool.fromSource
        .join(', ',);
      /**
       * Page's renderings, listed.
       */
      const fromPage = pool.fromPage
        .join(', ',);
      return `The ORIGINAL carries ${fromSource} where the PAGE AS IT STANDS carries ${fromPage}: the page rendered the original's reference another way, and your translation must carry exactly ${
        String(pool.owed,)
      } of these, taken from either side; it carries ${String(drawn.get(pool,) ?? 0,)}.`;
    },);
  return [
    ...missing,
    ...misdrawn,
    ...[...remaining.entries(),]
      .filter(function isSurplus([, count,],): boolean {
        return count > 0;
      },)
      .map(function toFinding([key, count,],): string {
        return `Your translation carries ${key}${
          count === 1 ? '' : ` ${String(count,)} times`
        } and the ${referenceName} does not.`;
      },),
  ];
}

//endregion Rewritten renderings
