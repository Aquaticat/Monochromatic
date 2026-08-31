// PROTOTYPE ONLY: Candidate K deterministic spent-node restart.

import { readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type {
  JsonSchemaResponseFormat,
  VisionMessage,
} from './chat-contract.ts';
import { hashContent, } from './document-node.ts';
import { isJsonRecord, } from './json-guard.ts';
import type { ReviewUnitGuardFailure, } from './prototype-review-unit-model.ts';
import {
  reviewUnitBasePromptDigest,
  reviewUnitContractDigest,
  reviewUnitFailureDigest,
  type ReviewUnitDispatchRecord,
  type ReviewUnitNodeRecord,
  writeReviewUnitNode,
} from './prototype-review-unit-node-record.ts';
import type { RosterModelId, } from './roster-id.ts';

/**
 * Restart outcome with explicit pending and unusable states.
 */
export type RestartedReviewUnitNode<ValueT,> =
  | { readonly kind: 'pending' }
  | {
    /**
     * Durable terminal spent record.
     */
    readonly kind: 'unusable';
    readonly record: ReviewUnitNodeRecord;
  }
  | {
    /**
     * Reusable completed response.
     */
    readonly kind: 'usable';
    readonly record: ReviewUnitNodeRecord;
    readonly value: ValueT;
  };

/**
 * Node file lookup without nullish absence.
 */
type ReviewUnitNodeText =
  | { readonly kind: 'absent' }
  | {
    readonly kind: 'found';
    readonly text: string
  };

/**
 * Stored pre-terminal or terminal node record.
 */
type ReviewUnitStoredNode = ReviewUnitDispatchRecord | ReviewUnitNodeRecord;

/**
 * Finite guard category whitelist for generated record validation.
 */
const GUARD_FAILURES: readonly ReviewUnitGuardFailure[] = [
  'anchor',
  'candidate-binding',
  'finding-shape',
  'json-syntax',
  'key-set',
  'overflow',
  'raw-duplicate',
  'status-alphabet',
  'status-length',
];

/**
 * Whether unknown value is finite guard category.
 *
 * @param value - Untrusted stored category
 *
 * @returns Whether value belongs to finite diagnostic union
 */
function isGuardFailure(value: unknown,): value is ReviewUnitGuardFailure {
  return ((typeof value) === 'string')
    && GUARD_FAILURES.some(function same(category,) { return category === value; });
}

/**
 * Whether generated node record carries required binding primitives.
 *
 * @param value - Untrusted parsed node record
 *
 * @returns Whether generated record has valid terminal shape
 */
function isStoredNode(value: unknown,): value is ReviewUnitStoredNode {
  if ((!isJsonRecord(value,))
    || ((typeof value.id) !== 'string')
    || ((typeof value.modelId) !== 'string')
    || ((typeof value.manifestDigest) !== 'string')
    || ((typeof value.basePromptDigest) !== 'string')
    || ((typeof value.promptDigest) !== 'string')
    || ((typeof value.startedAt) !== 'string')
    || ((value.state !== 'dispatched')
      && (value.state !== 'completed')
      && (value.state !== 'spent-unusable')))
    return false;
  if (value.state === 'dispatched')
    return true;
  return ((typeof value.durationMs) === 'number')
    && ((value.failureCategory === undefined) || isGuardFailure(value.failureCategory,));
}

/**
 * Reads node record text or explicit absent state.
 *
 * @returns Found text or explicit absence
 */
async function readNodeText({
  path,
}: {
  readonly path: string;
}): Promise<ReviewUnitNodeText> {
  try {
    return {
      kind: 'found',
      text: await readFile(
        path,
        'utf8',
      ),
    };
  }
  catch (error) {
    if (Error.isError(error,) && ('code' in error)
      && (error.code === 'ENOENT'))
      return { kind: 'absent', };
    throw error;
  }
}

/**
 * Resumes terminal Candidate K node without redispatching spent work.
 *
 * @returns Pending state, durable abstention, or reusable completed value
 *
 * @example
 * ```ts
 * const stored = await restartReviewUnitNode({
 *   outputDir,
 *   id,
 *   modelId,
 *   manifestDigest,
 *   messages,
 *   responseFormat,
 *   validate,
 *   validateRawText,
 *   signal,
 * });
 * ```
 */
export async function restartReviewUnitNode<ValueT,>({
  outputDir,
  id,
  modelId,
  manifestDigest,
  messages,
  responseFormat,
  validate,
  validateRawText,
  signal,
}: {
  readonly outputDir: string;
  readonly id: string;
  readonly modelId: RosterModelId;
  readonly manifestDigest: string;
  readonly messages: readonly (ChatMessage | VisionMessage)[];
  readonly responseFormat: JsonSchemaResponseFormat;
  readonly validate: (value: unknown) => value is ValueT;
  readonly validateRawText?: (rawText: string) => void;
  readonly signal: AbortSignal;
}): Promise<RestartedReviewUnitNode<ValueT>> {
  /**
   * Stored node file lookup.
   */
  const nodeText = await readNodeText({ path: join(
    outputDir,
    `node-${id}.json`,
  ), });
  if (nodeText.kind === 'absent')
    return { kind: 'pending', };
  /**
   * Parsed generated node record.
   */
  const stored: unknown = JSON.parse(nodeText.text,);
  if (!isStoredNode(stored,))
    throw new Error(`review unit restart record differs at ${id}`);
  /**
   * Recomputed substantive prompt digest.
   */
  const baseDigest = reviewUnitBasePromptDigest({
    modelId,
    messages,
    signal,
  });
  /**
   * Recomputed prompt and response schema digest.
   */
  const promptDigest = reviewUnitContractDigest({
    baseDigest,
    responseFormat,
  });
  if ((stored.id !== id)
    || (stored.modelId !== modelId)
    || (stored.manifestDigest !== manifestDigest)
    || (stored.basePromptDigest !== baseDigest)
    || (stored.promptDigest !== promptDigest))
    throw new Error(`review unit restart binding differs at ${id}`);
  if (stored.state === 'dispatched') {
    /**
     * Indeterminate transmission permanently converted to spent state.
     */
    const record: ReviewUnitNodeRecord = {
      id,
      modelId,
      manifestDigest,
      basePromptDigest: baseDigest,
      promptDigest,
      startedAt: stored.startedAt,
      durationMs: 0,
      state: 'spent-unusable',
      failureType: 'IndeterminateTransmission',
      failureDigest: reviewUnitFailureDigest({ value: 'IndeterminateTransmission', }),
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
  if (stored.state === 'spent-unusable')
    return {
      kind: 'unusable',
      record: stored,
    };
  /**
   * Completed response text.
   */
  const responseText = await readFile(
    join(
      outputDir,
      `response-${id}.json`,
    ),
    'utf8',
  );
  if (stored.responseDigest !== hashContent({ content: responseText, }))
    throw new Error(`review unit restart response digest differs at ${id}`);
  if (validateRawText !== undefined)
    validateRawText(responseText,);
  /**
   * Parsed completed response.
   */
  const value: unknown = JSON.parse(responseText,);
  if (!validate(value,))
    throw new Error(`review unit restart response schema differs at ${id}`);
  return {
    kind: 'usable',
    record: stored,
    value,
  };
}
