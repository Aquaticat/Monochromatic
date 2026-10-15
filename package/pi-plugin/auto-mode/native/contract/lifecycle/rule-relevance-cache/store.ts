/**
 Private relevance storage joins owner-local publications and retains original completed estimates.
 @module
 */
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {CACHE_ENTRY_MISSING,RuleRelevanceCacheError} from './definition.ts';
import {cacheFilename,privateDirectory,readPersistedEntry} from './store-files.ts';
import type {RelevanceEntry,RelevancePublication,RelevanceStore,RelevanceStoreInput} from './store-types.ts';

//region The synchronous owner retains fixed namespace and asynchronous work lifetimes.
/**
 Derive the original content-addressed identity without interpreting the input.
 @param value - exact serialized namespace, profile, or rule material
 @returns lowercase SHA-256 spelling
 */
export function digest(value:string):string{
 return createHash('sha256').update(value).digest('hex');
}
/**
 Construct a content-addressed data cache without starting uncaptured filesystem work.
 @param directory - application-owned private cache parent
 @param namespace - original repository and primary branch identities
 @param profileKey - fixed classifier profile digest
 @param trace - original diagnostic sink
 @returns owner joining initialization and same-key publication before exposing estimates
 @throws RuleRelevanceCacheError when directory, namespace, or diagnostic configuration is invalid
 */
export function createRelevanceStore({directory,namespace,profileKey,trace}:RelevanceStoreInput):RelevanceStore{
 if((typeof directory!=='string')||(directory.length===0)||(typeof trace!=='function')){
  throw new RuleRelevanceCacheError('Private cache directory and diagnostic sink are required');
 }
 for(const key of ['repository','primaryBranch'] as const){
  if((typeof namespace?.[key]!=='string')||(namespace[key].length===0)||(namespace[key].length>4_096)){
   throw new RuleRelevanceCacheError('Repository identity and primary branch are required cache namespace data');
  }
 }
 /** Identical repositories share a directory without sharing instruction authority. */
 const namespaceKey=digest(JSON.stringify({repository:namespace.repository,primaryBranch:namespace.primaryBranch}));
 /** Namespace isolation follows validated original repository identities. */
 const root=join(directory,namespaceKey);
 /** Initialization is started only by the first asynchronous operation. */
 const initialization:{pending?:Promise<void>}={};
 /** Concurrent same-key operations retain the first owner's publication. */
 const publications=new Map<string,Promise<RelevanceEntry>>();
 /** Validate the parent before creating and validating its namespace directory. */
 async function initialize():Promise<void>{
  await privateDirectory({path:directory,trace});
  await privateDirectory({path:root,trace});
 }
 /** Join original initialization, including any original rejection. */
 async function ready():Promise<void>{
  initialization.pending??=initialize();
  await initialization.pending;
 }
 /**
  Retain the original namespace and classifier profile during every disk read.
  @param key - requested content digest
  @returns completed estimate or the explicit missing-estimate sentinel
  */
 function readEntry(key:string):RelevanceEntry|typeof CACHE_ENTRY_MISSING{
  return readPersistedEntry({root,key,profileKey,trace});
 }
 /**
  Join an owner-local publication before observing completed persisted bytes.
  @param key - requested content digest
  @returns completed estimate or the explicit missing-estimate sentinel
  */
 async function read(key:string):Promise<RelevanceEntry|typeof CACHE_ENTRY_MISSING>{
  cacheFilename(key);
  await ready();
  /** A reader of an active owner-local write waits for that original operation. */
  const pending=publications.get(key);
  if(pending!==undefined)await pending;
  return readEntry(key);
 }
 /**
  Publish once or reuse the complete existing estimate without averaging or overwriting.
  @param entry - original frozen estimate
  @param filename - validated relative digest filename
  @returns first completed estimate retained for the digest
  @throws RuleRelevanceCacheError when an existing entry disappears before reuse
  */
 async function publish({entry,filename}:{readonly entry:RelevanceEntry;readonly filename:string}):Promise<RelevanceEntry>{
  /** The original key remains attached to every publication diagnostic. */
  const {key}=entry;
  try{
   await writeFile(join(root,filename),`${JSON.stringify(entry)}\n`,{flag:'wx',mode:0o600});
  }
  catch(error){
   if((typeof error!=='object')||(error===null)||!('code' in error)||(error.code!=='EEXIST'))throw error;
   trace({event:'cache-publication-already-exists',key,error});
   /** External removal cannot turn a failed exclusive write into a successful publication. */
   const existing=readEntry(key);
   if(typeof existing==='symbol'){
    if(existing!==CACHE_ENTRY_MISSING)throw new RuleRelevanceCacheError(`Unknown relevance cache absence: ${key}`);
    throw new RuleRelevanceCacheError(`Existing relevance cache entry disappeared before reuse: ${key}`);
   }
   return existing;
  }
  trace({event:'cache-published',key});
  return entry;
 }
 /**
  Validate and retain the first owner-local publication for one content digest.
  @param key - requested digest, validated before any filesystem operation
  @param probability - original finite relevance estimate in the closed unit interval
  @returns completed original estimate
  @throws RuleRelevanceCacheError when the estimate or digest cannot be admitted
  */
 async function put({key,probability}:RelevancePublication):Promise<RelevanceEntry>{
  if((!Number.isFinite(probability))||(probability<0)||(probability>1)){
   throw new RuleRelevanceCacheError('Relevance estimate must be finite and between zero and one');
  }
  /** Filename validation precedes cache initialization. */
  const filename=cacheFilename(key);
  await ready();
  /** Existing owner-local publication remains authoritative for this digest. */
  const pending=publications.get(key);
  if(pending!==undefined)return await pending;
  /** Persisted data carries no permission and no semantic exclusion qualification. */
  const entry:RelevanceEntry=Object.freeze({schema:1,key,profileKey,probability,qualification:'not-established'});
  /** Register the original asynchronous operation before yielding to its completion. */
  const publication=publish({entry,filename});
  publications.set(key,publication);
  /** Completion or rejection releases only this operation's owner-local pending slot. */
  using publicationScope={
   [Symbol.dispose](){
    publications.delete(key);
   }
  };
  return await publication;
 }
 return Object.freeze({read,put,namespaceKey});
}
//endregion
