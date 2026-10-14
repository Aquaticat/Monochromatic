import {createHash} from 'node:crypto';
import {
  lstatSync,
  mkdirSync,
  writeFileSync
} from 'node:fs';
import {join} from 'node:path';
import {observeDeclaredFile} from '../external-dependency-controls/file-observer.mjs';
import {ObservedFileMissingError} from '../external-dependency-controls/errors.mjs';
import {RuleRelevanceCacheError} from './definition.mjs';

export function digest(value) { return createHash('sha256').update(value).digest('hex'); }
/** Only application-owned private directories may contain persisted relevance data. */
function privateDirectory({
  path,
  trace
}){
 try{mkdirSync(
   path,
   {mode:0o700}
 );}
 catch(error){if(error?.code!=='EEXIST')throw error;trace({
   event:'cache-directory-present',
   path,
   error
 });}
 const stat=lstatSync(path);
 if((!stat.isDirectory())||stat.isSymbolicLink()||((stat.mode&0o777)!==0o700))throw new RuleRelevanceCacheError(`Relevance cache directory is not a private ordinary directory: ${path}`);
}
/** Content-addressed data cache, not an approval store or source-authentication mechanism. */
export function createRelevanceStore({
  directory,
  namespace,
  profileKey,
  trace
}){
 if((typeof directory)!=='string'||(!directory)||(typeof trace)!=='function')throw new RuleRelevanceCacheError('Private cache directory and diagnostic sink are required');
 for(const key of [
   'repository',
   'primaryBranch'
 ])if((typeof namespace?.[key])!=='string'||(!namespace[key])||(namespace[key].length>4096))throw new RuleRelevanceCacheError('Repository identity and primary branch are required cache namespace data');
 privateDirectory({
   path:directory,
   trace
 });
 const namespaceKey=digest(JSON.stringify({
   repository:namespace.repository,
   primaryBranch:namespace.primaryBranch
 }));
 const root=join(
   directory,
   namespaceKey
 );privateDirectory({
   path:root,
   trace
 });
 function fileFor(key){
  if((typeof key)!=='string'||(!/^[a-f0-9]{64}$/.test(key)))throw new RuleRelevanceCacheError('Cache entry key is not a content digest');
  return `${key}.json`;
 }
 function read(key){
  let observed;
  try{observed=observeDeclaredFile({
    root,
    relativePath:fileFor(key),
    requiredMode:0o600,
    maxBytes:4096
  });}
  catch(error){
   if(error instanceof ObservedFileMissingError){trace({
     event:'cache-miss',
     key,
     error
   });return undefined;}
   throw error;
  }
  let entry;
  try{entry=JSON.parse(observed.bytes
    .toString('utf8'));}
  catch(error){throw new RuleRelevanceCacheError(
    'Relevance cache entry is incomplete or malformed: '+key,
    {cause:error}
  );}
  if((Object.keys(entry).toSorted().join(',')!=='key,probability,profileKey,qualification,schema')||(entry.schema!==1)||(entry.key!==key)||(entry.profileKey!==profileKey)||(entry.qualification!=='not-established')||(!Number.isFinite(entry.probability))||(entry.probability<0)||(entry.probability>1))
   throw new RuleRelevanceCacheError(`Relevance cache entry has a different profile or invalid estimate: ${key}`);
  trace({
    event:'cache-hit',
    key
  });return Object.freeze(entry);
 }
 function put({
   key,
   probability
 }){
  if((!Number.isFinite(probability))||(probability<0)||(probability>1))throw new RuleRelevanceCacheError('Relevance estimate must be finite and between zero and one');
  const entry=Object.freeze({
    schema:1,
    key,
    profileKey,
    probability,
    qualification:'not-established'
  });
  try{writeFileSync(
    join(root,fileFor(key)),
    JSON.stringify(entry)+'\n',
    {flag:'wx',mode:0o600}
  );}
  catch(error){
   if(error?.code!=='EEXIST')throw error;
   // A complete existing entry wins; never average scores or overwrite another writer.
   trace({
     event:'cache-publication-already-exists',
     key,
     error
   });return read(key);
  }
  trace({
    event:'cache-published',
    key
  });return entry;
 }
 return Object.freeze({
   read,
   put,
   namespaceKey
 });
}
