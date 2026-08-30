// PROTOTYPE ONLY: serial producer controls, prompts, adoption, and restart.

import { readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import {
  introducedFootnoteFindings,
  introducedStructuralRegressions,
} from './assembly-integrity.ts';
import { droppedContributorNameForms, } from './contributor-name-authority.ts';
import { hashContent, } from './document-node.ts';
import { splitFrontMatter, } from './front-matter.ts';
import { validateFrontMatterTranslation, } from './front-matter-translation.ts';
import { parseDocument, } from './parse-document.ts';
import { photoReferences, } from './photo-reference.ts';
import {
  applyProducerChanges,
  producerContractDigest,
  type SerialProducerRecord,
} from './prototype-serial-producer-runtime.ts';
import type { RosterModelId, } from './roster-id.ts';
import { droppedDestinations, } from './corpus-run/dropped-destinations.ts';
import { writeFileAtomic, } from './corpus-run/atomic-write.ts';

export function validateSerialCandidate(
  {
    sourceText,
    archiveText,
    sourcePictures,
    candidate,
  }: {
    readonly sourceText: string;
    readonly archiveText: string;
    readonly sourcePictures: readonly { readonly assetName: string; }[];
    readonly candidate: string;
  },
): void {
  parseDocument({ text: candidate, },);
  if (introducedStructuralRegressions({ incumbentText: archiveText, assembledText: candidate, }).length > 0)
    throw new Error('candidate introduced structural parse regression');
  if (introducedFootnoteFindings({ incumbentText: archiveText, assembledText: candidate, }).length > 0)
    throw new Error('candidate introduced footnote relation defect');
  const sourceFrontMatter = splitFrontMatter({ text: sourceText, }).frontMatter?.raw ?? '';
  const archiveFrontMatter = splitFrontMatter({ text: archiveText, }).frontMatter?.raw ?? '';
  const candidateFrontMatter = splitFrontMatter({ text: candidate, }).frontMatter?.raw ?? '';
  if ((sourceFrontMatter !== '') || (archiveFrontMatter !== '')) {
    const validation = validateFrontMatterTranslation({
      sourceText: sourceFrontMatter,
      pageText: archiveFrontMatter,
      candidateText: candidateFrontMatter,
    },);
    if (validation.kind !== 'valid')
      throw new Error(`candidate front matter ${validation.kind}`);
  }
  const destinationCheck = droppedDestinations({ sourceText, pageText: candidate, },);
  if (destinationCheck.dropped.length > 0)
    throw new Error(`candidate dropped ${String(destinationCheck.dropped.length,)} source destinations`);
  const droppedContributors = droppedContributorNameForms({ archiveText, candidateText: candidate, },);
  if (droppedContributors.length > 0)
    throw new Error(`candidate dropped ${String(droppedContributors.length,)} contributor forms`);
  const candidatePictures = new Set(photoReferences({ text: candidate, }).map(function asset(reference,) {
    return reference.assetName;
  },),);
  if (sourcePictures.some(function missing(reference,): boolean {
    return !candidatePictures.has(reference.assetName,);
  },))
    throw new Error('candidate dropped source media reference');
}

export function serialProducerSystemInstruction(
  {
    role,
    responsibility,
    fallback,
  }: {
    readonly role: string;
    readonly responsibility: string;
    readonly fallback: boolean;
  },
): string {
  const mode = fallback
    ? 'No prior candidate exists. Assume full quality contract and create complete document. Return empty changes array.'
    : 'A prior complete candidate exists. Return complete revised document and exact non-overlapping change transaction. Each before must occur exactly once in PRIOR. Each sourceQuote must be exact nonempty SOURCE substring supporting change. Do not change text outside declared transaction.';
  return `You are ${role} accountable whole-document producer. ${responsibility} ${mode} Preserve Markdown, MDX, links, images, front matter, identities, contributor forms, formatting, and all source-supported content. For revision, kind must be one allowed role kind stated by responsibility. Return one document, no alternatives, no score, no approval, and no finding-only report.`;
}

export function runSerialLocalControls(): void {
  const valid = applyProducerChanges({
    prior: 'Cats rest.',
    sourceText: '猫安歇。',
    response: {
      document: 'Cats sleep.',
      changes: [{
        before: 'rest',
        after: 'sleep',
        sourceQuote: '安歇',
        kind: 'usage',
        explanation: 'Fixture wording.',
      },],
      note: '',
    },
    allowedKinds: new Set(['usage',]),
  },);
  if (valid !== 'Cats sleep.')
    throw new Error('serial producer valid control did not move');
  const guarded = [
    {
      name: 'overlapping-anchor',
      invoke: function overlap(): string {
        return applyProducerChanges({
          prior: 'aaa',
          sourceText: '猫',
          response: {
            document: 'ba',
            changes: [{ before: 'aa', after: 'b', sourceQuote: '猫', kind: 'usage', explanation: '', },],
            note: '',
          },
          allowedKinds: new Set(['usage',]),
        },);
      },
    },
    {
      name: 'whole-document-replacement',
      invoke: function whole(): string {
        return applyProducerChanges({
          prior: 'Cats rest.',
          sourceText: '猫安歇。',
          response: {
            document: 'Dogs run.',
            changes: [{
              before: 'Cats rest.',
              after: 'Dogs run.',
              sourceQuote: '猫安歇。',
              kind: 'usage',
              explanation: '',
            },],
            note: '',
          },
          allowedKinds: new Set(['usage',]),
        },);
      },
    },
  ];
  for (const control of guarded) {
    let refused = false;
    try {
      control.invoke();
    }
    catch (error) {
      refused = error !== undefined;
    }
    if (!refused)
      throw new Error(`serial producer ${control.name} control did not refuse`);
  }
}

export async function loadSerialRestartState(
  {
    outputDir,
    manifestDigest,
    producers,
    sourceText,
    archiveText,
    sourcePictures,
    signal,
  }: {
    readonly outputDir: string;
    readonly manifestDigest: string;
    readonly producers: readonly {
      readonly id: string;
      readonly role: string;
      readonly responsibility: string;
      readonly modelId: RosterModelId;
    }[];
    readonly sourceText: string;
    readonly archiveText: string;
    readonly sourcePictures: readonly { readonly assetName: string; }[];
    readonly signal: AbortSignal;
  },
): Promise<{ readonly records: SerialProducerRecord[]; readonly current: string | undefined; }> {
  const records: SerialProducerRecord[] = [];
  let current: string | undefined;
  for (const producer of producers) {
    const nodePath = join(outputDir, `node-${producer.id}.json`,);
    let nodeText: string;
    try {
      nodeText = await readFile(nodePath, 'utf8',);
    }
    catch (error) {
      if (Error.isError(error,) && ('code' in error) && (error.code === 'ENOENT'))
        continue;
      throw error;
    }
    const node = JSON.parse(nodeText,) as
      & Partial<Omit<SerialProducerRecord, 'state'>>
      & { readonly state?: SerialProducerRecord['state'] | 'dispatched'; };
    if (node.manifestDigest !== manifestDigest)
      throw new Error(`restart manifest identity differs at ${producer.id}`);
    if ((node.state !== 'dispatched') && (node.state !== 'completed') && (node.state !== 'spent-unusable'))
      throw new Error(`restart node state invalid at ${producer.id}`);
    if ((node.modelId !== producer.modelId) || (typeof node.promptDigest !== 'string'))
      throw new Error(`restart node binding invalid at ${producer.id}`);
    const messages = [
      { role: 'system' as const, content: serialProducerSystemInstruction({
        role: producer.role,
        responsibility: producer.responsibility,
        fallback: current === undefined,
      },), },
      { role: 'user' as const, content: `SOURCE:\n${sourceText}\n\nARCHIVE EVIDENCE:\n${archiveText}\n\nPRIOR:\n${current ?? '[NO PRIOR CANDIDATE]'}`, },
    ];
    const expectedPromptDigest = producerContractDigest({
      modelId: producer.modelId,
      messages,
      signal,
    },);
    if (node.promptDigest !== expectedPromptDigest)
      throw new Error(`restart prompt identity differs at ${producer.id}`);
    const record: SerialProducerRecord = node.state === 'dispatched'
      ? {
        id: producer.id,
        modelId: producer.modelId,
        manifestDigest,
        promptDigest: node.promptDigest ?? '',
        startedAt: node.startedAt ?? '',
        durationMs: 0,
        state: 'spent-unusable',
        adopted: false,
      }
      : node as SerialProducerRecord;
    if (record.adopted && (record.state !== 'completed'))
      throw new Error(`restart adopted node state invalid at ${producer.id}`);
    records.push(record,);
    if (node.state === 'dispatched')
      await writeFileAtomic({ path: nodePath, text: `${JSON.stringify(record, null, 2,)}\n`, },);
    if (record.adopted) {
      const candidate = await readFile(join(outputDir, `candidate-${producer.id}.md`,), 'utf8',);
      const decision = JSON.parse(
        await readFile(join(outputDir, `decision-${producer.id}.json`,), 'utf8',),
      ) as {
        readonly id?: string;
        readonly modelId?: string;
        readonly manifestDigest?: string;
        readonly promptDigest?: string;
        readonly priorDigest?: string | null;
        readonly responseDigest?: string;
        readonly candidateDigest?: string;
        readonly editCount?: number;
      };
      const expectedPriorDigest = current === undefined ? null : hashContent({ content: current, },);
      if ((decision.id !== producer.id)
        || (decision.modelId !== producer.modelId)
        || (decision.manifestDigest !== manifestDigest)
        || (decision.promptDigest !== record.promptDigest)
        || (decision.priorDigest !== expectedPriorDigest)
        || (typeof decision.responseDigest !== 'string')
        || (typeof decision.editCount !== 'number'))
        throw new Error(`restart decision binding differs at ${producer.id}`);
      if (decision.candidateDigest !== hashContent({ content: candidate, },))
        throw new Error(`restart candidate digest differs at ${producer.id}`);
      validateSerialCandidate({ sourceText, archiveText, sourcePictures, candidate, },);
      current = candidate;
    }
  }
  return { records, current, };
}
