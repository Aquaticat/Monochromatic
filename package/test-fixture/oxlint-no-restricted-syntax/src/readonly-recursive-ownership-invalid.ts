import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

/**
 * Fixture separating a recursive callable a marker feeds from one nothing feeds.
 *
 * `propagateForeignBorrowed` computes a greatest fixed point, and
 * `initializeCandidates` seeds every parameter of any callable holding an inbound. A
 * callable whose inbounds all pass a surviving parameter straight through therefore
 * keeps its candidates whether or not a marker reaches it, and self-recursion is
 * enough to satisfy that on its own.
 *
 * Foreign ownership suppresses the read-only offer, so a spurious candidate reads as
 * a withheld offer rather than as a wrong one. That is the safe direction and still
 * wrong: nothing marks the markerless case, so its parameter is not foreign.
 *
 * @module
 */

/**
 * Mutable value a recursive reader walks without writing.
 */
type Held = {
  label: string;
};

/**
 * Recurses over a value no marker reaches, writing nothing.
 *
 * The only in-scope usage of this callable is its own recursive call, so its single
 * inbound maps parameter zero back to parameter zero and the optimistic seed sustains
 * itself. Nothing here is foreign, so `value` deserves a read-only offer.
 *
 * @param value - Held value read at the base case.
 *
 * @param depth - Remaining recursion depth.
 *
 * @returns held label.
 *
 * @example
 * ```ts
 * markerlessRecursion({ label: 'x', }, 2,);
 * ```
 */
export function markerlessRecursion(
  value: Held,
  depth: number,
): string {
  return (depth <= 0)
    ? value.label
    : markerlessRecursion(
      value,
      depth - 1,
    );
}

/**
 * Recurses over a value every inbound proves foreign.
 *
 * The control. This helper has two inbounds, its own recursive call and
 * `markedRecursionEntry`, which passes a marked parameter. Every inbound is foreign,
 * so the candidate is genuine and must survive any narrowing: losing it is what a
 * plain least fixed point would do, since the self-edge is unsatisfied at the step
 * the parameter would first enter.
 *
 * @param value - Held value reached only from a foreign boundary.
 *
 * @param depth - Remaining recursion depth.
 *
 * @returns held label.
 *
 * @example
 * ```ts
 * markerFedRecursion({ label: 'x', }, 2,);
 * ```
 */
function markerFedRecursion(
  value: Held,
  depth: number,
): string {
  return (depth <= 0)
    ? value.label
    : markerFedRecursion(
      value,
      depth - 1,
    );
}

/**
 * Hands a marked value to the recursive helper.
 *
 * @param marked - Foreign-owned value entering the recursion.
 *
 * @returns held label.
 *
 * @example
 * ```ts
 * markedRecursionEntry(foreign,);
 * ```
 */
export function markedRecursionEntry(marked: ForeignBorrowed<Held>,): string {
  return markerFedRecursion(
    marked,
    2,
  );
}

/**
 * Reads the same value with no recursion at all.
 *
 * The control that makes the other two readable. Identical parameter, identical
 * body at the base case, and no inbound of any kind, so nothing seeds an optimistic
 * candidate and the read-only offer is made. A silent `markerlessRecursion` beside a
 * reported `markerlessPlain` is the whole measurement: the difference between them is
 * the self-edge, not the body.
 *
 * @param value - Held value read once.
 *
 * @returns held label.
 *
 * @example
 * ```ts
 * markerlessPlain({ label: 'x', },);
 * ```
 */
export function markerlessPlain(value: Held,): string {
  return value.label;
}
