import {SourceCollectionError} from '../collector.mjs';
import {readOriginalMessagePublication} from './handler-publication.mjs';

//region Resolve original input identities and retain selected native path membership.
/** Resolve original input identities and retain selected native path membership. */
export function createRunRetainedInputs({state,scopes,history,assertLive,readRoot,readSessionInput}){
/** Read original handler input references from this owner's existing history, scoped to the current native root. */
  function readHandlerOptionOrigins(){
    assertLive();
    if((typeof readRoot)!=='function')throw new SourceCollectionError('Handler input history requires the original native root reader');
    const root=readRoot();
      const origins=[];
    for(const scope of history){
      if(scope.rootOccurrence!==root)continue;
      if(scope.slots
        .some(function hasObservedInput(slot) { return (slot.before!==undefined); })
        &&(scope.handlerOptionOrigins===undefined))throw new SourceCollectionError('Original callback input history has no completed source publication');
      for(const origin of scope.handlerOptionOrigins??[]){
        if(origins.length>=128)throw new SourceCollectionError('Original callback input history exceeds the 128-source profile');
        origins.push(origin);
      }
    }
    if(readRoot()!==root)throw new SourceCollectionError('Native root changed while reading original callback input history');
    if((origins.length!==state.handlerInputView.length)||origins.some(function differsFromRetainedHandlerInput(
      origin,
      index
    ) { return (origin!==state.handlerInputView[index]); }))state.handlerInputView=Object.freeze(origins);
    return state.handlerInputView;
  }
/** Preserve native manager handoff ordering while adding stable original run-input references, not copied content. */
  function readInputOrigins(managerInputs){
    const handlerInputs=readHandlerOptionOrigins();
    if(handlerInputs.length===0)return managerInputs;
    if((state.combinedInputView?.managerInputs===managerInputs)&&(state.combinedInputView.handlerInputs===handlerInputs))return state.combinedInputView.value;
    const value=Object.freeze([
      ...handlerInputs,
      ...managerInputs
    ]);
    if(value.length>128)throw new SourceCollectionError('Combined original callback and manager inputs exceed the 128-source profile');
    state.combinedInputView={
      managerInputs,
      handlerInputs,
      value
    };return value;
  }
/** Original handler sources join the same Session count and serialized-record budget as manager receipts. */
  function readInputUsage(managerUsage){
    const origins=readHandlerOptionOrigins();
    return Object.freeze({
      count:managerUsage.count+origins.length,
      bytes:managerUsage.bytes+origins.reduce(
        function sumSourceBytes(
          bytes,
          origin
        ) { return (bytes+Buffer.byteLength(JSON.stringify(origin.source))); },
        0
      )
    });
  }
/** Resolve historical input identity through the original scope, not a copied source record. */
  function originalMessageInput(publication){
    if(publication?.sessionInputOccurrence!==undefined)return readSessionInput?.(publication);
    const original=scopes.get(publication?.runOccurrence);
    if((!original?.node)||(original.state!=='published'))return undefined;
    const expanded=original.expandedPromptPublication
      ?.view
      ===publication;
    const ordinal=original.handlerPublications
      ?.findIndex(function matchesPublicationView(value) { return (value.view===publication); })
      ??(-1);
    const option=original.handlerOptionOrigins
      ?.find(function matchesOriginPublication(origin) { return (origin.publication===publication); });
    if(option)return readRoot&&(original.rootOccurrence===readRoot())?option:undefined;
    const source=expanded?original.expandedPromptInput:original.handlerMessageInputs?.[ordinal];
    if((!source)||(source.occurrence!==publication.sourceOccurrence))return undefined;
    return Object.freeze({
      source,
      publication,
      runOccurrence:original.handle
    });
  }
/** Authenticate immutable historical membership, not current run success or current payload contents. */
  function assertRetainedInput(origin){
    const {
      source,
      publication,
      runOccurrence,
      sessionInputOccurrence
    }=origin;
    if(sessionInputOccurrence!==undefined){
      if((readSessionInput?.(publication)!==origin)||(source.sessionInputOccurrence!==sessionInputOccurrence)
        ||(publication.sessionInputOccurrence!==sessionInputOccurrence)
        ||(publication.sourceOccurrence!==source.occurrence))throw new SourceCollectionError('Selected session input is not this original manager input occurrence');
      return;
    }
    const original=scopes.get(runOccurrence)
      ?.node;
    const expanded=(original?.expandedPromptInput===source)&&(original?.expandedPromptPublication===publication);
    const ordinal=original?.handlerMessageInputs
      .indexOf(source)
      ??(-1);
    const handler=(ordinal>=0)&&(original.handlerPublications[ordinal]===publication);
    const option=original?.handlerOptionInputs
      ?.includes(source)
      &&original.handlerOptionPublications
      ?.includes(publication);
    if(option&&((!readRoot)||(scopes.get(runOccurrence)
      .rootOccurrence
      !==readRoot())))throw new SourceCollectionError('Original callback input belongs to another native root');
    if((!original)||((!expanded)
      &&(!handler)
      &&(!option))
      ||(source.runOccurrence!==runOccurrence)
      ||(publication.runOccurrence!==runOccurrence)
      ||(publication.sourceOccurrence!==source.occurrence))throw new SourceCollectionError('Selected-path input differs from its original source and run publication');
  }
/** The actual native leaf assignment proves membership of an appended input without another path walk. */
  function retainAppendedInput({
    rootOccurrence,
    entry
  }){
    if((!readRoot)||(rootOccurrence!==readRoot()))return;
    const previous=state.selectedPathInputs?.rootOccurrence===rootOccurrence?state.selectedPathInputs:undefined;
    if(previous?.failure)return;
    const publication=readOriginalMessagePublication(entry)??readOriginalMessagePublication(entry.type==='message'?entry.message:entry);
    const origin=originalMessageInput(publication);
    const origins=previous?.origins??[];
    if((!origin)||origins.some(function matchesSourceOccurrence(value) { return (value.source
      .occurrence
      ===origin.source
      .occurrence); }))return;
    const next=origins.length>=128
      ?Object.freeze({
        rootOccurrence,
        origins,
        failure:new SourceCollectionError('Retained native message sources exceed the original 128-source profile')
      })
      :Object.freeze({
        rootOccurrence,
        origins:Object.freeze([
          ...origins,
          origin
        ])
      });
    if(rootOccurrence===readRoot())state.selectedPathInputs=next;
  }
/** Keep only existing source capabilities from the actual native path walk, not the path or its message data. */
  function retainSelectedPath({
    rootOccurrence,
    entries
  }){
    if((!readRoot)||(rootOccurrence!==readRoot()))return;
    if((state.selectedPathInputs?.rootOccurrence===rootOccurrence)&&state.selectedPathInputs.failure)return;
    const seen=new Set();
    const origins=[];
    for(const entry of entries){
      const publication=readOriginalMessagePublication(entry)??readOriginalMessagePublication(entry.type==='message'?entry.message:entry);
      const companion=entry.type==='compaction'?Object.getOwnPropertyDescriptor(
        entry,
        'systemMessage'
      )
        ?.value:undefined;
      for(const original of [
        publication,
        readOriginalMessagePublication(companion)
      ]){
        const origin=originalMessageInput(original);
        if((!origin)||seen.has(origin.source
          .occurrence))continue;
        if(origins.length>=128)throw new SourceCollectionError('Retained native message sources exceed the original 128-source profile');
        seen.add(origin.source
          .occurrence);origins.push(origin);
      }
    }
    if(rootOccurrence!==readRoot())throw new SourceCollectionError('Native selected path changed during source observation');
    state.selectedPathInputs=Object.freeze({
      rootOccurrence,
      origins:Object.freeze(origins)
    });
  }
return {readHandlerOptionOrigins,readInputOrigins,readInputUsage,originalMessageInput,assertRetainedInput,retainAppendedInput,retainSelectedPath};
}
//endregion
