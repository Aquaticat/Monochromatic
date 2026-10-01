/** Real host cancellation test using a bounded, signal-owned synthetic native stream. @module */
import { createAssistantMessageEventStream, type Provider, } from '@earendil-works/pi-ai';
import { expect, } from '@monochromatic-dev/module-test/ts';
import { fixtureAssistant, } from './host-fixture-model.ts';
import { fixtureProvider, } from './host-fixture-provider.ts';
import { fixtureHome, fixtureHost, requireCompanion, } from './host-fixture-session.ts';

//region Cancellation: no timers, background work, fallback, or external transport.

/** Run the real session abort lifecycle and verify its finalized assistant history. */
export async function verifyHostAbort(): Promise<void> {
  await using home = await fixtureHome();
  const source = fixtureProvider({ dynamic: false, },);
  const started = Promise.withResolvers<void>();
  const provider: Provider = { ...source.provider, stream: function stream(model, context, options) {
    source.state.calls.push({ kind: 'full', model, context, options, },);
    const events = createAssistantMessageEventStream();
    const partial = fixtureAssistant({ model, },);
    events.push({ type: 'start', partial, },);
    const signal = options?.signal;
    if (signal === undefined)
      throw new Error('Actual host did not pass its cancellation signal.',);
    /** Cancellation emits the native error event and settles the same stream. */
    function aborted(): void {
      const message = fixtureAssistant({ model, overrides: { stopReason: 'aborted', errorMessage: 'Synthetic request aborted.', }, },);
      events.push({ type: 'error', reason: 'aborted', error: message, },);
      events.end(message,);
    }
    if (signal.aborted)
      aborted();
    else
      signal.addEventListener('abort', aborted, { once: true, },);
    started.resolve();
    return events;
  }, };
  using host = await fixtureHost({ home, source: { provider, state: source.state, }, },);
  const companion = requireCompanion({ runtime: host.runtime, id: host.base.id, },);
  await host.session.setModel(companion,);
  const pending = host.session.prompt('Abort this synthetic request.',);
  try {
    await Promise.race([started.promise, pending,],);
    expect(source.state.calls,).toHaveLength(1,);
    await host.session.abort();
  }
  finally {
    await host.session.abort();
    await pending;
  }
  const assistant = host.session.messages.findLast(message => message.role === 'assistant',);
  expect(assistant,).toMatchObject({ stopReason: 'aborted', model: host.base.id,
    provider: 'openai-codex', api: 'openai-codex-responses', },);
  expect(source.state.calls,).toHaveLength(1,);
  expect(source.state.calls[0]?.options,).toHaveProperty('serviceTier', 'priority',);
  expect(host.session.model,).toMatchObject({ api: 'pi-virtual', provider: 'openai-codex-fast', id: host.base.id, },);
}

//endregion Cancellation
