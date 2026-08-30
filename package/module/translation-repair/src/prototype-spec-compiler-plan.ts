// PROTOTYPE ONLY: Candidate B manifest and specification packet.

import { archiveContributorNameForms, } from './contributor-name-authority.ts';
import { hashContent, } from './document-node.ts';
import { sourceUnitsFor, type SourceUnit, } from './prototype-brief-editor-plan.ts';
import { exactCompilerIds, } from './prototype-spec-compiler-transaction.ts';
import type { RosterModelId, } from './roster-id.ts';
import type { SpecificationResponse, } from './prototype-spec-compiler-wire.ts';

export const SPECIFICATION_NODE: {
  readonly id: string;
  readonly modelId: RosterModelId;
} = { id: 'specification-author', modelId: 'hf:moonshotai/Kimi-K3', };

export const RENDERER_NODE: {
  readonly id: string;
  readonly modelId: RosterModelId;
} = { id: 'renderer', modelId: 'hf:Qwen/Qwen3.8-27B', };

export type CompilerSpecialist = {
  readonly id: string;
  readonly modelId: RosterModelId;
  readonly priority: number;
  readonly allowedKinds: readonly string[];
  readonly responsibility: string;
};

export const COMPILER_SPECIALISTS: readonly CompilerSpecialist[] = [
  {
    id: 'fidelity-specialist',
    modelId: 'hf:moonshotai/Kimi-K3',
    priority: 0,
    allowedKinds: ['wrong-meaning', 'omission', 'addition', 'attribution',],
    responsibility: 'correct meaning, omissions, unsupported additions, and attribution',
  },
  {
    id: 'authority-specialist',
    modelId: 'hf:Qwen/Qwen3.8-27B',
    priority: 1,
    allowedKinds: ['identity', 'structure', 'link', 'media', 'formatting', 'footnote',],
    responsibility: 'correct identities, structure, links, media, formatting, and footnotes',
  },
  {
    id: 'expression-specialist',
    modelId: 'hf:zai-org/GLM-5.3-Flash',
    priority: 2,
    allowedKinds: ['grammar', 'reference', 'tense', 'register', 'repetition', 'paragraph-relation',],
    responsibility: 'correct grammar, references, tense, register, repetition, and paragraph relations',
  },
];

export type CompilerSpecificationPacket = {
  readonly status: 'model' | 'raw-fallback';
  readonly sourceUnits: readonly (SourceUnit & { readonly obligations: readonly string[]; })[];
  readonly lockedContributorForms: readonly string[];
  readonly mediaNames: readonly string[];
};

export function validateSpecification(
  {
    response,
    sourceUnits,
  }: {
    readonly response: SpecificationResponse;
    readonly sourceUnits: readonly SourceUnit[];
  },
): void {
  exactCompilerIds({
    expected: sourceUnits.map(function id(unit,) { return unit.id; },),
    actual: response.units.map(function id(unit,) { return unit.sourceUnitId; },),
    label: 'specification unit',
  },);
}

export function buildCompilerSpecification(
  {
    sourceText,
    archiveText,
    mediaNames,
    response,
  }: {
    readonly sourceText: string;
    readonly archiveText: string;
    readonly mediaNames: readonly string[];
    readonly response?: SpecificationResponse;
  },
): CompilerSpecificationPacket {
  const units = sourceUnitsFor({ sourceText, });
  const obligations = new Map(response?.units.map(function entry(unit,) {
    return [unit.sourceUnitId, unit.obligations,] as const;
  },) ?? [],);
  return {
    status: response === undefined ? 'raw-fallback' : 'model',
    sourceUnits: units.map(function specified(unit,) {
      return { ...unit, obligations: obligations.get(unit.id,) ?? [], };
    },),
    lockedContributorForms: archiveContributorNameForms({ text: archiveText, }),
    mediaNames,
  };
}

export function selectCompilerFallback<ValueT,>(
  { usable, }: { readonly usable: ReadonlyMap<string, ValueT>; },
): { readonly id: string; readonly value: ValueT; } | undefined {
  const selected = COMPILER_SPECIALISTS
    .toSorted(function byPriority(left, right,) { return left.priority - right.priority; },)
    .find(function usableNode(node,) { return usable.has(node.id,); },);
  if (selected === undefined)
    return undefined;
  const value = usable.get(selected.id,);
  if (value === undefined)
    throw new Error('compiler fallback selection lost value');
  return { id: selected.id, value, };
}

export function compilerBaseDigest({ base, }: { readonly base: string; }): string {
  return hashContent({ content: base, });
}
