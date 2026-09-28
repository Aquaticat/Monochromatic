/**
 Tests that the repair lane's sheets read a footnote marker as carrying its
 note (ledger L5).

 WHY. Every footnote definition of both documents reaches these sheets as an
 "ORIGINAL note" or "ARCHIVE note" line of the DECLARED NAMES block
 (`entry-notes.ts`), but the rule for those lines said they establish
 vocabulary for the terms they name "and nothing else", and that the block is
 evidence about naming only. Nothing said that a note stands at its marker, so
 an attribution the archive moved into its own note read as dropped
 (shihai4h slices 33 and 37).

 Fixtures are cat-themed invention mirroring corpus structure only.

 @module
 */

import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  buildAdjudicationMessages,
  buildCriticMessages,
  buildEditorMessages,
  messageText,
} from '../dist/final/node/index.mjs';

/**
 Invented original citing a note.
 */
const SOURCE_TEXT = '小猫在窗台上睡到中午。[^1]';

/**
 Invented archive citing its own note.
 */
const TARGET_TEXT = 'Mittens slept on the sill until noon.[^1]';

/**
 System instructions of a message list.

 @param messages - one sheet's messages

 @returns System message text

 @example
 ```ts
 const system = systemOf({ messages, },);
 ```
 */
function systemOf({ messages, }: { readonly messages: readonly ChatMessage[]; },): string {
  /**
   First message, the system instructions.
   */
  const [first,] = messages;
  return (first === undefined) ? '' : messageText({ message: first, },);
}

/**
 System instructions of the three sheets the accepted omission claims passed through.
 */
const SHEETS: Readonly<Record<string, string>> = {
  critic: systemOf({ messages: buildCriticMessages({ sourceText: SOURCE_TEXT, targetText: TARGET_TEXT, },), },),
  panel: systemOf({
    messages: buildAdjudicationMessages({ sourceText: SOURCE_TEXT, targetText: TARGET_TEXT, clusters: [], },).messages,
  },),
  editor: systemOf({
    messages: buildEditorMessages({
      sourceText: SOURCE_TEXT,
      targetText: TARGET_TEXT,
      envelopes: [],
      issues: [],
    },).messages,
  },),
};

await describe({
  name: 'a footnote marker carries its note',
  children: Object.entries(SHEETS,).map(function sheetCase([name, system,],) {
    return it({
      name: `${name.toUpperCase()} SHEET says what a note says stands at its marker, so content a note carries is not omitted`,
      fn: async () => {
        expect(system,).toContain('stands at that marker',);
        expect(system,).toContain('is not omitted',);
      },
    },);
  },),
},);
