import {indexPolicyDocument} from '../../policy-index.ts';
import {PolicySlotBindingError} from './system-slot-error.mjs';

//region Original source spans remain local while selected excerpts cross the provider boundary.
/** Materialize exact excerpts; only confidently irrelevant tagged root rules can be excluded. */
export function captureDecisionMaterial({sources,input}){
 if(!input?.parsePolicy)return undefined;
 if(input.relevanceFailure)return Object.freeze({failure:input.relevanceFailure});
 const relevance=input.relevance;
 if(!relevance||relevance.sourceSHA256!==sources[0].sha256)throw new PolicySlotBindingError('Policy relevance does not belong to the current readable project policy');
 const excluded=Object.freeze(relevance.rules.filter(function irrelevant(rule){return rule.probability<=0.4;}));
 const material=Object.freeze(sources.map(function selectSource(source,sourceOrdinal){
  if(source.kind==='native-visible-conversation')return Object.freeze({sourceOrdinal,content:source.content});
  const index=indexPolicyDocument({source:source.content,parse:input.parsePolicy});
  const omitted=sourceOrdinal===0?excluded:[];
  const fragments=Object.freeze([...index.records,...index.unclassified].filter(function included(span){
   return !omitted.some(function sameSpan(rule){return rule.start===span.start&&rule.end===span.end&&rule.text===span.text;});
  }).toSorted(function sourceOrder(left,right){return left.start-right.start;}).map(function excerpt(span){
   return Object.freeze({start:span.start,end:span.end,text:span.text,headings:span.headings.map(function headingText(heading){return heading.text;})});
  }));
  return Object.freeze({sourceOrdinal,fragments});
 }));
 return Object.freeze({excluded,material});
}
//endregion
