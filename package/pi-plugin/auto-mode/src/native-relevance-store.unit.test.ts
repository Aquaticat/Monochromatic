/**
 Built cache publication uses disposable directories and keeps estimates unqualified.
 @module
 */
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,stat,symlink,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {describe,it} from '@monochromatic-dev/module-test/ts';

//region The built store is checked through its consumer contract.
/** Persisted relevance never supplies policy permission. */
type Entry={
  /** Original content digest. */
  readonly key:string;
  /** Fixed profile identity. */
  readonly profileKey:string;
  /** Retained estimate. */
  readonly probability:number;
  /** Qualification remains absent. */
  readonly qualification:'not-established';
};
/** Async operations retain the synchronous cache owner. */
type Store={
  /** Namespace remains available before I/O. */
  readonly namespaceKey:string;
  /** Missing files remain cache misses. */
  readonly read:(key:string)=>Promise<unknown>;
  /** Original completed publication wins over later estimates. */
  readonly put:(input:{readonly key:string;readonly probability:number})=>Promise<Entry>;
};
/** Only required built exports are admitted by the fixture. */
type StoreModule={
  /** Content-addressed names use the production digest. */
  readonly digest:(value:string)=>string;
  /** Construction validates inputs without starting uncaptured filesystem work. */
  readonly createRelevanceStore:(input:{
    readonly directory:string;
    readonly namespace:{readonly repository:string;readonly primaryBranch:string};
    readonly profileKey:string;
    readonly trace:(event:{readonly event:string})=>void;
  })=>Store;
};
/**
 Require callable artifact exports before invoking cache operations.
 @param value - copied module namespace
 @throws Error when required exports are missing
 */
function assertStoreModule(value:unknown):asserts value is StoreModule{
  if((value===null)||((typeof value)!=='object')||(!('digest' in value))||((typeof value.digest)!=='function')
    ||(!('createRelevanceStore' in value))||((typeof value.createRelevanceStore)!=='function')){
    throw new Error('Built relevance store exports are unavailable');
  }
}
/** Original artifact selected through the native consumer's file URL. */
const loaded:unknown=await import(new URL(
  '../dist/native/contract/lifecycle/rule-relevance-cache/store.mjs',import.meta.url
).href);
assertStoreModule(loaded);
/** Fixed checked callable exports. */
const storeModule=loaded;
//endregion

//region Every mutation belongs to an independent disposable cache directory.
/** Test-owned cache and its observable publication events. */
type Fixture=AsyncDisposable&{
  /** Exclusive disposable parent. */
  readonly root:string;
  /** Cache root is created only by the operation under test. */
  readonly directory:string;
  /** Original built owner. */
  readonly store:Store;
  /** Exact diagnostic event names. */
  readonly events:string[];
};
/**
 Allocate one cache without changing existing files or global permissions.
 @returns disposable fixture owning all filesystem mutations
 */
async function fixture():Promise<Fixture>{
  /** Shared scratch parent has no test data of its own. */
  const scratch=join(homedir(),'temp/agent');
  await mkdir(scratch,{recursive:true,mode:0o700});
  /** New directory is private and unique to this body. */
  const root=await mkdtemp(join(scratch,'pi-native-relevance-'));
  /** Store initialization must create and validate this absent path. */
  const directory=join(root,'cache');
  /** Diagnostic retention never reads source content. */
  const events:string[]=[];
  /** Original cache owner, including its asynchronous initialization lifetime. */
  const store=storeModule.createRelevanceStore({
    directory,namespace:{repository:'fixture',primaryBranch:'main'},profileKey:'fixture-profile',
    trace:function retainEvent(event){
      events.push(event.event);
    },
  });
  return {root,directory,store,events,
    async [Symbol.asyncDispose](){
      await rm(root,{recursive:true,force:true});
    }
  };
}
/**
 Capture asynchronous failure without hiding a successful operation.
 @param operation - original cache operation already started by its owner
 @returns original rejected value
 @throws Error when the operation unexpectedly succeeds
 */
async function failure(operation:Promise<unknown>):Promise<unknown>{
  try{
    await operation;
  }
  catch(error){
    return error;
  }
  throw new Error('Cache operation unexpectedly succeeded');
}
/**
 Assert the original diagnostic without regular-expression matching.
 @param error - original rejection
 @param message - required diagnostic text
 */
function assertFailure({error,message}:{readonly error:unknown;readonly message:string}):void{
  assert.ok(Error.isError(error));
  assert.ok(error.message.includes(message),error.message);
}
//endregion

await describe({name:'',children:[
  it({name:'publishes private complete entries and preserves the original value',fn:async function originalPublication(){
    await using current=await fixture();
    const key=storeModule.digest('original');
    assert.equal(await current.store.read(key),undefined);
    assert.equal((await stat(current.directory)).mode&0o777,0o700);
    const first=await current.store.put({key,probability:0.25});
    assert.equal(first.qualification,'not-established');
    assert.ok(Object.isFrozen(first));
    assert.equal(Object.hasOwn(first,'permission'),false);
    assert.deepEqual(await current.store.read(key),first);
    assert.equal((await current.store.put({key,probability:0.75})).probability,0.25);
    assert.equal((await stat(join(current.directory,current.store.namespaceKey,`${key}.json`))).mode&0o777,0o600);
    assert.equal(current.events.filter(function published(event){
      return event==='cache-published';
    }).length,1);
  }}),
  it({name:'joins concurrent same-key publications before reading the original entry',fn:async function sharedPublication(){
    await using current=await fixture();
    const key=storeModule.digest('concurrent');
    const pending=[0.125,0.25,0.5,0.75].map(function publish(probability){
      return current.store.put({key,probability});
    });
    const read=current.store.read(key);
    const entries=await Promise.all(pending);
    assert.equal(entries.length,4);
    for(const entry of entries)assert.equal(entry.probability,0.125);
    assert.deepEqual(await read,entries[0]);
    assert.equal(current.events.filter(function published(event){
      return event==='cache-published';
    }).length,1);
  }}),
  it({name:'rejects symlink cache directories before publication',fn:async function rejectSymlink(){
    await using current=await fixture();
    const target=join(current.root,'target');
    await mkdir(target,{mode:0o700});
    await symlink(target,current.directory);
    const error=await failure(
      current.store.read(storeModule.digest('missing')),
    );
    assertFailure({error,message:'not a private ordinary directory'});
  }}),
  it({name:'rejects malformed and mismatched persisted entries',fn:async function invalidPersistedEntry(){
    await using current=await fixture();
    const key=storeModule.digest('malformed');
    assert.equal(await current.store.read(key),undefined);
    const path=join(current.directory,current.store.namespaceKey,`${key}.json`);
    await writeFile(path,'{',{mode:0o600});
    assertFailure({error:await failure(current.store.read(key)),message:'incomplete or malformed'});
    await writeFile(path,JSON.stringify({schema:1,key,profileKey:'another-profile',probability:0.5,qualification:'not-established'}));
    assertFailure({error:await failure(current.store.read(key)),message:'different profile or invalid estimate'});
  }}),
  ...['../escape','A'.repeat(64),'a'.repeat(63),'a'.repeat(65),`${'a'.repeat(64)}\n`].map(function invalidKey(key){
    return it({name:`rejects non-digest filename ${JSON.stringify(key)}`,fn:async function rejectFilename(){
      await using current=await fixture();
      assertFailure({error:await failure(current.store.read(key)),message:'not a content digest'});
      assertFailure({error:await failure(current.store.put({key,probability:0.5})),message:'not a content digest'});
    }});
  }),
  ...[-0.1,1.1,Number.NaN,Number.POSITIVE_INFINITY].map(function invalidProbability(probability){
    return it({name:`rejects invalid estimate ${String(probability)}`,fn:async function rejectEstimate(){
      await using current=await fixture();
      assertFailure({error:await failure(current.store.put({key:storeModule.digest('invalid'),probability})),message:'finite and between zero and one'});
    }});
  }),
]});
