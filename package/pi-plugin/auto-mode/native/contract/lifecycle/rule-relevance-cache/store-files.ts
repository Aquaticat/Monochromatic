/**
 Cache filesystem admission keeps missing files distinct from invalid persisted estimates.
 @module
 */
import {lstat,mkdir} from 'node:fs/promises';
import {observeDeclaredFile} from '../external-dependency-controls/file-observer.ts';
import {ObservedFileMissingError} from '../external-dependency-controls/errors.ts';
import {CACHE_ENTRY_MISSING,RuleRelevanceCacheError} from './definition.ts';
import type {CacheTrace,RelevanceEntry} from './store-types.ts';

//region Namespace and filename construction admit only bounded original identities.
/**
 Admit only private ordinary directories before cache reads or publications.
 @param path - application-owned cache directory
 @param trace - original diagnostic sink
 @throws RuleRelevanceCacheError when directory type or permissions differ
 */
export async function privateDirectory({path,trace}:{readonly path:string;readonly trace:CacheTrace}):Promise<void>{
 try{
  await mkdir(path,{mode:0o700});
 }
 catch(error){
  if((typeof error!=='object')||(error===null)||!('code' in error)||(error.code!=='EEXIST'))throw error;
  trace({event:'cache-directory-present',path,error});
 }
 /** Directory metadata is observed after creation or the original existence failure. */
 const stat=await lstat(path);
 if((!stat.isDirectory())||stat.isSymbolicLink()||((stat.mode&0o777)!==0o700)){
  throw new RuleRelevanceCacheError(`Relevance cache directory is not a private ordinary directory: ${path}`);
 }
}
/**
 Bound every cache filename before path construction.
 @param key - requested content digest
 @returns filename beneath the original namespace directory
 @throws RuleRelevanceCacheError when the key is not a lowercase SHA-256 spelling
 */
export function cacheFilename(key:string):string{
 if((typeof key!=='string')||(key.length!==64))throw new RuleRelevanceCacheError('Cache entry key is not a content digest');
 for(const character of key){
  if(!'abcdef0123456789'.includes(character))throw new RuleRelevanceCacheError('Cache entry key is not a content digest');
 }
 return `${key}.json`;
}
//endregion

//region Parsed JSON remains unknown until complete schema and profile validation.
/**
 Preserve parse diagnostics under the cache failure category.
 @param text - completed descriptor-bound UTF-8 bytes
 @param key - original digest retained in failure diagnostics
 @returns untrusted parsed JSON value
 @throws RuleRelevanceCacheError when the persisted JSON cannot be parsed
 */
function parseEntry({text,key}:{readonly text:string;readonly key:string}):unknown{
 try{
  return JSON.parse(text);
 }
 catch(error){
  throw new RuleRelevanceCacheError(`Relevance cache entry is incomplete or malformed: ${key}`,{cause:error});
 }
}
/**
 Prove the complete persisted contract before exposing an estimate.
 @param value - untrusted parsed JSON value
 @returns whether every admitted field matches the fixed persisted schema
 */
function validEntry(value:unknown):value is RelevanceEntry{
 return (typeof value==='object')&&(value!==null)
  &&(Object.keys(value).toSorted().join(',')==='key,probability,profileKey,qualification,schema')
  &&('schema' in value)&&(value.schema===1)
  &&('key' in value)&&(typeof value.key==='string')
  &&('profileKey' in value)&&(typeof value.profileKey==='string')
  &&('qualification' in value)&&(value.qualification==='not-established')
  &&('probability' in value)&&(typeof value.probability==='number')
  &&Number.isFinite(value.probability)&&(value.probability>=0)&&(value.probability<=1);
}
/**
 Read completed bytes from the original descriptor and preserve ordinary cache absence.
 @param root - already-validated namespace directory
 @param key - original requested digest
 @param profileKey - fixed classifier profile
 @param trace - original diagnostic sink
 @returns validated frozen entry or the explicit missing-estimate sentinel
 @throws RuleRelevanceCacheError when persisted fields fail admission
 */
export function readPersistedEntry({root,key,profileKey,trace}:{
 readonly root:string;readonly key:string;readonly profileKey:string;readonly trace:CacheTrace;
}):RelevanceEntry|typeof CACHE_ENTRY_MISSING{
 /** Path construction validates the digest before opening the declared file. */
 const filename=cacheFilename(key);
 /** Only the missing-file exception becomes an ordinary cache miss. */
 const captured:{text?:string}={};
 try{
  captured.text=observeDeclaredFile({root,relativePath:filename,requiredMode:0o600,maxBytes:4_096}).bytes.toString('utf8');
 }
 catch(error){
  if(error instanceof ObservedFileMissingError){
   trace({event:'cache-miss',key,error});
   return CACHE_ENTRY_MISSING;
  }
  throw error;
 }
 /** JSON values acquire no trusted fields merely by parsing successfully. */
 const entry=parseEntry({text:captured.text,key});
 if((!validEntry(entry))||(entry.key!==key)||(entry.profileKey!==profileKey)){
  throw new RuleRelevanceCacheError(`Relevance cache entry has a different profile or invalid estimate: ${key}`);
 }
 trace({event:'cache-hit',key});
 return Object.freeze(entry);
}
//endregion
