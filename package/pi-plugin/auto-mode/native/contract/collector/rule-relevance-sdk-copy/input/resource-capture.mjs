import {SourceCollectionError} from '../../collector.mjs';
import {ResourceInputCustodyError,RecordedInputFailure,failed,publicFailure} from './resource-failures.mjs';
import {snapshotInput} from '../../resource-input-custody/values.ts';
import {phases} from './resource-methods.mjs';
/** Capture ordered synchronous callbacks under the original reload scope. */
export function createResourceCapture(){
function active(record){
    const scope=record.active;
    if(!scope)throw new SourceCollectionError('Resource callback has no active owned native reload');
    if(scope.failures
      .length
      > 0)throw new RecordedInputFailure({
      scope,
      occurrence:scope.failures[0]
    });
    return scope;
  }
function capturePhase({
    record,
    index,
    callback,
    receiver,
    value
  }){
    const scope=active(record);
    const phase=phases[index];
    if((receiver!==record.loader)||scope.busy
      ||(scope.phases
        .length
        !==index))throw failed({
      scope,
      error:new SourceCollectionError('Resource callback does not match its owned native reload phase'),
      at:'callback-entry'
    });
    scope.busy=true;let after;
      let before;
      let result;
    try{
      try{before=snapshotInput({
        kind:phase.kind,
        value
      });}
      catch(error){throw failed({
        scope,
        error,
        at:'input-capture'
      });}
      try{result=callback===undefined?value:Reflect.apply(
        callback,
        receiver,
        [value]
      );}
      catch(error){throw failed({
        scope,
        error,
        at:'configured-callback'
      });}
      // Ordinary Promise output is unsupported, but observe its eventual result before closing the reload.
      if((result instanceof Promise)&&(Object.getPrototypeOf(result)===Promise.prototype)){
        scope.pending
          .push(Promise.allSettled([result]));
        throw failed({
          scope,
          error:new SourceCollectionError('Resource override must return synchronously'),
          at:'callback-result'
        });
      }
      try{after=snapshotInput({
        kind:phase.kind,
        value:result
      });}
      catch(error){throw failed({
        scope,
        error,
        at:'output-capture'
      });}
      if(scope.failures
        .length
        > 0)throw new RecordedInputFailure({
        scope,
        occurrence:scope.failures[0]
      });
      const observation=Object.freeze({
        kind:phase.kind,
        before,
        after,
        transformation:callback===undefined?'identity':'configured-callback'
      });
      scope.phases
        .push(observation);scope.returns
          .push(result);return result;
    }finally{scope.busy=false;}
  }
return {capturePhase};
}
