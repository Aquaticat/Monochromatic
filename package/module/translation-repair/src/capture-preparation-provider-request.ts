import { type Logger, tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ChatTextRequest, } from './chat-contract.ts';
import { isJsonRecord, } from './json-guard.ts';
import { preparationCaptureClient, } from './preparation-capture-client.ts';
import { PreparationRequestCaptureError, } from './preparation-request-capture-error.ts';
import type { PreparationProviderRequest, } from './preparation-request-model.ts';
import type { ProviderName, } from './provider-name.ts';
import type { ModelTransport, } from './synthetic-transport.ts';

//region Exact native request capture

/** Forbidden top-level generation controls; occurrences inside source text or response schemas are not controls. */
const FORBIDDEN_CAPTURE_CONTROLS = ['thinking', 'budget_tokens', 'reasoning_effort', 'temperature', 'reasoning', 'effort',] as const;

/**
 * Materializes one native provider request and interrupts before network or spend-accounting work.
 * @param request - actual stage-level text request under the shared protocol
 * @param provider - compiled permitted text route
 * @param l - caller logger retaining question scope
 * @returns Owned header-free native request bytes and transport decoding metadata
 * @throws PreparationRequestCaptureError when native construction does not reach exactly one supported request
 * @example
 * ```ts
 * const captured = await capturePreparationProviderRequest({ request, provider, l });
 * ```
 */
export async function capturePreparationProviderRequest({ request, provider, l, }: {
  readonly request: ChatTextRequest;
  readonly provider: ProviderName;
  readonly l: Logger;
},): Promise<PreparationProviderRequest> {
  /** Privacy-safe capture lifecycle retains only compiled identities in telemetry. */
  const pl = tagged({ tag: capturePreparationProviderRequest.name, l, },);
  request.signal.throwIfAborted();
  /** Instance identity separates the intentional transport stop from every real client failure. */
  const stop = new PreparationRequestCaptureError({ kind: 'captured', },);
  /** The adapter must be reached once, not inferred from a caught exception's class. */
  const captured: PreparationProviderRequest[] = [];
  /**
   * Records only destination data and refuses transmission unconditionally.
   * @param exchange - native request including headers that must never be retained
   * @throws PreparationRequestCaptureError after capture or on unsupported request shape
   * @example
   * ```ts
   * stopBeforeTransmission(exchange);
   * ```
   */
  function stopBeforeTransmission(exchange: Parameters<ModelTransport>[0],): never {
    request.signal.throwIfAborted();
    if ((exchange.method !== 'POST') || (exchange.bodyJson === undefined))
      throw new PreparationRequestCaptureError({ kind: 'request', },);
    /** Native JSON is inspected for top-level knobs, never by matching private text strings. */
    const body: unknown = JSON.parse(exchange.bodyJson,);
    if (!isJsonRecord(body,))
      throw new PreparationRequestCaptureError({ kind: 'request', },);
    /** Explicit record type keeps callback inspection independent of closure narrowing. */
    const record: Record<string, unknown> = body;
    if (FORBIDDEN_CAPTURE_CONTROLS.some(function present(key,): boolean {
      return Object.hasOwn(record, key,);
    },))
      throw new PreparationRequestCaptureError({ kind: 'request', },);
    captured.push({ modelId: request.modelId, provider, method: 'POST', url: exchange.url, bodyJson: exchange.bodyJson, label: exchange.label,
      ...((exchange.wireFormat === undefined) ? {} : { wireFormat: exchange.wireFormat, }),
      ...((exchange.maxAnswerChars === undefined) ? {} : { maxAnswerChars: exchange.maxAnswerChars, }), },);
    throw stop;
  }
  /** Only non-serving clients with explicit capture transport and refused accounting are constructed. */
  const client = preparationCaptureClient({ provider, transport: stopBeforeTransmission, },);
  pl.debug(`capturing native ${provider} request for ${request.modelId} without transmission`,);
  try {
    await client.chatText(request,);
  }
  catch (error) {
    request.signal.throwIfAborted();
    if (error !== stop)
      throw error;
    pl.debug('native request captured at the transport seam',);
    if (captured.length !== 1)
      throw new PreparationRequestCaptureError({ kind: 'no-capture', },);
    /** Required record after exact-count verification. */
    const [result,] = captured;
    if (result === undefined)
      throw new PreparationRequestCaptureError({ kind: 'no-capture', },);
    return structuredClone(result,);
  }
  throw new PreparationRequestCaptureError({ kind: 'no-capture', },);
}

//endregion Exact native request capture
