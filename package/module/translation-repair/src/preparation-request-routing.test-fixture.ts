import {
  type BudgetView,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type ChatTextRequest,
  createRoutingClient,
  type JsonSchemaResponseFormat,
  type ModelCaller,
  type ProviderName,
  type ProviderRecord,
  promptUniqueClient,
  type RosterModelId,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

//region Native routed preparation fixture

/**
 * Logical stage call before the native uniqueness/router/provider stack handles it.
 * @example
 * ```ts
 * const call: ObservedPreparationCall = { modelId, messages, responseFormat };
 * ```
 */
export type ObservedPreparationCall = {
  /** Configured identity, not a provider alias. */
  readonly modelId: RosterModelId;
  /** Exact pre-window materialized substantive messages. */
  readonly messages: ChatTextRequest['messages'];
  /** Native schema when the stage supplies it. */
  readonly responseFormat?: JsonSchemaResponseFormat;
};

/**
 * Builds the native uniqueness and routing stack over supplied native provider clients and owned budget state.
 * @param callers - actual provider clients with injected no-network transports
 * @param initialDry - initial test-owned budget flags
 * @returns Routed stage client, observed logical calls and actual budget fallback order
 * @example
 * ```ts
 * const fixture = routedPreparationFixture({ callers, initialDry });
 * ```
 */
export function routedPreparationFixture({ callers, initialDry, }: {
  readonly callers: ProviderRecord<Pick<ModelCaller, 'chatText'>>;
  readonly initialDry: BudgetView;
},): { readonly client: SyntheticClient; readonly calls: ObservedPreparationCall[]; readonly refused: ProviderName[]; } {
  /** Mutable budget flags belong only to this fixture. */
  const dry = { ...initialDry, };
  /** Budget refusal order distinguishes routing from extra model identities. */
  const refused: ProviderName[] = [];
  /** Synthetic quota reads are not part of this stage's supplied budget interface. */
  function unexpectedQuotaRead(): never {
    throw new Error('routed preparation fixture must use its explicit budget view',);
  }
  /** Real router under the same prompt-uniqueness wrapper used by the run client. */
  const unique = promptUniqueClient({ inner: {
    ...createRoutingClient({ callers, budgets: {
      read: function read(): Promise<BudgetView> { return Promise.resolve({ ...dry, },); },
      markRefused: function markRefused({ provider, }): Promise<void> {
        refused.push(provider,);
        dry[provider] = true;
        return Promise.resolve();
      },
      holds: function holds(): ProviderRecord<number> { return { synthetic: 0, hyper: 0, bedrock: 0, openrouter: 0, }; },
    }, },),
    quotas: unexpectedQuotaRead,
  }, },);
  /** Logical calls remain visible even when the uniqueness wrapper reuses a completed payload. */
  const calls: ObservedPreparationCall[] = [];
  /**
   * Observes and delegates the actual stage request without adding a prompt or control field.
   * @param request - native stage input
   * @returns Existing native JSON outcome
   * @example
   * ```ts
   * const reply = await observe(request);
   * ```
   */
  async function observe<ValueT,>(request: ChatJsonRequest<ValueT>,): Promise<ChatJsonOutcome<ValueT>> {
    calls.push(structuredClone({ modelId: request.modelId, messages: request.messages,
      ...((request.responseFormat === undefined) ? {} : { responseFormat: request.responseFormat, }), },),);
    return await unique.chatJson(request,);
  }
  return { client: { ...unique, chatJson: observe, }, calls, refused, };
}

//endregion Native routed preparation fixture
