// PROTOTYPE ONLY: Candidate K atomic node execution and terminal settlement.

import { join, } from 'node:path';

import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type {
  JsonSchemaResponseFormat,
  SyntheticClient,
  VisionMessage,
} from './chat-contract.ts';
import { writeFileAtomic, } from './corpus-run/atomic-write.ts';
import { hashContent, } from './document-node.ts';
import type { ReviewUnitGuardFailure, } from './prototype-review-unit-model.ts';
import {
  reviewUnitBasePromptDigest,
  reviewUnitContractDigest,
  reviewUnitFailureDigest,
  type ReviewUnitFailureCategory,
  type ReviewUnitNodeRecord,
  writeReviewUnitNode,
} from './prototype-review-unit-node-record.ts';
import type { RosterModelId, } from './roster-id.ts';

/**
 * Fresh execution before deterministic semantic admission settles.
 */
export type ReviewUnitExecution<
  ValueT,
  FailureT extends string = ReviewUnitGuardFailure,
> =
  | {
    /**
     * Provider response passed parsed and raw guards.
     */
    readonly kind: 'usable';
    /**
     * Parsed typed response.
     */
    readonly value: ValueT;
    /**
     * Exact provider text retained only through caller boundary.
     */
    readonly rawText: string;
    /**
     * Runtime binding before terminal state.
     */
    readonly record: Omit<
      ReviewUnitNodeRecord<FailureT>,
      'durationMs' | 'responseDigest' | 'state'
    > & { readonly durationMs: number };
  }
  | {
    /**
     * Provider or caller guard made response no-effect.
     */
    readonly kind: 'unusable';
    /**
     * Atomic terminal spent record.
     */
    readonly record: ReviewUnitNodeRecord<FailureT>;
  };

/**
 * Executes one Candidate K node exactly once.
 *
 * @returns Usable response pending semantic admission or terminal spent record
 *
 * @example
 * ```ts
 * const execution = await executeReviewUnitNode({
 *   outputDir,
 *   client,
 *   id,
 *   modelId,
 *   manifestDigest,
 *   messages,
 *   responseFormat,
 *   validate,
 *   validateRawText,
 *   failureCategory,
 *   signal,
 * });
 * ```
 */
export async function executeReviewUnitNode<
  ValueT,
  FailureT extends string = ReviewUnitGuardFailure,
>({
  outputDir,
  client,
  id,
  modelId,
  manifestDigest,
  messages,
  responseFormat,
  validate,
  validateRawText,
  failureCategory,
  exchangeTimeoutMs,
  signal,
}: {
  readonly outputDir: string;
  readonly client: SyntheticClient;
  readonly id: string;
  readonly modelId: RosterModelId;
  readonly manifestDigest: string;
  readonly messages: readonly (ChatMessage | VisionMessage)[];
  readonly responseFormat: JsonSchemaResponseFormat;
  readonly validate: (value: unknown) => value is ValueT;
  readonly validateRawText?: (rawText: string) => void;
  readonly failureCategory?: (
    detailType?: ReviewUnitNodeRecord['failureDetailType'],
  ) => ReviewUnitFailureCategory<FailureT>;
  readonly exchangeTimeoutMs: number;
  readonly signal: AbortSignal;
}): Promise<ReviewUnitExecution<ValueT, FailureT>> {
  /**
   * Prompt digest before response schema.
   */
  const baseDigest = reviewUnitBasePromptDigest({
    modelId,
    messages,
    signal,
  });
  /**
   * Prompt and response-contract digest.
   */
  const promptDigest = reviewUnitContractDigest({
    baseDigest,
    responseFormat,
  });
  /**
   * Dispatch wall-clock timestamp.
   */
  const startedAt = new Date().toISOString();
  /**
   * Monotonic local start.
   */
  const startedMs = Date.now();
  /**
   * Immutable node binding shared by all records.
   */
  const binding = {
    id,
    modelId,
    manifestDigest,
    basePromptDigest: baseDigest,
    promptDigest,
    startedAt,
  };
  await writeReviewUnitNode({
    outputDir,
    record: {
      ...binding,
      state: 'dispatched',
    },
  },);
  try {
    /**
     * Provider-neutral parsed outcome.
     */
    const outcome = await client.chatJson({
      modelId,
      messages,
      responseFormat,
      validate,
      exchangeTimeoutMs,
      signal,
    },);
    if (signal.aborted)
      throw signal.reason;
    /**
     * Provider call duration.
     */
    const durationMs = Date.now() - startedMs;
    if (outcome.kind !== 'ok') {
      /**
       * Provider parser detail without raw wording.
       */
      const detail = outcome.kind === 'schema-mismatch' ? outcome.detail : outcome.marker;
      /**
       * Stable parser reason when schema mismatch occurred.
       */
      const failureDetailType = outcome.kind === 'schema-mismatch'
        ? outcome.reason ?? 'other-schema-mismatch'
        : undefined;
      /**
       * Optional exact caller category.
       */
      const category = failureCategory?.(failureDetailType,);
      /**
       * Atomic terminal spent record.
       */
      const record: ReviewUnitNodeRecord<FailureT> = {
        ...binding,
        durationMs,
        state: 'spent-unusable',
        providerResponseDigest: hashContent({ content: outcome.rawText, }),
        replyCacheKey: baseDigest,
        failureType: outcome.kind,
        ...(category?.kind === 'found' ? { failureCategory: category.value, } : {}),
        ...(failureDetailType === undefined ? {} : { failureDetailType, }),
        failureDigest: reviewUnitFailureDigest({
          value: `${outcome.kind}:${detail}`,
        },),
      };
      await writeReviewUnitNode({
        outputDir,
        record,
      });
      return {
        kind: 'unusable',
        record,
      };
    }
    if (validateRawText !== undefined) {
      try {
        validateRawText(outcome.rawText,);
      }
      catch (error) {
        /**
         * Raw guard category captured by caller closure.
         */
        const category = failureCategory?.();
        /**
         * Atomic raw-guard terminal record.
         */
        const record: ReviewUnitNodeRecord<FailureT> = {
          ...binding,
          durationMs,
          state: 'spent-unusable',
          providerResponseDigest: hashContent({ content: outcome.rawText, }),
          replyCacheKey: baseDigest,
          failureType: Error.isError(error,) ? error.constructor
            .name : 'unknown',
          ...(category?.kind === 'found' ? { failureCategory: category.value, } : {}),
          failureDigest: reviewUnitFailureDigest({ value: error, }),
        };
        await writeReviewUnitNode({
          outputDir,
          record,
        });
        return {
          kind: 'unusable',
          record,
        };
      }
    }
    return {
      kind: 'usable',
      value: outcome.value,
      rawText: outcome.rawText,
      record: {
        ...binding,
        durationMs,
        providerResponseDigest: hashContent({ content: outcome.rawText, }),
        replyCacheKey: baseDigest,
      },
    };
  }
  catch (error) {
    if (signal.aborted) {
      /**
       * Exact caller-abort terminal record.
       */
      const record: ReviewUnitNodeRecord<FailureT> = {
        ...binding,
        durationMs: Date.now() - startedMs,
        state: 'spent-unusable',
        failureType: 'CallerAbort',
        failureDigest: reviewUnitFailureDigest({ value: signal.reason, }),
      };
      await writeReviewUnitNode({
        outputDir,
        record,
      });
      throw signal.reason;
    }
    /**
     * Optional category for thrown caller validation failure.
     */
    const category = failureCategory?.();
    /**
     * Atomic thrown-failure terminal record.
     */
    const record: ReviewUnitNodeRecord<FailureT> = {
      ...binding,
      durationMs: Date.now() - startedMs,
      state: 'spent-unusable',
      failureType: Error.isError(error,) ? error.constructor
        .name : 'unknown',
      ...(category?.kind === 'found' ? { failureCategory: category.value, } : {}),
      failureDigest: reviewUnitFailureDigest({ value: error, }),
    };
    await writeReviewUnitNode({
      outputDir,
      record,
    });
    return {
      kind: 'unusable',
      record,
    };
  }
}

/**
 * Settles usable provider response after deterministic semantic admission.
 *
 * @returns Atomic completed or spent terminal record
 *
 * @example
 * ```ts
 * const record = await settleReviewUnitNode({ outputDir, execution, usable, });
 * ```
 */
export async function settleReviewUnitNode<
  FailureT extends string = ReviewUnitGuardFailure,
>({
  outputDir,
  execution,
  usable,
  failure,
  failureCategory,
}: {
  readonly outputDir: string;
  readonly execution: Extract<ReviewUnitExecution<unknown, FailureT>, { readonly kind: 'usable' }>;
  readonly usable: boolean;
  readonly failure?: unknown;
  readonly failureCategory?: FailureT;
}): Promise<ReviewUnitNodeRecord<FailureT>> {
  /**
   * Runtime-owned parsed response text.
   */
  const responseText = `${JSON.stringify(
    execution.value,
    null,
    2,
  )}\n`;
  /**
   * Final atomic node record including exact semantic category.
   */
  const record: ReviewUnitNodeRecord<FailureT> = {
    ...execution.record,
    state: usable ? 'completed' : 'spent-unusable',
    responseDigest: hashContent({ content: responseText, }),
    ...(failure === undefined ? {} : {
      failureType: Error.isError(failure,) ? failure.constructor
        .name : 'unknown',
      ...(failureCategory === undefined ? {} : { failureCategory, }),
      failureDigest: reviewUnitFailureDigest({ value: failure, }),
    }),
  };
  await writeFileAtomic({
    path: join(
      outputDir,
      `response-${record.id}.json`,
    ),
    text: responseText,
  },);
  await writeReviewUnitNode({
    outputDir,
    record,
  });
  return record;
}
