/**
 * Tests for the editor prompt's fencing.
 *
 * The builder had no suite; what it fences is corpus prose and its own
 * rendered regions, and the fence used to be a fixed row of equals signs a
 * setext heading underline could reproduce.
 *
 * @module
 */

import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  buildEditorMessages,
  messageText,
} from '../dist/final/node/index.mjs';

/**
 * Original carrying a row of five equals signs, the fence the builder once
 * used, on a line of its own.
 */
const RULED_SOURCE = '第一行。\n=====\n第二行。';

/**
 * User message of a plan, as text.
 *
 * @param messages - messages the builder returned
 *
 * @returns Last message's text
 *
 * @throws {@link Error} when the builder returned no message
 *
 * @example
 * ```ts
 * const content = userText({ messages, },);
 * ```
 */
function userText({ messages, }: { readonly messages: readonly ChatMessage[]; },): string {
  /**
   * Last message, which is the user turn.
   */
  const asked = messages.at(-1,);
  if (asked === undefined)
    throw new Error('the builder returned no message',);
  return messageText({ message: asked, },);
}

await describe({
  name: 'fence choice',
  children: [
    it({
      name: 'FENCES the blocks with a delimiter the enclosed text cannot reproduce, so a passage holding a row '
        + 'of five equals signs cannot close its own block and turn what follows into instructions',
      fn: async () => {
        const content = userText({ messages: buildEditorMessages({ sourceText: RULED_SOURCE, targetText: 'Line one.', envelopes: [], issues: [], },).messages, },);

        expect(content.includes('====== ORIGINAL ======',),).toBe(true,);
        expect(content.includes('\n===== ',),).toBe(false,);
        expect(content.includes(RULED_SOURCE,),).toBe(true,);
      },
    },),
  ],
},);
