import {SourceCollectionError} from '../collector.mjs';
import {readOriginalMessagePublication,observeMessageCopies} from './handler-publication.mjs';

//region Keep native message copies attached to their original run publications.
/** Keep native message copies attached to their original run publications. */
export function createRunContext({state,phase,check,known,assertLive,assertSessionInputs,readRoot,readConstructedInputs,readHandlerOptionOrigins,originalMessageInput,assertRetainedInput,retainAppendedInput,retainSelectedPath}){
/** Resolve retained native context inputs through existing run scopes, never through text or saved IDs. */
  function retainContextInputs(messages){
    const scope=state.current;
    if((!scope)||state.active
      ||state.operating
      ||(scope.state!=='published'))throw new SourceCollectionError('Retained inputs require the current published native run');
    return phase({
      scope,
      at:'retained-context-inputs',
      run:function captureRetainedMessageOrigins() {
      check(scope);assertSessionInputs?.();
      const activeOccurrences=new Set([
        scope.handle,
        ...scope.view
          .ancestors
          .map(function readAncestorOccurrence(value) { return (value.occurrence); })
      ]);
      const seen=new Set();
        const origins=[];
        const previous=scope.view
          .retainedMessageOrigins
          ??[];
      function append(origin){
        if((!origin)||activeOccurrences.has(origin.runOccurrence)
          ||seen.has(origin.source
            .occurrence))return;
        seen.add(origin.source
          .occurrence);origins.push(origin);
      }
      for(const origin of previous){assertRetainedInput(origin);append(origin);}
      if(readRoot)for(const origin of readHandlerOptionOrigins()){assertRetainedInput(origin);append(origin);}
      const constructedInputs=readConstructedInputs?.();
      for(const origin of constructedInputs??[]){assertRetainedInput(origin);append(origin);}
      for(const message of messages)append(
        originalMessageInput(readOriginalMessagePublication(message)),
      );
      // Re-read the native root at use; historical source identities are not a cached currentness result.
      if(state.selectedPathInputs&&(state.selectedPathInputs.rootOccurrence===readRoot())){
        if(state.selectedPathInputs.failure)throw state.selectedPathInputs.failure;
        for(const origin of state.selectedPathInputs.origins){assertRetainedInput(origin);append(origin);}
      }
      if(scope.view
        .retainedMessageOrigins
        &&(origins.length===previous.length)
        &&origins.every(function matchesPreviousOrigin(
          origin,
          index
        ) { return (origin===previous[index]); })){check(scope);scope.constructedInputs=constructedInputs;return;}
      const retainedMessageOrigins=Object.freeze(origins);
      const view=Object.freeze({
        ...scope.view,
        retainedMessageOrigins
      });
      check(scope);scope.view=view;scope.constructedInputs=constructedInputs;
    }
    });
  }
/** Actual native copy, entry-creation and projection sites propagate existing capabilities only. */
  function captureContextClone(value){
    if(value.kind==='selected-path'){retainSelectedPath(value);return;}
    if(value.kind==='appended-entry'){retainAppendedInput(value);return;}
    if(value.kind==='completed-context'){
      assertLive();
      if(value.contextRun!==state.current?.handle)throw new SourceCollectionError('Native context completion requires its original published run');
      if(state.current){
        const completion=value.contextObservation;
        if((!completion)||(!Object.isFrozen(completion))
          ||(!Object.isFrozen(completion.kinds))
          ||(completion.kinds
            .length
            !==2)
          ||(completion.kinds[0]!=='context')
          ||(completion.kinds[1]!=='context_with_system'))
          throw new SourceCollectionError('Native context completion requires both original observed handler traversals');
        retainContextInputs(value.messages);
        state.current.view=Object.freeze({
          ...state.current.view,
          contextHandlerReceipt:Object.freeze({
          runOccurrence:state.current.handle,
          observation:completion
        })
        });
      }
      return;
    }
    observeMessageCopies(value);
    if((value.kind==='handler-entry')||(value.kind==='projection'))return;
    // Known message copies outlive active-run preparation; system publication still requires its current run.
    state.current?.captureContextClone?.(value);
    if((value.kind==='request-context')&&state.current){const {handle} = state.current;retainContextInputs(value.before);return handle;}
  }
/** Bind the actual native user construction to this original expanded-text handoff. */
  function captureExpandedPromptMessage({
    scope:handle,
    expandedPrompt,
    message
  }){
    const scope=known(handle);
    if((state.active!==scope)||(scope.state!=='emitted')
      ||(!scope.expandedPromptInput)
      ||(scope.expandedPromptInput
        .content
        !==expandedPrompt))throw new SourceCollectionError('Expanded prompt message requires its original active native handoff');
    return phase({
      scope,
      at:'expanded-prompt-publication',
      run:function captureExpandedPrompt() {check(scope);scope.expandedPromptPublication
        .capture(message);check(scope);}
    });
  }
/** Bind the actual custom object constructed from an original emitter-result member. */
  function captureHandlerMessage({
    result,
    input,
    message
  }){
    const scope=state.active;
    const ordinal=scope?.emitted
      ?.messages
      .indexOf(input);
    if((!scope)||(scope.state!=='emitted')
      ||(scope.result!==result)
      ||(ordinal===undefined)
      ||(ordinal<0))throw new SourceCollectionError('Handler message requires its original native emitter member');
    return phase({
      scope,
      at:'handler-message-publication',
      run:function captureHandlerMessageCallback() {check(scope);scope.handlerPublications[ordinal]
        .capture(message);check(scope);}
    });
  }
/** Capture the fixed native forced projection without changing its message or tool declarations. */
  function captureForcedMessage({
    options,
    message
  }){
    const scope=state.current;
    if((!scope)||(scope.view
      .options
      !==options)
      ||(!scope.forcedPublication))throw new SourceCollectionError('Forced projection requires its original current run publication');
    return phase({
      scope,
      at:'forced-message-publication',
      run:function captureForcedMessageCallback() {check(scope);scope.forcedPublication
        .capture(message);check(scope);}
    });
  }
return {retainContextInputs,captureContextClone,captureExpandedPromptMessage,captureHandlerMessage,captureForcedMessage};
}
//endregion
