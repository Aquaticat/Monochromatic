// PROTOTYPE ONLY: Candidate D zero-spend full-graph client.

import { wait, } from '@monochromatic-dev/module-async-time/ts';

import { carriesPicture, type SyntheticClient, } from './chat-contract.ts';
import type { ImmutableShell, SlotDocumentResponse, } from './prototype-slot-model.ts';

export function createSlotScriptedClient(
  {
    shell,
    invalidAuthors,
    sourceEchoAuthors,
    presentationArtifactAuthors,
    hang,
  }: {
    readonly shell: ImmutableShell;
    readonly invalidAuthors: ReadonlySet<string>;
    readonly sourceEchoAuthors: ReadonlySet<string>;
    readonly presentationArtifactAuthors: ReadonlySet<string>;
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
      if (hang) {
        for (let elapsedMs = 0; elapsedMs < 60_000; elapsedMs += 10) {
          if (request.signal.aborted)
            throw request.signal.reason;
          await wait(10,);
        }
      }
      const systemMessage = request.messages[0];
      const system = systemMessage === undefined || typeof systemMessage.content !== 'string'
        ? ''
        : systemMessage.content;
      const roles = [
        { token: 'priority-zero', id: 'primary-author', },
        { token: 'priority-one', id: 'fallback-author', },
        { token: 'priority-two', id: 'reserve-author', },
        { token: 'finite final holistic', id: 'final-reviser', },
        { token: 'finite final copy', id: 'final-copy-editor', },
      ].filter(function matches(role,) { return system.includes(role.token,); },);
      const role = roles[0];
      if ((roles.length !== 1) || (role === undefined))
        throw new Error('scripted immutable shell author role is ambiguous');
      const authorId = role.id;
      if (authorId === 'primary-author')
        await wait(20,);
      const pairs = shell.slots
        .filter(function retained(_slot, index,) {
          return !(invalidAuthors.has(authorId,) && (index === 0));
        },)
        .map(function pair(slot,): readonly [string, string] {
          if (sourceEchoAuthors.has(authorId,))
            return [slot.key, slot.source,];
          const prior = shell.body[slot.startOffset - 1];
          const leadingSpace = (prior !== undefined) && (prior.trim() !== '') ? ' ' : '';
          const artifact = presentationArtifactAuthors.has(authorId,) && (slot.key === shell.slots[0]?.key)
            ? '↵'
            : '';
          return [slot.key, `${leadingSpace}English${artifact} text for ${slot.key} by ${authorId}.`,];
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
