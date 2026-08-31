// PROTOTYPE ONLY: Candidate I atomic node execution and terminal settlement.

import { join, } from 'node:path';

import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type {
  JsonSchemaResponseFormat,
  SyntheticClient,
  VisionMessage,
} from './chat-contract.ts';
import { writeFileAtomic, } from './corpus-run/atomic-write.ts';
import { hashContent, } from './document-node.ts';
import type { CandidateBallotGuardFailure, } from './prototype-candidate-ballot-model.ts';
import {
  candidateBallotBasePromptDigest,
  candidateBallotContractDigest,
  candidateBallotFailureDigest,
  type CandidateBallotFailureCategory,
  type CandidateBallotNodeRecord,
  writeCandidateBallotNode,
} from './prototype-candidate-ballot-node-record.ts';
import type { RosterModelId, } from './roster-id.ts';

/**
 * Fresh execution before deterministic semantic admission settles.
 */
export type CandidateBallotExecution<ValueT,> =
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
      CandidateBallotNodeRecord,
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
    readonly record: CandidateBallotNodeRecord;
  };

/**
 * Executes one Candidate I node exactly once.
 *
 * @returns Usable response pending semantic admission or terminal spent record
 *
 * @example
 * ```ts
 * const execution = await executeCandidateBallotNode({
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
export async function executeCandidateBallotNode<ValueT,>({
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
    detailType?: CandidateBallotNodeRecord['failureDetailType'],
  ) => CandidateBallotFailureCategory;
  readonly signal: AbortSignal;
}): Promise<CandidateBallotExecution<ValueT>> {
  /**
   * Prompt digest before response schema.
   */
  const baseDigest = candidateBallotBasePromptDigest({
    modelId,
    messages,
    signal,
  });
  /**
   * Prompt and response-contract digest.
   */
  const promptDigest = candidateBallotContractDigest({
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
  await writeCandidateBallotNode({
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
      const record: CandidateBallotNodeRecord = {
        ...binding,
        durationMs,
        state: 'spent-unusable',
        providerResponseDigest: hashContent({ content: outcome.rawText, }),
        replyCacheKey: baseDigest,
        failureType: outcome.kind,
        ...(category?.kind === 'found' ? { failureCategory: category.value, } : {}),
        ...(failureDetailType === undefined ? {} : { failureDetailType, }),
        failureDigest: candidateBallotFailureDigest({
          value: `${outcome.kind}:${detail}`,
        },),
      };
      await writeCandidateBallotNode({
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
        const record: CandidateBallotNodeRecord = {
          ...binding,
          durationMs,
          state: 'spent-unusable',
          providerResponseDigest: hashContent({ content: outcome.rawText, }),
          replyCacheKey: baseDigest,
          failureType: Error.isError(error,) ? error.constructor
            .name : 'unknown',
          ...(category?.kind === 'found' ? { failureCategory: category.value, } : {}),
          failureDigest: candidateBallotFailureDigest({ value: error, }),
        };
        await writeCandidateBallotNode({
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
      const record: CandidateBallotNodeRecord = {
        ...binding,
        durationMs: Date.now() - startedMs,
        state: 'spent-unusable',
        failureType: 'CallerAbort',
        failureDigest: candidateBallotFailureDigest({ value: signal.reason, }),
      };
      await writeCandidateBallotNode({
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
    const record: CandidateBallotNodeRecord = {
      ...binding,
      durationMs: Date.now() - startedMs,
      state: 'spent-unusable',
      failureType: Error.isError(error,) ? error.constructor
        .name : 'unknown',
      ...(category?.kind === 'found' ? { failureCategory: category.value, } : {}),
      failureDigest: candidateBallotFailureDigest({ value: error, }),
    };
    await writeCandidateBallotNode({
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
 * const record = await settleCandidateBallotNode({ outputDir, execution, usable, });
 * ```
 */
export async function settleCandidateBallotNode({
  outputDir,
  execution,
  usable,
  failure,
  failureCategory,
}: {
  readonly outputDir: string;
  readonly execution: Extract<CandidateBallotExecution<unknown>, { readonly kind: 'usable' }>;
  readonly usable: boolean;
  readonly failure?: unknown;
  readonly failureCategory?: CandidateBallotGuardFailure;
}): Promise<CandidateBallotNodeRecord> {
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
  const record: CandidateBallotNodeRecord = {
    ...execution.record,
    state: usable ? 'completed' : 'spent-unusable',
    responseDigest: hashContent({ content: responseText, }),
    ...(failure === undefined ? {} : {
      failureType: Error.isError(failure,) ? failure.constructor
        .name : 'unknown',
      ...(failureCategory === undefined ? {} : { failureCategory, }),
      failureDigest: candidateBallotFailureDigest({ value: failure, }),
    }),
  };
  await writeFileAtomic({
    path: join(
      outputDir,
      `response-${record.id}.json`,
    ),
    text: responseText,
  },);
  await writeCandidateBallotNode({
    outputDir,
    record,
  });
  return record;
}
