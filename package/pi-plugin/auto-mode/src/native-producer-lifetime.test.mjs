/** Built producer completion preserves active consumers, current diagnostics and original identity tombstones. @module */
import assert from 'node:assert/strict';
import { createRequestProducerOwner, RequestProducerError } from '../dist/native/contract/collector/request-producer-judgment-consumers/owner.mjs';

//region Controlled streams isolate producer ownership; the separate capacity guard uses the actual native session.
/** Supply unique result-bearing streams without substituting producer claims or response registration. */
function createFixture({ construct, sharedStream } = {}) {
  const owner = createRequestProducerOwner({ now() { return 1; } });
  const stream = owner.bindJudgmentConsumer({
    handle({ context }) {
      return sharedStream ?? {
        async *[Symbol.asyncIterator]() {},
        async result() { return context.response; },
      };
    },
    construct: construct ?? function constructValue({ response }) { return Object.freeze({ name: response.name }); },
  });
  return { owner, stream };
}

/** Enter the actual main/auxiliary claim and result registration paths before any judgment operation. */
async function observe({ fixture, name, response = { name }, auxiliary = false }) {
  const input = { stream: fixture.stream, context: { response }, options: {} };
  const result = await (auxiliary ? fixture.owner.fromAuxiliarySummary(input) : fixture.owner.fromAgentLoop(input));
  assert.equal(await result.result(), response);
  return { response, stream: fixture.stream };
}

/** Report the exact failed semantic case while retaining the original assertion and complete stderr. */
async function verify({ name, run }) {
  try {
    await run();
    console.log(JSON.stringify({ name, passed: true }));
  } catch (error) {
    console.error(JSON.stringify({ name, passed: false }));
    throw error;
  }
}

await verify({ name: 'latest completed diagnostic survives until the next original judgment', async run() {
  const fixture = createFixture();
  const first = await observe({ fixture, name: 'first' });
  const firstValue = fixture.owner.beginJudgment(first);
  fixture.owner.completeJudgment(first);
  assert.equal(fixture.owner.judgmentFor(first), firstValue);
  const second = await observe({ fixture, name: 'second' });
  const secondValue = fixture.owner.beginJudgment(second);
  assert.throws(() => fixture.owner.judgmentFor(first), /completed.*superseded/);
  assert.equal(fixture.owner.judgmentFor(second), secondValue);
  assert.equal(fixture.owner.describeResponse(first).kind, 'main-agent');
  assert.throws(() => fixture.owner.beginJudgment(first), /already reserved/);
  fixture.owner.completeJudgment(second);
  assert.throws(() => fixture.owner.completeJudgment(second), /already completed/);
} });

await verify({ name: 'newer construction preserves an active earlier operation until its own completion', async run() {
  const fixture = createFixture();
  const first = await observe({ fixture, name: 'first' });
  const firstValue = fixture.owner.beginJudgment(first);
  const second = await observe({ fixture, name: 'second' });
  const secondValue = fixture.owner.beginJudgment(second);
  assert.equal(fixture.owner.judgmentFor(first), firstValue);
  assert.equal(fixture.owner.judgmentFor(second), secondValue);
  fixture.owner.completeJudgment(second);
  fixture.owner.completeJudgment(first);
  assert.throws(() => fixture.owner.judgmentFor(first), /completed.*superseded/);
  assert.equal(fixture.owner.judgmentFor(second), secondValue);
} });

await verify({ name: 'independent consumers preserve their own latest completed diagnostic', async run() {
  const left = createFixture();
  const right = createFixture();
  const a = await observe({ fixture: left, name: 'left' });
  const b = await observe({ fixture: right, name: 'right' });
  const first = left.owner.beginJudgment(a);
  const second = right.owner.beginJudgment(b);
  left.owner.completeJudgment(a);
  right.owner.completeJudgment(b);
  assert.equal(left.owner.judgmentFor(a), first);
  assert.equal(right.owner.judgmentFor(b), second);
  assert.throws(() => left.owner.completeJudgment(b), /exact consumer/);
} });

await verify({ name: 'auxiliary and unjudged main responses do not retire an active primary operation', async run() {
  const fixture = createFixture();
  const main = await observe({ fixture, name: 'main' });
  const value = fixture.owner.beginJudgment(main);
  const auxiliary = await observe({ fixture, name: 'auxiliary', auxiliary: true });
  assert.throws(() => fixture.owner.beginJudgment(auxiliary), /Auxiliary/);
  assert.throws(() => fixture.owner.completeJudgment(auxiliary), /Auxiliary/);
  const unjudged = await observe({ fixture, name: 'unjudged' });
  fixture.owner.completeJudgment(unjudged);
  assert.equal(fixture.owner.judgmentFor(main), value);
  fixture.owner.completeJudgment(main);
} });

await verify({ name: 'failed construction retains its exact latest cause until superseded', async run() {
  const failure = new Error('original fixture construction failure');
  const fixture = createFixture({ construct({ response }) {
    if (response.name === 'failed') throw failure;
    return Object.freeze({ name: response.name });
  } });
  const failed = await observe({ fixture, name: 'failed' });
  assert.throws(() => fixture.owner.beginJudgment(failed), error => error === failure);
  fixture.owner.completeJudgment(failed);
  assert.throws(() => fixture.owner.judgmentFor(failed), error => error instanceof RequestProducerError && error.cause === failure);
  const next = await observe({ fixture, name: 'next' });
  fixture.owner.beginJudgment(next);
  assert.throws(() => fixture.owner.judgmentFor(failed), /completed.*superseded/);
  fixture.owner.completeJudgment(next);
} });

await verify({ name: 'completion cannot reenter construction or invalidate the current reservation', async run() {
  let fixture;
  fixture = createFixture({ construct(input) {
    assert.throws(() => fixture.owner.completeJudgment(input), /reenter/);
    return Object.freeze({ name: input.response.name });
  } });
  const input = await observe({ fixture, name: 'reentrant' });
  const value = fixture.owner.beginJudgment(input);
  assert.equal(fixture.owner.judgmentFor(input), value);
  fixture.owner.completeJudgment(input);
} });

await verify({ name: 'retirement preserves historical response reuse detection', async run() {
  const fixture = createFixture();
  const first = await observe({ fixture, name: 'first' });
  fixture.owner.beginJudgment(first);
  fixture.owner.completeJudgment(first);
  const next = await observe({ fixture, name: 'next' });
  fixture.owner.beginJudgment(next);
  await assert.rejects(observe({ fixture, response: first.response }), /identity was reused/);
  assert.throws(() => fixture.owner.describeResponse(first), /identity was reused/);
  fixture.owner.completeJudgment(next);
} });
//endregion Controlled streams isolate producer ownership; the separate capacity guard uses the actual native session.
