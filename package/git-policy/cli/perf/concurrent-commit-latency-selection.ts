/**
 Selection of concurrent-commit scenarios for a partial run, such as repeating the reservation sweep.

 @module
 */

/**
 Error raised when a selection names a scenario the matrix lacks.
 */
export class UnknownScenarioError extends Error {
  /**
   Creates the selection failure.

   @param message - unknown identifier and the known ones

   @example
   ```ts
   throw new UnknownScenarioError('unknown scenario disjoint-3');
   ```
   */
  constructor(message: string,) {
    super(message,);
    this.name = 'UnknownScenarioError';
  }
}

/**
 Selects scenarios by identifier, in the order the selection lists them,
 so repeated runs can rotate the order and separate order effects from setting effects.

 @param specs - complete matrix in its own order

 @param selection - comma-separated identifiers; empty selects the complete matrix in matrix order

 @returns scenarios to measure, in measurement order

 @throws {@link UnknownScenarioError} when an identifier names no scenario

 @example
 ```ts
 selectScenarios({ specs, selection: 'reserve-after-8,reserve-after-1' });
 ```
 */
export function selectScenarios<const Spec extends Readonly<{ id: string; }>>({
  specs,
  selection,
}: Readonly<{
  specs: readonly Spec[];
  selection: string;
}>,): readonly Spec[] {
  /**
   Requested identifiers.
   */
  const ids = selection
    .split(',',)
    .map(function trim(entry,) {
      return entry.trim();
    },)
    .filter(function nonEmpty(entry,) {
      return entry !== '';
    },);
  if (ids.length === 0)
    return specs;
  return ids.map(function specFor(id,): Spec {
    /**
     Matching scenario.
     */
    const spec = specs.find(function matches(candidate,) {
      return candidate.id === id;
    },);
    if (spec === undefined) {
      throw new UnknownScenarioError(`Unknown concurrent-commit scenario ${id}; known: ${specs.map(function idOf(candidate,) {
        return candidate.id;
      },)
        .join(', ',)}`,);
    }
    return spec;
  },);
}
