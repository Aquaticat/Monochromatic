import {RuleAssessmentWireError} from './wire-source.mjs';
import {sourceInputLocation} from '../../lifecycle/governing-rule-candidates/input-location.mjs';

//region Provider projections preserve readable material without transporting original source archives.
/** Validate every selected excerpt against the original locally retained source. */
export function projectPolicyMaterial({sources,material,questions}){
 const selected=material??sources.map(function selectedQuestionSpans(source,sourceOrdinal){
  if(source.kind==='native-visible-conversation')return {sourceOrdinal,content:source.content};
  return {sourceOrdinal,fragments:questions.flatMap(function selectedRule(head){
   const rule=head.binding?.governingRule;
   return rule?.sourceOrdinal===sourceOrdinal?[rule]:[];
  })};
 });
 if(!Array.isArray(selected)||selected.length!==sources.length)throw new RuleAssessmentWireError('Selected policy excerpts require every original source position');
 return selected.map(function project(entry,sourceOrdinal){
  const source=sources[sourceOrdinal];
  if(entry.sourceOrdinal!==sourceOrdinal)throw new RuleAssessmentWireError('Selected policy excerpts changed source order');
  const location={sourceOrdinal,sourceSHA256:source.sha256,...sourceInputLocation(source)};
  if(source.kind==='native-visible-conversation'){
   if(entry.content!==source.content)throw new RuleAssessmentWireError('Visible conversation differs from its original selected source');
   return {...location,content:entry.content};
  }
  if(!Array.isArray(entry.fragments))throw new RuleAssessmentWireError('Readable policy files require selected original excerpts');
  const fragments=entry.fragments.map(function excerpt(span){
   if(!Number.isSafeInteger(span.start)||!Number.isSafeInteger(span.end)||span.start<0||span.end<=span.start||span.end>source.content.length||source.content.slice(span.start,span.end)!==span.text)throw new RuleAssessmentWireError('Selected policy excerpt differs from its original source span');
   return {text:span.text,headings:span.headings};
  });
  return {...location,fragments};
 });
}

/** Keep visible response content and complete proposed tool arguments; omit provider-only signatures. */
export function projectVisibleOperation(parent){
 if(!Array.isArray(parent))throw new RuleAssessmentWireError('Original enclosing response must contain native content blocks');
 return parent.filter(function omitThinking(block){return block.type!=='thinking';}).map(function visibleBlock(block){
  if(block.type==='toolCall')return {type:block.type,name:block.name,arguments:block.arguments};
  if(block.type==='text')return {type:block.type,text:block.text};
  throw new RuleAssessmentWireError('Original enclosing response contains unsupported visible content');
 });
}
//endregion
