// PROTOTYPE ONLY: Candidate I atomic node record vocabulary and persistence.

import { join, } from 'node:path';

import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type {
  JsonSchemaResponseFormat,
  VisionMessage,
} from './chat-contract.ts';
import { writeFileAtomic, } from './corpus-run/atomic-write.ts';
import { hashContent, } from './document-node.ts';
import { modelPromptDigest, } from './prompt-uniqueness-client.ts';
import type { CandidateBallotGuardFailure, } from './prototype-candidate-ballot-model.ts';
import type { RosterModelId, } from './roster-id.ts';

/**
 * Complete terminal Candidate I provider node record.
 */
export type CandidateBallotNodeRecord = {
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
  readonly failureCategory?: CandidateBallotGuardFailure;
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
export type CandidateBallotDispatchRecord = Omit<
  CandidateBallotNodeRecord,
  'durationMs' | 'state'
> & { readonly state: 'dispatched' };

/**
 * Privacy-safe caller diagnostic or explicit absence.
 */
export type CandidateBallotFailureCategory =
  | { readonly kind: 'absent' }
  | {
    /**
     * Exact finite guard category.
     */
    readonly kind: 'found';
    readonly value: CandidateBallotGuardFailure;
  };

/**
 * Digests failure without retaining provider or reviewer wording.
 *
 * @returns SHA-256 evidence digest
 *
 * @example
 * ```ts
 * const digest = candidateBallotFailureDigest({ value: error, });
 * ```
 */
export function candidateBallotFailureDigest({
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
 * const digest = candidateBallotBasePromptDigest({ modelId, messages, signal, });
 * ```
 */
export function candidateBallotBasePromptDigest({
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
 * const digest = candidateBallotContractDigest({ baseDigest, responseFormat, });
 * ```
 */
export function candidateBallotContractDigest({
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
 * await writeCandidateBallotNode({ outputDir, record, });
 * ```
 */
export async function writeCandidateBallotNode({
  outputDir,
  record,
}: {
  readonly outputDir: string;
  readonly record: CandidateBallotNodeRecord | CandidateBallotDispatchRecord;
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
