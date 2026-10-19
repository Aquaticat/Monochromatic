/**
 Authored SDK fixture values carrying test correlation in fixture-owned weak
 tables. @module
 */
import {
  createAssistantMessageEventStream,
  normalizeContext,
  type AssistantMessage
} from '@earendil-works/pi-ai';
import type {
  ProducerJudgmentEntry,
  ProducerRequest,
  ProducerStream
} from '../native/contract/collector/request-producer-judgment-consumers/owner-types.ts';

//region Authored SDK values pair valid obligations with fixture-owned correlation.
/**
 One authored judgment value recorded for a registered response.

 Controlled test correlation field, never asserted onto SDK input.
 */
export type AuthoredJudgment = {
  readonly name: string;
};

/**
 Correlation names for authored values, held only in fixture-owned storage.
 */
const authoredNames = new WeakMap<object, string>();

/**
 Registered responses for authored request contexts, held only here.
 */
const authoredContextResponses = new WeakMap<object, AssistantMessage>();

/**
 The single authored chat model shared by every controlled fixture.
 */
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

/**
 The frozen authored chat model shared by every controlled fixture.
 */
export const authoredModel: ProducerRequest[0] =
  Object.freeze(authoredModelValue);

/**
 Register one authored response carrying a correlation name.

 @param name - correlation name

 @returns frozen response keeping a mutable SDK content array

 @example
 ```ts
 const response = createAuthoredResponse({ name: 'first' });
 ```
 */
export function createAuthoredResponse({ name }: {
  readonly name: string;
}): AssistantMessage {
  /**
   The authored response record carrying a mutable SDK content array.
   */
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
  authoredNames.set(
    response,
    name
  );
  return Object.freeze(response);
}

/**
 Read the correlation name registered for an authored response.

 @param value - registered response

 @returns correlation name

 @example
 ```ts
 const name = authoredNameOf({ value: response });
 ```
 */
export function authoredNameOf({ value }: {
  readonly value: object;
}): string {
  /**
   Registered correlation name, absent when the value was never registered.
   */
  const name = authoredNames.get(value);
  if (name === undefined) {
    throw new Error('missing authored correlation name');
  }
  return name;
}

/**
 Create one normalized request context carrying no correlation fields.

 @returns branded request context

 @example
 ```ts
 const context = createAuthoredContext();
 ```
 */
export function createAuthoredContext(): ProducerRequest[1] {
  return normalizeContext({ messages: [] });
}

/**
 Register which response an authored request context targets.

 @param context - request context

 @param response - registered response

 @example
 ```ts
 registerContextResponse({ context, response });
 ```
 */
export function registerContextResponse({
  context,
  response
}: {
  readonly context: object;
  readonly response: AssistantMessage;
}): void {
  authoredContextResponses.set(
    context,
    response
  );
}

/**
 Read the response registered for an authored request context.

 @param context - request context

 @returns registered response

 @example
 ```ts
 const response = contextResponseOf({ context });
 ```
 */
export function contextResponseOf({ context }: {
  readonly context: object;
}): AssistantMessage {
  /**
   Registered response, absent when the context was never registered.
   */
  const response = authoredContextResponses.get(context);
  if (response === undefined) {
    throw new Error('missing authored context response');
  }
  return response;
}

/**
 Build one result-bearing SDK stream ended with a response.

 @param response - response to register

 @returns result-bearing stream

 @example
 ```ts
 const stream = resultStreamFor({ response });
 ```
 */
export function resultStreamFor({ response }: {
  readonly response: AssistantMessage;
}): ProducerStream {
  /**
   Fresh SDK event stream carrying the registered response.
   */
  const stream = createAssistantMessageEventStream();
  stream.end(response);
  return stream;
}

/**
 Build one result-bearing SDK stream for a request context.

 @param context - request carrying registered response

 @returns result-bearing stream

 @example
 ```ts
 const stream = createResultStream({ context });
 ```
 */
export function createResultStream({ context }: {
  readonly context: object;
}): ProducerStream {
  return resultStreamFor({ response: contextResponseOf({ context }) });
}

/**
 A prepared-group capability the fixtures never use; it throws if the owner
 unexpectedly invokes it.

 @throws always

 @example
 ```ts
 const entry = judgmentEntry({ response, stream });
 ```
 */
export function unusedPreparedGroup(): never {
  throw new Error('deliberately unused prepared group');
}

/**
 Build one judgment entry carrying the production contract's required signal and
 group capabilities.

 @param response - identity response

 @param stream - identity stream

 @returns complete judgment entry

 @example
 ```ts
 const entry = judgmentEntry({ response, stream });
 ```
 */
export function judgmentEntry({
  response,
  stream
}: {
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
