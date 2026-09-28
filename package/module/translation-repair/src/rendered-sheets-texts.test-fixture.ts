/**
 The invented texts every rendered sheet is built from, and how a sheet's
 messages are joined (ledger X17: split out of `rendered-sheets.test-fixture.ts`
 when the sheets it renders outgrew one file).

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import {
  type AdjudicatedIssue,
  hashContent,
  type JudgeReference,
  type RepairRegion,
  messageText,
} from '../dist/final/node/index.mjs';


//region Rendered sheet texts

/**
 One rendered sheet, named by the stage that reads it.
 */
export type RenderedSheet = {
  /**
   Stage the sheet is written for.
   */
  readonly name: string;

  /**
   Every message of the exchange, joined.
   */
  readonly text: string;
};

/**
 Invented original: a kitten asleep on the windowsill, and what she said.
 */
export const SOURCE = '那晚小猫咪在窗台上睡着了。她说：「我明天还来。」';

/**
 Invented archive rendering, told in the present.
 */
export const ARCHIVE = 'That night the kitten falls asleep on the windowsill. She says, "I will come again tomorrow."';

/**
 Invented repair of the archive rendering, told in the past.
 */
export const REPAIR = 'That night the kitten fell asleep on the windowsill. She said, "I will come again tomorrow."';

/**
 Invented identity context carrying one declared name.
 */
export const IDENTITY = 'name: 咪咪 = Mittens';

/**
 Invented cited reference.
 */
export const REFERENCES = '- reference 1 https://example.org/mittens ("Mittens"): Mittens had an older sister who was also a tabby.';

/**
 Opening sentence of the invented original, which the invented claim quotes.
 */
export const SOURCE_QUOTE = '那晚小猫咪在窗台上睡着了。';

/**
 Opening sentence of the invented archive rendering, which the invented
 claim quotes.
 */
export const ARCHIVE_QUOTE = 'That night the kitten falls asleep on the windowsill.';

/**
 Invented accepted issue quoting both documents, so the checker sheet shows
 its claim evidence (ledger L14).
 */
export const TENSE_ISSUE: AdjudicatedIssue = {
  issueId: 'issue/tense',
  status: 'accepted' as const,
  severity: 'minor' as const,
  claims: [
    {
      claimId: 'claim/tense',
      claim: {
        category: 'fluency/grammar' as const,
        severity: 'minor' as const,
        summary: 'The narration is told in the present.',
        spans: [
          {
            side: 'source' as const,
            nodeId: 'block/1',
            nodeHash: hashContent({ content: SOURCE, },),
            startOffset: 0,
            endOffset: SOURCE_QUOTE.length,
            quotedText: SOURCE_QUOTE,
          },
          {
            side: 'target' as const,
            nodeId: 'block/1',
            nodeHash: hashContent({ content: ARCHIVE, },),
            startOffset: 0,
            endOffset: ARCHIVE_QUOTE.length,
            quotedText: ARCHIVE_QUOTE,
          },
        ],
      },
    },
  ],
  tallies: {},
};

/**
 Invented archive block the original does not claim.
 */
export const ASIDE = 'The kitten was the favourite of the whole street.';

/**
 Invented revision of that block, which a reviewer proposes.
 */
export const ASIDE_REVISED = 'The kitten was a favourite of the neighbours.';

/**
 Invented original with an explicit line break and no archive rendering, so
 the translated slate carries its rendered-break criterion.
 */
export const VERSE_SOURCE = '小猫睡着了。<br/>它梦见了鱼。';

/**
 Invented sentence a restoration judge is asked to find again.
 */
export const JUDGE_REFERENCE: JudgeReference = {
  seedId: 'seed/promise',
  deletedText: 'She said, "I will come again tomorrow."',
};

/**
 Invented repair region: the archive's present tense put into the past.
 */
export const TENSE_REGION: RepairRegion = {
  envelopeId: 'envelope/tense',
  issueIds: ['issue/tense',],
  before: ARCHIVE_QUOTE,
  editorAfter: 'That night the kitten fell asleep on the windowsill.',
};

/**
 Joins the content of every message of an exchange.

 @param messages - exchange to read

 @returns Every message's text, joined

 @example
 ```ts
 const text = joined({ messages, },);
 ```
 */
export function joined(
  { messages, }: { readonly messages: readonly Parameters<typeof messageText>[0]['message'][]; },
): string {
  return messages
    .map(function textOf(message,): string {
      return messageText({ message, },);
    },)
    .join('\n',);
}

//endregion Rendered sheet texts
