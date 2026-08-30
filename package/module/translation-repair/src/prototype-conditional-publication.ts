// PROTOTYPE ONLY: Candidate E1 double-prime atomic publication.

import { mkdir, readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import { hashContent, } from './document-node.ts';
import { writePrototypeJson, } from './prototype-brief-editor-runtime.ts';
import type { SlotNodeRecord, } from './prototype-slot-runtime.ts';
import { writeFileAtomic, } from './corpus-run/atomic-write.ts';

export async function publishConditionalPrototype(
  {
    outputDir,
    entryId,
    manifestDigest,
    finalDocument,
    selectedAuthor,
    evidenceFloorMet,
    votes,
    resolverAttempted,
    resolverChangedOnlyLocated,
    resolutionAdopted,
    rejectedFindingCount,
    records,
    unattemptedNodes,
    slotCount,
    startedAt,
    signal,
  }: {
    readonly outputDir: string;
    readonly entryId: string;
    readonly manifestDigest: string;
    readonly finalDocument: string;
    readonly selectedAuthor: string;
    readonly evidenceFloorMet: boolean;
    readonly votes: Readonly<Record<string, number>>;
    readonly resolverAttempted: boolean;
    readonly resolverChangedOnlyLocated: boolean;
    readonly resolutionAdopted: boolean;
    readonly rejectedFindingCount: number;
    readonly records: readonly SlotNodeRecord[];
    readonly unattemptedNodes: readonly string[];
    readonly slotCount: number;
    readonly startedAt: number;
    readonly signal: AbortSignal;
  },
): Promise<void> {
  const pagePath = join(outputDir, 'fixed', 'people', entryId, 'page.en.md',);
  try {
    await mkdir(join(outputDir, 'fixed', 'people', entryId,), { recursive: true, },);
    await writeFileAtomic({ path: pagePath, text: finalDocument, },);
    if (await readFile(pagePath, 'utf8',) !== finalDocument)
      throw new Error('conditional shell publication readback differs');
  }
  catch (error) {
    if (signal.aborted)
      throw signal.reason;
    const failureType = Error.isError(error,) ? error.constructor.name : 'unknown';
    throw new Error(`PublicationUnavailableError: ${failureType}`);
  }
  const invocationDurationMs = Date.now() - startedAt;
  await writePrototypeJson({
    path: join(outputDir, 'result.json',),
    value: {
      prototype: 'conditional-shell-e1-double-prime',
      status: 'written-pending-output-review',
      payloadCeiling: 10,
      dependencyWaves: 4,
      manifestDigest,
      slotCount,
      selectedAuthor,
      evidenceFloorMet,
      votes,
      resolverAttempted,
      resolverChangedOnlyLocated,
      resolutionAdopted,
      rejectedFindingCount,
      nodeRecords: records,
      unattemptedNodes,
      invocationDurationMs,
      finalDigest: hashContent({ content: finalDocument, }),
    },
  },);
  console.log(`PROTOTYPE ${entryId} design=E1-double-prime status=written-pending-output-review author=${selectedAuthor} evidenceFloor=${String(evidenceFloorMet,)} resolver=${String(resolverAttempted,)} adopted=${String(resolutionAdopted,)} slots=${String(slotCount,)} ms=${String(invocationDurationMs,)}`,);
}
