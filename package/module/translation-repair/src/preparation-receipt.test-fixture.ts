import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  alignDocumentSections,
  assertPipelineDigest,
  blockPairingProtocol,
  blockPairingQuestion,
  hashContent,
  parseDocument,
  prepareBlockPairing,
  PreparationReceiptError,
  type PipelineDigest,
  type PreparationOccurrenceExpectation,
  type PreparationReceiptData,
  type PreparationReceiptFailure,
  type PreparedBlockPairing,
  type RosterModelId,
  type SectionPair,
} from '../dist/final/node/index.mjs';
import { QUALIFICATION_ROSTER, } from './qualified-block-pairing.test-fixture.ts';
import { qualificationTransport, } from './qualification-transport.test-fixture.ts';

//region Native acquisition receipt fixtures

/**
 * Synthetic implementation identity for envelope tests, not a claim about executed package bytes.
 *
 * @returns Well-formed fixture-only pipeline identity
 *
 * @example
 * ```ts
 * const pipelineDigest = fixturePipelineDigest();
 * ```
 */
function fixturePipelineDigest(): PipelineDigest {
  /**
   * Measured hash of fixed non-corpus fixture text supplies valid digest syntax.
   */
  const value = `sha256-tree-v1:${hashContent({ content: 'receipt fixture implementation identity', },)}`;
  assertPipelineDigest(value,);
  return value;
}

/**
 * Actual native preparation and independently assembled expected occurrence beside its terminal data.
 *
 * @example
 * ```ts
 * const fixture = await receiptFixture();
 * ```
 */
export type PreparationReceiptFixture = {
  /**
   * Complete original fixture document.
   */
  readonly sourceText: string;
  /**
   * Complete incumbent fixture document.
   */
  readonly targetText: string;
  /**
   * Expected namespace and current documents, supplied separately from the receipt.
   */
  readonly expected: PreparationOccurrenceExpectation;
  /**
   * Serializable raw final outcomes; no stored aggregate is admitted.
   */
  readonly receipt: PreparationReceiptData;
  /**
   * Actual production handoff for exact parity checks.
   */
  readonly prepared: PreparedBlockPairing;
  /**
   * Real stage input over an owned mock transport.
   */
  readonly input: Parameters<typeof prepareBlockPairing>[0];
  /**
   * Body-only HTTP observations for zero-call replay checks.
   */
  readonly calls: string[];
};

/**
 * Acquires through the real stage/client before assembling receipt data without corpus text or real I/O.
 *
 * @param sourceText - complete original fixture
 *
 * @param targetText - complete target fixture
 *
 * @param sectionPairing - explicit native section correspondence, including an intentional empty map
 *
 * @param pairIndex - current native parent position to acquire
 *
 * @param replies - mock response bodies interpreted by the actual client
 *
 * @param modelIds - complete configured electorate
 *
 * @returns Current raw receipt and independent expected occurrence
 *
 * @throws Error when fixture cannot acquire a queried parent
 *
 * @example
 * ```ts
 * const fixture = await receiptFixture({ replies: ['{"pairs":[]}'], });
 * ```
 */
export async function receiptFixture({
  sourceText = '猫睡了。\n\n它喜欢盒子。',
  targetText = 'The cat slept.\n\nShe loves boxes.',
  sectionPairing,
  pairIndex = 0,
  replies,
  modelIds = QUALIFICATION_ROSTER,
}: {
  readonly sourceText?: string;
  readonly targetText?: string;
  readonly sectionPairing?: readonly SectionPair[];
  readonly pairIndex?: number;
  readonly replies?: readonly string[];
  readonly modelIds?: readonly RosterModelId[];
} = {},): Promise<PreparationReceiptFixture> {
  /**
   * Existing injected HTTP adapter, not a hand-authored preparation summary.
   */
  const { client, calls, } = qualificationTransport((replies === undefined) ? {} : { replies, },);
  /**
   * Complete current source parse.
   */
  const source = parseDocument({ text: sourceText, },);
  /**
   * Complete current target parse retains every container for production ownership.
   */
  const target = parseDocument({ text: targetText, },);
  /**
   * Same pre-block alignment used by the native document shell.
   */
  const pair = alignDocumentSections({
    source,
    target,
    ...((sectionPairing === undefined) ? {} : { sectionPairing, }),
  },)
    .pairs[pairIndex];
  if (pair === undefined)
    throw new Error('receipt fixture requires a current aligned parent',);
  /**
   * Actual parent invocation, retaining all default client and stage controls.
   */
  const input = {
    client,
    modelIds,
    pair,
    pairIndex,
    targetContainers: target.containers,
    signal: new AbortController().signal,
    exchangeTimeoutMs: 5_000,
    l: tagged({ tag: 'receipt-fixture', },),
  };
  /**
   * Native terminal stage result, including fallback when responses establish no relations.
   */
  const prepared = await prepareBlockPairing(input,);
  if (((prepared.kind !== 'paired') && (prepared.kind !== 'fallback')) || (prepared.evidence
    .kind
    !== 'queried'))
    throw new Error('receipt fixture requires queried evidence rather than structural dispatch or historical cache',);
  /**
   * Actual numbered question before occurrence-only interpretation fields are excluded.
   */
  const question = blockPairingQuestion({ pair, },);
  /**
   * Fixture expectations derive from direct inputs and HTTP observations, not the receipt being read.
   */
  const expected: PreparationOccurrenceExpectation = {
    binding: {
      acquisitionPlanDigest: hashContent({ content: 'registered fixture acquisition plan', },),
      attemptId: 'exclusive-fixture-attempt',
      receiptId: `registered-fixture-question/${String(pairIndex,)}`,
      pipelineDigest: fixturePipelineDigest(),
      requestConfigurationDigest: hashContent({ content: JSON.stringify({
        modelIds: input.modelIds,
        exchangeTimeoutMs: input.exchangeTimeoutMs,
        bodies: calls,
      },), },),
      modelIds: input.modelIds,
    },
    sourceHash: source.documentHash,
    targetHash: target.documentHash,
    pairIndex,
    sourceIndex: pair.source
      .sliceIndex,
    targetIndex: pair.target
      .sliceIndex,
    ...((sectionPairing === undefined) ? {} : { sectionPairing, }),
  };
  return {
    sourceText,
    targetText,
    expected,
    prepared,
    input,
    calls,
    receipt: structuredClone({
      version: 1,
      state: 'complete',
      binding: expected.binding,
      question: {
        sourceBlocks: question.sourceBlocks,
        targetBlocks: question.targetBlocks,
        protocol: blockPairingProtocol(question,),
      },
      outcomes: prepared.evidence
        .outcome
        .outcomes,
    },),
  };
}

/**
 * Distinguishes the expected domain refusal from unrelated exceptions and a successful operation.
 *
 * @param run - exact synchronous read under test
 *
 * @returns Named refusal or a positive success witness
 *
 * @throws Error when an unrelated exception occurs
 *
 * @example
 * ```ts
 * expect(receiptFailure(() => readPreparationOccurrence(input))).toBe('binding');
 * ```
 */
export function receiptFailure(run: () => unknown,): PreparationReceiptFailure | 'no-refusal' {
  try {
    run();
    return 'no-refusal';
  }
  catch (error) {
    if (!(error instanceof PreparationReceiptError))
      throw error;
    return error.kind;
  }
}

//endregion Native acquisition receipt fixtures
