import {statSync} from 'node:fs';
import {basename,dirname,isAbsolute} from 'node:path';
import {tagged} from '@monochromatic-dev/module-logger/ts';
import {createBootstrapPolicySelection} from '../../collector/host-governing-policy/selection.mjs';

//region Readable file custody is distinct from a loader callback's policy label.
/** Bind only context entries whose contents match an actual readable file. */
export function bindReadablePolicyFiles(contextInputs){
 const l=tagged({tag:bindReadablePolicyFiles.name});
 const retained=[];
 for(const source of contextInputs){
  if(source.carrier!==undefined)continue;
  if(typeof source.path!=='string'||!isAbsolute(source.path)){
   l.debug('context entry has no absolute readable policy path');
   continue;
  }
  try{
   const selection=createBootstrapPolicySelection({root:dirname(source.path),relativePath:basename(source.path),requiredMode:statSync(source.path).mode&0o777});
   const view=selection.capture();
   if(view.content!==source.content){
    l.debug('context entry differs from its readable policy file');
    continue;
   }
   retained.push({source,selection,view});
  }catch(error){l.debug(error);}
 }
 return Object.freeze({
  sources:Object.freeze(retained.map(function originalSource(record){return record.source;})),
  assertCurrent(){
   tagged({tag:'assertReadablePolicyFilesCurrent',l}).debug('checking retained readable policy files');
   for(const record of retained)record.selection.assertCurrent(record.view);
  }
 });
}
//endregion
