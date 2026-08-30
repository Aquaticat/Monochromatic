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
  DestinationScriptError,
  slotDocumentGuard,
  validateSlotCandidate,
} from './prototype-slot-wire.ts';

const SOURCE = `---\nname: Cat\ninfo:\n  alias: Cat\n---\n# 猫\n\n猫在[家](https://example.com)休息。![图](cat.webp)[^1]，继续。\n\n[^1]: 注。\n\n本条目贡献者：猫\n`;
const ARCHIVE = `---\nname: Cat\ninfo:\n  alias: Cat\n---\n# Cat\n\nThe cat rests at [home](https://example.com).![Picture](cat.webp)[^1] and continues.\n\n[^1]: Note.\n\nContributor for this entry: Cat\n`;
const CONTRIBUTOR_LINE = 'Contributor for this entry: Cat';

function englishResponse(
  { shell, }: { readonly shell: ReturnType<typeof buildImmutableShell>; },
): SlotDocumentResponse {
  return {
    slots: Object.fromEntries(shell.slots.map(function pair(slot,) {
      const prior = shell.body[slot.startOffset - 1];
      const leadingSpace = (prior !== undefined) && (prior.trim() !== '') ? ' ' : '';
      return [slot.key, `${leadingSpace}English text for ${slot.key}.`,];
    },),),
  };
}

function sourceEchoResponse(
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
  const contributorStart = shell.body.indexOf(CONTRIBUTOR_LINE,);
  const contributorEnd = contributorStart + CONTRIBUTOR_LINE.length;
  if ((contributorStart < 0)
    || !shell.lockedRanges.some(function exact(range,) {
      return (range.startOffset === contributorStart) && (range.endOffset === contributorEnd);
    },)
    || shell.slots.some(function overlaps(slot,) {
      return (slot.startOffset < contributorEnd) && (contributorStart < slot.endOffset);
    },))
    throw new Error('immutable shell contributor authority control failed');
  const response = englishResponse({ shell, });
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
  let sourceEchoRefused = false;
  try {
    validateSlotCandidate({
      shell,
      response: sourceEchoResponse({ shell, }),
      sourceText: SOURCE,
      archiveText: ARCHIVE,
      sourcePictures: photoReferences({ text: SOURCE, }),
    },);
  }
  catch (error) {
    sourceEchoRefused = error instanceof DestinationScriptError
      && error.message.includes('in s',);
  }
  if (!sourceEchoRefused)
    throw new Error('immutable shell destination-script control failed');
  for (const codePoint of [0x2EE5D, 0x2FA1F,]) {
    let rangeBoundaryRefused = false;
    try {
      validateSlotCandidate({
        shell,
        response: {
          slots: { ...response.slots, [firstKey]: String.fromCodePoint(codePoint,), },
        },
        sourceText: SOURCE,
        archiveText: ARCHIVE,
        sourcePictures: photoReferences({ text: SOURCE, }),
      },);
    }
    catch (error) {
      rangeBoundaryRefused = error instanceof DestinationScriptError;
    }
    if (!rangeBoundaryRefused)
      throw new Error(`immutable shell destination-script range control failed at ${String(codePoint,)}`);
  }
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
  const afterReference = shell.slots.find(function referenceBoundary(slot,) {
    return shell.body[slot.startOffset - 1] === ']';
  },);
  const afterLink = shell.slots.find(function linkBoundary(slot,) {
    return shell.body[slot.startOffset - 1] === ')';
  },);
  if ((afterReference === undefined) || (afterLink === undefined))
    throw new Error('immutable shell inline boundary census control failed');
  const spaced = compileSlotDocument({
    shell,
    response: {
      slots: {
        ...response.slots,
        [afterReference.key]: ' after reference',
        [afterLink.key]: ' after link',
      },
    },
  },);
  if (!spaced.includes('] after reference',) || !spaced.includes(') after link',))
    throw new Error('immutable shell inline boundary spacing control failed');
  const paragraph = shell.slots.find(function paragraphSlot(slot,) { return slot.parentKind === 'paragraph'; },);
  if (paragraph === undefined)
    throw new Error('immutable shell paragraph slot control failed');
  let structuralInjectionRefused = false;
  try {
    validateSlotCandidate({
      shell,
      response: { slots: { ...response.slots, [paragraph.key]: '# injected heading', }, },
      sourceText: SOURCE,
      archiveText: ARCHIVE,
      sourcePictures: photoReferences({ text: SOURCE, }),
    },);
  }
  catch (error) {
    structuralInjectionRefused = error !== undefined;
  }
  if (!structuralInjectionRefused)
    throw new Error('immutable shell line-start syntax control failed');
  let uncoveredSourceRefused = false;
  try {
    buildImmutableShell({
      sourceText: SOURCE.replace('# 猫', '# 猫\n\n<Widget title="中文" />',),
      archiveText: ARCHIVE.replace('# Cat', '# Cat\n\n<Widget title="English" />',),
    },);
  }
  catch (error) {
    uncoveredSourceRefused = error !== undefined;
  }
  if (!uncoveredSourceRefused)
    throw new Error('immutable shell source-leaf coverage control failed');
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
