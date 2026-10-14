import assert from 'node:assert/strict';
import {createEnvironment} from './environment.mjs';
import {createRootSessionFactory} from './session-root.ts';
import {attachNativeContextCopies} from './generated/session-manager.mjs';

const env=await createEnvironment();
let registrations=0;
const factory=createRootSessionFactory({
  ...env,
  onSessionRegistered({
    session,
    manager,
    lifecycle
  }){
 registrations++;
 lifecycle.assertActive(lifecycle.capture({
   session,
   manager
 }));
}
});
const foreignManager=env.SessionManager
  .inMemory(env.options
    .cwd);
await assert.rejects(
  function constructForeignManagerSession() { return (factory.createFromManager({
    options:env.options,
    manager:foreignManager
  })); },
  /not returned by this declared constructor owner/
);
assert.equal(
  registrations,
  0
);
const manager=factory.managers
  .inMemory(env.options
    .cwd);
const first=await factory.createFromManager({
  options:env.options,
  manager
});
assert.equal(
  first.root
    .manager,
  manager
);
assert.equal(
  registrations,
  1
);
const oldLease=factory.lifecycle
  .capture(first.root);
const transition=factory.lifecycle
  .begin(oldLease);
factory.lifecycle
  .markMutation(transition);
first.session
  .dispose();
assert.equal(
  env.readSessionDisposalState(first.session)
    .completed,
  true
);
factory.lifecycle
  .completeRetirement(transition);
assert.throws(function inspectRetiredLease() { return (factory.lifecycle
  .assertActive(oldLease)); });
manager.newSession();
const second=await factory.createFromManager({
  options:env.options,
  manager
});
assert.equal(
  second.root
    .manager,
  manager
);
assert.notEqual(
  second.session,
  first.session
);
assert.equal(
  registrations,
  2
);
const secondLease=factory.lifecycle
  .capture(second.root);
factory.lifecycle
  .assertActive(secondLease);
const secondTransition=factory.lifecycle
  .begin(secondLease);
factory.lifecycle
  .markMutation(secondTransition);
const disconnect=second.session
  ._disconnectFromAgent;
const disposalFailure=new Error('Fixture disposal has not completed');
second.session
  ._disconnectFromAgent=function failIncompleteDisposal() {throw disposalFailure;};
assert.throws(
  function disposeIncompleteSession() { return (second.session
    .dispose()); },
  function matchesDisposalFailure(error) { return (error===disposalFailure); }
);
assert.equal(
  env.readSessionDisposalState(second.session)
    .completed,
  false
);
assert.throws(
  function attachConflictingObserver() { return (attachNativeContextCopies(
    manager,
    function unusedConflictingObserver() {}
  )); },
  /already has a context-copy owner/
);
second.session
  ._disconnectFromAgent=disconnect;
second.session
  .dispose();
assert.equal(
  env.readSessionDisposalState(second.session)
    .completed,
  true
);
factory.lifecycle
  .completeRetirement(secondTransition);
manager.newSession();
const third=await factory.createFromManager({
  options:env.options,
  manager
});
assert.equal(
  registrations,
  3
);
second.session
  ._disconnectFromAgent=function rejectRepeatedCleanup() {throw new Error('Completed disposal must not enter old cleanup again');};
assert.doesNotThrow(function repeatCompletedDisposal() { return (second.session
  .dispose()); });
assert.throws(
  function attachObserverAfterOldDisposal() { return (attachNativeContextCopies(
    manager,
    function unusedReplacementObserver() {}
  )); },
  /already has a context-copy owner/
);
factory.lifecycle
  .assertActive(factory.lifecycle
    .capture(third.root));
third.session
  .dispose();
await env.drain();
console.log(JSON.stringify({
  complete:true,
  originalManagers:1,
  sessionConstructions:3,
  foreignManagersRejected:1,
  retiredLeaseRejected:true,
  incompleteDisposalRetainsOwner:true,
  completedDisposalDoesNotRepeat:true,
  providerRequests:0
}));
