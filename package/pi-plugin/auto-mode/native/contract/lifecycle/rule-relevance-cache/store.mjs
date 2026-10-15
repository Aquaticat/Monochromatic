import {createHash} from 'node:crypto';
import {
  lstat,
  mkdir,
  writeFile
} from 'node:fs/promises';
import {join} from 'node:path';
import {observeDeclaredFile} from '../external-dependency-controls/file-observer.mjs';
import {ObservedFileMissingError} from '../external-dependency-controls/errors.ts';
import {RuleRelevanceCacheError} from './definition.mjs';

export function digest(value) { return createHash('sha256')
  .update(value)
  .digest('hex'); }
/** Only application-owned private directories may contain persisted relevance data. */
async function privateDirectory({
  path,
  trace
}){
 try{await mkdir(
   path,
   {mode:0o700}
 );}
 catch(error){if(error?.code!=='EEXIST')throw error;trace({
   event:'cache-directory-present',
   path,
   error
 });}
 const stat=await lstat(path);
 if((!stat.isDirectory())||stat.isSymbolicLink()
   ||((stat.mode&0o777)!==0o700))throw new RuleRelevanceCacheError(`Relevance cache directory is not a private ordinary directory: ${path}`);
}
/** Fixed lowercase SHA-256 spelling bounds every cache filename before path construction. */
function isContentDigest(value){
 if(typeof value!=='string'||value.length!==64)return false;
 for(const character of value)if(!'abcdef0123456789'.includes(character))return false;
 return true;
}
/** Retain JSON parse failures under the original cache error category. */
function readCacheEntry({observed,key}){
 try{return JSON.parse(observed.bytes.toString('utf8'));}
 catch(error){throw new RuleRelevanceCacheError(
  `Relevance cache entry is incomplete or malformed: ${key}`,
  {cause:error}
 );}
}
/** Content-addressed data cache, not an approval store or source-authentication mechanism. */
export function createRelevanceStore({
  directory,
  namespace,
  profileKey,
  trace
}){
 if(((typeof directory)!=='string')||(!directory)
   ||((typeof trace)!=='function'))throw new RuleRelevanceCacheError('Private cache directory and diagnostic sink are required');
 for(const key of [
   'repository',
   'primaryBranch'
 ])if(((typeof namespace?.[key])!=='string')||(!namespace[key])
   ||(namespace[key]
     .length
     >4_096))throw new RuleRelevanceCacheError('Repository identity and primary branch are required cache namespace data');
 const namespaceKey=digest(JSON.stringify({
   repository:namespace.repository,
   primaryBranch:namespace.primaryBranch
 }));
 const root=join(
   directory,
   namespaceKey
 );
 const initialization={pending:undefined};
 const publications=new Map();
 async function initialize(){
  await privateDirectory({path:directory,trace});
  await privateDirectory({path:root,trace});
 }
 async function ready(){
  initialization.pending??=initialize();
  await initialization.pending;
 }

 function fileFor(key){
  if(!isContentDigest(key))throw new RuleRelevanceCacheError('Cache entry key is not a content digest');
  return `${key}.json`;
 }
 function readEntry(key){
  const filename=fileFor(key);
  const capture={observed:undefined};
  try{capture.observed=observeDeclaredFile({
    root,
    relativePath:filename,
    requiredMode:0o600,
    maxBytes:4_096
  });}
  catch(error){
   if(error instanceof ObservedFileMissingError){trace({
     event:'cache-miss',
     key,
     error
   });return undefined;}
   throw error;
  }
  const entry=readCacheEntry({observed:capture.observed,key});
  if((Object.keys(entry)
    .toSorted()
    .join(',')
    !=='key,probability,profileKey,qualification,schema')||(entry.schema!==1)
    ||(entry.key!==key)
    ||(entry.profileKey!==profileKey)
    ||(entry.qualification!=='not-established')
    ||(!Number.isFinite(entry.probability))
    ||(entry.probability<0)
    ||(entry.probability>1))
   throw new RuleRelevanceCacheError(`Relevance cache entry has a different profile or invalid estimate: ${key}`);
  trace({
    event:'cache-hit',
    key
  });return Object.freeze(entry);
 }
 async function read(key){
  fileFor(key);
  await ready();
  const pending=publications.get(key);
  if(pending!==undefined)await pending;
  return readEntry(key);
 }
 async function publish({entry,filename}){
  const {key}=entry;
  try{await writeFile(
    join(
      root,
      filename
    ),
    `${JSON.stringify(entry)}\n`,
    {
      flag:'wx',
      mode:0o600
    }
  );}
  catch(error){
   if(error?.code!=='EEXIST')throw error;
   // A complete existing entry wins; never average scores or overwrite another writer.
   trace({
     event:'cache-publication-already-exists',
     key,
     error
   });return readEntry(key);
  }
  trace({
    event:'cache-published',
    key
  });return entry;
 }
 async function put({key,probability}){
  if((!Number.isFinite(probability))||(probability<0)
    ||(probability>1))throw new RuleRelevanceCacheError('Relevance estimate must be finite and between zero and one');
  const filename=fileFor(key);
  await ready();
  const pending=publications.get(key);
  if(pending!==undefined)return await pending;
  const entry=Object.freeze({schema:1,key,profileKey,probability,qualification:'not-established'});
  const publication=publish({entry,filename});
  publications.set(key,publication);
  using publicationScope={
   [Symbol.dispose](){publications.delete(key);}
  };
  return await publication;
 }
 return Object.freeze({
   read,
   put,
   namespaceKey
 });
}
