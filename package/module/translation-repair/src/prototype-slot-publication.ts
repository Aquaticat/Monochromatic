// PROTOTYPE ONLY: Candidate D fixed-priority decisions and atomic publication.

import {
  mkdir,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { hashContent, } from './document-node.ts';
import { SLOT_AUTHOR_NODES, } from './prototype-slot-plan.ts';
import type { SlotNodeRecord, } from './prototype-slot-runtime.ts';
import { writePrototypeJson, } from './prototype-brief-editor-runtime.ts';
import { writeFileAtomic, } from './corpus-run/atomic-write.ts';

export async function publishSlotPrototype(
  {
    outputDir,
    entryId,
    manifestDigest,
    selected,
    usable,
    records,
    slotCount,
    startedAt,
    signal,
  }: {
    readonly outputDir: string;
    readonly entryId: string;
    readonly manifestDigest: string;
    readonly selected: { readonly id: string; readonly document: string; };
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
        adopted: selected.id === node.id,
        candidateDigest: value === undefined ? null : hashContent({ content: value.document, }),
      },
    },);
  }
  const pagePath = join(outputDir, 'fixed', 'people', entryId, 'page.en.md',);
  try {
    await mkdir(join(outputDir, 'fixed', 'people', entryId,), { recursive: true, },);
    await writeFileAtomic({ path: pagePath, text: selected.document, },);
    if (await readFile(pagePath, 'utf8',) !== selected.document)
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
      payloadCeiling: SLOT_AUTHOR_NODES.length,
      dependencyWaves: 1,
      manifestDigest,
      slotCount,
      selectedAuthor: selected.id,
      nodeRecords: records,
      invocationDurationMs,
      finalDigest: hashContent({ content: selected.document, }),
    },
  },);
  console.log(`PROTOTYPE ${entryId} design=D status=written-pending-output-review author=${selected.id} slots=${String(slotCount,)} ms=${String(invocationDurationMs,)}`,);
}
