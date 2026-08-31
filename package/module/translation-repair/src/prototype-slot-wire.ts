// PROTOTYPE ONLY: Candidate D dynamic response schema and admission.

import type { JsonSchemaResponseFormat, } from './chat-contract.ts';
import { parseDocument, } from './parse-document.ts';
import { compileSlotDocument, } from './prototype-slot-compile.ts';
import {
  type ImmutableShell,
  MAX_SLOT_CHARACTERS,
  type SlotDocumentResponse,
} from './prototype-slot-model.ts';
import { validateSerialCandidate, } from './prototype-serial-producer-plan.ts';

export class DestinationScriptError extends Error {
  public constructor(message: string,) {
    super(message,);
    this.name = DestinationScriptError.name;
  }
}

export class CandidatePresentationArtifactError extends Error {
  public constructor(message: string,) {
    super(message,);
    this.name = CandidatePresentationArtifactError.name;
  }
}

function isPresentationArtifactCodePoint({ codePoint, }: { readonly codePoint: number; }): boolean {
  // LF and CR are compiler-normalized; every other C0/C1 control is refused.
  // Unicode 17 assigns control pictures only through U+2426.
  const isRawC0 = ((codePoint >= 0x0000) && (codePoint <= 0x0009))
    || ((codePoint >= 0x000B) && (codePoint <= 0x000C))
    || ((codePoint >= 0x000E) && (codePoint <= 0x001F));
  const isRawC1 = (codePoint >= 0x007F) && (codePoint <= 0x009F);
  const isControlPicture = (codePoint >= 0x2400) && (codePoint <= 0x2426);
  return isRawC0
    || isRawC1
    || isControlPicture
    || (codePoint === 0x21B5)
    || (codePoint === 0x23CE)
    || (codePoint === 0xFFFD);
}

function assertNoPresentationArtifacts(
  {
    shell,
    response,
  }: {
    readonly shell: ImmutableShell;
    readonly response: SlotDocumentResponse;
  },
): void {
  for (const slot of shell.slots) {
    const value = response.slots[slot.key];
    if (value === undefined)
      continue;
    for (const character of value) {
      const codePoint = character.codePointAt(0,);
      if ((codePoint === undefined) || !isPresentationArtifactCodePoint({ codePoint, }))
        continue;
      const locator = `U+${codePoint.toString(16,).toUpperCase().padStart(4, '0',)}`;
      throw new CandidatePresentationArtifactError(
        `immutable shell candidate retained presentation artifact ${locator} in ${slot.key}`,
      );
    }
  }
}

function isHanCodePoint({ codePoint, }: { readonly codePoint: number; }): boolean {
  // Unicode 17 unified and compatibility ideograph ranges include Extension I.
  // Punctuation is intentionally outside this zh-to-en source-echo refusal.
  return ((codePoint >= 0x3400) && (codePoint <= 0x4DBF))
    || ((codePoint >= 0x4E00) && (codePoint <= 0x9FFF))
    || ((codePoint >= 0xF900) && (codePoint <= 0xFAFF))
    || ((codePoint >= 0x20000) && (codePoint <= 0x2EE5D))
    || ((codePoint >= 0x2F800) && (codePoint <= 0x2FA1F))
    || ((codePoint >= 0x30000) && (codePoint <= 0x323AF));
}

function containsHanScript({ text, }: { readonly text: string; }): boolean {
  return [...text,].some(function han(character,) {
    const codePoint = character.codePointAt(0,);
    return (codePoint !== undefined) && isHanCodePoint({ codePoint, });
  },);
}

function assertDestinationScript(
  {
    shell,
    response,
  }: {
    readonly shell: ImmutableShell;
    readonly response: SlotDocumentResponse;
  },
): void {
  const retained = shell.slots.find(function retainedHan(slot,) {
    const value = response.slots[slot.key];
    return (value !== undefined) && containsHanScript({ text: value, });
  },);
  if (retained !== undefined)
    throw new DestinationScriptError(`immutable shell candidate retained Han script in ${retained.key}`);
}

function structuralSignature({ text, }: { readonly text: string; }): string {
  const parsed = parseDocument({ text, },);
  return JSON.stringify({
    nodes: parsed.nodes.map(function node(item,) { return { kind: item.kind, zone: item.zone, }; },),
    containers: parsed.containers.map(function container(item,) { return item.name; },),
    footnoteFindings: parsed.footnoteGraph.findings.map(function finding(item,) { return item.kind; },),
  },);
}

export function validateSlotCandidate(
  {
    shell,
    response,
    sourceText,
    archiveText,
    sourcePictures,
  }: {
    readonly shell: ImmutableShell;
    readonly response: SlotDocumentResponse;
    readonly sourceText: string;
    readonly archiveText: string;
    readonly sourcePictures: readonly { readonly assetName: string; }[];
  },
): string {
  assertDestinationScript({ shell, response, });
  assertNoPresentationArtifacts({ shell, response, });
  const document = compileSlotDocument({ shell, response, });
  if (structuralSignature({ text: document, }) !== structuralSignature({ text: shell.controlDocument, }))
    throw new Error('immutable shell structural signature changed');
  validateSerialCandidate({ sourceText, archiveText, sourcePictures, candidate: document, },);
  return document;
}

export function slotResponseFormat(
  { shell, }: { readonly shell: ImmutableShell; },
): JsonSchemaResponseFormat {
  const properties = Object.fromEntries(shell.slots.map(function property(slot,) {
    return [slot.key, { type: 'string', minLength: 1, maxLength: MAX_SLOT_CHARACTERS, },];
  },),);
  return {
    type: 'json_schema',
    json_schema: {
      name: 'immutable_shell_slots',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['slots',],
        properties: {
          slots: {
            type: 'object',
            additionalProperties: false,
            required: shell.slots.map(function key(slot,) { return slot.key; },),
            properties,
          },
        },
      },
    },
  };
}

export function slotDocumentGuard(
  { shell, }: { readonly shell: ImmutableShell; },
): (value: unknown) => value is SlotDocumentResponse {
  const expected = shell.slots.map(function key(slot,) { return slot.key; },);
  return function isSlotDocumentResponse(value: unknown): value is SlotDocumentResponse {
    if ((typeof value !== 'object')
      || (value === null)
      || (Object.keys(value,).length !== 1)
      || !('slots' in value))
      return false;
    const { slots, } = value;
    if ((typeof slots !== 'object') || (slots === null))
      return false;
    const actual = Object.keys(slots,);
    if ((actual.length !== expected.length) || expected.some(function missing(key,) { return !actual.includes(key,); }))
      return false;
    return expected.every(function valid(key,) {
      const item = (slots as Readonly<Record<string, unknown>>)[key];
      return (typeof item === 'string') && (item.trim() !== '') && (item.length <= MAX_SLOT_CHARACTERS);
    },);
  };
}
