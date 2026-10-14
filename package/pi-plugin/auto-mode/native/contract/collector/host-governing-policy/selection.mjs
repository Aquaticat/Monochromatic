import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {observeDeclaredFile,assertRetainedFile} from '../../lifecycle/external-dependency-controls/file-observer.mjs';
import {SourceCollectionError} from '../collector.mjs';

export class GoverningPolicySelectionError extends SourceCollectionError {}
/**
 * Fixed bootstrap operation explicitly designates one policy input.
 * Its caller is the constructor owner, not action metadata, loaded-file labels or a model response.
 * This records host designation and file custody, not priority, interpretation, complete coverage or permission.
 */
export function createBootstrapPolicySelection({root,relativePath,requiredMode}){
  const location=Object.freeze({root,relativePath,requiredMode,maxBytes:65536}),records=new WeakMap();
  let current,ordinal=0;
  function observe(){
    const observed=observeDeclaredFile(location),content=observed.bytes.toString('utf8');
    if(!Buffer.from(content,'utf8').equals(observed.bytes))throw new GoverningPolicySelectionError('Designated governing policy is not byte-preserving UTF-8 text');
    return {observed,content};
  }
  function capture(){
    const {observed,content}=observe();
    if(current){
      const saved=records.get(current);
      // This is a new capture boundary, not a freshness check on the previous generation.
      if(saved.observed.relativePath===observed.relativePath&&saved.observed.dev===observed.dev&&saved.observed.ino===observed.ino&&saved.observed.mode===observed.mode&&saved.observed.bytes.equals(observed.bytes))return current;
    }
    const view=Object.freeze({
      occurrence:Object.freeze({}),ordinal:ordinal++,identity:join(root,relativePath),content,
      sha256:createHash('sha256').update(observed.bytes).digest('hex'),
      fileIdentity:Object.freeze({dev:String(observed.dev),ino:String(observed.ino),mode:observed.mode}),
      designation:'explicit-bootstrap-governing-policy',
      priority:'not-established',scopeMeaning:'not-established',delegation:'not-established',
      completeInstructionCoverage:false,humanPermission:false
    });
    records.set(view,{observed});current=view;return view;
  }
  function assertCurrent(view){
    const saved=records.get(view);
    if(!saved||view!==current)throw new GoverningPolicySelectionError('Governing policy source is not this bootstrap selection current occurrence');
    const {observed}=observe();assertRetainedFile({initial:saved.observed,current:observed});
  }
  function readPolicy(){
    const source=capture();return Object.freeze({identity:source.identity,content:source.content});
  }
  return Object.freeze({capture,assertCurrent,readPolicy});
}
