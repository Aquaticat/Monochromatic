/** Finite native provider and synthetic subscription authentication for tests. @module */
import {
  type Api,
  type AssistantMessage,
  type Model,
  type OAuthCredential,
  type Provider,
  type RefreshModelsContext,
  type StreamOptions,
  type TranscriptContext,
} from '@earendil-works/pi-ai';
import { fixtureAssistant, fixtureModel, fixtureStream, } from './host-fixture-model.ts';

//region Credential and request ownership: every fixture has independent state.

/** Synthetic JWT contains only the account claim read by native Codex request preparation. */
export const HOST_TOKEN = `e30.${btoa(JSON.stringify({
  'https://api.openai.com/auth': { chatgpt_account_id: 'host-fixture-account', },
},),)}.fixture-signature`;

/** Distinct expired access token makes stale credential forwarding observable. */
export const HOST_EXPIRED_TOKEN = HOST_TOKEN.replace('fixture-signature', 'expired-fixture-signature',);

/** Build disposable OAuth data; no login, real token, or ambient auth file is used. */
export function fixtureCredential({ expired = false, }: { readonly expired?: boolean; } = {},): OAuthCredential {
  return { type: 'oauth', access: expired ? HOST_EXPIRED_TOKEN : HOST_TOKEN, refresh: 'fixture-refresh',
    expires: expired ? 0 : Date.now() + 3_600_000, };
}

/** One captured request retains its exact native model, transcript, and options. */
export type FixtureCall = {
  readonly kind: 'full' | 'simple';
  readonly model: Model<Api>;
  readonly context: TranscriptContext;
  readonly options: StreamOptions | undefined;
};

/** Mutable test driver never escapes into production code. */
export type FixtureProviderState = {
  models: readonly Model<Api>[];
  nextModels: readonly Model<Api>[] | undefined;
  calls: FixtureCall[];
  refreshes: number;
  oauthRefreshes: number;
  reply?: (call: FixtureCall) => AssistantMessage;
  refreshGate?: () => Promise<void>;
};

/** Create an offline native Provider with auth callbacks and finite terminal streams. */
export function fixtureProvider({ models = [fixtureModel(),], dynamic = true, allModels = true, }: {
  readonly models?: readonly Model<Api>[];
  readonly dynamic?: boolean;
  readonly allModels?: boolean;
} = {},): { readonly provider: Provider; readonly state: FixtureProviderState; } {
  const state: FixtureProviderState = { models, nextModels: undefined, calls: [], refreshes: 0, oauthRefreshes: 0, };
  /** Record the original request before constructing its canonical response. */
  function dispatch(call: FixtureCall,) {
    state.calls.push(call,);
    const message = state.reply?.(call,) ?? fixtureAssistant({ model: call.model, },);
    return fixtureStream(message,);
  }
  const provider: Provider = {
    id: 'openai-codex', name: 'Synthetic Codex subscription', baseUrl: 'https://host-fixture.invalid/backend-api',
    headers: { 'x-provider-fixture': 'native', },
    auth: { oauth: {
      name: 'Synthetic OAuth', isSubscription: true,
      login: async function login() { return fixtureCredential(); },
      refresh: async function refresh(credential, signal,) {
        signal.throwIfAborted();
        state.oauthRefreshes += 1;
        await state.refreshGate?.();
        return { ...credential, access: HOST_TOKEN, refresh: 'fixture-rotated-refresh', expires: Date.now() + 3_600_000, };
      },
      toAuth: async function toAuth(credential,) {
        return { apiKey: credential.access, headers: { 'x-fixture-oauth': 'resolved', }, };
      },
    }, },
    getModels: function getModels() { return state.models; },
    ...(allModels ? { getAllModels: function getAllModels() { return state.models; }, } : {}),
    stream: function stream(model, context, options,) { return dispatch({ kind: 'full', model, context, options, },); },
    streamSimple: function streamSimple(model, context, options,) {
      return dispatch({ kind: 'simple', model, context, options, },);
    },
    ...(dynamic ? { refreshModels: async function refreshModels(context: RefreshModelsContext) {
      state.refreshes += 1;
      await context.publish({ update: function update() {
        if (state.nextModels !== undefined) {
          state.models = state.nextModels;
          state.nextModels = undefined;
        }
      }, },);
    }, } : {}),
  };
  return { provider, state, };
}

//endregion Credential and request ownership
