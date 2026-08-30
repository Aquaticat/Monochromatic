// PROTOTYPE ONLY: Candidate D fixed-priority decisions and atomic publication.

import {
  mkdir,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { hashContent, } from './document-node.ts';
import { SLOT_AUTHOR_NODES, SLOT_REVISER_NODE, } from './prototype-slot-plan.ts';
import type { SlotNodeRecord, } from './prototype-slot-runtime.ts';
import { writePrototypeJson, } from './prototype-brief-editor-runtime.ts';
import { writeFileAtomic, } from './corpus-run/atomic-write.ts';

export async function publishSlotPrototype(
  {
    outputDir,
    entryId,
    manifestDigest,
    selectedAuthor,
    finalDocument,
    reviserDocument,
    usable,
    records,
    slotCount,
    startedAt,
    signal,
  }: {
    readonly outputDir: string;
    readonly entryId: string;
    readonly manifestDigest: string;
    readonly selectedAuthor: { readonly id: string; readonly document: string; };
    readonly finalDocument: string;
    readonly reviserDocument?: string;
    readonly usable: ReadonlyMap<string, { readonly document: string; }>;
    readonly records: readonly SlotNodeRecord[];
    readonly slotCount: number;
    readonly startedAt: number;
    readonly signal: AbortSignal;
  },
): Promise<void> {
  for (const node of SLOT_AUTHOR_NODES) {
    const value = usable.get(node.id,);
    await writePrototypeJson({
      path: join(outputDir, `decision-${node.id}.json`,),
      value: {
        id: node.id,
        modelId: node.modelId,
        priority: node.priority,
        manifestDigest,
        selectedBase: selectedAuthor.id === node.id,
        candidateDigest: value === undefined ? null : hashContent({ content: value.document, }),
      },
    },);
  }
  await writePrototypeJson({
    path: join(outputDir, `decision-${SLOT_REVISER_NODE.id}.json`,),
    value: {
      id: SLOT_REVISER_NODE.id,
      modelId: SLOT_REVISER_NODE.modelId,
      manifestDigest,
      adopted: reviserDocument !== undefined,
      candidateDigest: reviserDocument === undefined ? null : hashContent({ content: reviserDocument, }),
    },
  },);
  const pagePath = join(outputDir, 'fixed', 'people', entryId, 'page.en.md',);
  try {
    await mkdir(join(outputDir, 'fixed', 'people', entryId,), { recursive: true, },);
    await writeFileAtomic({ path: pagePath, text: finalDocument, },);
    if (await readFile(pagePath, 'utf8',) !== finalDocument)
      throw new Error('immutable shell publication readback differs');
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
      prototype: 'immutable-shell-slot-compiler-d',
      status: 'written-pending-output-review',
      payloadCeiling: SLOT_AUTHOR_NODES.length + 1,
      dependencyWaves: 2,
      manifestDigest,
      slotCount,
      selectedAuthor: selectedAuthor.id,
      reviserAdopted: reviserDocument !== undefined,
      nodeRecords: records,
      invocationDurationMs,
      finalDigest: hashContent({ content: finalDocument, }),
    },
  },);
  console.log(`PROTOTYPE ${entryId} design=D status=written-pending-output-review author=${selectedAuthor.id} reviser=${String(reviserDocument !== undefined,)} slots=${String(slotCount,)} ms=${String(invocationDurationMs,)}`,);
}
