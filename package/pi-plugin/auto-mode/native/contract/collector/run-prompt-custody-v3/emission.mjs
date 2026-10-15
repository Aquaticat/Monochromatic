import {SourceCollectionError} from '../collector.mjs';
import {isDeepStrictEqual} from 'node:util';
import {copyPromptOptions,freezePromptOptions} from '../base-prompt-custody-v2/copy.mjs';
import {captureExpandedPromptInput,captureMessageInputs} from './message-inputs.mjs';
import {createExpandedPromptPublication,createHandlerPublication} from './handler-publication.mjs';

//region Observe the original native emitter and ordered handler completion.
/** Observe the original native emitter and ordered handler completion. */
export function createRunEmission({state,reserve,phase,check,base,charge,fail,known,dense,capture,record,issuedErrors}){
function start({
    runner,
    expandedPrompt
  }){
    const scope=reserve('before-agent-start');
    try{return phase({
      scope,
      at:'base-entry',
      run:function captureEmitterSeed() {
      check(scope);scope.base=base();scope.runner=runner;scope.seed=copyPromptOptions(scope.base
        .options);
      if(!runner)throw new SourceCollectionError('Native run requires its actual extension runner');
      if(expandedPrompt!==undefined){
       scope.expandedPromptInput=charge({
         scope,
         value:captureExpandedPromptInput({
           content:expandedPrompt,
           runOccurrence:scope.handle
         })
       });
       scope.expandedPromptPublication=createExpandedPromptPublication(scope.expandedPromptInput);
      }
      return Object.freeze({
        handle:scope.handle,
        seed:scope.seed
      });
    }
    });}
    catch(error){throw fail({
      scope:scope.handle,
      error
    });}
  }
function enterNative({
    scope:handle,
    runner,
    seed,
    working,
    snapshot,
    messages
  }){
    const scope=known(handle);return phase({
      scope,
      at:'native-entry',
      run:function beginOriginalDispatch() {
      check(scope);
      if((state.active!==scope)||(scope.state!=='created')
        ||(runner!==scope.runner)
        ||(seed!==scope.seed)
        ||(working===seed))throw new SourceCollectionError('Native emitter differs from its reserved entry');
      const seedCopy=freezePromptOptions(seed);
      const workingCopy=freezePromptOptions(working);
      if((!isDeepStrictEqual(
        seedCopy,
        scope.base
          .options
      ))||(!isDeepStrictEqual(
        workingCopy,
        seedCopy
      )))throw new SourceCollectionError('Native normalized options differ from their original base seed');
      for(const item of dense({
        value:snapshot,
        maximum:64
      })){
        const path=Object.getOwnPropertyDescriptor(
          item.ext,
          'path'
        );
        if((!path)||(!Object.hasOwn(
          path,
          'value'
        ))
          ||((typeof path.value)!=='string')
          ||(Buffer.byteLength(path.value)>65_536))throw new SourceCollectionError('Native extension snapshot requires a bounded data path');
        for(const handler of dense({
          value:item.handlers,
          maximum:256
        })){
          if(((typeof handler)!=='function')||(scope.slots
            .length
            >=256))throw new SourceCollectionError('Native handler membership exceeds its declared profile');
          scope.slots
            .push({
              ordinal:scope.slots
                .length,
              extension:item.ext,
              handler,
              path:path.value,
              state:'unentered',
              failures:[]
            });
        }
      }
      if(dense({
        value:messages,
        maximum:64
      })
        .length
        > 0)throw new SourceCollectionError('Native run messages must begin with their empty owned accumulator');
      scope.initial=capture({
        scope,
        options:working,
        messages
      });scope.working=working;scope.messages=messages;scope.state='dispatching';
    }
    });
  }
/** Preserve native handler/result processing and native reporting as separate failure occurrences. */
  async function invokeHandler({
    scope:handle,
    runner,
    extension,
    handler,
    messages,
    invoke,
    reportError,
    outputObserver
  }){
    const scope=known(handle);
    const slot=phase({
      scope,
      at:'handler-entry',
      run:function enterOriginalHandler() {
      check(scope);const item=scope.slots[scope.next];
      if((state.active!==scope)||(scope.state!=='dispatching')
        ||scope.running
        ||(runner!==scope.runner)
        ||(messages!==scope.messages)
        ||(!item)
        ||(item.extension!==extension)
        ||(item.handler!==handler)
        ||((typeof invoke)!=='function')
        ||((typeof reportError)!=='function'))throw new SourceCollectionError('Native handler does not match its original ordered slot');
      item.before=capture({
        scope,
        options:scope.working,
        messages
      });item.state='running';scope.running=item;return item;
    }
    });
    try{await invoke();slot.state='returned';}
    catch(error){
      const observationFailure=outputObserver?.failureFor(error);
      if(observationFailure){
        slot.state='failed';scope.running=undefined;
        record({
          scope,
          error:observationFailure.error,
          at:'handler-output-observation'
        });
        // The owned wrapper is a propagation alias; the native session rethrows its exact original value.
        issuedErrors.set(
          error,
          scope
        );throw error;
      }
      slot.state='failed';slot.failures
        .push(Object.freeze({
          identity:Object.freeze({}),
          error,
          at:'handler-processing'
        }));
      try{reportError(error);}
      catch(error){
        slot.failures
          .push(Object.freeze({
            identity:Object.freeze({}),
            error,
            at:'error-report'
          }));
        record({
          scope,
          error,
          at:'native-error-report'
        });
      }
    }
    // Capture settled handler state even if disposal or a concurrent refused entry invalidated release.
    try{slot.after=capture({
      scope,
      options:scope.working,
      messages
    });}
    catch(error){record({
      scope,
      error,
      at:'handler-after'
    });}
    scope.running=undefined;scope.next++;
    return phase({
      scope,
      at:'handler-completion',
      run:function checkAfterHandler() { check(scope); }
    });
  }
function leaveNative({
    scope:handle,
    runner,
    working,
    messages
  }){
    const scope=known(handle);return phase({
      scope,
      at:'native-return',
      run:function completeOriginalDispatch() {
      check(scope);
      if((state.active!==scope)||(scope.state!=='dispatching')
        ||(runner!==scope.runner)
        ||(working!==scope.working)
        ||(messages!==scope.messages)
        ||scope.running
        ||(scope.next
          !==scope.slots
          .length))throw new SourceCollectionError('Native emitter returned without its exact complete traversal');
      scope.emitted=capture({
        scope,
        options:working,
        messages
      });
      scope.handlerMessageInputs=captureMessageInputs({
        messages:scope.emitted
          .messages,
        runOccurrence:scope.handle
      });
      scope.handlerPublications=Object.freeze(scope.handlerMessageInputs
        .map(function captureHandlerPublication(
          source,
          ordinal
        ) { return (createHandlerPublication({
          source,
          input:scope.emitted
            .messages[ordinal]
        })); }));
      // The native session receives its own mutable reconciliation copy before any subsequent await.
      scope.delivery=copyPromptOptions(working);
      scope.result=Object.freeze({
        systemPromptOptions:scope.delivery,
        messages:scope.emitted
          .messages
      });scope.state='emitted';return scope.result;
    }
    });
  }
return {start,enterNative,invokeHandler,leaveNative};
}
//endregion
