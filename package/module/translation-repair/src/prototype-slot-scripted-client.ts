// PROTOTYPE ONLY: Candidate D zero-spend full-graph client.

import { wait, } from '@monochromatic-dev/module-async-time/ts';

import { carriesPicture, type SyntheticClient, } from './chat-contract.ts';
import type { ImmutableShell, SlotDocumentResponse, } from './prototype-slot-model.ts';

export function createSlotScriptedClient(
  {
    shell,
    invalidAuthors,
    hang,
  }: {
    readonly shell: ImmutableShell;
    readonly invalidAuthors: ReadonlySet<string>;
    readonly hang: boolean;
  },
): SyntheticClient {
  return {
    chatText: async function unusedText() {
      await Promise.resolve();
      throw new Error('chatText unused by immutable shell prototype');
    },
    chatJson: async function scriptedJson(request,) {
      if (!carriesPicture({ messages: request.messages, },))
        throw new Error('scripted immutable shell call omitted images');
      if (request.responseFormat?.json_schema.name !== 'immutable_shell_slots')
        throw new Error('scripted immutable shell received unknown schema');
      if (hang)
        await wait(60_000,);
      const systemMessage = request.messages[0];
      const system = systemMessage === undefined || typeof systemMessage.content !== 'string'
        ? ''
        : systemMessage.content;
      const authorId = system.includes('priority-zero')
        ? 'primary-author'
        : system.includes('priority-one')
          ? 'fallback-author'
          : 'reserve-author';
      if (authorId === 'primary-author')
        await wait(20,);
      const pairs = shell.slots
        .filter(function retained(_slot, index,) {
          return !(invalidAuthors.has(authorId,) && (index === 0));
        },)
        .map(function pair(slot,): readonly [string, string] {
          return [slot.key, slot.source,];
        },);
      const value: SlotDocumentResponse = { slots: Object.fromEntries(pairs,), };
      const rawText = JSON.stringify(value,);
      if (!request.validate(value,)) {
        return {
          kind: 'schema-mismatch',
          rawText,
          detail: 'guard rejected scripted slot record',
        };
      }
      return { kind: 'ok', value, rawText, };
    },
    quotas: async function unusedQuotas() {
      await Promise.resolve();
      throw new Error('quotas unused by immutable shell prototype');
    },
  };
}
