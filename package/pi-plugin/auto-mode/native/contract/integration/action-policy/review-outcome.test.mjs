import assert from 'node:assert/strict';
import {resolveManualReviewOutcome} from './review-outcome.ts';
import {flushPolicyDiagnostics} from '../maintained-policy.mjs';

/** Authored internal facts exercise routing without claiming source authority. */
function rule(
  id,
  effect,
  priority=1,
  applicability='applies'
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
     'permit',
     'permit'
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
     'deny',
     'prohibit'
   )],
   state:'resolved',
   verdict:'deny'
 },
 {
   name:'equal-tier conflict cannot override an established prohibition',
   premises:'complete',
   rules:[
     rule(
       'deny',
       'prohibit'
     ),
     rule(
       'permit',
       'permit'
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
       'deny',
       'prohibit'
     ),
     rule(
       'possible',
       'permit',
       0,
       'unresolved'
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
       'deny',
       'prohibit'
     ),
     rule(
       'permit',
       'permit',
       0
     )
   ],
   state:'unresolved'
 },
 {
   name:'inapplicable prohibition does not block review',
   premises:'incomplete',
   rules:[rule(
     'deny',
     'prohibit',
     0,
     'does-not-apply'
   )],
   state:'unresolved'
 },
 {
   name:'uncertain prohibition is not established',
   premises:'incomplete',
   rules:[rule(
     'possible',
     'prohibit',
     0,
     'unresolved'
   )],
   state:'unresolved'
 },
 {
   name:'complete permission retains automatic approval',
   premises:'complete',
   rules:[rule(
     'permit',
     'permit'
   )],
   state:'resolved',
   verdict:'approve'
 },
 {
   name:'complete prohibition retains automatic denial',
   premises:'complete',
   rules:[rule(
     'deny',
     'prohibit'
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
assert.throws(()=>resolveManualReviewOutcome({
  premises:'incomplete',
  rules:[{id:'invalid'}]
}));
await flushPolicyDiagnostics();
console.log(JSON.stringify({
  complete:true,
  manualReviewOutcomes:cases.length,
  malformedFactsRejected:true
}));
