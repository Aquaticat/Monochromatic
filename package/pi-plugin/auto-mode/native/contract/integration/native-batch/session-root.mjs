import {createManagerConstructorOwner} from '../../lifecycle/runtime-custody/manager-owner.ts';
import {createNativeManagerRegistry} from '../../lifecycle/root-lifecycle-retirement-entry/registry.mjs';
import {createSessionRootReader} from '../../lifecycle/root-lifecycle-retirement-entry/root-reader.mjs';
import {createRuntimeFactoryScopes} from '../../lifecycle/runtime-factory-scopes/scopes.mjs';

export class NativeSessionRootError extends Error {
 constructor(
   message,
   options
 ){super(
   message,
   options
 );this.name=this.constructor
   .name;}
}

/** Copy the direct SDK result, not an invented runtime-services result. */
function prepareSdkResult(result){
 if((!result)||((typeof result)!=='object')
   ||(Object.getPrototypeOf(result)!==Object.prototype))throw new NativeSessionRootError('SDK construction requires its ordinary original result');
 const fields={};
 for(const key of [
   'session',
   'extensionsResult',
   'modelFallbackMessage'
 ]){
  const descriptor=Object.getOwnPropertyDescriptor(
    result,
    key
  );
  if((!descriptor)&&(key==='modelFallbackMessage'))continue;
  if((!descriptor)||(!Object.hasOwn(
    descriptor,
    'value'
  )))throw new NativeSessionRootError(`SDK result lacks original data field ${key}`);
  fields[key]=descriptor.value;
 }
 return Object.freeze(fields);
}

/**
 Bind actual SDK construction to incumbent constructor, root and cleanup owners.
 Bootstrap selects native readers once. Publication has no fallible work after it.
 */
export function createRootSessionFactory({
  createAgentSession,
  SessionManager,
  readActiveSessionManager,
  readRootOccurrence,
  readSessionDisposalState,
  onSessionRegistered
}){
 if((onSessionRegistered!==undefined)&&((typeof onSessionRegistered)!=='function'))throw new NativeSessionRootError('Session registration observer must be fixed by the original bootstrap');
 const owner=createManagerConstructorOwner(SessionManager);
 const sessions=new WeakMap();
 const accounting={
   registryRequests:0,
   returnedRegistries:0,
   canonicalManagerStatesCreated:0,
   reusedCanonicalStateBinds:0
 };
 const {lifecycle} = createNativeManagerRegistry({
   owner,
   sessionOwner:{assertOwned({
     session,
     manager
   }){
   if(sessions.get(session)!==manager)throw new NativeSessionRootError('Session was not emitted by this original SDK construction');
  }},
   readRootOccurrence:createSessionRootReader({
     readActiveSessionManager,
     readManagerOccurrence:readRootOccurrence
   }),
   trace(){},
   accounting
 });
 const scopes=createRuntimeFactoryScopes({
   lifecycle,
   readManager:readActiveSessionManager,
   prepareResult:prepareSdkResult,
   assertRuntimeResult(result){readActiveSessionManager(result.session);},
   disposeSession(session){
   session.dispose();
   if(readSessionDisposalState(session)
     .completed
     !==true)throw new NativeSessionRootError('Original SDK disposal did not complete; retry owned construction cleanup');
  }
 });
 async function createFromManager({
   options,
   manager
 }){
  if(scopes.diagnostics()
    .pendingCleanup)throw new NativeSessionRootError('Native construction cleanup is pending; retry it before creating another session');
  if((options.sessionManager!==undefined)||(options.ownerFactoryScope!==undefined))throw new NativeSessionRootError('Session and construction ownership are selected through this factory, not SDK option overrides');
  owner.assertOwned(manager);
  const scope=scopes.begin({manager});
  let registered;
  try{
   const result=await createAgentSession({
     ...options,
     sessionManager:manager,
     ownerFactoryScope:{registerSession(session){
     if(registered)throw new NativeSessionRootError('SDK construction emitted more than one original session');
     if(sessions.has(session))throw new NativeSessionRootError('SDK construction cannot reuse a session already owned by this factory');
     sessions.set(
       session,
       manager
     );scope.registerSession(session);registered=session;
     onSessionRegistered?.({
       session,
       manager,
       lifecycle,
       options
     });
    }}
   });
   const prepared=scope.accept(result);
   const root=Object.freeze({
     session:prepared.session,
     manager
   });
   const published=Object.freeze({
     ...prepared,
     root,
     lifecycle
   });
   scope.publish(prepared);
   return published;
  }catch(error){
   const failures=[error];
   try{scope.abort();}catch(cleanupError){failures.push(cleanupError);}
   if(failures.length>1)throw new AggregateError(
     failures,
     'Native session construction and cleanup failed',
     { cause: error }
   );
   throw error;
  }
 }
 async function create({
   options,
   createManager=function createDefaultMemoryManager(constructors) { return (constructors.inMemory(options.cwd)); }
 }){
  return await createFromManager({
    options,
    manager:createManager(owner.managers)
  });
 }
 return Object.freeze({
   create,
   createFromManager,
   managers:owner.managers,
   lifecycle,
   retryCleanup:scopes.retryCleanup,
   diagnostics:scopes.diagnostics
 });
}
