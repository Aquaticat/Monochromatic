import {bindConstructionOwner,createCollector,SourceCollectionError} from '../../collector.mjs';
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
/** Bind original resource, base, and session observations without issuing new authority. */
export function createResourceBindings({known,current,readSessionLoader,readSessionPrompt,readSessionBase,readSessionRun}){
/** Issued only for this factory's actual loader; serialized copies cannot bind native composition. */
  function bindNativeLoader(loader){
    const record=known(loader);
    if(!record.nativeBinding){record.nativeBinding=Object.freeze({});nativeInputBindings.set(
      record.nativeBinding,
      {
        loader,
        read:function readCurrentResource() { return (current(record)); }
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
/** Native private-field readers establish the pair; public context/loader labels are not input. */
  function bindSessionCollector(options){
    if((!options)
      ||((typeof options)!=='object')
      ||Reflect.ownKeys(options)
      .some(function isUnexpectedBindingKey(key) { return ((key!=='session')&&(key!=='readPolicy')); }))throw new SourceCollectionError('Session source binding accepts only session and policy reader');
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
return {bindNativeLoader,bindCollector,bindSessionCollector};
}
