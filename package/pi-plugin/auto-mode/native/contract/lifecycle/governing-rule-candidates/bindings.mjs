import {createHash} from 'node:crypto';
import {indexPolicyDocument} from '../../policy-index.mjs';

export class GoverningRuleBindingError extends Error {
  constructor(message,options){super(message,options);this.name=this.constructor.name;}
}
/**
 * Bind exact indexed clauses to one already-selected original source.
 * Bootstrap supplies the real source reader and incumbent parser. Indexing cannot establish authority or meaning.
 */
export function createGoverningRuleBindings({readSource,parse}){
  if(typeof readSource!=='function'||typeof parse!=='function')throw new GoverningRuleBindingError('Original governing-source reader and qualified Markdown parser are required');
  const source=readSource();
  if(!source||!Object.isFrozen(source)||typeof source.content!=='string'||typeof source.sha256!=='string')throw new GoverningRuleBindingError('Governing-source reader returned no owned immutable text occurrence');
  const index=source.kind==='native-run-handler-message-input'&&source.contentFormat==='native-content-json'
    ?{sourceSha256:createHash('sha256').update(source.content).digest('hex'),records:[],unclassified:[{start:0,end:source.content.length,text:source.content,type:'native-content-json'}],structuralCoverage:'unclassified-nodes-retained'}
    :indexPolicyDocument({source:source.content,parse});
  if(index.sourceSha256!==source.sha256)throw new GoverningRuleBindingError('Indexed policy bytes differ from the original selected source');
  const referencedHeadings=new Set();
  for(const record of [...index.records,...index.unclassified])for(const heading of record.headings??[])referencedHeadings.add(heading);
  const orphanHeadings=(index.headings??[]).filter(heading=>!referencedHeadings.has(heading));
  if(index.records.length+index.unclassified.length+orphanHeadings.length>512)throw new GoverningRuleBindingError('Policy clause count exceeds the original question binding profile');
  const records=new WeakMap(),byCode=new Map(),allHandles=[],unclassified=[],contextualHeadings=[];let stale=false,failure;
  function current(){
    if(stale)throw new GoverningRuleBindingError('Original governing-rule source was already invalidated',{cause:failure});
    try{if(readSource()!==source)throw new GoverningRuleBindingError('Original governing-source occurrence changed');}
    catch(error){stale=true;failure=error;throw new GoverningRuleBindingError('Governing-rule binding is no longer current',{cause:error});}
  }
  /** Both tagged paragraphs and retained spans use this source owner's original capability space. */
  function retain({record,classification}){
    const handle=Object.freeze({}),projection=Object.freeze({
      sourceOccurrence:source.occurrence,sourceSHA256:source.sha256,...classification,
      start:record.start,end:record.end,text:record.text,
      textSHA256:createHash('sha256').update(record.text).digest('hex'),
      headings:Object.freeze((record.headings??[]).map(value=>value.text)),
      authorityEstablishedByIndex:false,semanticQualification:'not-established'
    });
    records.set(handle,projection);allHandles.push(handle);return handle;
  }
  for(const record of index.records){
    const handle=retain({record,classification:{code:record.code}});
    byCode.set(record.code,handle);
  }
  for(const record of index.unclassified){
    const candidate=retain({record,classification:{kind:'unclassified-source-span',nodeType:record.type}});
    unclassified.push(Object.freeze({candidate,start:record.start,end:record.end,text:record.text,type:record.type}));
  }
  // Context exposure is retained separately from an independently consumed normative interpretation.
  let ancestry=[];
  for(const heading of index.headings??[]){
    ancestry=ancestry.filter(parent=>parent.depth<heading.depth);
    if(referencedHeadings.has(heading))contextualHeadings.push(Object.freeze({start:heading.start,end:heading.end,text:heading.text,depth:heading.depth}));
    else{
      const record={...heading,headings:ancestry};
      const candidate=retain({record,classification:{kind:'unclassified-source-span',nodeType:'heading'}});
      unclassified.push(Object.freeze({candidate,start:heading.start,end:heading.end,text:heading.text,type:'heading'}));
    }
    ancestry=[...ancestry,heading];
  }
  const retainedContextualHeadings=Object.freeze(contextualHeadings);
  const headingContextCandidate=contextualHeadings.length?Object.freeze({}):undefined;
  if(headingContextCandidate)records.set(headingContextCandidate,Object.freeze({kind:'source-heading-context',sourceOccurrence:source.occurrence,sourceSHA256:source.sha256,headings:retainedContextualHeadings,authorityEstablishedByIndex:false,semanticQualification:'not-established'}));
  const headingCandidates=Object.freeze(headingContextCandidate?[headingContextCandidate]:[]);
  const candidateHandles=Object.freeze([...byCode.values()]);
  const instructionHandles=Object.freeze(allHandles.toSorted((left,right)=>records.get(left).start-records.get(right).start));
  const retainedUnclassified=Object.freeze(unclassified.toSorted((left,right)=>left.start-right.start));
  current();
  /** All structurally indexed original rules remain candidates until exclusions are separately qualified. */
  function indexedCandidates(){current();return candidateHandles;}
  /** Enumerate retained source text without inferring instruction status, authority or delegation. */
  function indexedInstructionCandidates(){current();return instructionHandles;}
  /** Select one aggregate content subject per source, not a new authoritative instruction or clause. */
  function indexedHeadingContextCandidates(){current();return headingCandidates;}
  function select(code){
    current();const handle=byCode.get(code);
    if(!handle)throw new GoverningRuleBindingError('Requested clause is not in the original indexed policy');
    return handle;
  }
  function read(handle){
    const projection=records.get(handle);
    if(!projection)throw new GoverningRuleBindingError('Clause handle is not owned by this original governing-source binding');
    current();return projection;
  }
  function inspect(){
    return Object.freeze({retainedOnly:true,stale,failure,sourceSHA256:source.sha256,codes:Object.freeze([...byCode.keys()]),unclassified:retainedUnclassified,instructionCandidates:instructionHandles,contextualHeadings:retainedContextualHeadings,headingContextCandidate,structuralCoverage:retainedUnclassified.length?'unclassified-nodes-retained':index.structuralCoverage,authorityEstablishedByIndex:false,semanticQualification:'not-established'});
  }
  return Object.freeze({select,read,indexedCandidates,indexedInstructionCandidates,indexedHeadingContextCandidates,inspect});
}
