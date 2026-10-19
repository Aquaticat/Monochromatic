/** Completed native producer records release superseded request bodies while Pi retains its history. @module */
import assert from 'node:assert/strict';
import { logger } from '@monochromatic-dev/module-logger/ts';
import { createDomainFixtureEnvironment } from '../dist/native/contract/integration/native-batch/domain-fixture-environment.mjs';
import { createDomainFixtureRuntime } from '../dist/native/contract/integration/native-batch/domain-fixture-runtime.mjs';

//region The actual session owns historical response keys and the latest policy diagnostic.
/** Complete genuine native groups with growing original provider requests and preserve the latest diagnostic. */
async function verifyProducerRetirement() {
  assert.equal(typeof globalThis.gc, 'function');
  const settings = {
    text: 'The complete proposed local inspection is permitted.',
    relation: 'permission',
    unresolvedClause: 'prerequisite',
    operationDecision: 'approve',
    operatingPolicy: true,
    httpTransport: true,
    sdkStream: true,
    configuredExtensions: [],
    changeControl: {
      async beforeChildReturn() {},
      async drain() {},
    },
  };
  const observations = {
    contextCalls: 0,
    lateContextMutations: 0,
    progressCalls: 0,
    assessments: 0,
    executions: 0,
    requests: 0,
    httpCalls: 0,
    nextInputQuestions: 0,
  };
  let runtime;
  const { env, session, root, lifecycle } = await createDomainFixtureEnvironment({
    settings,
    observations,
    readRuntime() { return runtime; },
  });
  runtime = createDomainFixtureRuntime({
    settings, observations, env, session, root, lifecycle,
    code: 'return await tools.fixture_value({path:"seed"});',
    programProfile: 'awaited-literal-single-call',
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
  const groups = 12;
  const padding = 'retained native request prefix '.repeat(4_370);
  assert.ok(padding.length > 131_000);
  globalThis.gc();
  const initialHeapBytes = process.memoryUsage().heapUsed;
  for (let index = 0; index < groups; index++) {
    observations.requests = 0;
    await session.prompt('Perform the proposed inspection. Fixture data: ' + padding);
    const latestMessage = session.messages.at(-1);
    assert.equal(latestMessage.stopReason, 'stop', latestMessage.errorMessage);
    assert.equal(observations.executions, index + 1);
    const latest = runtime.inspect();
    assert.deepEqual(latest.lastReview.outcome, { state: 'resolved', verdict: 'approve' });
    assert.ok(latest.lastJudgment.inspect().finalRecord);
    globalThis.gc();
  }
  globalThis.gc();
  const retainedHeapBytes = process.memoryUsage().heapUsed - initialHeapBytes;
  const latest = runtime.inspect();
  const assistantResponses = session.messages.filter(message => message.role === 'assistant').length;
  assert.equal(assistantResponses, groups * 2);
  assert.ok(observations.assessments >= groups);
  assert.ok(Buffer.byteLength(observations.originalBody) > 1_500_000);
  assert.equal(latest.lastReview.inputs.requestObservation.request.body, observations.originalBody);
  assert.ok(latest.lastJudgment.inspect().finalRecord);
  assert.ok(retainedHeapBytes < 32 * 1_048_576,
    `Completed producer judgments retain ${retainedHeapBytes} heap bytes with historical assistant responses live`);
  console.log(JSON.stringify({ producerRetirement: true, groups, assistantResponses, retainedHeapBytes }));
}

await verifyProducerRetirement();
//endregion The actual session owns historical response keys and the latest policy diagnostic.
