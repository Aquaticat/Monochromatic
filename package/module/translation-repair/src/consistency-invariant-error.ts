//region Consistency invariant
// A state the page-level consistency pass's own construction rules out, met
// anyway.
//
// UNMARKED ON PURPOSE, as `RenderingAuditInvariantError` is: each site writes
// its sentence from indexes, counts and vocabulary words and never from page
// text, but the inventory in `message-names-only.unit.test.ts` reserves the
// marker for classes whose sentence a boundary has to print. The pass contains
// this error (a run always ships) and records `refused by
// ConsistencyInvariantError`; the sentence itself reaches the run's log through
// the caught value and the stack.

/**
 An invariant of the consistency pass that did not hold.

 Unreachable by construction; reaching it means the code above the site
 changed and the site's assumption did not.

 @example
 ```ts
 throw new ConsistencyInvariantError({
   invariant: 'a repeat group lists no place, and the detector reports a repeat only where it stands in two',
 },);
 ```
 */
export class ConsistencyInvariantError extends Error {
  /**
   @param invariant - what was supposed to hold, in the site's own words,
   naming indexes and vocabulary words and never text
   */
  constructor(
    { invariant, }: { readonly invariant: string; },
  ) {
    super(`unreachable: ${invariant}`,);
    this.name = 'ConsistencyInvariantError';
  }
}

//endregion Consistency invariant
