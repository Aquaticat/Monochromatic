// PROTOTYPE ONLY: Candidate G complete page-evidence carriage guard.

import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import { messageText, type VisionMessage, } from './chat-contract.ts';

/** Refuses missing, extra, or unnamed page-referenced image prompt parts. */
export function assertRealizationPicturesReachMessages({ messages, sourcePictures, }: {
  readonly messages: readonly (ChatMessage | VisionMessage)[];
  readonly sourcePictures: readonly { readonly assetName: string; }[];
}): void {
  const imageCount = messages.reduce(function countImages(total, message,) {
    if ((typeof message.content) === 'string')
      return total;
    return total + message.content.filter(function image(part,) { return part.type === 'image_url'; }).length;
  }, 0,);
  const promptText = messages.map(function text(message,) { return messageText({ message, }); }).join('\n',);
  if ((imageCount !== sourcePictures.length)
    || sourcePictures.some(function unnamed(picture,) { return !promptText.includes(picture.assetName,); }))
    throw new Error('realization prompt page-referenced image carriage differs');
}
