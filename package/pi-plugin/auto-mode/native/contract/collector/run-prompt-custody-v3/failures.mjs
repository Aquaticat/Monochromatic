//region Original run failures preserve identity and occurrence order.
export class RunPromptCustodyError extends AggregateError {
  constructor(failures){
    super(
      failures.map(function readRecordedError(item) { return (item.error); }),
      'Native run prompt derivation is incomplete or no longer current. Inspect its recorded source, handler, publication or session failure before using it.'
    );
    this.name=this.constructor
      .name;this.failures=Object.freeze([...failures]);
  }
}
//endregion
