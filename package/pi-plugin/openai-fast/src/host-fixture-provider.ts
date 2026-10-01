/**
 * Finite native provider and synthetic subscription authentication for tests.
 *
 * @module
 */
import type {
  Api,
  AssistantMessage,
  AssistantMessageEventStream,
  ModelAuth,
  Model,
  OAuthCredential,
  Provider,
  RefreshModelsContext,
  StreamOptions,
  TranscriptContext,
} from '@earendil-works/pi-ai';
import { fixtureAssistant, fixtureModel, fixtureStream, } from './host-fixture-model.ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

//region Credential and request ownership: every fixture has independent state.

/**
 * Synthetic JWT contains only the account claim read by native Codex request preparation.
 */
export const HOST_TOKEN: string = `e30.${btoa(JSON.stringify({
  'https://api.openai.com/auth': { chatgpt_account_id: 'host-fixture-account', },
},),)}.fixture-signature`;

/**
 * Distinct expired access token makes stale credential forwarding observable.
 */
export const HOST_EXPIRED_TOKEN: string = HOST_TOKEN.replace('fixture-signature', 'expired-fixture-signature',);

/**
 * Build disposable OAuth without login, real tokens, or ambient auth files.
 *
 * @param expired - stale access marker makes native refresh observable
 * @returns synthetic credential owned by its test
 * @example
 * ```ts
 * const credential = fixtureCredential({ expired: true });
 * ```
 */
export function fixtureCredential({ expired = false, }: { readonly expired?: boolean; } = {},): OAuthCredential {
  return { type: 'oauth', access: expired ? HOST_EXPIRED_TOKEN : HOST_TOKEN, refresh: 'fixture-refresh',
    expires: expired ? 0 : Date.now() + 3_600_000, };
}

/**
 * Captured request retains exact native model, transcript, and caller options.
 */
export type FixtureCall = {
  readonly kind: 'full' | 'simple';
  readonly model: ForeignBorrowed<Model<Api>>;
  readonly context: ForeignBorrowed<TranscriptContext>;
  readonly options?: ForeignBorrowed<StreamOptions>;
};

/**
 * Mutable test driver never escapes into production code.
 */
export type FixtureProviderState = {
  models: readonly Model<Api>[];
  nextModels?: readonly Model<Api>[];
  calls: FixtureCall[];
  refreshes: number;
  oauthRefreshes: number;
  reply?: (call: FixtureCall) => AssistantMessage;
  refreshGate?: () => Promise<void>;
};

/**
 * Create offline native provider with synthetic auth and finite terminal streams.
 *
 * @param models - original native catalog owned by this scenario
 * @param dynamic - expose native refresh publication capability when needed
 * @param allModels - expose native mixed-model accessor when needed
 * @returns original provider and independent mutable test controls
 * @example
 * ```ts
 * const source = fixtureProvider({ dynamic: false });
 * ```
 */
export function fixtureProvider({ models = [fixtureModel(),], dynamic = true, allModels = true, }: {
  readonly models?: ForeignBorrowed<readonly Model<Api>[]>;
  readonly dynamic?: boolean;
  readonly allModels?: boolean;
} = {},): { readonly provider: Provider; readonly state: FixtureProviderState; } {
  /**
   * Owned request, refresh, and reply controls are independent for each test.
   */
  const state: FixtureProviderState = { models, calls: [], refreshes: 0, oauthRefreshes: 0, };
  /**
   * Record original request before constructing its canonical response.
   *
   * @param call - test-owned observation retaining native request references
   * @returns finite stream with original response identity
   */
  function dispatch(call: FixtureCall,): AssistantMessageEventStream {
    state.calls.push(call,);
    /**
     * Response retains original native identity even for priority requests.
     */
    const message = state.reply?.(call,) ?? fixtureAssistant({ model: call.model, },);
    return fixtureStream(message,);
  }
  /**
   * Native provider callbacks resolve only synthetic subscription credentials.
   */
  const provider: Provider = {
    id: 'openai-codex', name: 'Synthetic Codex subscription', baseUrl: 'https://host-fixture.invalid/backend-api',
    headers: { 'x-provider-fixture': 'native', },
    auth: { oauth: {
      name: 'Synthetic OAuth', isSubscription: true,
      login: function login(): Promise<OAuthCredential> { return Promise.resolve(fixtureCredential(),); },
      refresh: async function refresh(credential: ForeignBorrowed<OAuthCredential>, signal: ForeignBorrowed<AbortSignal>,): Promise<OAuthCredential> {
        signal.throwIfAborted();
        state.oauthRefreshes += 1;
        await state.refreshGate?.();
        return { ...credential, access: HOST_TOKEN, refresh: 'fixture-rotated-refresh', expires: Date.now() + 3_600_000, };
      },
      toAuth: function toAuth(credential: ForeignBorrowed<OAuthCredential>,): Promise<ModelAuth> {
        return Promise.resolve({ apiKey: credential.access, headers: { 'x-fixture-oauth': 'resolved', }, },);
      },
    }, },
    getModels: function getModels(): readonly Model<Api>[] { return state.models; },
    ...(allModels ? { getAllModels: function getAllModels(): readonly Model<Api>[] { return state.models; }, } : {}),
    stream: function stream(model: ForeignBorrowed<Model<Api>>, context: ForeignBorrowed<TranscriptContext>, options?: ForeignBorrowed<StreamOptions>,): AssistantMessageEventStream { return dispatch({ kind: 'full', model, context, ...(options === undefined ? {} : { options, }), },); },
    streamSimple: function streamSimple(model: ForeignBorrowed<Model<Api>>, context: ForeignBorrowed<TranscriptContext>, options?: ForeignBorrowed<StreamOptions>,): AssistantMessageEventStream {
      return dispatch({ kind: 'simple', model, context, ...(options === undefined ? {} : { options, }), },);
    },
    ...(dynamic ? { refreshModels: async function refreshModels(context: ForeignBorrowed<RefreshModelsContext>,): Promise<void> {
      state.refreshes += 1;
      await context.publish({ update: function update(): void {
        if (state.nextModels !== undefined) {
          state.models = state.nextModels;
          delete state.nextModels;
        }
      }, },);
    }, } : {}),
  };
  return { provider, state, };
}

//endregion Credential and request ownership
