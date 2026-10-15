import {createInputPool} from './loaded-pool.mjs';
//region Native load boundaries retain their original failure classes and budgets.
/** Native loading and message construction continue independently; capture failures are raised on source use. */
export class SessionInputCaptureError extends AggregateError {
 constructor(error){super(
   [error],
   'Original session inputs exceed the supported source capture profile'
 );this.name=this.constructor
   .name;}
}
/** Keep all existing Session input paths on their original shared four-MiB record budget. */
export function captureLoadedInputs(entries){return createInputPool({
  entries,
  maximumInputs:128,
  maximumSnapshotBytes:4_194_304,
  InputCaptureError:SessionInputCaptureError
});}
/** Native resource registration failures retain exact causes without replacing the native registration result. */
export class ResourceToolInputCaptureError extends AggregateError {
 constructor(error){super(
   [error],
   'Original extension tool inputs exceed the supported resource capture profile'
 );this.name=this.constructor
   .name;}
}
/** Extend resource-owned receipts under the existing one-MiB resource budget, using the same store and publisher. */
export function captureResourceToolInputs(){return createInputPool({
  entries:[],
  maximumInputs:64,
  maximumSnapshotBytes:1_048_576,
  InputCaptureError:ResourceToolInputCaptureError
});}
//endregion
