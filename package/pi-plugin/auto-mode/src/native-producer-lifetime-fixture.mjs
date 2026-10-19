/**
 Controlled streams and shared runners for the producer lifetime catalog.

 The separate capacity guard uses the actual native session. @module
 */
import assert from 'node:assert/strict';
import {
  createRequestProducerOwner
} from '../dist/native/contract/collector/request-producer-judgment-consumers/owner.mjs';

//region Controlled streams isolate producer ownership without substituting claims.

/**
 Construct the default frozen judgment value for each registered response.

 @param response - registered response identity

 @returns frozen value recorded for the response
 */
function constructValue({ response }) {
  return Object.freeze({ name: response.name });
}

/**
 Supply unique result-bearing streams without substituting producer claims or
 response registration.

 @param context - holder carrying the registered response

 @returns stream exposing the supplied response
 */
export function createResultStream({ context }) {
  return {
    async *[Symbol.asyncIterator]() {
      /**
       Result-bearing streams emit no events of their own.
       */
    },
    result() { return context.response; },
  };
}

/**
 Bind distinct consumers to the supplied issuer while preserving the actual
 private ownership tables.

 @param construct - optional value constructor recorded for each response

 @param handle - optional stream factory bound to the consumer

 @param owner - optional producer owner shared across consumers

 @returns owner and bound judgment consumer stream
 */
export function createFixture({
  construct,
  handle = createResultStream,
  owner = createRequestProducerOwner({ now() { return 1; } })
} = {}) {
  const stream = owner.bindJudgmentConsumer({
    handle,
    construct: construct ?? constructValue,
  });
  return {
    owner,
    stream
  };
}

/**
 Enter the actual main/auxiliary claim and result registration paths before any
 judgment operation.

 @param fixture - owner and bound stream pair

 @param name - registered response name

 @param response - registered response identity

 @param auxiliary - route through the auxiliary summary path

 @returns registered response and bound stream
 */
export async function observe({
  fixture,
  name,
  response = { name },
  auxiliary = false
}) {
  const input = {
    stream: fixture.stream,
    context: { response },
    options: {}
  };
  const result = await (auxiliary ? fixture.owner
    .fromAuxiliarySummary(input) : fixture.owner
      .fromAgentLoop(input));
  assert.equal(
    await result.result(),
    response
  );
  return {
    response,
    stream: fixture.stream
  };
}

/**
 Report the exact failed semantic case while retaining the original assertion
 and complete stderr.

 @param name - semantic case name printed with its outcome

 @param run - case body retaining original assertions

 @returns completion of the reported case
 */
export async function verify({
  name,
  run
}) {
  try {
    await run();
    console.log(JSON.stringify({
      name,
      passed: true
    }));
  } catch (error) {
    console.error(JSON.stringify({
      name,
      passed: false
    }));
    throw error;
  }
}

//endregion Controlled streams isolate producer ownership without substituting claims.
