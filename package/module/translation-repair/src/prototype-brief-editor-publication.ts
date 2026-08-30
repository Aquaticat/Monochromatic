// PROTOTYPE ONLY: Candidate C atomic publication and decision records.

import {
  mkdir,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { hashContent, } from './document-node.ts';
import { EDITOR_NODES, } from './prototype-brief-editor-plan.ts';
import type { BriefEditorNodeRecord, } from './prototype-brief-editor-runtime.ts';
import { writePrototypeJson, } from './prototype-brief-editor-runtime.ts';
import type { BriefEditorDocument, } from './prototype-brief-editor-wire.ts';
import { writeFileAtomic, } from './corpus-run/atomic-write.ts';

export async function publishBriefEditorPrototype(
  {
    outputDir,
    entryId,
    manifestDigest,
    selected,
    editorValues,
    records,
    usableBriefs,
    startedAt,
    signal,
  }: {
    readonly outputDir: string;
    readonly entryId: string;
    readonly manifestDigest: string;
    readonly selected: { readonly id: string; readonly value: BriefEditorDocument; };
    readonly editorValues: ReadonlyMap<string, BriefEditorDocument>;
    readonly records: readonly BriefEditorNodeRecord[];
    readonly usableBriefs: number;
    readonly startedAt: number;
    readonly signal: AbortSignal;
  },
): Promise<void> {
  for (const node of EDITOR_NODES) {
    const value = editorValues.get(node.id,);
    await writePrototypeJson({
      path: join(outputDir, `decision-${node.id}.json`,),
      value: {
        id: node.id,
        modelId: node.modelId,
        manifestDigest,
        adopted: node.id === selected.id,
        candidateDigest: value === undefined
          ? null
          : hashContent({ content: value.document, }),
      },
    },);
  }
  const pagePath = join(outputDir, 'fixed', 'people', entryId, 'page.en.md',);
  try {
    await mkdir(join(outputDir, 'fixed', 'people', entryId,), { recursive: true, },);
    const document = selected.value.document;
    await writeFileAtomic({ path: pagePath, text: document, },);
    const readback = await readFile(pagePath, 'utf8',);
    if (readback !== document)
      throw new Error('readback mismatch');
  }
  catch (error) {
    if (signal.aborted)
      throw signal.reason;
    const failureType = Error.isError(error,)
      ? error.constructor.name
      : 'unknown';
    throw new Error(`PublicationUnavailableError: ${failureType}`);
  }
  const invocationDurationMs = Date.now() - startedAt;
  await writePrototypeJson({
    path: join(outputDir, 'result.json',),
    value: {
      prototype: 'brief-before-prose-c',
      status: 'written-pending-output-review',
      payloadCeiling: 5,
      dependencyWaves: 2,
      usableBriefs,
      selectedEditor: selected.id,
      nodeRecords: records,
      invocationDurationMs,
      finalDigest: hashContent({ content: selected.value.document, }),
    },
  },);
  console.log(`PROTOTYPE ${entryId} design=C status=written-pending-output-review editor=${selected.id} briefs=${String(usableBriefs,)} ms=${String(invocationDurationMs,)}`,);
}
