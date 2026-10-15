import {PolicySlotBindingError} from './system-slot-error.mjs';
import {collectRetainedRunInputs} from './run-history.mjs';
import {linkRunInputCarriers} from './run-carriers.mjs';
import {collectNativeMessageInputs} from '../../collector/run-prompt-custody-v3/message-inputs.mjs';
import {assertCollectedManagerGrowth,assertManagerOriginsAppended} from './manager-source-growth.mjs';

//region Original snapshots and approval retention share one collector-owned map.
export function retainPolicyInput({base,session,readSessionConstructedInputs,readSessionDomainEvents,readCurrent,assertCurrent,assertInputBudget,resourceInputs,hostPrompt}){
  const snapshots=new WeakMap();
  function constructedInputs(run){return (run===undefined)&&session?readSessionConstructedInputs?.(session):undefined;}
  function domainEvents(){return session&&readSessionDomainEvents?readSessionDomainEvents(session):undefined;}
  function capture(options){
   const input=readCurrent();
   const original=base.capture(options);
   assertCurrent(input);assertInputBudget(session);
   if(original.resourceInputObservation!==input.frame)throw new PolicySlotBindingError('Native collector belongs to another policy input resource frame');
   const independentContext=input.contextInputs
     .filter(function lacksContextCarrier(source) { return (source.carrier===undefined); });
   const forcedPromptInput=original.nativeRunComposition
     ?.forcedPromptInput;
   const promptGuidelineInputs=original.nativeRunComposition
     ?.promptGuidelineInputs;
   const toolGuidelineInputs=original.nativeRunComposition
     ?.toolGuidelineInputs;
   const mappedPromptInputs=original.nativeRunComposition
     ?.mappedPromptInputs;
   const replacementInputs=original.nativeRunComposition
     ?.replacementInputs;
   const skillDescriptionInputs=original.nativeRunComposition
     ?.skillDescriptionInputs;
   const nativeConstructedInputs=constructedInputs(original.nativeRunComposition);
   const nativeResourceToolInputs=resourceInputs();
   if((nativeResourceToolInputs!==undefined)&&(Buffer.byteLength(JSON.stringify({
     resourceInputObservation:original.resourceInputObservation,
     nativeResourceToolInputs
   }))>1_048_576))throw new PolicySlotBindingError('Combined resource inputs exceed the original one-MiB resource bound');
   if((nativeConstructedInputs!==undefined)&&(Buffer.byteLength(JSON.stringify({
     ...original,
     nativeConstructedInputs
   }))>1_048_576))throw new PolicySlotBindingError('Base-linked source collection exceeds total byte bound');
   const runMessageInputs=collectNativeMessageInputs({
     nativeRunComposition:original.nativeRunComposition,
     nativeConstructedInputs
   });
   const builtInPromptInputs=original.nativeRunComposition
     ?.builtInPromptInputs;
   const runInputCarriers=linkRunInputCarriers({
     run:original.nativeRunComposition,
     input,
     hostPrompt
   });
   const retainedRunInputs=collectRetainedRunInputs({
     run:original.nativeRunComposition,
     represented:runMessageInputs
   });
   const governingSources=Object.freeze([
     input.source,
     ...(retainedRunInputs??[]).map(function readHistoricalRunSource(origin) { return (origin.source); }),
     ...input.resourceReceiptInputs,
     ...(hostPrompt?[hostPrompt]:[]),
     ...(input.resourceSystemInput?[input.resourceSystemInput]:[]),
     ...input.appendInputs,
     ...independentContext,
     ...(forcedPromptInput?[forcedPromptInput]:[]),
     ...(promptGuidelineInputs??[]),
     ...(toolGuidelineInputs??[]),
     ...(mappedPromptInputs??[]),
     ...(replacementInputs??[]),
     ...(skillDescriptionInputs??[]),
     ...runMessageInputs,
     ...(builtInPromptInputs??[]),
     ...(nativeResourceToolInputs??[]).map(function readResourceToolSource(origin) { return (origin.source); })
   ]);
   const nativeDomain=domainEvents();
   const snapshot=Object.freeze({
     ...original,
     nativeDomainEventKinds:nativeDomain?.kinds,
     nativeDomainEventObservation:nativeDomain?.observation,
     retainedRunInputs,
     resourceReceiptInputs:input.resourceReceiptInputs,
     nativeConstructedInputs,
     nativeResourceToolInputs,
     hostGoverningPolicy:input.source,
     hostPromptInput:hostPrompt,
     resourceSystemInput:input.resourceSystemInput,
     appendPromptInputs:input.appendInputs,
     contextPromptInputs:input.contextInputs,
     governingContextCarriers:input.contextCarriers,
     priorContextPublication:input.priorContext,
     forcedPromptInput,
     promptGuidelineInputs,
     toolGuidelineInputs,
     mappedPromptInputs,
     replacementInputs,
     skillDescriptionInputs,
     runMessageInputs,
     builtInPromptInputs,
     runInputCarriers,
     governingSources
   });
   if(constructedInputs(original.nativeRunComposition)!==nativeConstructedInputs)throw new PolicySlotBindingError('Original constructed inputs changed during source capture');
   if(resourceInputs()!==nativeResourceToolInputs)throw new PolicySlotBindingError('Resource tool inputs changed during source capture');
   assertInputBudget(session);
   snapshots.set(
     snapshot,
     {
       input,
       original,
       nativeConstructedInputs,
       nativeResourceToolInputs
     }
   );return snapshot;
  }
  /** Preserve selected dependencies while later authenticated receipts remain available to the next decision. */
  function assertApprovedSourcesCurrent({
    snapshot,
    saved
  }){
   assertCurrent(saved.input);assertInputBudget(session);
   if(resourceInputs()!==saved.nativeResourceToolInputs)throw new PolicySlotBindingError('Approved operation lost its original extension tool inputs');
   const current=base.capture();
   const currentConstructed=constructedInputs(current.nativeRunComposition);
   const nativeDomain=domainEvents();
   if((JSON.stringify(nativeDomain?.kinds)!==JSON.stringify(snapshot.nativeDomainEventKinds))
     ||(nativeDomain?.observation?.occurrence!==snapshot.nativeDomainEventObservation?.occurrence)
     ||nativeDomain?.observation?.failed
     ||((nativeDomain?.observation?.revision??0)<(snapshot.nativeDomainEventObservation?.revision??0)))throw new PolicySlotBindingError('Approved operation lost its original native event runner or complete receipt accounting');
   assertCollectedManagerGrowth({
     before:saved.original,
     after:current
   });
   assertManagerOriginsAppended({
     before:saved.nativeConstructedInputs,
     after:currentConstructed
   });
   base.assertObservedFresh(current);
   if(constructedInputs(current.nativeRunComposition)!==currentConstructed)throw new PolicySlotBindingError('Approved operation inputs changed during dependency validation');
   assertCurrent(saved.input);assertInputBudget(session);
   if(resourceInputs()!==saved.nativeResourceToolInputs)throw new PolicySlotBindingError('Approved operation extension tool inputs changed during dependency validation');
  }
  function assertObservedFresh(snapshot){
   const saved=snapshots.get(snapshot);
   if(!saved)throw new PolicySlotBindingError('Governing snapshot is not owned by this source collector');
   if(saved.failure)throw new PolicySlotBindingError(
     'Original governing snapshot lost eligibility',
     {cause:saved.failure
       .cause}
   );
   try{
    if(saved.approved){assertApprovedSourcesCurrent({
      snapshot,
      saved
    });return;}
    assertCurrent(saved.input);assertInputBudget(session);
    if(resourceInputs()!==saved.nativeResourceToolInputs)throw new PolicySlotBindingError('Original extension tool inputs changed after source capture');
    if(constructedInputs(saved.original
      .nativeRunComposition)!==saved.nativeConstructedInputs)throw new PolicySlotBindingError('Original constructed inputs changed after source capture');
    const nativeDomain=domainEvents();
    if(JSON.stringify(nativeDomain?.kinds)!==JSON.stringify(snapshot.nativeDomainEventKinds))throw new PolicySlotBindingError("Native extension event membership changed after source capture");
    if(nativeDomain?.observation!==snapshot.nativeDomainEventObservation)throw new PolicySlotBindingError(`Native extension event callbacks changed after source capture: ${JSON.stringify({
      before:snapshot.nativeDomainEventObservation,
      after:nativeDomain?.observation
    })}`);
    base.assertObservedFresh(saved.original);
    if(constructedInputs(saved.original
      .nativeRunComposition)!==saved.nativeConstructedInputs)throw new PolicySlotBindingError('Original constructed inputs changed during source finalization');
    assertCurrent(saved.input);assertInputBudget(session);
    if(resourceInputs()!==saved.nativeResourceToolInputs)throw new PolicySlotBindingError('Original extension tool inputs changed during source finalization');
   }catch(error){saved.failure??={cause:error};throw error;}
  }
  /** Called only at the original resolved approval handoff; never selects new sources or revives failed ones. */
  function retainApprovedSources(snapshot){
   assertObservedFresh(snapshot);
   const saved=snapshots.get(snapshot);
   if(saved.approved)throw new PolicySlotBindingError('Original selected sources were already retained for approved execution');
   saved.approved=true;
  }
  /** Bind one current governing snapshot after proving preservation of the owned emitted material. */
  function captureJudgmentSources({
    original,
    signal,
    extend=false
  }){
   const saved=snapshots.get(original);
   if(!saved)throw new PolicySlotBindingError('Judgment source handoff requires this collector original snapshot');
   if(saved.failure)throw new PolicySlotBindingError(
     'Original governing snapshot lost eligibility',
     {cause:saved.failure
       .cause}
   );
   if(saved.capturingJudgment){
    const error=new PolicySlotBindingError('Original judgment source capture cannot reenter');
    saved.failure={cause:error};throw error;
   }
   saved.capturingJudgment=true;
   using judgmentCaptureScope={
    [Symbol.dispose](){saved.capturingJudgment=false;}
   };
   try{
    assertCurrent(saved.input);
    if((saved.judgmentSources!==undefined)&&((!extend)||(domainEvents()?.observation===saved.judgmentSources.nativeDomainEventObservation))){
     assertObservedFresh(saved.judgmentSources);
     if(saved.failure)throw new PolicySlotBindingError(
       'Original governing snapshot lost eligibility',
       {cause:saved.failure
         .cause}
     );
     return saved.judgmentSources;
    }
    const previous=saved.judgmentSources===undefined?saved:snapshots.get(saved.judgmentSources);
    if(previous.failure)throw new PolicySlotBindingError(
      'Original prepared source collection lost eligibility',
      {cause:previous.failure.cause}
    );
    const previousSnapshot=saved.judgmentSources??original;
    const current=capture({signal});
    const next=snapshots.get(current);
    if(next.input!==saved.input)throw new PolicySlotBindingError('Judgment source handoff cannot replace its original policy binding');
    if(next.nativeResourceToolInputs!==saved.nativeResourceToolInputs)throw new PolicySlotBindingError('Manager-only judgment handoff cannot adopt new extension tool receipts');
    if((JSON.stringify(current.nativeDomainEventKinds)!==JSON.stringify(previousSnapshot.nativeDomainEventKinds))
      ||(current.nativeDomainEventObservation?.occurrence!==previousSnapshot.nativeDomainEventObservation?.occurrence))
      throw new PolicySlotBindingError('Judgment source handoff cannot replace native event membership or its original runner');
    assertCollectedManagerGrowth({
      before:previous.original,
      after:next.original
    });
    assertManagerOriginsAppended({
      before:previous.nativeConstructedInputs,
      after:next.nativeConstructedInputs
    });
    assertObservedFresh(current);
    if(saved.failure)throw new PolicySlotBindingError(
      'Original governing snapshot lost eligibility',
      {cause:saved.failure
        .cause}
    );
    saved.judgmentSources=current;return current;
   }catch(error){saved.failure??={cause:error};throw error;}
  }
  return Object.freeze({
    capture,
    assertObservedFresh,
    retainApprovedSources,
    captureJudgmentSources
  });
 }
//endregion
