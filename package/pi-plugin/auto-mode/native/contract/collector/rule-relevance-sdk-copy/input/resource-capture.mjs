import {SourceCollectionError} from '../../collector.mjs';
import {RecordedInputFailure,failed} from './resource-failures.mjs';
import {snapshotInput} from '../../resource-input-custody/values.ts';
import {phases} from './resource-methods.mjs';
/** Capture ordered synchronous callbacks under the original reload scope. */
export function createResourceCapture(){
  function captureValue({scope,kind,value,at}){
    try{return snapshotInput({kind,value});}
    catch(error){throw failed({scope,error,at});}
  }
  function invokeOverride({scope,callback,receiver,value}){
    try{return callback===undefined?value:Reflect.apply(callback,receiver,[value]);}
    catch(error){throw failed({scope,error,at:'configured-callback'});}
  }
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
    scope.busy=true;
    using callbackActivity={ [Symbol.dispose](){scope.busy=false;} };
      const before=captureValue({scope,kind:phase.kind,value,at:'input-capture'});
      const result=invokeOverride({scope,callback,receiver,value});
      // Ordinary Promise output is unsupported, but observe its eventual result before closing the reload.
      const {prototype:ordinaryPromisePrototype}=Promise;
      if((result instanceof Promise)&&(Object.getPrototypeOf(result)===ordinaryPromisePrototype)){
        scope.pending
          .push(Promise.allSettled([result]));
        throw failed({
          scope,
          error:new SourceCollectionError('Resource override must return synchronously'),
          at:'callback-result'
        });
      }
      const after=captureValue({scope,kind:phase.kind,value:result,at:'output-capture'});
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
  }
return {capturePhase};
}
