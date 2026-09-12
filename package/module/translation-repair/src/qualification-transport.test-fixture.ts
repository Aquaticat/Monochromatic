import {
  createSyntheticClient,
  type ModelTransport,
  type SyntheticClient,
  type TransportReply,
} from '../dist/final/node/index.mjs';

//region Owned qualification transport

/**
 * Default independent reply for a two-block correspondence question.
 */
export const COMPLETE_PAIRING_REPLY = '{"pairs":[{"source":0,"target":0},{"source":1,"target":1}]}';

/**
 * Creates an actual structured client over an owned no-network adapter, without selecting a document parent.
 *
 * @param replies - reply bodies consumed in order and then repeated from the last registered entry
 *
 * @returns Client and body-only observations owned by this fixture
 *
 * @throws Error when the fixture has no registered response
 *
 * @example
 * ```ts
 * const { client, calls, } = qualificationTransport({ replies: ['{"pairs":[]}'], });
 * ```
 */
export function qualificationTransport({ replies = [COMPLETE_PAIRING_REPLY,], }: {
  readonly replies?: readonly string[];
} = {},): {
  readonly client: SyntheticClient;
  readonly calls: string[]
} {
  if (replies.length === 0)
    throw new Error('qualification transport requires at least one registered reply',);
  /**
   * Request bodies remain local and never include authorization headers.
   */
  const calls: string[] = [];
  /**
   * Returns a registered event-stream response through the real client parser.
   *
   * @param exchange - body-only request fields recorded for actual caller parity
   *
   * @returns Owned mock HTTP reply
   *
   * @throws Error when bounded fixture response indexing is inconsistent
   *
   * @example
   * ```ts
   * const response = await recordedReply(exchange);
   * ```
   */
  function recordedReply(exchange: Parameters<ModelTransport>[0],): Promise<TransportReply> {
    calls.push(exchange.bodyJson ?? '',);
    /**
     * Final registered response repeats during existing stage recovery.
     */
    const index = Math.min(
      calls.length - 1,
      replies.length - 1,
    );
    /**
     * Bounded lookup retains the original fixture error rather than returning invented content.
     */
    const content = replies[index];
    if (content === undefined)
      throw new Error('qualification fixture reply index is unavailable',);
    return Promise.resolve({
      status: 200,
      bodyText: `data: ${JSON.stringify({ choices: [{
        index: 0,
        delta: { content, },
      },], },)}\n\ndata: [DONE]\n\n`,
    },);
  }
  return {
    calls,
    client: createSyntheticClient({
      apiKey: 'fixture-key',
      transport: recordedReply,
    },),
  };
}

//endregion Owned qualification transport
