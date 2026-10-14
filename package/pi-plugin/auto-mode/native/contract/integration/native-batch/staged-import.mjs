import {realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

export class StagedImportError extends Error {}

/** Rewrite one generated JSON-string import only when its file still resolves to the expected local build input. */
export function replaceStagedImport({source,binding,expected,replacement}){
 const prefix='import {'+binding+'} from ';
 const lines=source.split('\n').filter(line=>line.startsWith(prefix));
 if(lines.length!==1||!lines[0].endsWith(';'))throw new StagedImportError('Expected one generated import for '+binding);
 const [line]=lines;
 try{
  const specifier=JSON.parse(line.slice(prefix.length,-1));
  if(typeof specifier!=='string')throw new StagedImportError('Generated import must name a file URL');
  const observed=new URL(specifier);
  if(observed.search||observed.hash)throw new StagedImportError('Generated import must not select a separate module URL');
  if(realpathSync(fileURLToPath(observed))!==realpathSync(fileURLToPath(expected)))throw new StagedImportError('Generated import differs from its expected local build input');
 }catch(error){
  throw new StagedImportError('Cannot verify generated import for '+binding,{cause:error});
 }
 return source.replace(line,prefix+JSON.stringify(replacement)+';');
}
