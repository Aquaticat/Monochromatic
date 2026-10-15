/** Public failure preserves caught values, including undefined, as separate occurrence records. */
export class ResourceInputCustodyError extends AggregateError{
  constructor({
    message,
    failures
  }){super(
    failures.map(function readFailureValue(value) { return (value.error); }),
    message
  );this.name=this.constructor
    .name;this.failures=Object.freeze([...failures]);}
}
/** Internal propagation alias, never used to deduplicate a newly thrown callback value. */
export class RecordedInputFailure extends Error{
  constructor({
    scope,
    occurrence
  }){super('Resource input failure already recorded');this.scope=scope;this.occurrence=occurrence;}
}
export function failed({
    scope,
    error,
    at
  }){
    const occurrence=Object.freeze({
      identity:Object.freeze({}),
      ordinal:scope.failures
        .length,
      error,
      at
    });scope.failures
      .push(occurrence);
    return new RecordedInputFailure({
      scope,
      occurrence
    });
  }
export function publicFailure(scope){return new ResourceInputCustodyError({
    message:'Native resource reload cannot publish current input observations; inspect retained source and callback failures.',
    failures:scope.failures
  });}
