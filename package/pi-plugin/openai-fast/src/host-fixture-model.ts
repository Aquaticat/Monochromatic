/** Disposable native Codex values shared only by tests. @module */
import {
  createAssistantMessageEventStream,
  hasApi,
  type Api,
  type AssistantMessage,
  type Model,
} from '@earendil-works/pi-ai';
import { normalizeContext, } from '@earendil-works/pi-ai/utils/transcript';

//region Native values: preserve original model identities in completed history.

/** Build an independent model without an upstream compatibility allowlist. */
export function fixtureModel(overrides: Partial<Model<'openai-codex-responses'>> = {},): Model<'openai-codex-responses'> {
  return {
    id: 'gpt-host-fixture', name: 'Host fixture', api: 'openai-codex-responses', provider: 'openai-codex',
    baseUrl: 'https://host-fixture.invalid/backend-api', reasoning: true, input: ['text', 'image',],
    thinkingLevelMap: { high: 'high', xhigh: 'xhigh', },
    cost: { input: 1, output: 2, cacheRead: 0.5, cacheWrite: 0, }, contextWindow: 200_000, maxTokens: 8_192,
    ...overrides,
  };
}

/** Prepare a normalized, synthetic transcript using the installed native API. */
export function fixtureContext() {
  return normalizeContext({ systemPrompt: 'Synthetic test instructions.',
    messages: [{ role: 'user', content: 'Synthetic test input.', timestamp: 0, },], },);
}

/** Create canonical assistant history for finite, offline provider calls. */
export function fixtureAssistant({ model, overrides = {}, }: {
  readonly model: Model<Api>;
  readonly overrides?: Partial<AssistantMessage>;
},): AssistantMessage {
  return {
    role: 'assistant', content: [{ type: 'text', text: 'Fixture answer.', },],
    api: model.api, provider: model.provider, model: model.id, timestamp: 0, stopReason: 'stop',
    usage: { input: 10, output: 2, cacheRead: 0, cacheWrite: 0, totalTokens: 12,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, }, },
    ...overrides,
  };
}

/** Produce a terminal native stream, including the actual error event protocol. */
export function fixtureStream(message: AssistantMessage,) {
  const events = createAssistantMessageEventStream();
  events.push({ type: 'start', partial: message, },);
  if (message.stopReason === 'error' || message.stopReason === 'aborted')
    events.push({ type: 'error', reason: message.stopReason, error: message, },);
  else
    events.push({ type: 'done', reason: message.stopReason, message, },);
  events.end(message,);
  return events;
}

/** Reject a missing or differently configured native fixture instead of silently substituting it. */
export function requireCodexModel(model: Model<Api> | undefined,): Model<'openai-codex-responses'> {
  if (model === undefined || !hasApi(model, 'openai-codex-responses',))
    throw new Error('Expected native Codex fixture model.',);
  return model;
}

/** Capture rejection values while allowing tests to distinguish an unexpected success. */
export async function caughtFailure(fn: () => unknown,): Promise<unknown> {
  try {
    await fn();
  }
  catch (error) {
    return error;
  }
  throw new Error('Expected fixture operation to fail.',);
}

//endregion Native values
