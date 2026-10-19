/** Original SDK steering during a provider request must preserve automatic review of the prepared group. @module */
import assert from 'node:assert/strict';
import { logger } from '@monochromatic-dev/module-logger/ts';
import { createDomainFixtureEnvironment } from '../dist/native/contract/integration/native-batch/domain-fixture-environment.mjs';
import { createDomainFixtureRuntime } from '../dist/native/contract/integration/native-batch/domain-fixture-runtime.mjs';

//region The genuine SDK captures incoming call, event and queue receipts before its original response returns.
const method = process.argv[2];
assert.ok(['steer', 'followUp'].includes(method));
const marker = 'Original inflight supervisor fixture data, not new permission.';
const settings = {
  text: 'The complete proposed local inspection is permitted.',
  relation: 'permission',
  unresolvedClause: 'prerequisite',
  operationDecision: 'approve',
  operatingPolicy: true,
  httpTransport: true,
  sdkStream: true,
  configuredExtensions: [],
  changeControl: { async beforeChildReturn() {}, async drain() {} },
};
const observations = {
  contextCalls: 0, lateContextMutations: 0, progressCalls: 0,
  assessments: 0, executions: 0, requests: 0, httpCalls: 0, nextInputQuestions: 0,
};
let runtime;
const { env, session, root, lifecycle } = await createDomainFixtureEnvironment({
  settings, observations, readRuntime() { return runtime; },
});
let delivered = false;
runtime = createDomainFixtureRuntime({
  settings, observations, env, session, root, lifecycle,
  code: 'return await tools.fixture_value({path:"seed"});',
  programProfile: 'awaited-literal-single-call',
  async beforePrimaryResponse({ proposal }) {
    if (!proposal) return;
    assert.equal(delivered, false);
    delivered = true;
    await session[method](marker);
  },
});
await using cleanup = {
  async [Symbol.asyncDispose]() {
    session.dispose();
    await session.agent.waitForIdle();
    runtime.detach();
    await env.drain();
    await logger.flush();
  },
};
await session.prompt('Perform the proposed local inspection.');
assert.equal(delivered, true);
const finalMessage = session.messages.at(-1);
assert.equal(finalMessage.stopReason, 'stop', finalMessage.errorMessage);
assert.equal(observations.originalBody.includes(marker), false,
  'Later input must not be rewritten into the original provider request');
assert.equal(observations.executions, 1,
  `Original inflight ${method} must retain one automatic approved execution without source-growth fallback`);
assert.ok(observations.assessments > 0);
const latest = runtime.inspect();
assert.equal(latest.lastReview.outcome.state, 'resolved');
assert.equal(latest.lastReview.outcome.verdict, 'approve');
assert.equal(latest.lastReview.inputs.requestObservation.request.body, observations.originalBody);
console.log(JSON.stringify({ inflightInput: method, executions: observations.executions, assessments: observations.assessments }));
//endregion The genuine SDK captures incoming call, event and queue receipts before its original response returns.
