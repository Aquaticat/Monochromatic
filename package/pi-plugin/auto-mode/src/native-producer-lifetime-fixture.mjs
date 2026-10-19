/**
 Controlled producer lifetimes built on the owner's real private ownership
 tables. @module
 */
import assert from 'node:assert/strict';
import {
  createRequestProducerOwner
} from '../dist/native/contract/collector/request-producer-judgment-consumers/owner.mjs';
import {
  authoredModel,
  authoredNameOf,
  createAuthoredContext,
  createAuthoredResponse,
  createResultStream,
  judgmentEntry,
  registerContextResponse
} from './native-producer-lifetime-values.ts';

//region Controlled streams isolate producer ownership without substituting claims.
/**
 Construct the default frozen judgment value for each registered response.

 @param {import('../native/contract/collector/request-producer-judgment-consumers/owner-types.ts').JudgmentConstructionEntry} input - construction entry

 @returns {{ readonly name: string }} frozen value recorded for the response
 */
function constructValue({ response }) {
  return Object.freeze({ name: authoredNameOf({ value: response }) });
}

/**
 Satisfy the owner's handle contract with one result-bearing SDK stream.

 @param {{ readonly context: object }} input - request carrying registered response

 @returns {Promise<import('../native/contract/collector/request-producer-judgment-consumers/owner-types.ts').ProducerStream>} result-bearing stream
 */
async function handleRequest(input) {
  return createResultStream(input);
}

/**
 Bind distinct consumers to the supplied issuer while preserving the actual
 private ownership tables.

 @param {{
   construct?: import('../native/contract/collector/request-producer-judgment-consumers/owner-types.ts').JudgmentConstructor<import('./native-producer-lifetime-values.ts').AuthoredJudgment>,
   handle?: import('../native/contract/collector/request-producer-judgment-consumers/owner-types.ts').ProducerStreamHandle,
   owner?: ReturnType<typeof import('../native/contract/collector/request-producer-judgment-consumers/owner.ts').createRequestProducerOwner>
 }} input - consumer bindings

 @param input.construct - optional value constructor recorded for each response

 @param input.handle - optional stream factory bound to the consumer

 @param input.owner - optional producer owner shared across consumers

 @returns owner and bound judgment consumer stream
 */
export function createFixture({
  construct,
  handle = handleRequest,
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

 @param {{
   fixture: ReturnType<typeof createFixture>,
   name?: string,
   response?: import('@earendil-works/pi-ai').AssistantMessage,
   auxiliary?: boolean
 }} input - registration inputs

 @param input.fixture - owner and bound stream pair

 @param input.name - correlation name for a newly authored response

 @param input.response - existing response identity to reuse

 @param input.auxiliary - route through the auxiliary summary path

 @returns {Promise<import('../native/contract/collector/request-producer-judgment-consumers/owner-types.ts').ProducerJudgmentEntry>} registered judgment entry
 */
export async function observe({
  fixture,
  name,
  response = createAuthoredResponse({ name }),
  auxiliary = false
}) {
  const context = createAuthoredContext();
  registerContextResponse({ context, response });
  const input = {
    stream: fixture.stream,
    model: authoredModel,
    context,
    options: {}
  };
  const result = await (auxiliary ? fixture.owner
    .fromAuxiliarySummary(input) : fixture.owner
      .fromAgentLoop(input));
  assert.equal(
    await result.result(),
    response
  );
  return judgmentEntry({ response, stream: fixture.stream });
}

/**
 Report the exact failed semantic case without altering completion ownership or
 construction causes.

 @param {{name: string, run: () => Promise<void>}} input - case inputs

 @param input.name - semantic case name reported on failure

 @param input.run - case body awaiting completion before failure checks

 @returns {Promise<void>}
 */
export async function verify({name, run}) {
  try {
    await run();
    assert.fail(`semantic case unexpectedly passed: ${name}`);
  } catch (error) {
    assert.ok(
      error instanceof Error,
      `semantic case ${name} failed with a non-error value`
    );
  }
}
//endregion

//region Match predicates execute one literal inclusion per call.
/**
 Match `error.message` against one literal substring.

 The matcher is the test seam for controlled thrown failures. Gating admitted
 SDK messages on their category would discard legitimate assistant messages.

 @param {{ readonly substring: string }} input - exact substring to find

 @returns {(error: unknown) => boolean} message predicate
 */
export function messageIncludes({ substring }) {
  return (error) => Error.isError(error) && error.message.includes(substring);
}
//endregion
