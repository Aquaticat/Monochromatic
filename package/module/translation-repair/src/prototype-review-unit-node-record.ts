// PROTOTYPE ONLY: Candidate K atomic node record vocabulary and persistence.

import { join, } from 'node:path';

import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type {
  JsonSchemaResponseFormat,
  VisionMessage,
} from './chat-contract.ts';
import { writeFileAtomic, } from './corpus-run/atomic-write.ts';
import { hashContent, } from './document-node.ts';
import { modelPromptDigest, } from './prompt-uniqueness-client.ts';
import type { ReviewUnitGuardFailure, } from './prototype-review-unit-model.ts';
import type { RosterModelId, } from './roster-id.ts';

/**
 * Complete terminal Candidate K provider node record.
 */
export type ReviewUnitNodeRecord<FailureT extends string = ReviewUnitGuardFailure,> = {
  /**
   * Static node id.
   */
  readonly id: string;
  /**
   * Canonical model identity.
   */
  readonly modelId: RosterModelId;
  /**
   * Immutable graph binding.
   */
  readonly manifestDigest: string;
  /**
   * Substantive prompt identity before schema.
   */
  readonly basePromptDigest: string;
  /**
   * Substantive prompt and response-contract identity.
   */
  readonly promptDigest: string;
  /**
   * Dispatch timestamp.
   */
  readonly startedAt: string;
  /**
   * Local elapsed milliseconds.
   */
  readonly durationMs: number;
  /**
   * Durable terminal state.
   */
  readonly state: 'completed' | 'spent-unusable';
  /**
   * Runtime-owned parsed response digest.
   */
  readonly responseDigest?: string;
  /**
   * Raw provider payload digest.
   */
  readonly providerResponseDigest?: string;
  /**
   * Reply cache key.
   */
  readonly replyCacheKey?: string;
  /**
   * Operational or semantic failure class.
   */
  readonly failureType?: string;
  /**
   * Privacy-safe exact caller-guard category.
   */
  readonly failureCategory?: FailureT;
  /**
   * Provider response parser classification.
   */
  readonly failureDetailType?:
    | 'caller-guard-rejected'
    | 'other-schema-mismatch'
    | 'truncated-completion'
    | 'truncated-thinking'
    | 'unparseable-json';
  /**
   * Failure evidence digest.
   */
  readonly failureDigest?: string;
};

/**
 * Pre-terminal dispatch marker persisted before transmission.
 */
export type ReviewUnitDispatchRecord<FailureT extends string = ReviewUnitGuardFailure,> = Omit<
  ReviewUnitNodeRecord<FailureT>,
  'durationMs' | 'state'
> & { readonly state: 'dispatched' };

/**
 * Privacy-safe caller diagnostic or explicit absence.
 */
export type ReviewUnitFailureCategory<FailureT extends string = ReviewUnitGuardFailure,> =
  | { readonly kind: 'absent' }
  | {
    /**
     * Exact finite guard category.
     */
    readonly kind: 'found';
    readonly value: FailureT;
  };

/**
 * Digests failure without retaining provider or reviewer wording.
 *
 * @returns SHA-256 evidence digest
 *
 * @example
 * ```ts
 * const digest = reviewUnitFailureDigest({ value: error, });
 * ```
 */
export function reviewUnitFailureDigest({
  value,
}: {
  readonly value: unknown;
}): string {
  /**
   * Stable local failure text.
   */
  const text = Error.isError(value,) ? `${value.name}:${value.message}` : String(value,);
  return hashContent({ content: text, });
}

/**
 * Digests model and substantive messages before response schema.
 *
 * @returns Prompt uniqueness base digest
 *
 * @example
 * ```ts
 * const digest = reviewUnitBasePromptDigest({ modelId, messages, signal, });
 * ```
 */
export function reviewUnitBasePromptDigest({
  modelId,
  messages,
  signal,
}: {
  readonly modelId: RosterModelId;
  readonly messages: readonly (ChatMessage | VisionMessage)[];
  readonly signal: AbortSignal;
}): string {
  return modelPromptDigest({ request: {
    modelId,
    messages,
    signal,
  }, },);
}

/**
 * Digests substantive prompt and response contract.
 *
 * @returns Full node prompt digest
 *
 * @example
 * ```ts
 * const digest = reviewUnitContractDigest({ baseDigest, responseFormat, });
 * ```
 */
export function reviewUnitContractDigest({
  baseDigest,
  responseFormat,
}: {
  readonly baseDigest: string;
  readonly responseFormat: JsonSchemaResponseFormat;
}): string {
  return hashContent({
    content: JSON.stringify({
      basePromptDigest: baseDigest,
      responseFormat,
    },),
  });
}

/**
 * Atomically replaces one node record.
 *
 * @example
 * ```ts
 * await writeReviewUnitNode({ outputDir, record, });
 * ```
 */
export async function writeReviewUnitNode<FailureT extends string,>({
  outputDir,
  record,
}: {
  readonly outputDir: string;
  readonly record: ReviewUnitNodeRecord<FailureT> | ReviewUnitDispatchRecord<FailureT>;
}): Promise<void> {
  await writeFileAtomic({
    path: join(
      outputDir,
      `node-${record.id}.json`,
    ),
    text: `${JSON.stringify(
      record,
      null,
      2,
    )}\n`,
  },);
}
