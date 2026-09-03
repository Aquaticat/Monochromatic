import { openRouterChunksOf, } from './openrouter-chunk-scan.ts';

//region OpenRouter endpoint
// WHICH UPSTREAM SERVED ONE CALL, read off the wire so a bad endpoint can be
// named from the run log rather than found by a separate probe.
//
// WHY THIS EXISTS. The first live pass with OpenRouter in the order
// (keyword233, 2026-09-03) cut `deepseek-v4-pro-0813` twice, gemma twice and
// `deepseek-v4-flash-0731` once, and answered 16 of 31 MiniMax M3 calls with
// an empty content channel, and nothing in the log said which of the model's
// seven zero-data-retention endpoints had served any of them. The MiniMax
// case took a per-endpoint probe to pin on Parasail; the cut streams are
// still unattributed. Every chat completion chunk the gateway sends carries
// the upstream's name at the top level (`"provider":"ModelRun"`, captured
// 2026-09-03), so the attribution was on the wire all along.

/**
 * Field OpenRouter puts the upstream's display name in, on every chunk.
 */
const ENDPOINT_KEY = 'provider';

/**
 * Reading given when no chunk named an upstream.
 */
export const ENDPOINT_UNREPORTED = 'unreported';

/**
 * Upstream endpoint one completed stream says served it.
 *
 * THE FIRST NAME WINS. The gateway names the same upstream on every chunk of
 * one call; a stream that changed upstreams mid-call would be a gateway bug
 * this reader has no evidence of, and the first name is the one that
 * accepted the request.
 *
 * @param bodyText - whole drained `text/event-stream` body
 *
 * @returns Display name as the gateway spelled it, or that no chunk carried one
 *
 * @example
 * ```ts
 * const endpoint = openRouterEndpointOf({ bodyText: reply.bodyText, },);
 * ```
 */
export function openRouterEndpointOf(
  { bodyText, }: { readonly bodyText: string; },
): string | typeof ENDPOINT_UNREPORTED {
  /**
   * Names each chunk carried, in arrival order, empty strings dropped.
   */
  const names = openRouterChunksOf({ bodyText, },)
    .flatMap(function nameOf(chunk,): readonly string[] {
      /**
       * Whatever sits at the field, of unknown type until checked.
       */
      const name = chunk[ENDPOINT_KEY];
      if ((typeof name) !== 'string')
        return [];
      if (name === '')
        return [];
      return [name,];
    },);

  return names[0] ?? ENDPOINT_UNREPORTED;
}

//endregion OpenRouter endpoint
