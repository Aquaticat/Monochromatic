// PROTOTYPE ONLY: Candidate B image-bearing prompts.

import type { ChatMessage, ContentPart, } from '@monochromatic-dev/module-llm-type/ts';

import type { VisionMessage, } from './chat-contract.ts';
import { sourceUnitsFor, } from './prototype-brief-editor-plan.ts';
import type { PrototypeMedia, } from './prototype-brief-editor-input.ts';
import {
  compilerBaseDigest,
  type CompilerSpecialist,
  type CompilerSpecificationPacket,
} from './prototype-spec-compiler-plan.ts';

export function specificationSystemInstruction(): string {
  return 'You are the source specification author. For every supplied deterministic source unit id exactly once, state finite English translation obligations grounded in that unit, including propositions, relations, identity, destinations, and visible media obligations. Do not draft translated prose, score output, or add units.';
}

export function rendererSystemInstruction(): string {
  return 'You are the accountable whole-document renderer. Produce one complete publication-ready English document from source, archive evidence, images, and specification packet. Own meaning, completeness, identities, attribution, grammar, references, tense, paragraph relations, register, structure, front matter, links, media, formatting, and footnotes. mode must be render, baseDigest null, changes empty. Return every source unit id exactly once with an exact nonempty target quote and one-based occurrence locating its realization.';
}

export function specialistSystemInstruction(
  {
    specialist,
    baseDigest,
  }: {
    readonly specialist: CompilerSpecialist;
    readonly baseDigest?: string;
  },
): string {
  const mode = baseDigest === undefined
    ? 'No usable renderer exists. mode must be fallback, baseDigest null, changes empty. Establish one complete first candidate and own the full renderer quality contract.'
    : `A usable renderer base exists. mode must be revision and baseDigest must equal ${baseDigest}. Correct only ${specialist.responsibility}. Return exact non-overlapping changes against BASE; applying all changes to BASE must reproduce document byte-for-byte.`;
  return `You are the ${specialist.id}. ${mode} Return one complete publication-ready document, every source unit id exactly once with an exact target locator, no alternatives, score, approval, or finding-only report. Preserve all source-supported content, contributor forms, front matter, links, images, formatting, and footnotes.`;
}

export function compilerUserInstruction(
  {
    sourceText,
    archiveText,
    specification,
    base,
  }: {
    readonly sourceText: string;
    readonly archiveText: string;
    readonly specification: CompilerSpecificationPacket;
    readonly base?: string;
  },
): string {
  return `SOURCE:\n${sourceText}\n\nARCHIVE EVIDENCE:\n${archiveText}\n\nSPECIFICATION:\n${JSON.stringify(specification,)}\n\nBASE:\n${base ?? '[NO USABLE RENDERER]'}`;
}

function visionMessages(
  {
    system,
    text,
    media,
  }: {
    readonly system: string;
    readonly text: string;
    readonly media: readonly PrototypeMedia[];
  },
): readonly (ChatMessage | VisionMessage)[] {
  const content: readonly ContentPart[] = [
    { type: 'text', text, },
    ...media.flatMap(function image(item,): readonly ContentPart[] {
      return [
        { type: 'text', text: `MEDIA ${item.assetName}`, },
        { type: 'image_url', image_url: { url: item.dataUri, }, },
      ];
    },),
  ];
  return [
    { role: 'system', content: system, },
    { role: 'user', content, },
  ];
}

export function specificationMessages(
  {
    sourceText,
    archiveText,
    media,
  }: {
    readonly sourceText: string;
    readonly archiveText: string;
    readonly media: readonly PrototypeMedia[];
  },
): readonly (ChatMessage | VisionMessage)[] {
  const units = sourceUnitsFor({ sourceText, });
  return visionMessages({
    system: specificationSystemInstruction(),
    text: `SOURCE:\n${sourceText}\n\nARCHIVE EVIDENCE:\n${archiveText}\n\nSOURCE UNITS:\n${JSON.stringify(units,)}`,
    media,
  },);
}

export function rendererMessages(
  {
    sourceText,
    archiveText,
    specification,
    media,
  }: {
    readonly sourceText: string;
    readonly archiveText: string;
    readonly specification: CompilerSpecificationPacket;
    readonly media: readonly PrototypeMedia[];
  },
): readonly (ChatMessage | VisionMessage)[] {
  return visionMessages({
    system: rendererSystemInstruction(),
    text: compilerUserInstruction({ sourceText, archiveText, specification, },),
    media,
  },);
}

export function specialistMessages(
  {
    specialist,
    sourceText,
    archiveText,
    specification,
    base,
    media,
  }: {
    readonly specialist: CompilerSpecialist;
    readonly sourceText: string;
    readonly archiveText: string;
    readonly specification: CompilerSpecificationPacket;
    readonly base?: string;
    readonly media: readonly PrototypeMedia[];
  },
): readonly (ChatMessage | VisionMessage)[] {
  const baseDigest = base === undefined ? undefined : compilerBaseDigest({ base, });
  return visionMessages({
    system: specialistSystemInstruction({
      specialist,
      ...(baseDigest === undefined ? {} : { baseDigest, }),
    },),
    text: compilerUserInstruction({
      sourceText,
      archiveText,
      specification,
      ...(base === undefined ? {} : { base, }),
    },),
    media,
  },);
}
