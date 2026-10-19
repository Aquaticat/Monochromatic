/**
 Authored SDK fixture values carrying test correlation in fixture-owned weak
 tables. @module
 */
import {
  createAssistantMessageEventStream,
  normalizeContext
} from '@earendil-works/pi-ai';

//region Authored SDK values pair valid obligations with fixture-owned correlation.
/**
 * One authored judgment value recorded for a registered response.
 *
 * Controlled test correlation field, never asserted onto SDK input.
 * @typedef {{ readonly name: string }} AuthoredJudgment
 */

/** Correlation names for authored values, held only in fixture-owned storage. */
/** @type {WeakMap<object, string>} */
const authoredNames = new WeakMap();

/** Registered responses for authored request contexts, held only here. */
/** @type {WeakMap<object, import('@earendil-works/pi-ai').AssistantMessage>} */
const authoredContextResponses = new WeakMap();

/** The single authored chat model shared by every controlled fixture. */
/** @type {import('../native/contract/collector/request-producer-judgment-consumers/owner-types.ts').ProducerRequest[0]} */
export const authoredModel = Object.freeze({
  id: 'e2e-fake-model',
  name: 'E2E fake model',
  api: 'e2e-fake',
  provider: 'e2e-fake',
  baseUrl: 'https://e2e-fake.invalid',
  input: Object.freeze(['text']),
  cost: Object.freeze({
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0
  }),
  reasoning: false,
  contextWindow: 1,
  maxTokens: 1
});

/**
 Register one authored response carrying a correlation name.

 @param {{ readonly name: string }} input - correlation name

 @returns {import('@earendil-works/pi-ai').AssistantMessage} frozen response
 */
export function createAuthoredResponse({ name }) {
  const response = Object.freeze({
    role: 'assistant',
    content: Object.freeze([]),
    api: 'e2e-fake',
    provider: 'e2e-fake',
    model: authoredModel.id,
    usage: Object.freeze({
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: Object.freeze({
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0
      })
    }),
    stopReason: 'stop',
    timestamp: 1
  });
  authoredNames.set(response, name);
  return response;
}

/**
 Read the correlation name registered for an authored response.

 @param {{ readonly value: object }} input - registered response

 @returns {string} correlation name
 */
export function authoredNameOf({ value }) {
  const name = authoredNames.get(value);
  if (name === undefined) {
    throw new Error('missing authored correlation name');
  }
  return name;
}

/**
 Create one normalized request context carrying no correlation fields.

 @returns {import('../native/contract/collector/request-producer-judgment-consumers/owner-types.ts').ProducerRequest[1]} branded request context
 */
export function createAuthoredContext() {
  return normalizeContext({ messages: [] });
}

/**
 Register which response an authored request context targets.

 @param {{ readonly context: object; readonly response: import('@earendil-works/pi-ai').AssistantMessage }} input - correlation pair

 @returns {void}
 */
export function registerContextResponse({ context, response }) {
  authoredContextResponses.set(context, response);
}

/**
 Read the response registered for an authored request context.

 @param {{ readonly context: object }} input - request context

 @returns {import('@earendil-works/pi-ai').AssistantMessage} registered response
 */
export function contextResponseOf({ context }) {
  const response = authoredContextResponses.get(context);
  if (response === undefined) {
    throw new Error('missing authored context response');
  }
  return response;
}

/**
 Build one result-bearing SDK stream ended with a response.

 @param {{ readonly response: import('@earendil-works/pi-ai').AssistantMessage }} input - response to register

 @returns {import('../native/contract/collector/request-producer-judgment-consumers/owner-types.ts').ProducerStream} result-bearing stream
 */
export function resultStreamFor({ response }) {
  const stream = createAssistantMessageEventStream();
  stream.end(response);
  return stream;
}

/**
 Build one result-bearing SDK stream for a request context.

 @param {{ readonly context: object }} input - request carrying registered response

 @returns {import('../native/contract/collector/request-producer-judgment-consumers/owner-types.ts').ProducerStream} result-bearing stream
 */
export function createResultStream({ context }) {
  return resultStreamFor({ response: contextResponseOf({ context }) });
}

/**
 A prepared-group capability the fixtures never use; it throws if the owner
 unexpectedly invokes it.

 @returns {never} no prepared group record is ever fabricated

 @throws always
 */
export function unusedPreparedGroup() {
  throw new Error('deliberately unused prepared group');
}

/**
 Build one judgment entry carrying the production contract's required signal and
 group capabilities.

 @param {{ readonly response: import('@earendil-works/pi-ai').AssistantMessage; readonly stream: object }} input - identity pair

 @returns {import('../native/contract/collector/request-producer-judgment-consumers/owner-types.ts').ProducerJudgmentEntry} complete judgment entry
 */
export function judgmentEntry({ response, stream }) {
  return {
    response,
    stream,
    signal: new AbortController().signal,
    group: unusedPreparedGroup,
    startedAt: 1
  };
}
//endregion
