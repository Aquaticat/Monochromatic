import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import {SourceCollectionError} from '../collector.mjs';
import {
  copyPromptOptions,
  freezePromptOptions
} from '../base-prompt-custody-v2/copy.mjs';
import {snapshotRunMessages} from '../run-prompt-custody/messages.mjs';
import {republishBaseInputs} from './base-inputs.mjs';
import {
  captureMessageInputs,
  captureExpandedPromptInput
} from './message-inputs.mjs';
import {captureRenderInputs} from './render-inputs.mjs';
import {createForcedPublication} from './forced-publication.mjs';
import {createGuidelineInputs} from './guideline-inputs.mjs';
import {captureHandlerOptionInputs} from './handler-option-inputs.mjs';
import {
  createHandlerPublication,
  createExpandedPromptPublication,
  createInputOnlyPublication,
  observeMessageCopies,
  readOriginalMessagePublication
} from './handler-publication.mjs';

//region Private session operation state and explicit propagation aliases.
export class RunPromptCustodyError extends AggregateError {
  constructor(failures){
    super(
      failures.map(item=>item.error),
      'Native run prompt derivation is incomplete or no longer current. Inspect its recorded source, handler, publication or session failure before using it.'
    );
    this.name=this.constructor
      .name;this.failures=Object.freeze([...failures]);
  }
}
/** Fixed native session code privately holds this owner and its base/lifetime readers. */
export function createRunPromptOwner({
  assertLive,
  readBase,
  readRoot,
  readSessionInput,
  readConstructedInputs,
  assertSessionInputs,
  requireRenderCapture=false
}){
  if(((typeof assertLive)!=='function')||((typeof readBase)!=='function'))throw new SourceCollectionError('Native run requires fixed session lifetime and base readers');
  if((readConstructedInputs!==undefined)&&(((typeof readConstructedInputs)!=='function')||((typeof readSessionInput)!=='function')))throw new SourceCollectionError('Constructed message inputs require their fixed native origin readers');
  if((readRoot!==undefined)&&((typeof readRoot)!=='function'))throw new SourceCollectionError('Native selected inputs require their fixed root reader');
  if(((readSessionInput!==undefined)||(assertSessionInputs!==undefined))&&(![
    readSessionInput,
    assertSessionInputs
  ].every(value=>(typeof value)==='function')))throw new SourceCollectionError('Native session inputs require their fixed origin and capture readers');
  const scopes=new WeakMap();
    const issuedErrors=new WeakMap();
    const history=[];
  let absent=true;
    let active;
    let current;
    let operating=false;
    let selectedPathInputs;
  let handlerInputView=Object.freeze([]);
    let combinedInputView;
  function guard(scope){const error=new RunPromptCustodyError(scope.failures);issuedErrors.set(
    error,
    scope
  );return error;}
  function record({
    scope,
    error,
    at
  }){scope.failures
    .push(Object.freeze({
      identity:Object.freeze({}),
      ordinal:scope.failures
        .length,
      error,
      at
    }));}
  function reject({
    scope,
    message,
    at
  }){record({
    scope,
    error:new SourceCollectionError(message),
    at
  });throw guard(scope);}
  function known(handle){const scope=scopes.get(handle);if(!scope)throw new SourceCollectionError('Run scope belongs to another native owner');return scope;}
  function check(scope){
    assertLive();if(scope.failures
      .length
      > 0)throw guard(scope);
    if(readRoot&&(scope.rootOccurrence!==readRoot()))throw new SourceCollectionError('Native run inputs belong to a different original root');
  }
  function phase({
    scope,
    at,
    run
  }){
    if(operating)reject({
      scope,
      message:'Native run source bookkeeping cannot reenter',
      at
    });
    operating=true;
    try{return run();}
    catch(error){if(issuedErrors.get(error)!==scope)record({
      scope,
      error,
      at
    });throw guard(scope);}
    finally{operating=false;}
  }
  function reserve(kind){
    if(active)reject({
      scope:active,
      message:'Native run preparation cannot overlap or reenter',
      at:'entry'
    });
    const handle=Object.freeze({});
    const scope={
      handle,
      rootOccurrence:readRoot?.(),
      ordinal:history.length,
      kind,
      state:'created',
      failures:[],
      slots:[],
      next:0,
      running:undefined,
      bytes:0,
      parent:undefined,
      node:undefined,
      view:undefined
    };
    scopes.set(
      handle,
      scope
    );history.push(scope);active=scope;current=undefined;absent=false;return scope;
  }
  function fail({
    scope:handle,
    error
  }){
    const scope=known(handle);
    // Only errors actually issued by this owner are propagation aliases. Public error shape is irrelevant.
    if(issuedErrors.get(error)!==scope)record({
      scope,
      error,
      at:'native-operation'
    });
    scope.state='failed';if(active===scope)active=undefined;if(current===scope)current=undefined;return guard(scope);
  }
  function base(){
    const value=readBase();
    if((!value)||(!Object.isFrozen(value))
      ||(value.status!=='ready')
      ||(!Object.isFrozen(value.options)))throw new SourceCollectionError('Native run base reader did not return a ready owned base');
    return value;
  }
  function charge({
    scope,
    value
  }){
    scope.bytes+=Buffer.byteLength(JSON.stringify(value));
    if(scope.bytes>4_194_304)throw new SourceCollectionError('Complete native run observations exceed the snapshot byte bound');
    return value;
  }
  function capture({
    scope,
    options,
    messages
  }){
    return charge({
      scope,
      value:Object.freeze({
        options:freezePromptOptions(options),
        messages:snapshotRunMessages(messages)
      })
    });
  }
  function dense({
    value,
    maximum
  }){
    if((!Array.isArray(value))||(Object.getPrototypeOf(value)!==Array.prototype)
      ||(value.length>maximum)
      ||(Reflect.ownKeys(value)
        .length
        !==(value.length
        +1)))throw new SourceCollectionError('Native handler snapshot requires bounded dense arrays');
    for(let index=0;index<value.length;index++){
      const property=Object.getOwnPropertyDescriptor(
        value,
        String(index)
      );
      if((!property?.enumerable)||(!Object.hasOwn(
        property,
        'value'
      )))throw new SourceCollectionError('Native handler snapshot has missing or accessor entries');
    }
    return value;
  }
//endregion
//region Actual native emitter traversal and immutable observation copies.
  function start({
    runner,
    expandedPrompt
  }){
    const scope=reserve('before-agent-start');
    try{return phase({
      scope,
      at:'base-entry',
      run:()=>{
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
      run:()=>{
      check(scope);
      if((active!==scope)||(scope.state!=='created')
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
      run:()=>{
      check(scope);const item=scope.slots[scope.next];
      if((active!==scope)||(scope.state!=='dispatching')
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
      run:()=>{ check(scope); }
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
      run:()=>{
      check(scope);
      if((active!==scope)||(scope.state!=='dispatching')
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
        .map((
          source,
          ordinal
        )=>createHandlerPublication({
          source,
          input:scope.emitted
            .messages[ordinal]
        })));
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
//endregion
//region Native publication and next-turn derivation keep ancestry distinct from currency.
  /** The fixed native preparation path renders synchronously within this original run. */
  function render({
    options,
    build
  }){
    const scope=active;
    const initial=(scope?.state==='emitted')&&(!operating)
      &&(options===scope.delivery);
    const refresh=(scope?.kind==='next-turn-refresh')&&(scope.state==='created')
      &&operating;
    if((!scope)||scope.rendering
      ||scope.rendered
      ||((!initial)
      &&(!refresh))
      ||((typeof build)!=='function'))throw new SourceCollectionError('Native prompt rendering requires its original open preparation position');
    check(scope);scope.rendering=true;
    try{
      const input=freezePromptOptions(options);
        const occurrence=Object.freeze({});
      const guidelines=createGuidelineInputs({
        options:input,
        runOccurrence:scope.handle,
        renderOccurrence:occurrence
      });
      function observeGuideline(value){
        // The existing render finally block closes this observation window on every exit.
        if((!scope.rendering)||(active!==scope))throw new SourceCollectionError('Guideline insertion requires its original active native rendering');
        try{check(scope);guidelines.observe(value);check(scope);}
        catch(error){if(issuedErrors.get(error)!==scope)record({
          scope,
          error,
          at:'native-guideline-insertion'
        });throw guard(scope);}
      }
      const captured=captureRenderInputs({
        output:build(
          options,
          observeGuideline
        ),
        runOccurrence:scope.handle,
        renderOccurrence:occurrence
      });
      check(scope);
      if((!isDeepStrictEqual(
        input,
        freezePromptOptions(options)
      ))||(active!==scope))throw new SourceCollectionError('Native prompt inputs changed during construction');
      charge({
        scope,
        value:captured
      });
      scope.rendered=Object.freeze({
        options,
        input,
        occurrence,
        inputs:captured.inputs,
        sections:captured.sections,
        guidelineInputs:guidelines.seal()
      });
      return captured.sections;
    }catch(error){
      if(issuedErrors.get(error)!==scope)record({
        scope,
        error,
        at:'native-render'
      });
      throw guard(scope);
    }finally{scope.rendering=false;}
  }
  /** Retain the actual native sections publication, not a text-equivalent reconstruction. */
  function captureSystemMessage({
    options,
    message
  }){
    const scope=active;
    if((!scope?.rendered)||(scope.rendered
      .options
      !==options)
      ||scope.systemPublication)throw new SourceCollectionError('System contribution requires its original native rendering position');
    if(message===undefined)return;
    const {sections} = message;
      const descriptors=Object.getOwnPropertyDescriptors(sections);
      const aliases=new WeakSet([sections]);
    const complete=isDeepStrictEqual(
      sections,
      scope.rendered
        .sections
    );
    let retirementError;
    scope.systemPublication=Object.freeze({
      occurrence:Object.freeze({}),
      renderOccurrence:scope.rendered
        .occurrence,
      runOccurrence:scope.handle,
      complete,
      matchesSections(value){
        if(retirementError)throw new SourceCollectionError(
          'Original system contribution lost eligibility',
          {cause:retirementError}
        );
        if(!aliases.has(value))return false;
        if(!isDeepStrictEqual(
          Object.getOwnPropertyDescriptors(value),
          descriptors
        )){
          retirementError=new SourceCollectionError('Original system sections changed before serializer consumption');throw retirementError;
        }
        return true;
      }
    });
    scope.captureContextClone=({
      before,
      after
    })=>{
      // Failed provenance must not prevent native persistence of the failure itself.
      if(retirementError)return;
      for(const [index,original] of before.entries()){
        if((!original)||((typeof original)!=='object'))continue;
        const field=Object.getOwnPropertyDescriptor(
          original,
          'sections'
        );
        if((!field?.enumerable)||(!Object.hasOwn(
          field,
          'value'
        ))
          ||(!aliases.has(field.value)))continue;
        const copiedMessage=after[index];
        const copiedField=copiedMessage&&Object.getOwnPropertyDescriptor(
          copiedMessage,
          'sections'
        );
        const copied=copiedField&&Object.hasOwn(
          copiedField,
          'value'
        )?copiedField.value:undefined;
        if((!copied)||(!isDeepStrictEqual(
          Object.getOwnPropertyDescriptors(field.value),
          descriptors
        ))
          ||(!isDeepStrictEqual(
            Object.getOwnPropertyDescriptors(copied),
            descriptors
          ))){
          retirementError=new SourceCollectionError('Native context clone changed the original sections contribution');
          return;
        }
        aliases.add(copied);
      }
    };
  }
  /** Read original handler input references from this owner's existing history, scoped to the current native root. */
  function readHandlerOptionOrigins(){
    assertLive();
    if((typeof readRoot)!=='function')throw new SourceCollectionError('Handler input history requires the original native root reader');
    const root=readRoot();
      const origins=[];
    for(const scope of history){
      if(scope.rootOccurrence!==root)continue;
      if(scope.slots
        .some(slot=>slot.before!==undefined)
        &&(scope.handlerOptionOrigins===undefined))throw new SourceCollectionError('Original callback input history has no completed source publication');
      for(const origin of scope.handlerOptionOrigins??[]){
        if(origins.length>=64)throw new SourceCollectionError('Original callback input history exceeds the 64-source profile');
        origins.push(origin);
      }
    }
    if(readRoot()!==root)throw new SourceCollectionError('Native root changed while reading original callback input history');
    if((origins.length!==handlerInputView.length)||origins.some((
      origin,
      index
    )=>origin!==handlerInputView[index]))handlerInputView=Object.freeze(origins);
    return handlerInputView;
  }
  /** Preserve native manager handoff ordering while adding stable original run-input references, not copied content. */
  function readInputOrigins(managerInputs){
    const handlerInputs=readHandlerOptionOrigins();
    if(handlerInputs.length===0)return managerInputs;
    if((combinedInputView?.managerInputs===managerInputs)&&(combinedInputView.handlerInputs===handlerInputs))return combinedInputView.value;
    const value=Object.freeze([
      ...handlerInputs,
      ...managerInputs
    ]);
    if(value.length>64)throw new SourceCollectionError('Combined original callback and manager inputs exceed the 64-source profile');
    combinedInputView={
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
        (
          bytes,
          origin
        )=>bytes+Buffer.byteLength(JSON.stringify(origin.source)),
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
      ?.findIndex(value=>value.view===publication)
      ??(-1);
    const option=original.handlerOptionOrigins
      ?.find(origin=>origin.publication===publication);
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
    const previous=selectedPathInputs?.rootOccurrence===rootOccurrence?selectedPathInputs:undefined;
    if(previous?.failure)return;
    const publication=readOriginalMessagePublication(entry)??readOriginalMessagePublication(entry.type==='message'?entry.message:entry);
    const origin=originalMessageInput(publication);
    const origins=previous?.origins??[];
    if((!origin)||origins.some(value=>value.source
      .occurrence
      ===origin.source
      .occurrence))return;
    const next=origins.length>=64
      ?Object.freeze({
        rootOccurrence,
        origins,
        failure:new SourceCollectionError('Retained native message sources exceed the original 64-source profile')
      })
      :Object.freeze({
        rootOccurrence,
        origins:Object.freeze([
          ...origins,
          origin
        ])
      });
    if(rootOccurrence===readRoot())selectedPathInputs=next;
  }
  /** Keep only existing source capabilities from the actual native path walk, not the path or its message data. */
  function retainSelectedPath({
    rootOccurrence,
    entries
  }){
    if((!readRoot)||(rootOccurrence!==readRoot()))return;
    if((selectedPathInputs?.rootOccurrence===rootOccurrence)&&selectedPathInputs.failure)return;
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
        if(origins.length>=64)throw new SourceCollectionError('Retained native message sources exceed the original 64-source profile');
        seen.add(origin.source
          .occurrence);origins.push(origin);
      }
    }
    if(rootOccurrence!==readRoot())throw new SourceCollectionError('Native selected path changed during source observation');
    selectedPathInputs=Object.freeze({
      rootOccurrence,
      origins:Object.freeze(origins)
    });
  }
  /** Resolve retained native context inputs through existing run scopes, never through text or saved IDs. */
  function retainContextInputs(messages){
    const scope=current;
    if((!scope)||active
      ||operating
      ||(scope.state!=='published'))throw new SourceCollectionError('Retained inputs require the current published native run');
    return phase({
      scope,
      at:'retained-context-inputs',
      run:()=>{
      check(scope);assertSessionInputs?.();
      const activeOccurrences=new Set([
        scope.handle,
        ...scope.view
          .ancestors
          .map(value=>value.occurrence)
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
        if(origins.length>=64)throw new SourceCollectionError('Retained native message sources exceed the original 64-source profile');
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
      if(selectedPathInputs&&(selectedPathInputs.rootOccurrence===readRoot())){
        if(selectedPathInputs.failure)throw selectedPathInputs.failure;
        for(const origin of selectedPathInputs.origins){assertRetainedInput(origin);append(origin);}
      }
      if(scope.view
        .retainedMessageOrigins
        &&(origins.length===previous.length)
        &&origins.every((
          origin,
          index
        )=>origin===previous[index])){check(scope);scope.constructedInputs=constructedInputs;return;}
      const retainedMessageOrigins=charge({
        scope,
        value:Object.freeze(origins)
      });
      const view=Object.freeze({
        ...scope.view,
        retainedMessageOrigins
      });
      if(Buffer.byteLength(JSON.stringify(view))>8_388_608)throw new SourceCollectionError('Complete run ancestry exceeds its declared byte bound');
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
      if(value.contextRun!==current?.handle)throw new SourceCollectionError('Native context completion requires its original published run');
      if(current)retainContextInputs(value.messages);return;
    }
    observeMessageCopies(value);
    if((value.kind==='handler-entry')||(value.kind==='projection'))return;
    // Known message copies outlive active-run preparation; system publication still requires its current run.
    current?.captureContextClone?.(value);
    if((value.kind==='request-context')&&current){const {handle} = current;retainContextInputs(value.before);return handle;}
  }
  /** Bind the actual native user construction to this original expanded-text handoff. */
  function captureExpandedPromptMessage({
    scope:handle,
    expandedPrompt,
    message
  }){
    const scope=known(handle);
    if((active!==scope)||(scope.state!=='emitted')
      ||(!scope.expandedPromptInput)
      ||(scope.expandedPromptInput
        .content
        !==expandedPrompt))throw new SourceCollectionError('Expanded prompt message requires its original active native handoff');
    return phase({
      scope,
      at:'expanded-prompt-publication',
      run:()=>{check(scope);scope.expandedPromptPublication
        .capture(message);check(scope);}
    });
  }
  /** Bind the actual custom object constructed from an original emitter-result member. */
  function captureHandlerMessage({
    result,
    input,
    message
  }){
    const scope=active;
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
      run:()=>{check(scope);scope.handlerPublications[ordinal]
        .capture(message);check(scope);}
    });
  }
  /** Capture the fixed native forced projection without changing its message or tool declarations. */
  function captureForcedMessage({
    options,
    message
  }){
    const scope=current;
    if((!scope)||(scope.view
      .options
      !==options)
      ||(!scope.forcedPublication))throw new SourceCollectionError('Forced projection requires its original current run publication');
    return phase({
      scope,
      at:'forced-message-publication',
      run:()=>{check(scope);scope.forcedPublication
        .capture(message);check(scope);}
    });
  }
  function publishScope(scope){
    check(scope);const publishedBase=base();
    const republished=republishBaseInputs({
      input:scope.delivery??scope.working,
      base:scope.base,
      runOccurrence:scope.handle
    });
    const options=freezePromptOptions(republished.options);
    if(requireRenderCapture&&(!scope.rendered))throw new SourceCollectionError('Native run requires its original prompt construction capture');
    if(scope.rendered&&((scope.rendered
      .options
      !==(scope.delivery??scope.working))||(!isDeepStrictEqual(
      scope.rendered
        .input,
      options
    ))))throw new SourceCollectionError('Native run publication differs from its original prompt construction inputs');
    const builtInPromptInputs=scope.rendered
      ?.inputs
      ??Object.freeze([]);
    charge({
      scope,
      value:options
    });check(scope);
    if(active!==scope)throw new SourceCollectionError('Run source occurrence changed before publication');
    const observations=Object.freeze(scope.slots
      .map(slot=>Object.freeze({
        ordinal:slot.ordinal,
        path:slot.path,
        state:slot.state,
        before:slot.before,
        after:slot.after,
        failures:Object.freeze(slot.failures
          .map((
            failure,
            ordinal
          )=>Object.freeze({
            occurrence:failure.identity,
            ordinal,
            at:failure.at
          })))
      })));
    const handlerOptionInputs=charge({
      scope,
      value:captureHandlerOptionInputs({
        observations,
        runOccurrence:scope.handle
      })
    });
    const handlerOptionPublications=Object.freeze(handlerOptionInputs.map((
      source,
      index
    )=>{
      const publication=createInputOnlyPublication(source);publication.capture(observations[index]
        .before);return publication.view;
    }));
    scope.handlerOptionOrigins=Object.freeze(handlerOptionInputs.map((
      source,
      index
    )=>Object.freeze({
      source,
      publication:handlerOptionPublications[index],
      runOccurrence:scope.handle
    })));
    const forcedPromptInput=options.forceSystemPrompt===undefined?undefined:Object.freeze({
      kind:'native-run-forced-prompt-input',
      content:options.forceSystemPrompt,
      sha256:createHash('sha256')
        .update(options.forceSystemPrompt)
        .digest('hex'),
      occurrence:Object.freeze({}),
      runOccurrence:scope.handle,
      registration:undefined,
      permission:false
    });
    scope.forcedPublication=forcedPromptInput?createForcedPublication(forcedPromptInput):undefined;
    const {
      promptGuidelineInputs,
      toolGuidelineInputs
    }=scope.rendered
      ?.guidelineInputs
      ??createGuidelineInputs({
        options,
        runOccurrence:scope.handle
      })
      .seal();
    const mappedPromptInputs=Object.freeze([
      'toolSnippets',
      'sections'
    ].flatMap(field=>Object.entries(options[field])
      .map(([key,content])=>Object.freeze({
        kind:'native-run-mapped-prompt-input',
        content,
        inputLocation:Object.freeze({
          field,
          key
        }),
        sha256:createHash('sha256')
          .update(content)
          .digest('hex'),
        occurrence:Object.freeze({}),
        runOccurrence:scope.handle,
        registration:undefined,
        permission:false
      }))));
    const skillDescriptionInputs=Object.freeze(options.skills
      .map((
        {
          description,
          ...metadata
        },
        ordinal
      )=>Object.freeze({
        kind:'native-run-skill-description-input',
        content:description,
        inputLocation:Object.freeze({
          field:'skills',
          ordinal,
          metadataJSON:JSON.stringify(metadata)
        }),
        sha256:createHash('sha256')
          .update(description)
          .digest('hex'),
        occurrence:Object.freeze({}),
        runOccurrence:scope.handle,
        registration:undefined,
        pathToRawFileIdentity:'not-established',
        permission:false
      })));
    const handlerMessageInputs=scope.handlerMessageInputs??captureMessageInputs({
      messages:[],
      runOccurrence:scope.handle
    });
    const handlerPublications=Object.freeze((scope.handlerPublications??[]).map(publication=>publication.view));
    scope.node=Object.freeze({
      retainedOnly:true,
      expandedPromptInput:scope.expandedPromptInput,
      expandedPromptPublication:scope.expandedPromptPublication
        ?.view,
      systemPublication:scope.systemPublication,
      forcedPublication:scope.forcedPublication
        ?.view,
      builtInPromptInputs,
      renderOccurrence:scope.rendered
        ?.occurrence,
      handlerMessageInputs,
      handlerPublications,
      skillDescriptionInputs,
      baseInputCarriers:republished.baseInputCarriers,
      replacementInputs:republished.replacementInputs,
      forcedPromptInput,
      promptGuidelineInputs,
      toolGuidelineInputs,
      mappedPromptInputs,
      occurrence:scope.handle,
      ordinal:scope.ordinal,
      kind:scope.kind,
      inputBase:scope.base,
      publishedBase,
      inputRun:scope.parent
        ?.handle,
      inputRunOrdinal:scope.parent
        ?.ordinal,
      options,
      handlerObservations:observations,
      handlerOptionInputs,
      handlerOptionPublications,
      emitterOptions:scope.emitted
        ?.options,
      emitterMessages:scope.emitted
        ?.messages,
      sourceAuthority:'not-established',
      otherInputCoverage:'not-established'
    });
    const ancestors=[];let {parent} = scope;
    while(parent){if(ancestors.length>=64)throw new SourceCollectionError('Run source ancestry exceeds its declared profile');ancestors.push(parent.node);parent=parent.parent;}
    scope.view=Object.freeze({
      ...scope.node,
      ancestors:Object.freeze(ancestors)
    });
    if(Buffer.byteLength(JSON.stringify(scope.view))>8_388_608)throw new SourceCollectionError('Complete run ancestry exceeds its declared byte bound');
    scope.state='published';current=scope;active=undefined;return options;
  }
  function publish({
    scope:handle,
    result
  }){
    const scope=known(handle);return phase({
      scope,
      at:'publication',
      run:()=>{
      check(scope);
      if((active!==scope)||(scope.state!=='emitted')
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
    const parent=current;
      const scope=reserve('next-turn-refresh');
    try{return phase({
      scope,
      at:'next-turn-refresh',
      run:()=>{
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
    if(active)reject({
      scope:active,
      message:'Native run reset cannot replace pending preparation',
      at:'reset'
    });
    current=undefined;absent=true;
  }
  function read({options}){
    assertLive();const scope=current;
    if(active||(!scope)
      ||(scope.state!=='published')
      ||(scope.view
        .options
        !==options))throw new SourceCollectionError('Run prompt is pending, failed, absent or not its canonical publication');
    const constructedInputs=readConstructedInputs?.();
    if((constructedInputs!==scope.constructedInputs)&&(constructedInputs?.length
      ||scope.constructedInputs
      ?.length))retainContextInputs([]);
    return phase({
      scope,
      at:'current-read',
      run:()=>{
      check(scope);assertSessionInputs?.();
      if(readRoot){
        const root=readRoot();
        const prior=[];
        for(const original of history){
          if((original===scope)||(original.rootOccurrence!==root))continue;
          if((original.state!=='published')||(!original.node))throw new SourceCollectionError('Original run input history contains an unpublished processing receipt');
          if(prior.length>=64)throw new SourceCollectionError('Original run input history exceeds the bounded native run profile');
          prior.push(original.node);
        }
        if(readRoot()!==root)throw new SourceCollectionError('Native root changed while reading original run input history');
        const previous=scope.view
          .priorRuns;
        if((!previous)||(previous.length!==prior.length)
          ||prior.some((
          value,
          index
        )=>value!==previous[index])){
          const view=Object.freeze({
            ...scope.view,
            priorRuns:Object.freeze(prior)
          });
          if(Buffer.byteLength(JSON.stringify(view))>8_388_608)throw new SourceCollectionError('Original run history exceeds the native source byte bound');
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
    if(absent&&(!active)
      &&(!current)
      &&(options===undefined))return undefined;
    return read({options});
  }
  function inspect(){
    return Object.freeze({
      retainedOnly:true,
      pending:active!==undefined,
      currentOrdinal:current?.ordinal,
      history:Object.freeze(history.map(scope=>Object.freeze({
        ordinal:scope.ordinal,
        kind:scope.kind,
        state:scope.state,
        view:scope.view,
        failures:Object.freeze([...scope.failures]),
        slots:Object.freeze(scope.slots
          .map(slot=>Object.freeze({
            ordinal:slot.ordinal,
            state:slot.state,
            before:slot.before,
            after:slot.after,
            failures:Object.freeze([...slot.failures])
          })))
      })))
    });
  }
  return Object.freeze({
    start,
    enterNative,
    invokeHandler,
    leaveNative,
    render,
    captureSystemMessage,
    captureContextClone,
    captureForcedMessage,
    captureHandlerMessage,
    captureExpandedPromptMessage,
    publish,
    refresh,
    reset,
    read,
    readOrAbsent,
    readInputOrigins,
    readInputUsage,
    inspect,
    fail
  });
}
//endregion
