import { randomUUID, } from 'node:crypto';
import { chmod, mkdtemp, open, } from 'node:fs/promises';
import { join, } from 'node:path';
import { type Logger, tagged, } from '@monochromatic-dev/module-logger/ts';
import { hashContent, } from './document-node.ts';
import { isJsonRecord, } from './json-guard.ts';
import { PreparationAttemptError, type PreparationAttemptOperation, } from './preparation-attempt-error.ts';

//region Exclusive preparation attempt namespace

/**
 * Location and identity returned only after root-plan bytes and the identity marker have been written and synced.
 * This is not a phase review, acquisition receipt or writer-admission capability.
 * @example
 * ```ts
 * const attempt = await createPreparationAttempt({ parentDir, rootPlanText, l });
 * ```
 */
export type PreparationAttemptLocation = {
  /** Fresh exclusively created directory; incomplete prior attempts are never reopened by this operation. */
  readonly dir: string;
  /** Independent identity for this newly created namespace. */
  readonly attemptId: string;
  /** Hash of exact serialized root-plan bytes, without canonicalizing or dropping fields. */
  readonly rootPlanDigest: string;
};

/**
 * Writes one namespace file exclusively and syncs its bytes before the caller advances to the next step.
 * @param dir - freshly owned attempt directory
 * @param file - fixed internal filename
 * @param text - complete encoded file content
 * @param operation - diagnostic stage with no private text
 * @throws PreparationAttemptError when opening, writing, syncing or closing fails
 * @example
 * ```ts
 * await writeAttemptFile({ dir, file: 'root-plan.json', text, operation: 'write-plan' });
 * ```
 */
async function writeAttemptFile({ dir, file, text, operation, }: {
  readonly dir: string;
  readonly file: 'root-plan.json' | 'attempt.json';
  readonly text: string;
  readonly operation: PreparationAttemptOperation;
},): Promise<void> {
  try {
    await using handle = await open(join(dir, file,), 'wx', 0o600,);
    await handle.writeFile(text, 'utf8',);
    await handle.sync();
  }
  catch (error) {
    throw new PreparationAttemptError({ operation, dir, cause: error, },);
  }
}

/**
 * Allocates a fresh directory without converting a failed create into an open of existing state.
 * @param parentDir - caller-owned existing parent
 * @returns Exclusively created directory
 * @throws PreparationAttemptError when allocation fails
 * @example
 * ```ts
 * const dir = await allocateAttemptDirectory({ parentDir });
 * ```
 */
async function allocateAttemptDirectory({ parentDir, }: { readonly parentDir: string; },): Promise<string> {
  try {
    return await mkdtemp(join(parentDir, 'preparation-',),);
  }
  catch (error) {
    throw new PreparationAttemptError({ operation: 'create-directory', dir: parentDir, cause: error, },);
  }
}

/**
 * Creates the owning journal's exclusive namespace without providers, acquisition claims or approval.
 * Only JSON object syntax is checked here; the phase materializer must validate root-plan semantics first.
 * The marker is written after the complete root plan is synced. Failures retain incomplete owned files.
 *
 * @param parentDir - existing caller-owned runs directory
 * @param rootPlanText - exact serialized root plan already validated by the phase materializer
 * @param l - caller logger retaining the preparation scope
 * @returns Fresh namespace identity after both files are synced
 * @throws PreparationAttemptError when syntax or exclusive namespace creation fails
 * @example
 * ```ts
 * const attempt = await createPreparationAttempt({ parentDir, rootPlanText: JSON.stringify(rootPlan), l });
 * ```
 */
export async function createPreparationAttempt({ parentDir, rootPlanText, l, }: {
  readonly parentDir: string;
  readonly rootPlanText: string;
  readonly l: Logger;
},): Promise<PreparationAttemptLocation> {
  /** Namespace lifecycle logs contain no root-plan content. */
  const pl = tagged({ tag: createPreparationAttempt.name, l, },);
  pl.debug('validating root-plan object syntax before creating a namespace',);
  try {
    /** Syntax validation does not establish semantic plan authority. */
    const parsed: unknown = JSON.parse(rootPlanText,);
    if (Array.isArray(parsed,) || (!isJsonRecord(parsed,)))
      throw new PreparationAttemptError({ operation: 'plan-syntax', dir: parentDir, },);
  }
  catch (error) {
    if (error instanceof PreparationAttemptError)
      throw error;
    throw new PreparationAttemptError({ operation: 'plan-syntax', dir: parentDir, cause: error, },);
  }
  /** Unique allocation, never an idempotent open of existing attempt state. */
  const dir = await allocateAttemptDirectory({ parentDir, },);
  try {
    await chmod(dir, 0o700,);
  }
  catch (error) {
    throw new PreparationAttemptError({ operation: 'create-directory', dir, cause: error, },);
  }
  /** Plan bytes are bound before any phase can create a live client. */
  const rootPlanDigest = hashContent({ content: rootPlanText, },);
  /** Namespace identity is unrelated to model-prompt identity and never enters a model message. */
  const attemptId = randomUUID();
  await writeAttemptFile({ dir, file: 'root-plan.json', text: rootPlanText, operation: 'write-plan', },);
  await writeAttemptFile({ dir, file: 'attempt.json', text: JSON.stringify({ version: 1, kind: 'preparation-attempt', attemptId, rootPlanDigest, },), operation: 'write-identity', },);
  pl.info(`sealed fresh preparation namespace ${attemptId}`,);
  return { dir, attemptId, rootPlanDigest, };
}

//endregion Exclusive preparation attempt namespace
