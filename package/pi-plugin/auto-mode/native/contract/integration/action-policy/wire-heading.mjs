import {RuleAssessmentWireError} from './wire-source.mjs';

//region Validate the original binding before publishing its correlated wire question.
export function appendHeadingQuestion({sources,head,binding,definition,index,seen,membership,questions,pairs}){
   if((!binding)||(Object.keys(binding)
     .toSorted()
     .join(',')
     !=='claimScope,headingContext')
     ||(binding.claimScope!=='program-heading-context'))throw new RuleAssessmentWireError('Heading question lacks its original source-group scope');
   const group=binding.headingContext;
     const ordinal=group?.sourceOrdinal;
   if((group?.kind!=='source-heading-context')||(!Number.isSafeInteger(ordinal))
     ||(ordinal<0)
     ||(ordinal>=sources.length)
     ||(group.sourceSHA256
       !==sources[ordinal]
       .sha256)
     ||(!Array.isArray(group.headings))
     ||(group.headings
       .length
       ===0)
     ||(Reflect.ownKeys(group.headings)
       .length
       !==(group.headings
         .length
         +1)))throw new RuleAssessmentWireError('Heading content lacks its complete original source group');
   const source=sources[ordinal];
   for(const heading of group.headings){
    if((!Number.isSafeInteger(heading.start))||(!Number.isSafeInteger(heading.end))
      ||(heading.start<0)
      ||(heading.end<=heading.start)
      ||(heading.end
        >source.content
        .length)
      ||((typeof heading.text)!=='string')
      ||(source.content
        .slice(
          heading.start,
          heading.end
        )
        !==heading.text)
      ||(!Number.isInteger(heading.depth))
      ||(heading.depth<1)
      ||(heading.depth>6))throw new RuleAssessmentWireError('Selected heading differs from its original source span');
   }
   const key=`${head.definitionId}:${
     ordinal}`;
   if(seen.has(key))throw new RuleAssessmentWireError('Mixed batch repeats an original heading-context group');
   seen.add(key);membership.hasHeadingContent=true;
   const slot=`head_${index}`;
   questions[slot]={
     type:definition.type,
     instructions:{
       predicate:'Use headingInstructionDefinition in shared state for the complete selected source-local heading group; this is not directive lowering or global coverage.',
       selectedHeadingContext:{
         sourceOrdinal:ordinal,
         headings:group.headings
       }
     },
     criteria:Object.fromEntries(Object.keys(definition.criteria)
       .map(function initializeHeadingChoice(label) { return ([
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
