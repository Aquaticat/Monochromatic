import {RuleAssessmentWireError,sha} from './wire-source.mjs';

//region Validate the original binding before publishing its correlated wire question.
export function appendAdoptionQuestion({sources,head,binding,definition,index,seen,membership,questions,pairs}){
   if((!binding)||(Object.keys(binding)
     .toSorted()
     .join(',')
     !=='adopter,claimScope,member,memberOrdinal,target')
     ||(binding.claimScope!=='member-unit-adoption')
     ||(binding.memberOrdinal!==0)
     ||(!binding.member)
     ||(!Object.isFrozen(binding.member)))throw new RuleAssessmentWireError('Unit adoption lacks its original single-member pair binding');
   const {
     adopter,
     target
   }=binding;
   if((!adopter)||(!target)
     ||(adopter.sourceOrdinal!==target.sourceOrdinal)
     ||((typeof adopter.code)!=='string')
     ||(target.kind!=='unclassified-source-span')
     ||(target.nodeType!=='blockquote'))throw new RuleAssessmentWireError('Unit adoption requires a tagged adopter and quoted target from the same original source');
   for(const unit of [
     adopter,
     target
   ]){
    const source=sources[unit.sourceOrdinal];
    if((!source)||(unit.sourceSHA256!==source.sha256)
      ||(!Number.isSafeInteger(unit.start))
      ||(!Number.isSafeInteger(unit.end))
      ||(unit.start<0)
      ||(unit.end<=unit.start)
      ||(unit.end
        >source.content
        .length)
      ||(source.content
        .slice(
          unit.start,
          unit.end
        )
        !==unit.text)
      ||(sha(unit.text)!==unit.textSHA256)
      ||(!Array.isArray(unit.headings))
      ||(!unit.headings
        .every(function isHeadingText(heading) { return ((typeof heading)==='string'); })))throw new RuleAssessmentWireError('Adoption unit differs from its original source span');
   }
   const key=`${head.definitionId}:${
     adopter.sourceOrdinal
     }:${
     adopter.start
     }:${
     target.start}`;
   if(seen.has(key))throw new RuleAssessmentWireError('Mixed batch repeats an original unit-adoption pair');
   seen.add(key);membership.unitAdoptionCount++;
   if(membership.unitAdoptionCount>64)throw new RuleAssessmentWireError('Unit adoption exceeds the original source bound');
   function project(unit) { return {
     sourceOrdinal:unit.sourceOrdinal,
     start:unit.start,
     end:unit.end,
     text:unit.text,
     headings:unit.headings
   }; }
   const slot=`head_${index}`;
   questions[slot]={
     type:definition.type,
     instructions:{
       predicate:'Use unitAdoptionDefinition in shared state for the complete adopter and exact quoted target. Authority and scope eligibility are code-owned.',
       memberOrdinal:binding.memberOrdinal,
       selectedAdopter:project(adopter),
       selectedTarget:project(target)
     },
     criteria:Object.fromEntries(Object.keys(definition.criteria)
       .map(function initializeAdoptionChoice(label) { return ([
         label,
         null
       ]); }))
   };
   pairs.push({
     slot,
     id:head.id,
     type:definition.type
   });
}
//endregion
