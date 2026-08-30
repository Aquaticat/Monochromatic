// PROTOTYPE ONLY: Candidate C image-bearing brief inputs.

import type { ChatMessage, ContentPart, } from '@monochromatic-dev/module-llm-type/ts';

import type { VisionMessage, } from './chat-contract.ts';
import {
  type CorpusPin,
  readCorpusBytes,
} from './corpus-source.ts';
import { hashContent, } from './document-node.ts';
import { encodeImageAsset, } from './image-asset.ts';
import {
  photoPath,
  photoReferences,
} from './photo-reference.ts';
import {
  BRIEF_NODES,
  briefSystemInstruction,
  type EditorialPacket,
  editorSystemInstruction,
  editorUserInstruction,
} from './prototype-brief-editor-plan.ts';

const MAX_IMAGE_BYTES = 7_340_032;

export type PrototypeMedia = {
  readonly assetName: string;
  readonly dataUri: string;
  readonly digest: string;
};

export function prototypeBriefMessages(
  {
    node,
    sourceText,
    archiveText,
    media,
  }: {
    readonly node: typeof BRIEF_NODES[number];
    readonly sourceText: string;
    readonly archiveText: string;
    readonly media: readonly PrototypeMedia[];
  },
): readonly (ChatMessage | VisionMessage)[] {
  const text = `SOURCE:\n${sourceText}\n\nARCHIVE EVIDENCE:\n${archiveText}\n\nMEDIA NAMES:\n${media.map(function name(item,) { return item.assetName; },).join('\n')}`;
  const content: string | readonly ContentPart[] = node.id !== 'structure-brief'
    ? text
    : [
      { type: 'text', text, },
      ...media.flatMap(function image(item,): readonly ContentPart[] {
        return [
          { type: 'text', text: `MEDIA ${item.assetName}`, },
          { type: 'image_url', image_url: { url: item.dataUri, }, },
        ];
      },),
    ];
  const userMessage: ChatMessage | VisionMessage = typeof content === 'string'
    ? { role: 'user', content, }
    : { role: 'user', content, };
  return [
    { role: 'system', content: briefSystemInstruction(node,), },
    userMessage,
  ];
}

export function prototypeEditorMessages(
  {
    sourceText,
    archiveText,
    packet,
    media,
  }: {
    readonly sourceText: string;
    readonly archiveText: string;
    readonly packet: EditorialPacket;
    readonly media: readonly PrototypeMedia[];
  },
): readonly (ChatMessage | VisionMessage)[] {
  const text = editorUserInstruction({ sourceText, archiveText, packet, },);
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
    { role: 'system', content: editorSystemInstruction(), },
    { role: 'user', content, },
  ];
}

export async function gatherPrototypeMedia(
  {
    pin,
    entryId,
    sourceText,
  }: {
    readonly pin: CorpusPin;
    readonly entryId: string;
    readonly sourceText: string;
  },
): Promise<readonly PrototypeMedia[]> {
  const names = [...new Set(photoReferences({ text: sourceText, }).map(function name(reference,) {
    return reference.assetName;
  },)),];
  return await Promise.all(names.map(async function gather(assetName,) {
    const bytes = await readCorpusBytes({ pin, relPath: photoPath({ entryId, assetName, },), },);
    const encoded = encodeImageAsset({ bytes, assetName, maxBytes: MAX_IMAGE_BYTES, },);
    if (encoded.kind !== 'usable')
      throw new Error(`prototype media ${assetName} is ${encoded.reason}`);
    return {
      assetName,
      dataUri: encoded.dataUri,
      digest: hashContent({ content: encoded.dataUri, }),
    };
  },),);
}
