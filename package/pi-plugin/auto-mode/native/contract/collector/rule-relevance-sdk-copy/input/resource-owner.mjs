import {SourceCollectionError} from '../../collector.mjs';
import {copyOptions} from '../../resource-input-custody/values.ts';
import {phases,readerNames,selectorNames,discoveryNames} from './resource-methods.mjs';
import {createResourceCapture} from './resource-capture.mjs';
import {createResourceReload} from './resource-reload.mjs';
import {createResourceBindings} from './resource-bindings.mjs';
import {createResourcePolicy} from './resource-policy.mjs';
export {ResourceInputCustodyError} from './resource-failures.mjs';
export {readBoundResourceFrame,assertBoundResourceInputs} from './resource-bindings.mjs';















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
    const readers=Object.fromEntries(readerNames.map(function readNativeReader(name) { return ([
    name,
    DefaultResourceLoader?.prototype?.[name]
  ]); }));
    const discoveries=Object.fromEntries(discoveryNames.map(function readNativeDiscovery(name) { return ([
    name,
    DefaultResourceLoader?.prototype?.[name]
  ]); }));
  if(((typeof nativeReload)!=='function')||[
    ...Object.values(readers),
    ...Object.values(discoveries)
  ].some(function isMissingMethod(value) { return ((typeof value)!=='function'); }))throw new SourceCollectionError('Qualified native resource loader methods are unavailable');
  const records=new WeakMap();
  const {capturePhase}=createResourceCapture();
  const {current,reload}=createResourceReload({readers,discoveries,nativeReload});
  const {bindNativeLoader,bindCollector,bindSessionCollector}=createResourceBindings({known,current,readSessionLoader,readSessionPrompt,readSessionBase,readSessionRun});
  const {designateGoverningPolicy,captureGoverningPolicy,refreshGoverningRelevance,readGoverningRelevance,assertGoverningRelevanceCurrent}=createResourcePolicy({known});

  function known(loader){const record=records.get(loader);if(!record)throw new SourceCollectionError('Resource loader was not created by this constructor owner');return record;}
  
  
  
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
    const callbacks=phases.map(function readConfiguredCallback({property}) {const callback=copied[property];if((callback!==undefined)&&((typeof callback)!=='function'))throw new SourceCollectionError('Resource override must be a function');return callback;});
    const wrappers=phases.map(function createPhaseWrapper(phase,
      index) { return (function wrappers(value){return capturePhase({
      record,
      index,
      callback:callbacks[index],
      receiver:this,
      value
    });}); });
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
      async value(options){return await reload({
        record,
        receiver:this,
        args:[options]
      });}
    });
    records.set(
      loader,
      record
    );return loader;
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
        .map(function inspectReloadOccurrence(scope) { return (Object.freeze({
          ordinal:scope.ordinal,
          status:scope.status,
          stages:Object.freeze([...scope.phases]),
          failures:Object.freeze([...scope.failures]),
          unbound:Object.freeze([...scope.unbound])
        })); }))
    });
  }
  /** Native reload work is published before callbacks; this wait is cleanup, not current-use permission. */
  async function drain(loader){const record=known(loader);await Promise.all([
    ...record.history
      .map(function readReloadCompletion(scope) { return (scope.completion
        .promise); }),
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
