import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type {
  JsonSchemaResponseFormat,
  SyntheticClient,
} from './chat-contract.ts';
import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';

//region Stage call
// One guarded model exchange for pipeline stages: non-ok outcomes and
// transport failures become an absent voice (the ensemble tolerates missing
// panelists and critics), while caller aborts always propagate so user
// steering wins. The client's transport-level retries have already run by
// the time this helper sees a failure.

/**
 * One stage voice as data:
 * either the model's validated reply, or the recorded loss of that voice.
 *
 * @example
 * ```ts
 * const voice: StageVoice<CriticReportWire> = { heard: false, };
 * ```
 */
export type StageVoice<ValueT,> =
  | {
    /**
     * Reply arrived and validated.
     */
    readonly heard: true;

    /**
     * Validated reply value.
     */
    readonly value: ValueT;
  }
  | {
    /**
     * Voice lost to a non-ok outcome or transport failure.
     */
    readonly heard: false;
  };

/**
 * Runs one schema-validated exchange for a pipeline stage.
 *
 * @param client - injected model client
 *
 * @param modelId - model to call
 *
 * @param messages - prompt for the exchange
 *
 * @param signal - caller abort honored by the exchange
 *
 * @param exchangeTimeoutMs - deadline armed inside the per-model slot
 *
 * @param responseFormat - structured-output constraint
 *
 * @param validate - client-side schema guard
 *
 * @param stage - stage label for logging
 *
 * @param l - logger of the calling stage
 *
 * @returns Voice as data; a lost voice never throws unless the caller aborted
 *
 * @example
 * ```ts
 * const voice = await attemptStageCall({ ..., stage: 'critic', l, },);
 * ```
 */
export async function attemptStageCall<ValueT,>(
  {
    client,
    modelId,
    messages,
    signal,
    exchangeTimeoutMs,
    responseFormat,
    validate,
    stage,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly modelId: SyntheticModelId;
    readonly messages: readonly ChatMessage[];
    readonly signal: AbortSignal;
    readonly exchangeTimeoutMs: number;
    readonly responseFormat: JsonSchemaResponseFormat;
    readonly validate: (value: unknown,) => value is ValueT;
    readonly stage: string;
    readonly l: Logger;
  }>,
): Promise<StageVoice<ValueT>> {
  try {
    /**
     * Outcome of the exchange.
     */
    const outcome = await client.chatJson({
      modelId,
      messages,
      signal,
      exchangeTimeoutMs,
      responseFormat,
      validate,
    },);
    if (outcome.kind !== 'ok') {
      l.warn(`${stage} ${modelId}: ${outcome.kind}, voice lost`,);
      return { heard: false, };
    }
    return {
      heard: true,
      value: outcome.value,
    };
  }
  catch (error) {
    // Aborts must always win so user steering can stop a fan-out.
    if (signal.aborted)
      throw error;
    l.warn(`${stage} ${modelId}: ${String(error,)}, voice lost`,);
    return { heard: false, };
  }
}

//endregion Stage call
