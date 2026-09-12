import { randomUUID, } from 'node:crypto';
import { type Logger, tagged, } from '@monochromatic-dev/module-logger/ts';
import { hashContent, } from './document-node.ts';
import { isJsonRecord, } from './json-guard.ts';
import { PreparationAttemptError, type PreparationAttemptOperation, } from './preparation-attempt-error.ts';
import { preparationAttemptStorage, type PreparationAttemptFile, type PreparationAttemptStorage, } from './preparation-attempt-storage.ts';

//region Exclusive preparation attempt namespace

/**
 * Location returned after root-plan bytes and the identity marker have been written and synced.
 * This is not a phase review, acquisition receipt or writer-admission capability.
 * @example
 * ```ts
 * const attempt = await createPreparationAttempt({ parentDir, rootPlanText, l });
 * ```
 */
export type PreparationAttemptLocation = {
  /** Fresh exclusively created directory; incomplete prior attempts are never reopened here. */
  readonly dir: string;
  /** Independent identity of this newly created namespace. */
  readonly attemptId: string;
  /** Hash of exact serialized root-plan bytes, without canonicalizing or dropping fields. */
  readonly rootPlanDigest: string;
};

/**
 * Writes a fixed namespace file and preserves the failed operation in its diagnostic.
 * @param storage - trusted namespace-only adapter
 * @param dir - freshly owned directory
 * @param file - fixed internal filename
 * @param text - complete encoded content
 * @param operation - diagnostic stage with no private text
 * @throws PreparationAttemptError when opening, writing, syncing or closing fails
 * @example
 * ```ts
 * await writeAttemptFile({ storage, dir, file: 'root-plan.json', text, operation: 'write-plan' });
 * ```
 */
async function writeAttemptFile({ storage, dir, file, text, operation, }: {
  readonly storage: PreparationAttemptStorage;
  readonly dir: string;
  readonly file: PreparationAttemptFile;
  readonly text: string;
  readonly operation: PreparationAttemptOperation;
},): Promise<void> {
  try {
    await storage.write({ dir, file, text, },);
  }
  catch (error) {
    throw new PreparationAttemptError({ operation, dir, cause: error, },);
  }
}

/**
 * Allocates a new namespace without converting failed creation into an open of old state.
 * @param storage - trusted allocator preserving exclusive creation
 * @param parentDir - caller-owned existing parent
 * @returns Fresh directory
 * @throws PreparationAttemptError when allocation fails
 * @example
 * ```ts
 * const dir = await allocateAttemptDirectory({ storage, parentDir });
 * ```
 */
async function allocateAttemptDirectory({ storage, parentDir, }: { readonly storage: PreparationAttemptStorage; readonly parentDir: string; },): Promise<string> {
  try {
    return await storage.allocate({ parentDir, },);
  }
  catch (error) {
    if (error instanceof PreparationAttemptError)
      throw error;
    throw new PreparationAttemptError({ operation: 'create-directory', dir: parentDir, cause: error, },);
  }
}

/**
 * Creates the journal's exclusive namespace without providers, acquisition claims or approval.
 * Only JSON object syntax is checked here; the phase materializer must validate root-plan semantics first.
 * The identity marker follows a synced complete plan. Failures retain incomplete owned files.
 *
 * @param parentDir - existing caller-owned runs directory
 * @param rootPlanText - exact serialized root plan validated by the phase materializer
 * @param l - caller logger retaining preparation scope
 * @param storage - trusted namespace-only I/O, native by default; permits controlled fault/ordering tests
 * @returns New namespace identity after both file writes and syncs complete
 * @throws PreparationAttemptError when syntax or exclusive namespace creation fails
 * @example
 * ```ts
 * const attempt = await createPreparationAttempt({ parentDir, rootPlanText: JSON.stringify(rootPlan), l });
 * ```
 */
export async function createPreparationAttempt({ parentDir, rootPlanText, l, storage = preparationAttemptStorage, }: {
  readonly parentDir: string;
  readonly rootPlanText: string;
  readonly l: Logger;
  readonly storage?: PreparationAttemptStorage;
},): Promise<PreparationAttemptLocation> {
  /** Lifecycle messages never include root-plan content. */
  const pl = tagged({ tag: createPreparationAttempt.name, l, },);
  pl.debug('validating root-plan object syntax before creating a namespace',);
  try {
    /** Syntax validity is deliberately separate from semantic plan authority. */
    const parsed: unknown = JSON.parse(rootPlanText,);
    if (Array.isArray(parsed,) || (!isJsonRecord(parsed,)))
      throw new PreparationAttemptError({ operation: 'plan-syntax', dir: parentDir, },);
  }
  catch (error) {
    if (error instanceof PreparationAttemptError)
      throw error;
    throw new PreparationAttemptError({ operation: 'plan-syntax', dir: parentDir, cause: error, },);
  }
  /** Allocation is never an idempotent resume of an existing attempt. */
  const dir = await allocateAttemptDirectory({ storage, parentDir, },);
  /** Original bytes are bound before a later phase may construct a live client. */
  const rootPlanDigest = hashContent({ content: rootPlanText, },);
  /** Namespace identity is unrelated to model-prompt identity and never enters a model message. */
  const attemptId = randomUUID();
  await writeAttemptFile({ storage, dir, file: 'root-plan.json', text: rootPlanText, operation: 'write-plan', },);
  await writeAttemptFile({ storage, dir, file: 'attempt.json', text: JSON.stringify({ version: 1, kind: 'preparation-attempt', attemptId, rootPlanDigest, },), operation: 'write-identity', },);
  pl.info(`sealed fresh preparation namespace ${attemptId}`,);
  return { dir, attemptId, rootPlanDigest, };
}

//endregion Exclusive preparation attempt namespace
