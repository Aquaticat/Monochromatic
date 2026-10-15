//region Compiler output retains remaining premise gaps and original input evidence.
/** Package derived resolver inputs and diagnostics without changing any original estimate or source record. */
export function compilation({
  issues,
  rules,
  authorizationRequirements,
  clauses,
  scope,
  headingContextInterpretations=Object.freeze([]),
  sourceUses,
  unitAdoptionInterpretations=Object.freeze([])
}){
 issues=[
   ...issues,
   ...sourceUses.issues
 ];
 const missingPremises=Object.freeze([...new Set(issues.map(function readIssuePremise(issue) { return (issue.premise); }))]);
 const program=Object.freeze({
   premises:missingPremises.length > 0?'incomplete':'complete',
   rules:Object.freeze(rules),
   authorizationRequirements:Object.freeze(authorizationRequirements)
 });
 return Object.freeze({
   program,
   missingPremises,
   premiseIssues:Object.freeze(issues),
   clauses:Object.freeze(clauses),
   semanticAdmission:scope,
   headingContextInterpretations,
   requestSourceAssociationUses:sourceUses.uses,
   unitAdoptionInterpretations
 });
}

/** Preserve independent source and authority gaps after admitted original relationships. */
export function resolveCompilationIssues({issues,adopted,headingUses,interpreted,sourceNeedsAuthority}){
 // Only consumed none relationships are tier-independent. This does not close the governing-source inventory.
 const requiredIssues=issues.filter(function retainUnresolvedAdoptionIssue(issue) {
  if(adopted.adopters
    .has(issue.rule)
    &&[
      'clause-interpretation-not-admitted',
      'clause-relation-interpretation',
      'clause-operation-interpretation'
    ].includes(issue.kind))return false;
  if(adopted.targets
    .has(issue.rule)
    &&(issue.kind==='clause-source-use-scope')
    &&(issue.scopeReason==='unresolved-quoted-unit-use'))return false;
  const heading=issue.kind==='source-heading-context'?headingUses.get(issue.candidate):undefined;
  if((heading?.admission==='admitted')&&(heading.relation==='none'))return false;
  if(issue.kind==='source-local-instruction-use')return !issue.candidates
    .every(function hasCandidateInterpretation(candidate) { return (interpreted.has(candidate)); });
  return (issue.premise!=='instruction-authority-and-scope')||(!issue.source)
    ||(sourceNeedsAuthority.get(issue.source
      .sourceOccurrence)!==false);
 });
 const headingIssues=requiredIssues.map(function attachHeadingInterpretation(issue) {
  const interpretation=issue.kind==='source-heading-context'?headingUses.get(issue.candidate):undefined;
  return interpretation?Object.freeze({
    ...issue,
    headingContextInterpretation:interpretation,
    reason:'The original heading group was assessed, but its independent normative content remains potential, unknown or unadmitted; no directive meaning or delegation is inferred.'
  }):issue;
 });
 return headingIssues;
}
//endregion
