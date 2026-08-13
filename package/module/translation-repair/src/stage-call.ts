import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type {
  ChatJsonOutcome,
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
 * Longest model text a lost-voice warning carries.
 * A parse failure is almost always diagnosable from the OPENING characters:
 * the Kimi-K3 outage was a two-character channel marker, and 507 mismatches in
 * one pass were explained by it.
 */
const RAW_PREVIEW_CHARS = 120;

/**
 * Names WHY a voice was lost, not merely that one was.
 *
 * `schema-mismatch` covers three different faults needing three different
 * fixes, truncated thinking, unparseable content and a rejected guard, and the
 * client already distinguishes them in `detail`. That distinction was logged at
 * DEBUG and discarded here, so a run recorded `schema-mismatch, voice lost`
 * hundreds of times while saying nothing about which fault it was.
 *
 * @param outcome - non-ok exchange outcome
 *
 * @returns Cause with its sub-kind, plus a bounded opening of the model text
 *
 * @example
 * ```ts
 * lostVoiceCause({ outcome, },);
 * ```
 */
function lostVoiceCause(
  {
    outcome,
  }: {
    readonly outcome: Exclude<ChatJsonOutcome<unknown>, { readonly kind: 'ok'; }>;
  },
): string {
  /**
   * Model text flattened to one line and bounded, since a warning is one line.
   *
   * Both line terminators are replaced, not just the newline: a reply using
   * carriage returns would otherwise break the one-line guarantee this exists
   * to keep. Bounded by CODE POINT rather than by `slice`, so cutting at the
   * limit cannot split a surrogate pair and leave a lone half in the log, which
   * is exactly the diagnostic that has to survive to be read.
   */
  const opening = [...outcome
    .rawText
    .replaceAll(
      '\r\n',
      ' ',
    )
    .replaceAll(
      '\n',
      ' ',
    )
    .replaceAll(
      '\r',
      ' ',
    ),]
    .slice(
      0,
      RAW_PREVIEW_CHARS,
    )
    .join('',);
  if (outcome.kind === 'schema-mismatch')
    return `schema-mismatch (${outcome.detail}) raw=${JSON.stringify(opening,)}`;
  return `refusal-shaped (${outcome.marker}) raw=${JSON.stringify(opening,)}`;
}

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
      l.warn(`${stage} ${modelId}: ${lostVoiceCause({ outcome, },)}, voice lost`,);
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
