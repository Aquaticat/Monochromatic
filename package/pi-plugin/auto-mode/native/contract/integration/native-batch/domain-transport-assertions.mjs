import assert from 'node:assert/strict';
import {inspect} from 'node:util';
import {alteredContribution} from './domain-receipt-controls.mjs';

//region Assert original request bytes, admitted relation data, and field-specific serializer receipts.
export function assertDomainTransport({review,settings,originalBody}){
 const {providerMetadata,lowConfidenceClause,unresolvedClause,sdkStream,receiptControl,observedContext,unobservedContext}=settings;
 assert.equal(
   review.inputs
     .requestObservation
     .request
     .body,
   originalBody
 );
 assert.equal(
   Object.hasOwn(
     review,
     'requestMaterialInterpretation'
   ),
   false
 );
 assert.equal(
   Object.hasOwn(
     review,
     'requestGoverningUse'
   ),
   false
 );
 assert.equal(
   Object.hasOwn(
     review.inputs
       .requestObservation,
     'sourceDerivation'
   ),
   false
 );
 assert.equal(
   Object.hasOwn(
     review.inputs
       .requestObservation,
     'sourceDerivationFailure'
   ),
   false
 );
 assert.ok(review.premiseIssues
   .every(function toolCallPremise(issue){return ![
     'request-material-instruction-use',
     'request-material-interpretation'
   ].includes(issue.kind);}));
 if(providerMetadata){
  const request=JSON.parse(originalBody);
  if(providerMetadata==='thinking')assert.deepEqual(
    request.thinking,
    {type:'enabled'}
  );
  else assert.deepEqual(
    request.fixture_provider_option,
    {value:'extension metadata'}
  );
 }
 const clauseAbstention=lowConfidenceClause||(unresolvedClause!==undefined);
 if(clauseAbstention){
  assert.equal(
    review.clauseInterpretations
      .filter(function abstained(clause){return clause.admission==='abstained';})
      .length,
    1
  );
 }else assert.ok(review.clauseInterpretations
   .every(function isAdmittedClause(clause) { return (clause.admission==='admitted'); }));
 assert.ok(review.headingContextInterpretations
   .every(function isAdmittedNonInstructionHeading(heading) { return ((heading.admission==='admitted')&&(heading.relation==='none')); }));
 if(sdkStream){
  assert.ok(
    review.requestSourceAssociationUses
      .length
      >0,
    'The normal SDK route must retain original native serializer contributions'
  );
  assert.ok(
    review.requestSourceAssociationUses
      .every(function matchesExpectedContributionState(use) { return (use.state===(alteredContribution({
        control:receiptControl,
        location:use.location
      })?'unresolved':'accounted')); }),
    inspect(
    review.requestSourceAssociationUses,
    {depth:3}
  )
  );
 }
 if(sdkStream&&(!receiptControl)
   &&(!observedContext)
   &&(!unobservedContext)){
  const systemContributions=review.inputs
    .requestObservation
    .sourceContributions
    .filter(function originalSystemDerivation(value){return value.systemDerivation!==undefined;});
  assert.ok(
    systemContributions.length>0,
    'The normal native serializer must retain its original system input derivation'
  );
  const derivation=systemContributions[0]
    .systemDerivation;
  assert.ok(derivation.associations
    .length
    >0);
  for(const association of derivation.associations){
   assert.ok(
     association.systemInputPublication,
     'System derivation must use the original manager input publication'
   );
   assert.ok(
     systemContributions.some(function originalSystemAssociation(value){return value.association===association;}),
     'Every original system derivation input must reach contribution consumption'
   );
  }
 }
 return clauseAbstention;
}
//endregion
