import {captureFailureMessage} from '../capture-failure-message.mjs';
//region Original run failures preserve identity and occurrence order.
export class RunPromptCustodyError extends AggregateError {
  constructor(failures){
    super(
      failures.map(function readRecordedError(item) { return (item.error); }),
      'Pi could not capture the complete prompt inputs or those inputs changed during capture. '
        +'The prompt cannot proceed with incomplete instruction evidence. Recorded causes:\n'
        +captureFailureMessage(failures.map(function readCause(item){return item.error;}))
    );
    this.name=this.constructor
      .name;this.failures=Object.freeze([...failures]);
  }
}
//endregion
