// PROTOTYPE ONLY: Candidate B decision records and atomic publication.

import { mkdir, readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import { hashContent, } from './document-node.ts';
import {
  COMPILER_SPECIALISTS,
  RENDERER_NODE,
  SPECIFICATION_NODE,
} from './prototype-spec-compiler-plan.ts';
import type { BriefEditorNodeRecord, } from './prototype-brief-editor-runtime.ts';
import { writePrototypeJson, } from './prototype-brief-editor-runtime.ts';
import { writeFileAtomic, } from './corpus-run/atomic-write.ts';

export type CompilerRoleDecision = {
  readonly id: string;
  readonly applied: boolean;
  readonly beforeDigest: string;
  readonly afterDigest: string;
  readonly failureType?: string;
};

export async function publishSpecificationCompiler(
  {
    outputDir,
    entryId,
    manifestDigest,
    document,
    records,
    decisions,
    startedAt,
    specificationStatus,
    selectedFallback,
    signal,
  }: {
    readonly outputDir: string;
    readonly entryId: string;
    readonly manifestDigest: string;
    readonly document: string;
    readonly records: readonly BriefEditorNodeRecord[];
    readonly decisions: readonly CompilerRoleDecision[];
    readonly startedAt: number;
    readonly specificationStatus: 'model' | 'raw-fallback';
    readonly selectedFallback?: string;
    readonly signal: AbortSignal;
  },
): Promise<void> {
  for (const decision of decisions)
    await writePrototypeJson({ path: join(outputDir, `decision-${decision.id}.json`,), value: decision, },);
  const pagePath = join(outputDir, 'fixed', 'people', entryId, 'page.en.md',);
  try {
    await mkdir(join(outputDir, 'fixed', 'people', entryId,), { recursive: true, },);
    await writeFileAtomic({ path: pagePath, text: document, },);
    if (await readFile(pagePath, 'utf8',) !== document)
      throw new Error('specification compiler readback mismatch');
  }
  catch (error) {
    if (signal.aborted)
      throw signal.reason;
    const failureType = Error.isError(error,) ? error.constructor.name : 'unknown';
    throw new Error(`PublicationUnavailableError: ${failureType}`);
  }
  const invocationDurationMs = Date.now() - startedAt;
  await writePrototypeJson({ path: join(outputDir, 'result.json',), value: {
    prototype: 'specification-compiler-b',
    status: 'written-pending-output-review',
    payloadCeiling: 2 + COMPILER_SPECIALISTS.length,
    dependencyWaves: 3,
    manifestDigest,
    specificationStatus,
    rendererId: RENDERER_NODE.id,
    specificationId: SPECIFICATION_NODE.id,
    selectedFallback: selectedFallback ?? null,
    nodeRecords: records,
    decisions,
    invocationDurationMs,
    finalDigest: hashContent({ content: document, }),
  }, },);
  console.log(`PROTOTYPE ${entryId} design=B status=written-pending-output-review fallback=${selectedFallback ?? 'none'} ms=${String(invocationDurationMs,)}`,);
}
