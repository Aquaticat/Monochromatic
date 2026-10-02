/**
 Tests for the editor prompt's fencing.

 The builder had no suite; what it fences is corpus prose and its own
 rendered regions, and the fence used to be a fixed row of equals signs a
 setext heading underline could reproduce.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  buildEditorMessages,
  MARKUP_ATOM_SHEET_NAMES,
  messageText,
} from '../dist/final/node/index.mjs';
import { userText, } from './chat-message-reading.test-fixture.ts';

/**
 Original carrying a row of five equals signs, the fence the builder once
 used, on a line of its own.
 */
const RULED_SOURCE = '第一行。\n=====\n第二行。';

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: 'fence choice',
      concurrency: DEFAULT_CONCURRENCY,
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
    },),

    describe({
      name: 'markup rule (ledger L4)',
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'NAMES on the editor sheet every markup kind the preservation gate refuses to lose, since a gate '
            + 'the editor is never told about refuses edits it had no way to avoid',
          fn: async () => {
            /** The system turn, which carries the rules. */
            const [system,] = buildEditorMessages({ sourceText: '猫。', targetText: 'Cat.', envelopes: [], issues: [], },)
              .messages;
            /** The rules as text. */
            const rules = (system === undefined) ? '' : messageText({ message: system, },);
            expect(
              Object.values(MARKUP_ATOM_SHEET_NAMES,)
                .filter(function unnamed(name,) {
                  return !rules.includes(name,);
                },),
            ).toStrictEqual([],);
            expect(rules,).toContain('accuracy/addition issue quotes',);
          },
        },),
      ],
    },),
  ],
},);
