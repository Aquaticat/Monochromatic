import {SourceCollectionError} from '../collector.mjs';
import {isCustomDataInput} from './custom-data-input.mjs';

//region Read and refresh the current run without treating retained ancestry as current.
/** Read and refresh the current run without treating retained ancestry as current. */
export function createRunLifecycle({state,history,known,phase,check,publishScope,reserve,base,fail,reject,assertLive,readConstructedInputs,retainContextInputs,assertSessionInputs,readRoot}){
function publish({
    scope:handle,
    result
  }){
    const scope=known(handle);return phase({
      scope,
      at:'publication',
      run:function publishOriginalRun() {
      check(scope);
      if((state.active!==scope)||(scope.state!=='emitted')
        ||(result!==scope.result)
        ||(result.systemPromptOptions!==scope.delivery))throw new SourceCollectionError('Run publication requires the exact native emitter return');
      return publishScope(scope);
    }
    });
  }
/** Fixed native closure performs its actual normalization and tool-loadout preparation synchronously. */
  function refresh({
    previousOptions,
    compose
  }){
    const parent=state.current;
      const scope=reserve('next-turn-refresh');
    try{return phase({
      scope,
      at:'next-turn-refresh',
      run:function refreshOriginalRun() {
      check(scope);if(parent)check(parent);
      if(previousOptions===undefined?parent!==undefined:(!parent)||(parent.view
        .options
        !==previousOptions))throw new SourceCollectionError('Next-turn refresh requires its actual previous run publication');
      scope.parent=parent;scope.base=base();
      scope.working=compose({
        previous:previousOptions,
        base:scope.base
          .options
      });
      return publishScope(scope);
    }
    });}
    catch(error){throw fail({
      scope:scope.handle,
      error
    });}
  }
function reset(){
    if(state.active)reject({
      scope:state.active,
      message:'Native run reset cannot replace pending preparation',
      at:'reset'
    });
    state.current=undefined;state.absent=true;
  }
function read({options}){
    assertLive();const scope=state.current;
    if(state.active||(!scope)
      ||(scope.state!=='published')
      ||(scope.view
        .options
        !==options))throw new SourceCollectionError('Run prompt is pending, failed, absent or not its canonical publication');
    const constructedInputs=readConstructedInputs?.();
    if((constructedInputs!==scope.constructedInputs)&&(constructedInputs?.length
      ||scope.constructedInputs
      ?.length)){
      const previous=scope.constructedInputs??[];
      const customOnly=constructedInputs!==undefined&&constructedInputs.length>=previous.length
        &&previous.every((origin,index)=>origin===constructedInputs[index])
        &&constructedInputs.slice(previous.length).every(isCustomDataInput);
      // Pending custom data has not changed this run's governing inputs or its serialized request.
      // Its original publication remains available when a real context callback admits the message.
      if(customOnly)scope.constructedInputs=constructedInputs;
      else retainContextInputs([]);
    }
    return phase({
      scope,
      at:'current-read',
      run:function capturePriorRunHistory() {
      check(scope);assertSessionInputs?.();
      if(readRoot){
        const root=readRoot();
        const prior=[];
        for(const original of history){
          if((original===scope)||(original.rootOccurrence!==root))continue;
          if((original.state!=='published')||(!original.node))throw new SourceCollectionError('Original run input history contains an unpublished processing receipt');
          prior.push(original.node);
        }
        if(readRoot()!==root)throw new SourceCollectionError('Native root changed while reading original run input history');
        const previous=scope.view
          .priorRuns;
        if((!previous)||(previous.length!==prior.length)
          ||prior.some(function differsFromPriorOrigin(
          value,
          index
        ) { return (value!==previous[index]); })){
          const view=Object.freeze({
            ...scope.view,
            priorRuns:Object.freeze(prior)
          });
          scope.view=view;
        }
      }
      return scope.view;
    }
    });
  }
/** An absent run is valid only before preparation or after a native reset, never after failure. */
  function readOrAbsent({options}){
    assertLive();
    if(state.absent&&(!state.active)
      &&(!state.current)
      &&(options===undefined))return undefined;
    return read({options});
  }
function inspect(){
    return Object.freeze({
      retainedOnly:true,
      pending:state.active!==undefined,
      currentOrdinal:state.current?.ordinal,
      history:Object.freeze(history.map(function snapshotRunDiagnostics(scope) { return (Object.freeze({
        ordinal:scope.ordinal,
        kind:scope.kind,
        state:scope.state,
        view:scope.view,
        failures:Object.freeze([...scope.failures]),
        slots:Object.freeze(scope.slots
          .map(function snapshotSlotDiagnostics(slot) { return (Object.freeze({
            ordinal:slot.ordinal,
            state:slot.state,
            before:slot.before,
            after:slot.after,
            failures:Object.freeze([...slot.failures])
          })); }))
      })); }))
    });
  }
return {publish,refresh,reset,read,readOrAbsent,inspect};
}
//endregion
