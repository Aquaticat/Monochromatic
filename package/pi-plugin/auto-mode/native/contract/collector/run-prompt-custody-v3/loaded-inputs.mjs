import {createInputPool} from './loaded-pool.mjs';
import {captureFailureMessage} from '../capture-failure-message.mjs';
//region Native load boundaries retain their original failure classes.
/** Native loading and message construction continue independently; capture failures are raised on source use. */
export class SessionInputCaptureError extends AggregateError {
 constructor(error){super(
   [error],
   'Pi could not retain the complete session inputs. '+captureFailureMessage([error])
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
   'Pi could not retain the complete extension tool inputs. '+captureFailureMessage([error])
 );this.name=this.constructor
   .name;}
}
/** Retain resource-owned receipts using the same store and publisher. */
export function captureResourceToolInputs(){return createInputPool({
  entries:[],
  InputCaptureError:ResourceToolInputCaptureError
});}
//endregion
