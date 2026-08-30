// PROTOTYPE ONLY: Candidate D deterministic shell and selection controls.

import { carriesPicture, } from './chat-contract.ts';
import { photoReferences, } from './photo-reference.ts';
import { slotAuthorMessages, selectSlotAuthor, SLOT_AUTHOR_NODES, } from './prototype-slot-plan.ts';
import { compileSlotDocument, } from './prototype-slot-compile.ts';
import {
  MAX_SLOT_CHARACTERS,
  type SlotDocumentResponse,
} from './prototype-slot-model.ts';
import { buildImmutableShell, } from './prototype-slot-shell.ts';
import {
  slotDocumentGuard,
  validateSlotCandidate,
} from './prototype-slot-wire.ts';

const SOURCE = `---\nname: Cat\ninfo:\n  alias: Cat\n---\n# 猫\n\n猫在[家](https://example.com)休息。![图](cat.webp)[^1]\n\n[^1]: 注。\n`;
const ARCHIVE = `---\nname: Cat\ninfo:\n  alias: Cat\n---\n# Cat\n\nThe cat rests at [home](https://example.com).![Picture](cat.webp)[^1]\n\n[^1]: Note.\n`;

function sourceResponse(
  { shell, }: { readonly shell: ReturnType<typeof buildImmutableShell>; },
): SlotDocumentResponse {
  return {
    slots: Object.fromEntries(shell.slots.map(function pair(slot,) {
      return [slot.key, slot.source,];
    },),),
  };
}

export function runSlotLocalControls(): void {
  const shell = buildImmutableShell({ sourceText: SOURCE, archiveText: ARCHIVE, });
  if (shell.slots.length < 4)
    throw new Error('immutable shell slot census control failed');
  const response = sourceResponse({ shell, });
  const isSlotDocumentResponse = slotDocumentGuard({ shell, });
  if (!isSlotDocumentResponse(response,))
    throw new Error('immutable shell valid response control failed');
  const missing: SlotDocumentResponse = {
    slots: Object.fromEntries(Object.entries(response.slots,).slice(1,),),
  };
  if (isSlotDocumentResponse(missing,))
    throw new Error('immutable shell missing-key control failed');
  const extra: SlotDocumentResponse = { slots: { ...response.slots, extra: 'x', }, };
  if (isSlotDocumentResponse(extra,))
    throw new Error('immutable shell extra-key control failed');
  const firstKey = shell.slots[0]?.key;
  if (firstKey === undefined)
    throw new Error('immutable shell first slot control failed');
  const tooLong: SlotDocumentResponse = {
    slots: { ...response.slots, [firstKey]: 'x'.repeat(MAX_SLOT_CHARACTERS + 1,), },
  };
  if (isSlotDocumentResponse(tooLong,))
    throw new Error('immutable shell slot-envelope control failed');
  const document = validateSlotCandidate({
    shell,
    response,
    sourceText: SOURCE,
    archiveText: ARCHIVE,
    sourcePictures: photoReferences({ text: SOURCE, }),
  },);
  if (!document.includes('https://example.com',) || !document.includes('cat.webp',) || !document.includes('[^1]',))
    throw new Error('immutable shell syntax preservation control failed');
  const injected: SlotDocumentResponse = {
    slots: { ...response.slots, [firstKey]: '] {unsafe} `marker`', },
  };
  validateSlotCandidate({
    shell,
    response: injected,
    sourceText: SOURCE,
    archiveText: ARCHIVE,
    sourcePictures: photoReferences({ text: SOURCE, }),
  },);
  const compiled = compileSlotDocument({ shell, response: injected, });
  if (!compiled.includes('\\]',) || !compiled.includes('\\{unsafe\\}',) || !compiled.includes('\\`marker\\`',))
    throw new Error('immutable shell syntax encoding control failed');
  const usable = new Map([
    ['fallback-author', { response, document, },],
    ['reserve-author', { response, document, },],
  ],);
  const selected = selectSlotAuthor({ usable, });
  if (selected?.id !== 'fallback-author')
    throw new Error('immutable shell fixed-priority control failed');
  const primary = SLOT_AUTHOR_NODES[0];
  if (primary === undefined)
    throw new Error('immutable shell primary author control failed');
  const messages = slotAuthorMessages({
    node: primary,
    shell,
    sourceText: SOURCE,
    archiveText: ARCHIVE,
    media: [{ assetName: 'cat.webp', dataUri: 'data:image/webp;base64,AA==', digest: 'fixture', },],
  },);
  if (!carriesPicture({ messages, }))
    throw new Error('immutable shell vision control failed');
}
