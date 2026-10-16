import assert from 'node:assert/strict';
import {resolveManualReviewOutcome,resolveConfirmedOutcome} from './review-outcome.ts';
import {flushPolicyDiagnostics} from '../maintained-policy.mjs';

/** Authored internal facts exercise routing without claiming source authority. */
function rule(
  {
  id,
  effect,
  priority=1,
  applicability='applies'
}
){
 return {
   id,
   effect,
   priority,
   applicability
 };
}
const cases=[
 {
   name:'uncertain permission requires confirmation',
   premises:'incomplete',
   rules:[rule(
     {
      id: 'permit',
      effect: 'permit'
    }
   )],
   state:'unresolved'
 },
 {
   name:'absent policy requires confirmation',
   premises:'complete',
   rules:[],
   state:'unspecified'
 },
 {
   name:'established prohibition survives incomplete premises',
   premises:'incomplete',
   rules:[rule(
     {
      id: 'deny',
      effect: 'prohibit'
    }
   )],
   state:'resolved',
   verdict:'deny'
 },
 {
   name:'equal-tier conflict cannot override an established prohibition',
   premises:'complete',
   rules:[
     rule(
       {
      id: 'deny',
      effect: 'prohibit'
    }
     ),
     rule(
       {
      id: 'permit',
      effect: 'permit'
    }
     )
   ],
   state:'resolved',
   verdict:'deny'
 },
 {
   name:'uncertain stronger permission cannot override an established prohibition',
   premises:'complete',
   rules:[
     rule(
       {
      id: 'deny',
      effect: 'prohibit'
    }
     ),
     rule(
       {
      id: 'possible',
      effect: 'permit',
      priority: 0,
      applicability: 'unresolved'
    }
     )
   ],
   state:'resolved',
   verdict:'deny'
 },
 {
   name:'established stronger permission supersedes lower-tier prohibition',
   premises:'incomplete',
   rules:[
     rule(
       {
      id: 'deny',
      effect: 'prohibit'
    }
     ),
     rule(
       {
      id: 'permit',
      effect: 'permit',
      priority: 0
    }
     )
   ],
   state:'unresolved'
 },
 {
   name:'inapplicable prohibition does not block review',
   premises:'incomplete',
   rules:[rule(
     {
      id: 'deny',
      effect: 'prohibit',
      priority: 0,
      applicability: 'does-not-apply'
    }
   )],
   state:'unresolved'
 },
 {
   name:'uncertain prohibition is not established',
   premises:'incomplete',
   rules:[rule(
     {
      id: 'possible',
      effect: 'prohibit',
      priority: 0,
      applicability: 'unresolved'
    }
   )],
   state:'unresolved'
 },
 {
   name:'complete permission retains automatic approval',
   premises:'complete',
   rules:[rule(
     {
      id: 'permit',
      effect: 'permit'
    }
   )],
   state:'resolved',
   verdict:'approve'
 },
 {
   name:'complete prohibition retains automatic denial',
   premises:'complete',
   rules:[rule(
     {
      id: 'deny',
      effect: 'prohibit'
    }
   )],
   state:'resolved',
   verdict:'deny'
 },
];
for(const fixture of cases){
 const outcome=resolveManualReviewOutcome({
   premises:fixture.premises,
   rules:fixture.rules
 });
 assert.equal(
   outcome.state,
   fixture.state,
   fixture.name
 );
 assert.equal(
   outcome.verdict,
   fixture.verdict,
   fixture.name
 );
 assert.equal(
   Object.isFrozen(outcome),
   true
 );
}
assert.throws(function rejectMalformedRule() { return (resolveManualReviewOutcome({
  premises:'incomplete',
  rules:[{id:'invalid'}]
})); });
for(const premises of ['complete','incomplete']){
 for(const channel of ['incumbent-approval','unsupported','unresolved']){
  const program={
    premises,
    rules:[rule({id:'permit',effect:'permit'})],
    authorizationRequirements:[{
      id:'independent',applicability:'applies',satisfaction:'unsatisfied',channel
    }]
  };
  const confirmed=resolveConfirmedOutcome({program});
  assert.equal(confirmed.state,'resolved');
  assert.equal(confirmed.verdict,'approve');
  assert.equal(confirmed.authorizationRequirements.state,channel==='incumbent-approval'?'requires-approval':'unresolved');
  assert.equal(program.authorizationRequirements[0].satisfaction,'unsatisfied');
 }
 const mixed={
   premises,
   rules:[rule({id:'permit',effect:'permit'})],
   authorizationRequirements:[
     {id:'confirm',applicability:'applies',satisfaction:'unsatisfied',channel:'incumbent-approval'},
     {id:'external',applicability:'applies',satisfaction:'unsatisfied',channel:'unsupported'}
   ]
 };
 assert.equal(resolveManualReviewOutcome(mixed).authorizationRequirements.state,'unresolved');
 assert.equal(resolveConfirmedOutcome({program:mixed}).verdict,'approve');
 assert.equal(resolveConfirmedOutcome({
   program:{...mixed,rules:[rule({id:'deny',effect:'prohibit'})]}
 }).verdict,'deny');
 assert.equal(resolveConfirmedOutcome({program:{premises,rules:[]}}).verdict,'approve');
 const prohibited={...mixed,rules:[rule({id:'deny',effect:'prohibit'})]};
 assert.equal(resolveConfirmedOutcome({program:prohibited,reconsideredOutcome:{state:'unresolved',reason:'Both model reviews remain uncertain'}}).verdict,'approve');
 assert.equal(prohibited.rules[0].effect,'prohibit');
 assert.equal(resolveConfirmedOutcome({program:prohibited,reconsideredOutcome:{state:'resolved',verdict:'deny',reason:'Complete operation is prohibited'}}).verdict,'deny');
}
await flushPolicyDiagnostics();
console.log(JSON.stringify({
  complete:true,
  manualReviewOutcomes:cases.length,
  malformedFactsRejected:true
}));
