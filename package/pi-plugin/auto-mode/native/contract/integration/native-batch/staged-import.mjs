import {
  readFile,
  realpath
} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {parse} from 'yuku-parser';

export class StagedImportError extends Error {}

/** Preserve each input module's import targets when its transformed source moves into the generated directory. */
export async function readStagedInput(sourceUrl){
 const source=await readFile(
   sourceUrl,
   'utf8'
 ); const parsed=parse(
   source,
   {sourceType:'module'}
 );
 if(parsed.diagnostics
   .length
   > 0)throw new StagedImportError(`Cannot parse the original native build input: ${sourceUrl.href}`);
 const edits=[];
 for(const node of parsed.program
   .body){
  if((![
    'ImportDeclaration',
    'ExportNamedDeclaration',
    'ExportAllDeclaration'
  ].includes(node.type))||(!node.source))continue;
  const specifier=node.source
    .value;
  if(((typeof specifier)==='string')&&specifier.startsWith('.'))edits.push({
    start:node.source
      .start,
    end:node.source
      .end,
    text:JSON.stringify(new URL(
      specifier,
      sourceUrl
    ).href)
  });
 }
 let result=source;
 for(const edit of edits.reverse())result=result.slice(
   0,
   edit.start
 )+edit.text
   +result.slice(edit.end);
 return result;
}

/** Rewrite one generated JSON-string import only when its file still resolves to the expected local build input. */
export async function replaceStagedImport({
  source,
  binding,
  expected,
  replacement
}){
 const prefix=`import {${binding
   }} from `;
 const lines=source.split('\n')
   .filter(function matchesStagedImportPrefix(line) { return (line.startsWith(prefix)); });
 if((lines.length!==1)||(!lines[0]
   .endsWith(';')))throw new StagedImportError(`Expected one generated import for ${binding}`);
 const [line]=lines;
 try{
  const specifier=JSON.parse(line.slice(
    prefix.length,
    -1
  ));
  if((typeof specifier)!=='string')throw new StagedImportError('Generated import must name a file URL');
  const observed=new URL(specifier);
  if(observed.search||observed.hash)throw new StagedImportError('Generated import must not select a separate module URL');
  if((await realpath(fileURLToPath(observed)))!==(await realpath(fileURLToPath(expected))))throw new StagedImportError('Generated import differs from its expected local build input');
 }catch(error){
  throw new StagedImportError(
    `Cannot verify generated import for ${binding}`,
    {cause:error}
  );
 }
 return source.replace(
   line,
   `${prefix+JSON.stringify(replacement)};`
 );
}
