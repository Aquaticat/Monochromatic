/**
 * Fixture separating a trusted iterator from one this repository declares.
 *
 * Draining an iterator is a call. The accepted trust baseline covers the standard iterator
 * for a value typed as a collection view, recorded in
 * `doc/decision/prefer-readonly-member-channel-authority.md`, and until
 * `effect-iteration-channel.ts` nothing checked that a given iterator was the standard one.
 * Both writing cases below recorded no effect at all, so the parameter was offered read-only
 * while the loop mutated it.
 *
 * @module
 */

/**
 * Row carrying one mutable label.
 */
type IteratedRow = {
  label: string;
};

/**
 * Iterable whose own iterator writes the object it belongs to.
 *
 * The counterexample, produced by an external review of the escape-walk work and then
 * measured. Its `[Symbol.iterator]` is declared here rather than by the default library, so
 * draining it runs repository code that increments `count`.
 */
export class CountingIterable implements Iterable<number> {
  /**
   * Times iteration has started.
   */
  count = 0;

  /**
   * Counts the start and yields one number.
   *
   * @returns iterator over a single number.
   *
   * @example
   * ```ts
   * [...new CountingIterable(),];
   * ```
   */
  [Symbol.iterator](): Iterator<number> {
    this.count += 1;
    return [1,][Symbol.iterator]();
  }
}

/**
 * Iterates a value whose iterator writes it.
 *
 * @param item - Value this drains.
 *
 * @example
 * ```ts
 * iterateCountingValue(new CountingIterable(),);
 * ```
 */
export function iterateCountingValue(item: CountingIterable,): void {
  for (const value of item)
    void value;
}

/**
 * Spreads a value whose iterator writes it.
 *
 * The control proving the question is draining rather than `for...of`: the same member runs,
 * through different syntax and a different branch of the walk.
 *
 * @param item - Value this drains.
 *
 * @example
 * ```ts
 * spreadCountingValue(new CountingIterable(),);
 * ```
 */
export function spreadCountingValue(item: CountingIterable,): void {
  /**
   * Copy built by draining the value.
   */
  const copy = [...item,];
  void copy;
}

/**
 * Iterates a plain array, whose iterator the default library declares.
 *
 * The control that keeps the pair above from charging every iteration in the repository. This
 * drains an iterator too, and it is the trusted one, so it must stay silent.
 *
 * @param rows - Rows this reads.
 *
 * @returns total label length.
 *
 * @example
 * ```ts
 * iterateTrustedRows([],);
 * ```
 */
export function iterateTrustedRows(rows: readonly IteratedRow[],): number {
  /**
   * Running total across rows.
   */
  const measured = { total: 0, };
  for (const row of rows)
    measured.total += row.label
      .length;
  return measured.total;
}
