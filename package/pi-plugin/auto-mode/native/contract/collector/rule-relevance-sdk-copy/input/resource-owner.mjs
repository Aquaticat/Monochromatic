import {createBootstrapPolicySelection} from "../../../lifecycle/rule-relevance-cache/selection.mjs";
import {
  bindConstructionOwner,
  createCollector,
  SourceCollectionError
} from "../../collector.mjs";
import {
  copyOptions,
  snapshotInput
} from "../../resource-input-custody/values.ts";

/** Public failure preserves caught values, including undefined, as separate occurrence records. */
export class ResourceInputCustodyError extends AggregateError{
  constructor({
    message,
    failures
  }){super(
    failures.map(value=>value.error),
    message
  );this.name=this.constructor
    .name;this.failures=Object.freeze([...failures]);}
}
/** Internal propagation alias, never used to deduplicate a newly thrown callback value. */
class RecordedInputFailure extends Error{
  constructor({
    scope,
    occurrence
  }){super('Resource input failure already recorded');this.scope=scope;this.occurrence=occurrence;}
}
// Opaque loader bindings are resource indexes, never a session or authority registry.
const nativeInputBindings=new WeakMap();
function boundResource({
  binding,
  loader
}){
  const bound=nativeInputBindings.get(binding);
  if((!bound)||(bound.loader!==loader))throw new SourceCollectionError('Native base composition lacks its exact owned resource binding');
  return bound.read();
}
export function readBoundResourceFrame(input){return boundResource(input)
  .view;}
export function assertBoundResourceInputs({
  binding,
  loader,
  frame,
  contextFiles,
  systemPrompt,
  appendSystemPrompt
}){
  const scope=boundResource({
    binding,
    loader
  });
  if((scope.view!==frame)||(contextFiles
    !==scope.returns[0]
    .agentsFiles)
    ||(systemPrompt!==scope.returns[1])
    ||(appendSystemPrompt!==scope.returns[2]))throw new SourceCollectionError('Native base inputs differ from their original resource occurrence');
}
const phases=Object.freeze([
  {
    kind:'context',
    property:'agentsFilesOverride'
  },
  {
    kind:'system',
    property:'systemPromptOverride'
  },
  {
    kind:'append',
    property:'appendSystemPromptOverride'
  }
]);
const readerNames=Object.freeze([
  'getAgentsFiles',
  'getSystemPrompt',
  'getSystemPromptSource',
  'getAppendSystemPrompt',
  'getAppendSystemPromptSources'
]);
const selectorNames=Object.freeze([
  'cwd',
  'agentDir',
  'noContextFiles',
  'systemPromptSource',
  'appendSystemPromptSource'
]);
const discoveryNames=Object.freeze([
  'discoverSystemPromptFile',
  'discoverAppendSystemPromptFile'
]);

/** Trusted bootstrap supplies the qualified native constructor, not a caller-shaped authority record. */
export function createResourceInputOwner({
  DefaultResourceLoader,
  readSessionLoader,
  readSessionPrompt,
  readSessionBase,
  readSessionRun
}){
  const nativeReload=DefaultResourceLoader?.prototype
    ?.reload;
    const readers=Object.fromEntries(readerNames.map(name=>[
    name,
    DefaultResourceLoader?.prototype?.[name]
  ]));
    const discoveries=Object.fromEntries(discoveryNames.map(name=>[
    name,
    DefaultResourceLoader?.prototype?.[name]
  ]));
  if(((typeof nativeReload)!=='function')||[
    ...Object.values(readers),
    ...Object.values(discoveries)
  ].some(value=>(typeof value)!=='function'))throw new SourceCollectionError('Qualified native resource loader methods are unavailable');
  const records=new WeakMap();
  function known(loader){const record=records.get(loader);if(!record)throw new SourceCollectionError('Resource loader was not created by this constructor owner');return record;}
  function failed({
    scope,
    error,
    at
  }){
    const occurrence=Object.freeze({
      identity:Object.freeze({}),
      ordinal:scope.failures
        .length,
      error,
      at
    });scope.failures
      .push(occurrence);
    return new RecordedInputFailure({
      scope,
      occurrence
    });
  }
  function publicFailure(scope){return new ResourceInputCustodyError({
    message:'Native resource reload cannot publish current input observations; inspect retained source and callback failures.',
    failures:scope.failures
  });}
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
  function fixed({
    loader,
    name,
    value
  }){
    Object.defineProperty(
      loader,
      name,
      {
        value,
        writable:false,
        configurable:false,
        enumerable:false
      }
    );
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
  function readOutputs(record){
    const {loader} = record;
    for(const name of [
      'agentsFiles',
      'systemPrompt',
      'appendSystemPrompt',
      'systemPromptSourcePath',
      'appendSystemPromptSourcePaths'
    ]){
      const field=Object.getOwnPropertyDescriptor(
        loader,
        name
      );
      if((!field)||(!Object.hasOwn(
        field,
        'value'
      )))throw new SourceCollectionError(`Native resource output field ${name} is not an own data property`);
    }
    for(const [name,fn] of Object.entries({
      ...readers,
      ...discoveries
    }))if(loader[name]!==fn)throw new SourceCollectionError('Native resource method identity changed');
    const context=Reflect.apply(
      readers.getAgentsFiles,
      loader,
      []
    );
      const system=Reflect.apply(
      readers.getSystemPrompt,
      loader,
      []
    );
      const append=Reflect.apply(
      readers.getAppendSystemPrompt,
      loader,
      []
    );
    return {
      raw:[
        context.agentsFiles,
        system,
        append
      ],
      copies:[
        snapshotInput({
          kind:'context',
          value:context
        }),
        snapshotInput({
          kind:'system',
          value:system
        }),
        snapshotInput({
          kind:'append',
          value:append
        })
      ]
    };
  }
  function compareOutputs({
    scope,
    outputs
  }){
    const references=[
      scope.returns[0]
        .agentsFiles,
      scope.returns[1],
      scope.returns[2]
    ];
    if(outputs.raw
      .some((
        value,
        index
      )=>value!==references[index])
      ||(JSON.stringify(outputs.copies)!==JSON.stringify(scope.phases
        .map(value=>value.after))))throw new SourceCollectionError('Native resource output differs from its captured transformation result');
  }
  function current(record){
    const scope=record.current;
    if(record.active||record.cleanup
      ||(!scope)
      ||(scope.status!=='ready'))throw new SourceCollectionError('Resource input observation is not currently published');
    try{compareOutputs({
      scope,
      outputs:readOutputs(record)
    });}
    catch(error){scope.status='stale';record.current=undefined;failed({
      scope,
      error,
      at:'current-output'
    });throw publicFailure(scope);}
    return scope;
  }
  async function reload({
    record,
    receiver,
    args
  }){
    if(receiver!==record.loader)throw new SourceCollectionError('Native resource reload requires its exact owned loader');
    if(record.active){const scope=record.active;failed({
      scope,
      error:new SourceCollectionError('Native resource reload cannot reenter'),
      at:'reload-entry'
    });throw publicFailure(scope);}
    if(record.cleanup)throw new SourceCollectionError('Unsupported resource callback work is still pending; drain it before reloading');
    const scope={
      identity:Object.freeze({}),
      ordinal:record.history
        .length,
      status:'pending',
      phases:[],
      returns:[],
      failures:[],
      pending:[],
      unbound:Object.freeze([]),
      completion:Promise.withResolvers(),
      busy:false,
      view:undefined
    };
    record.current=undefined;record.active=scope;record.history
      .push(scope);
    let result;
    try{
      try{result=await Reflect.apply(
        nativeReload,
        record.loader,
        args
      );}
      catch(error){
        if(!((error instanceof RecordedInputFailure)
          &&(error.scope===scope)
          &&scope.failures
          .includes(error.occurrence)))failed({
          scope,
          error,
          at:'native-reload'
        });
      }
      if(scope.failures
        .length
        > 0)throw publicFailure(scope);
      if(scope.phases
        .length
        !==phases.length)throw failed({
        scope,
        error:new SourceCollectionError('Native reload returned without all required resource input phases'),
        at:'native-return'
      });
      try{compareOutputs({
        scope,
        outputs:readOutputs(record)
      });}
      catch(error){throw failed({
        scope,
        error,
        at:'native-output'
      });}
      scope.view=Object.freeze({
        occurrence:scope.identity,
        ordinal:scope.ordinal,
        stages:Object.freeze([...scope.phases]),
        sourceAuthority:'not-established',
        pathToRawFileIdentity:'not-established',
        delegation:'not-established'
      });
      if(Buffer.byteLength(JSON.stringify(scope.view))>1_048_576)throw failed({
        scope,
        error:new SourceCollectionError('Resource input frame exceeds total byte bound'),
        at:'frame-bound'
      });
      scope.status='ready';record.current=scope;return result;
    }catch(error){
      if((!(error instanceof ResourceInputCustodyError))&&(!((error instanceof RecordedInputFailure)
        &&(error.scope===scope)
        &&scope.failures
        .includes(error.occurrence))))failed({
        scope,
        error,
        at:'reload-close'
      });
      scope.status='failed';throw publicFailure(scope);
    }finally{
      record.active=undefined;
      if(scope.pending
        .length
        > 0){
        record.cleanup=scope;
        async function finishUnbound(){
          scope.unbound=Object.freeze((await Promise.all(scope.pending)).flat()
            .map(value=>Object.freeze(value)));
          record.cleanup=undefined;scope.completion
            .resolve();
        }
        void finishUnbound();
      }else scope.completion
        .resolve();
    }
  }
  function create(options){
    const copied=copyOptions(options);
      const record={
      relevancePending:new Set(),
      relevanceFailureCount:0,
      loader:undefined,
      active:undefined,
      cleanup:undefined,
      current:undefined,
      history:[],
      nativeBinding:undefined
    };
    const callbacks=phases.map(({property})=>{const callback=copied[property];if((callback!==undefined)&&((typeof callback)!=='function'))throw new SourceCollectionError('Resource override must be a function');return callback;});
    const wrappers=phases.map((
      phase,
      index
    )=>function wrappers(value){return capturePhase({
      record,
      index,
      callback:callbacks[index],
      receiver:this,
      value
    });});
    const configured={...copied};for(const [index,phase] of phases.entries())configured[phase.property]=wrappers[index];
    const loader=Reflect.construct(
      DefaultResourceLoader,
      [configured]
    );record.loader=loader;
    for(const [index,phase] of phases.entries())fixed({
      loader,
      name:phase.property,
      value:wrappers[index]
    });
    for(const name of selectorNames){const property=Object.getOwnPropertyDescriptor(
      loader,
      name
    );if((!property)||(!Object.hasOwn(
      property,
      'value'
    )))throw new SourceCollectionError('Native resource selector is not an owned data field');fixed({
      loader,
      name,
      value:property.value
    });}
    for(const [name,value] of Object.entries({
      ...readers,
      ...discoveries
    }))fixed({
      loader,
      name,
      value
    });
    fixed({
      loader,
      name:'reload',
      async value(...args){return await reload({
        record,
        receiver:this,
        args
      });}
    });
    records.set(
      loader,
      record
    );return loader;
  }
  /** Issued only for this factory's actual loader; serialized copies cannot bind native composition. */
  function bindNativeLoader(loader){
    const record=known(loader);
    if(!record.nativeBinding){record.nativeBinding=Object.freeze({});nativeInputBindings.set(
      record.nativeBinding,
      {
        loader,
        read:()=>current(record)
      }
    );}
    return record.nativeBinding;
  }
  /** The existing collector still owns policy, rendered evidence, bounds and its own snapshot identity. */
  function bindCollector({
    loader,
    context,
    readPolicy
  }){
    const record=known(loader);
      const base=createCollector({
      binding:bindConstructionOwner({
        context,
        owner:loader
      }),
      readPolicy
    });
      const snapshots=new WeakMap();
    function capture(options){
      const scope=current(record);
      const original=base.capture(options);
      if(current(record)!==scope)throw new SourceCollectionError('Native resource occurrence changed during collection');
      const value=Object.freeze({
        ...original,
        resourceInputObservation:scope.view
      });
      if(Buffer.byteLength(JSON.stringify(value))>1_048_576)throw new SourceCollectionError('Combined resource collection exceeds total byte bound');
      snapshots.set(
        value,
        {
          scope,
          original
        }
      );return value;
    }
    function assertObservedFresh(snapshot){
      const saved=snapshots.get(snapshot);if(!saved)throw new SourceCollectionError('Resource snapshot is not owned by this collector');
      if(current(record)!==saved.scope)throw new SourceCollectionError('Native resource reload replaced this snapshot');
      base.assertObservedFresh(saved.original);
      if(current(record)!==saved.scope)throw new SourceCollectionError('Native resource occurrence changed during finalization');
    }
    return Object.freeze({
      capture,
      assertObservedFresh
    });
  }
  /** Only the bootstrap holder of this existing constructor owner may designate a governing policy input. */
  function designateGoverningPolicy({
    loader,
    root,
    relativePath,
    requiredMode,
    relevance
  }){
    const record=known(loader);
    if(record.policySelection)throw new SourceCollectionError('Governing policy selection is already fixed for this resource owner');
    const selection=createBootstrapPolicySelection({
      root,
      relativePath,
      requiredMode,
      relevance
    });
    selection.capture();record.policySelection=selection;
  }
  /** Bootstrap and fixed native consumers read the exact constructor-owned policy selection. */
  function captureGoverningPolicy(loader){
    const selection=known(loader)
      .policySelection;
    if(!selection)throw new SourceCollectionError('Resource constructor has no explicit governing policy designation');
    return selection.capture();
  }
  /** Native private-field readers establish the pair; public context/loader labels are not input. */
  function bindSessionCollector(options){
    if((!options)
      ||((typeof options)!=='object')
      ||Reflect.ownKeys(options)
      .some(key=>(key!=='session')&&(key!=='readPolicy')))throw new SourceCollectionError('Session source binding accepts only session and policy reader');
    if(((typeof readSessionLoader)!=='function')||((typeof readSessionPrompt)!=='function')
      ||((typeof readSessionBase)!=='function')
      ||((typeof readSessionRun)!=='function'))throw new SourceCollectionError('Qualified native session resource readers are unavailable');
    const {
      session,
      readPolicy
    }=options;
      const loader=readSessionLoader(session);
      const record=known(loader);
      const snapshots=new WeakMap();
    const {policySelection} = record;
    if(policySelection&&(readPolicy!==undefined))throw new SourceCollectionError('Explicit bootstrap policy selection cannot be replaced by a caller policy reader');
    const policyReader=policySelection?policySelection.readPolicy:readPolicy;
    function paired(){if(readSessionLoader(session)!==loader)throw new SourceCollectionError('Native session changed its original resource loader');}
    function composition(){
      paired();const value=readSessionBase(session);
      if(value.resourceFrame
        !==current(record)
        .view)throw new SourceCollectionError('Native base prompt belongs to another resource occurrence');
      paired();return value;
    }
    const collector=bindCollector({
      loader,
      context:{getSystemPrompt(){composition();const text=readSessionPrompt(session);composition();return text;}},
      readPolicy:policyReader
    });
    return Object.freeze({
      capture(input){
        const policy=policySelection?.capture();
          const base=composition();
          const run=readSessionRun(session);
          const source=collector.capture(input);
        if(policySelection)policySelection.assertCurrent(policy);
        if(readSessionRun(session)!==run)throw new SourceCollectionError('Native run prompt changed during source collection');
        if(composition()!==base)throw new SourceCollectionError('Native base prompt changed during source collection');
        const snapshot=Object.freeze({
          ...source,
          nativeBaseComposition:base,
          nativeRunComposition:run,
          hostGoverningPolicy:policy
        });
        if(Buffer.byteLength(JSON.stringify(snapshot))>1_048_576)throw new SourceCollectionError('Base-linked source collection exceeds total byte bound');
        snapshots.set(
          snapshot,
          {
            base,
            run,
            source,
            policy
          }
        );return snapshot;
      },
      assertObservedFresh(snapshot){
        const saved=snapshots.get(snapshot);if(!saved)throw new SourceCollectionError('Base-linked source snapshot is not owned by this collector');
        if(policySelection)policySelection.assertCurrent(saved.policy);
        if(composition()!==saved.base)throw new SourceCollectionError('Native base prompt was rebuilt after this source snapshot');
        if(readSessionRun(session)!==saved.run)throw new SourceCollectionError('Native run prompt was replaced after this source snapshot');
        collector.assertObservedFresh(saved.source);
        if(readSessionRun(session)!==saved.run)throw new SourceCollectionError('Native run prompt changed during source finalization');
        if(composition()!==saved.base)throw new SourceCollectionError('Native base prompt changed during source finalization');
        if(policySelection)policySelection.assertCurrent(saved.policy);
      }
    });
  }

  async function refreshGoverningRelevance({
    loader,
    signal
  }){
    const record=known(loader);
      const selection=record.policySelection;
    if((typeof selection?.refreshRelevance)!=='function')throw new SourceCollectionError('Governing policy relevance was not configured by this constructor owner');
    if((typeof signal?.throwIfAborted)!=='function')throw new SourceCollectionError('Original relevance refresh cancellation is required');
    signal.throwIfAborted();
    const completion=Promise.withResolvers();record.relevancePending
      .add(completion.promise);
    try{
      const view=await selection.refreshRelevance({signal});
      signal.throwIfAborted();selection.assertRelevanceCurrent(view);return view;
    }catch(error){record.relevanceFailureCount+=1;throw error;}
    finally{record.relevancePending
      .delete(completion.promise);completion.resolve();}
  }
  function readGoverningRelevance(loader){
    const selection=known(loader)
      .policySelection;
    if((typeof selection?.readRelevance)!=='function')throw new SourceCollectionError('Governing policy relevance is unavailable; keep rules included');
    return selection.readRelevance();
  }
  function assertGoverningRelevanceCurrent({
    loader,
    view
  }){
    const selection=known(loader)
      .policySelection;
    if((typeof selection?.assertRelevanceCurrent)!=='function')throw new SourceCollectionError('Governing policy relevance is unavailable');
    selection.assertRelevanceCurrent(view);
  }
  function inspect(loader){
    const record=known(loader);
    return Object.freeze({
      retainedOnly:true,
      relevancePending:record.relevancePending
        .size,
      relevanceFailureCount:record.relevanceFailureCount,
      pending:record.active!==undefined,
      cleanupPending:record.cleanup!==undefined,
      currentOrdinal:record.current
        ?.ordinal,
      history:Object.freeze(record.history
        .map(scope=>Object.freeze({
          ordinal:scope.ordinal,
          status:scope.status,
          stages:Object.freeze([...scope.phases]),
          failures:Object.freeze([...scope.failures]),
          unbound:Object.freeze([...scope.unbound])
        })))
    });
  }
  /** Native reload work is published before callbacks; this wait is cleanup, not current-use permission. */
  async function drain(loader){const record=known(loader);await Promise.all([
    ...record.history
      .map(scope=>scope.completion
        .promise),
    ...record.relevancePending
  ]);}
  return Object.freeze({
    create,
    bindCollector,
    bindSessionCollector,
    bindNativeLoader,
    designateGoverningPolicy,
    captureGoverningPolicy,
    refreshGoverningRelevance,
    readGoverningRelevance,
    assertGoverningRelevanceCurrent,
    inspect,
    drain
  });
}
