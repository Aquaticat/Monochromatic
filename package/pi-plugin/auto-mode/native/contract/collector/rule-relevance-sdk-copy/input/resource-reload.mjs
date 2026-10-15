import {SourceCollectionError} from '../../collector.mjs';
import {ResourceInputCustodyError,RecordedInputFailure,failed,publicFailure} from './resource-failures.mjs';
import {snapshotInput} from '../../resource-input-custody/values.ts';
import {phases} from './resource-methods.mjs';
/** Publish and retire original native resource reload occurrences. */
export function createResourceReload({readers,discoveries,nativeReload}){
  function finishReload({record,scope}){
    record.active=undefined;
    if(scope.pending.length>0){
      record.cleanup=scope;
      async function finishUnbound(){
        scope.unbound=Object.freeze((await Promise.all(scope.pending)).flat()
          .map(function freezeUnboundResult(value){return Object.freeze(value);}));
        record.cleanup=undefined;
        scope.completion.resolve();
      }
      void finishUnbound();
    }else scope.completion.resolve();
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
      .some(function isChangedReference(value,
        index) { return (value!==references[index]); })
      ||(JSON.stringify(outputs.copies)!==JSON.stringify(scope.phases
        .map(function readCapturedOutput(value) { return (value.after); }))))throw new SourceCollectionError('Native resource output differs from its captured transformation result');
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
    /** Callback results must settle before reload cleanup can close. @type {Promise<PromiseSettledResult<unknown>[]>[]} */
    const pending=[];
    const scope={
      identity:Object.freeze({}),
      ordinal:record.history
        .length,
      status:'pending',
      phases:[],
      returns:[],
      failures:[],
      pending,
      unbound:Object.freeze([]),
      completion:Promise.withResolvers(),
      busy:false,
      view:undefined
    };
    record.current=undefined;record.active=scope;record.history
      .push(scope);
    using reloadActivity={ [Symbol.dispose](){finishReload({record,scope});} };
    const nativeReturn={value:undefined};
    try{
      try{nativeReturn.value=await Reflect.apply(nativeReload,record.loader,args);}
      catch(error){
        if(!((error instanceof RecordedInputFailure)&&(error.scope===scope)
          &&scope.failures.includes(error.occurrence)))failed({scope,error,at:'native-reload'});
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
      scope.status='ready';record.current=scope;return nativeReturn.value;
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
    }
  }
return {current,reload};
}
