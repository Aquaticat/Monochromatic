import {createInputPool} from './loaded-pool.mjs';
//region Native load boundaries retain their original failure classes.
/** Native loading and message construction continue independently; capture failures are raised on source use. */
export class SessionInputCaptureError extends AggregateError {
 constructor(error){super(
   [error],
   'Original session inputs exceed the supported source capture profile'
 );this.name=this.constructor
   .name;}
}
/** Keep Session receipt accounting without an arbitrary capacity ceiling. */
export function captureLoadedInputs(entries){return createInputPool({
  entries,
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
/** Retain resource-owned receipts using the same store and publisher. */
export function captureResourceToolInputs(){return createInputPool({
  entries:[],
  InputCaptureError:ResourceToolInputCaptureError
});}
//endregion
