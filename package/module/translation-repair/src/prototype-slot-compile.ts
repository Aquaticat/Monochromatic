// PROTOTYPE ONLY: Candidate D syntax-boundary encoding and shell compilation.

import {
  type ImmutableShell,
  type ImmutableSlot,
  MAX_COMPILED_DOCUMENT_CHARACTERS,
  type SlotDocumentResponse,
} from './prototype-slot-model.ts';

function escapeMarkdownText(
  {
    text,
    preserveLeadingSpace,
  }: {
    readonly text: string;
    readonly preserveLeadingSpace: boolean;
  },
): string {
  const escapedCharacters = new Set(['\\', '`', '*', '_', '{', '}', '[', ']', '<', '>',],);
  const leadingSpace = preserveLeadingSpace && (text.trimStart() !== text) ? ' ' : '';
  const core = [...text.trim(),].map(function escape(character,): string {
    if ((character === '\n') || (character === '\r'))
      return ' ';
    return escapedCharacters.has(character,) ? `\\${character}` : character;
  },).join('',);
  return `${leadingSpace}${core}`;
}

export function compileSlotBody(
  {
    body,
    slots,
    values,
  }: {
    readonly body: string;
    readonly slots: readonly ImmutableSlot[];
    readonly values: Readonly<Record<string, string>>;
  },
): string {
  return slots.toReversed().reduce(function replace(current, slot,): string {
    const value = values[slot.key];
    if (value === undefined)
      throw new Error(`immutable shell value is absent for ${slot.key}`);
    const priorCharacter = body[slot.startOffset - 1];
    const preserveLeadingSpace = priorCharacter !== undefined && (priorCharacter.trim() !== '');
    const escaped = escapeMarkdownText({ text: value, preserveLeadingSpace, });
    if (escaped === '')
      throw new Error(`immutable shell value is empty for ${slot.key}`);
    return `${current.slice(0, slot.startOffset)}${escaped}${current.slice(slot.endOffset)}`;
  }, body,);
}

export function compileSlotDocument(
  {
    shell,
    response,
  }: {
    readonly shell: ImmutableShell;
    readonly response: SlotDocumentResponse;
  },
): string {
  const document = `${shell.frontMatter}${compileSlotBody({
    body: shell.body,
    slots: shell.slots,
    values: response.slots,
  },)}`;
  if (document.length > MAX_COMPILED_DOCUMENT_CHARACTERS)
    throw new Error('immutable shell compiled document exceeds envelope');
  return document;
}
