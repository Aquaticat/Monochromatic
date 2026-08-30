// PROTOTYPE ONLY: deterministic finite-editor transaction helpers.

import { writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type {
  JsonSchemaResponseFormat,
  SyntheticClient,
} from './chat-contract.ts';
import { modelPromptDigest, } from './prompt-uniqueness-client.ts';
import type { RosterModelId, } from './roster-id.ts';
import {
  askPrototypeJson,
  type PrototypeFinding,
  type PrototypePatch,
} from './prototype-accountable-editor-wire.ts';

export type PrototypeNodeRecord = {
  readonly id: string;
  readonly modelId: RosterModelId;
  readonly promptDigest: string;
  readonly startedAt: string;
  readonly durationMs: number;
  readonly state: 'completed';
  readonly payload: 'fresh';
};

export type DossierFinding = PrototypeFinding & {
  readonly id: string;
  readonly roles: readonly string[];
  readonly explanations: readonly string[];
};

const ALLOWED_BY_ROLE: Readonly<Record<string, ReadonlySet<string>>> = {
  fidelity: new Set(['wrong-meaning', 'omission', 'addition', 'identity-change', 'attribution',]),
  expression: new Set(['grammar', 'usage', 'unclear-expression', 'register-mismatch',]),
  continuity: new Set(['unclear-reference', 'tense-inconsistency', 'chronology', 'repetition', 'paragraph-relation',]),
};

export function reduceDossier(
  {
    sourceText,
    draftText,
    findings,
  }: {
    readonly sourceText: string;
    readonly draftText: string;
    readonly findings: readonly (PrototypeFinding & { readonly role: string; })[];
  },
): readonly DossierFinding[] {
  const grouped = new Map<string, DossierFinding>();
  for (const finding of findings) {
    if (!ALLOWED_BY_ROLE[finding.role]?.has(finding.kind,))
      throw new Error(`prototype ${finding.role} emitted forbidden defect kind ${finding.kind}`);
    if ((finding.targetQuote === '') || (!draftText.includes(finding.targetQuote,)))
      throw new Error(`prototype ${finding.role} emitted unanchored target finding`);
    if ((finding.role === 'fidelity') && (finding.sourceQuote === ''))
      throw new Error('prototype fidelity finding has no source anchor');
    if ((finding.sourceQuote !== '') && (!sourceText.includes(finding.sourceQuote,)))
      throw new Error(`prototype ${finding.role} emitted unanchored source finding`);
    const key = JSON.stringify([finding.kind, finding.targetQuote, finding.sourceQuote,],);
    const existing = grouped.get(key,);
    if (existing !== undefined) {
      grouped.set(key, {
        ...existing,
        roles: [...new Set([...existing.roles, finding.role,]),],
        explanations: [...new Set([...existing.explanations, finding.explanation,]),],
      },);
      continue;
    }
    grouped.set(key, {
      id: `finding/${String(grouped.size + 1,)}`,
      kind: finding.kind,
      targetQuote: finding.targetQuote,
      sourceQuote: finding.sourceQuote,
      explanation: finding.explanation,
      roles: [finding.role,],
      explanations: [finding.explanation,],
    },);
  }
  return [...grouped.values(),];
}

function occurrenceCount({ text, needle, }: { readonly text: string; readonly needle: string; }): number {
  if (needle === '')
    return 0;
  let count = 0;
  let at = 0;
  while (at < text.length) {
    const found = text.indexOf(needle, at,);
    if (found === -1)
      return count;
    count += 1;
    at = found + needle.length;
  }
  return count;
}

export function applyPrototypePatches(
  {
    text,
    patches,
    findingIds,
  }: {
    readonly text: string;
    readonly patches: readonly PrototypePatch[];
    readonly findingIds: ReadonlySet<string>;
  },
): string {
  const located = patches.map((patch,) => {
    if ((patch.findingIds.length === 0) || patch.findingIds.some((id,) => !findingIds.has(id,)))
      throw new Error('prototype patch has empty or unknown finding references');
    if (patch.before === patch.after)
      throw new Error('prototype patch is no-op');
    const count = occurrenceCount({ text, needle: patch.before, },);
    if (count !== 1)
      throw new Error(`prototype patch anchor occurrence count ${String(count,)}`);
    const at = text.indexOf(patch.before,);
    return { ...patch, at, end: at + patch.before.length, };
  },).toSorted((left, right,) => (right.at - left.at) || right.end - left.end,);
  for (let index = 1; index < located.length; index += 1) {
    const earlier = located[index - 1];
    const later = located[index];
    if ((earlier !== undefined) && (later !== undefined) && (later.end > earlier.at))
      throw new Error('prototype patches overlap');
  }
  return located.reduce((current, patch,) => `${current.slice(0, patch.at,)}${patch.after}${current.slice(patch.end,)}`, text,);
}

export async function runPrototypeNode<ValueT,>(
  {
    outputDir,
    records,
    client,
    id,
    modelId,
    messages,
    responseFormat,
    validate,
    signal,
  }: {
    readonly outputDir: string;
    readonly records: PrototypeNodeRecord[];
    readonly client: SyntheticClient;
    readonly id: string;
    readonly modelId: RosterModelId;
    readonly messages: readonly ChatMessage[];
    readonly responseFormat: JsonSchemaResponseFormat;
    readonly validate: (value: unknown,) => value is ValueT;
    readonly signal: AbortSignal;
  },
): Promise<ValueT> {
  const promptDigest = modelPromptDigest({ request: { modelId, messages, signal, }, },);
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  await writeFile(join(outputDir, `node-${id}.json`,), `${JSON.stringify({
    id,
    modelId,
    promptDigest,
    state: 'dispatched',
    payload: 'fresh',
    startedAt,
  }, null, 2,)}\n`,);
  const value = await askPrototypeJson({ client, modelId, messages, responseFormat, validate, signal, },);
  const record: PrototypeNodeRecord = {
    id,
    modelId,
    promptDigest,
    startedAt,
    durationMs: Date.now() - startedMs,
    state: 'completed',
    payload: 'fresh',
  };
  records.push(record,);
  await writeFile(join(outputDir, `node-${id}.json`,), `${JSON.stringify(record, null, 2,)}\n`,);
  return value;
}
