/**
 Authored SDK fixture values carrying test correlation in fixture-owned weak
 tables. @module
 */
import {
  createAssistantMessageEventStream,
  normalizeContext
} from '@earendil-works/pi-ai';
import type {
  AssistantMessage
} from '@earendil-works/pi-ai';
import type {
  ProducerJudgmentEntry,
  ProducerRequest,
  ProducerStream
} from '../native/contract/collector/request-producer-judgment-consumers/owner-types.ts';

//region Authored SDK values pair valid obligations with fixture-owned correlation.
/**
 * One authored judgment value recorded for a registered response.
 *
 * Controlled test correlation field, never asserted onto SDK input.
 */
export interface AuthoredJudgment {
  readonly name: string;
}

/** Correlation names for authored values, held only in fixture-owned storage. */
const authoredNames = new WeakMap<object, string>();

/** Registered responses for authored request contexts, held only here. */
const authoredContextResponses = new WeakMap<object, AssistantMessage>();

/** The single authored chat model shared by every controlled fixture. */
const authoredModelValue: ProducerRequest[0] = {
  id: 'e2e-fake-model',
  name: 'E2E fake model',
  api: 'e2e-fake',
  provider: 'e2e-fake',
  baseUrl: 'https://e2e-fake.invalid',
  input: ['text'],
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0
  },
  reasoning: false,
  contextWindow: 1,
  maxTokens: 1
};

/** The frozen authored chat model shared by every controlled fixture. */
export const authoredModel: ProducerRequest[0] =
  Object.freeze(authoredModelValue);

/**
 Register one authored response carrying a correlation name.

 @param input - correlation name

 @returns frozen response keeping a mutable SDK content array
 */
export function createAuthoredResponse({ name }: {
  readonly name: string;
}): AssistantMessage {
  const response: AssistantMessage = {
    role: 'assistant',
    content: [],
    api: 'e2e-fake',
    provider: 'e2e-fake',
    model: authoredModel.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0
      }
    },
    stopReason: 'stop',
    timestamp: 1
  };
  authoredNames.set(response, name);
  return Object.freeze(response);
}

/**
 Read the correlation name registered for an authored response.

 @param input - registered response

 @returns correlation name
 */
export function authoredNameOf({ value }: {
  readonly value: object;
}): string {
  const name = authoredNames.get(value);
  if (name === undefined) {
    throw new Error('missing authored correlation name');
  }
  return name;
}

/**
 Create one normalized request context carrying no correlation fields.

 @returns branded request context
 */
export function createAuthoredContext(): ProducerRequest[1] {
  return normalizeContext({ messages: [] });
}

/**
 Register which response an authored request context targets.

 @param input - correlation pair

 @returns nothing
 */
export function registerContextResponse({ context, response }: {
  readonly context: object;
  readonly response: AssistantMessage;
}): void {
  authoredContextResponses.set(context, response);
}

/**
 Read the response registered for an authored request context.

 @param input - request context

 @returns registered response
 */
export function contextResponseOf({ context }: {
  readonly context: object;
}): AssistantMessage {
  const response = authoredContextResponses.get(context);
  if (response === undefined) {
    throw new Error('missing authored context response');
  }
  return response;
}

/**
 Build one result-bearing SDK stream ended with a response.

 @param input - response to register

 @returns result-bearing stream
 */
export function resultStreamFor({ response }: {
  readonly response: AssistantMessage;
}): ProducerStream {
  const stream = createAssistantMessageEventStream();
  stream.end(response);
  return stream;
}

/**
 Build one result-bearing SDK stream for a request context.

 @param input - request carrying registered response

 @returns result-bearing stream
 */
export function createResultStream({ context }: {
  readonly context: object;
}): ProducerStream {
  return resultStreamFor({ response: contextResponseOf({ context }) });
}

/**
 A prepared-group capability the fixtures never use; it throws if the owner
 unexpectedly invokes it.

 @returns never

 @throws always
 */
export function unusedPreparedGroup(): never {
  throw new Error('deliberately unused prepared group');
}

/**
 Build one judgment entry carrying the production contract's required signal and
 group capabilities.

 @param input - identity pair

 @returns complete judgment entry
 */
export function judgmentEntry({ response, stream }: {
  readonly response: AssistantMessage;
  readonly stream: object;
}): ProducerJudgmentEntry {
  return {
    response,
    stream,
    signal: new AbortController().signal,
    group: unusedPreparedGroup
  };
}
//endregion
