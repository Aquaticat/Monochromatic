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
    if ((typeof value !== 'object') || (value === null) || !('slots' in value))
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
