import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  type prepareBlockPairing,
  alignDocumentSections,
  createSyntheticClient,
  type ModelTransport,
  parseDocument,
  PreparationQualificationError,
  type PreparationQualificationFailure,
  type QualifiedBlockPairing,
  type RosterModelId,
  type TransportReply
} from '../dist/final/node/index.mjs';

//region Transport-backed qualification fixtures
// Tests acquire real preparation results while every HTTP exchange stays within an owned adapter.

/**
 * Independent default voters, not multiple routes for one identity.
 */
export const QUALIFICATION_ROSTER = [
  'hf:zai-org/GLM-5.3-Flash',
  'hf:Qwen/Qwen3.8-27B',
] as const;

/**
 * Matching relations for the default two-paragraph parent.
 */
export const COMPLETE_PAIRING_REPLY = '{"pairs":[{"source":0,"target":0},{"source":1,"target":1}]}';

/**
 * Actual production inputs beside an owned request counter.
 *
 * @example
 * ```ts
 * const fixture = qualificationFixture();
 * const prepared = await prepareBlockPairing(fixture.input);
 * ```
 */
export type QualificationFixture = {
  /**
   * Existing production preparation invocation.
   */
  readonly input: Parameters<typeof prepareBlockPairing>[0];
  /**
   * Body-only request records, with no credentials or real network traffic.
   */
  readonly calls: string[];
};

/**
 * Constructs a parser-backed parent and finite mocked HTTP replies.
 *
 * @param sourceText - original fixture with no corpus passages
 *
 * @param targetText - intentionally imperfect or structurally expanded incumbent
 *
 * @param replies - reply selected by request order, then repeated from the final supplied reply
 *
 * @param modelIds - configured independent electorate
 *
 * @returns Inputs crossing actual client and preparation code
 *
 * @throws Error when fixture cannot supply one parent or one reply
 *
 * @example
 * ```ts
 * const fixture = qualificationFixture({ replies: ['{"pairs":[]}'], });
 * ```
 */
export function qualificationFixture({
  sourceText = '猫睡了。\n\n它喜欢盒子。',
  targetText = 'The cat slept.\n\nShe loves boxes.',
  replies = [COMPLETE_PAIRING_REPLY,],
  modelIds = QUALIFICATION_ROSTER,
}: {
  readonly sourceText?: string;
  readonly targetText?: string;
  readonly replies?: readonly string[];
  readonly modelIds?: readonly RosterModelId[];
} = {},): QualificationFixture {
  /**
   * Current source parser output.
   */
  const source = parseDocument({ text: sourceText, },);
  /**
   * Complete target containers are retained for media ownership.
   */
  const target = parseDocument({ text: targetText, },);
  /**
   * First parent under production section alignment.
   */
  const [pair,] = alignDocumentSections({
    source,
    target,
  },)
    .pairs;
  if ((pair === undefined) || (replies.length === 0))
    throw new Error('qualification fixture requires one parent and at least one reply',);
  /**
   * Request bodies remain local to this fixture.
   */
  const calls: string[] = [];
  /**
   * Adapter exercises the actual structured client without network access.
   *
   * @param exchange - body-only request fields to record locally
   *
   * @returns Registered event-stream reply
   *
   * @throws Error when fixture reply indexing is inconsistent
   *
   * @example
   * ```ts
   * const response = await recordedReply(exchange);
   * ```
   */
  function recordedReply(exchange: Parameters<ModelTransport>[0],): Promise<TransportReply> {
    calls.push(exchange.bodyJson ?? '',);
    /**
     * Last registered reply repeats if production legitimately asks again.
     */
    const index = Math.min(
      calls.length - 1,
      replies.length - 1,
    );
    /**
     * Indexed reply remains bounded by the nonempty fixture declaration.
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
    input: {
      client: createSyntheticClient({
        apiKey: 'fixture-key',
        transport: recordedReply,
      },),
      modelIds,
      pair,
      pairIndex: 0,
      targetContainers: target.containers,
      signal: new AbortController().signal,
      exchangeTimeoutMs: 5_000,
      l: tagged({ tag: 'qualification-fixture', },),
    },
  };
}

/**
 * Reads an expected domain refusal without mistaking an unexpected exception for guard detection.
 *
 * @param run - exact qualification call under test
 *
 * @returns Closed failure kind or explicit successful-call witness
 *
 * @throws Error when qualification throws an unrelated failure
 *
 * @example
 * ```ts
 * expect(qualificationFailure(() => qualifyPreparedBlockPairing(input)),).toBe('usable-quorum');
 * ```
 */
export function qualificationFailure(run: () => QualifiedBlockPairing,): PreparationQualificationFailure | 'no-refusal' {
  try {
    run();
    return 'no-refusal';
  }
  catch (error) {
    if (!(error instanceof PreparationQualificationError))
      throw error;
    return error.kind;
  }
}

//endregion Transport-backed qualification fixtures
