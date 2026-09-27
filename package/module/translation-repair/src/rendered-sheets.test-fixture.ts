import {
  buildAbsoluteNaturalnessReviewMessages,
  buildCandidateSelectMessages,
  buildConsolidateGateMessages,
  buildConsolidateMessages,
  buildConsolidationPolishGateMessages,
  buildCoverageMessages,
  buildCriticMessages,
  buildEditorMessages,
  buildLaneContestMessages,
  buildRefineMessages,
  buildRenderingAuditMessages,
  buildResolutionMessages,
  buildTranslateMessages,
  HOUSE_POLICY_BLOCK,
  messageText,
  TRANSLATE_SELECTION_TASK,
  translateSelectionCriteria,
} from '../dist/final/node/index.mjs';

//region Rendered sheets
// EVERY MODEL-FACING SHEET, rendered once with invented cat fixtures, so a
// guard about what the models read (a spelling, a precedence line, a rule
// every sheet must carry) checks every sheet at once rather than the one
// sheet its class happened to find. Built for the whole-package audit of
// 2026-09-27, whose sheet audits rendered the same sheets by hand. These
// strings are authored test data, never copied corpus passages.

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
const SOURCE = '那晚小猫咪在窗台上睡着了。她说：「我明天还来。」';

/**
 Invented archive rendering, told in the present.
 */
const ARCHIVE = 'That night the kitten falls asleep on the windowsill. She says, "I will come again tomorrow."';

/**
 Invented repair of the archive rendering, told in the past.
 */
const REPAIR = 'That night the kitten fell asleep on the windowsill. She said, "I will come again tomorrow."';

/**
 Invented identity context carrying one declared name.
 */
const IDENTITY = 'name: 咪咪 = Mittens';

/**
 Invented cited reference.
 */
const REFERENCES = '- reference 1 https://example.org/mittens ("Mittens"): Mittens had an older sister who was also a tabby.';

/**
 Joins the content of every message of an exchange.

 @param messages - exchange to read

 @returns Every message's text, joined

 @example
 ```ts
 const text = joined({ messages, },);
 ```
 */
function joined(
  { messages, }: { readonly messages: readonly Parameters<typeof messageText>[0]['message'][]; },
): string {
  return messages
    .map(function textOf(message,): string {
      return messageText({ message, },);
    },)
    .join('\n',);
}

/**
 Every model-facing sheet the package builds, rendered with the fixtures.

 @returns One entry per sheet, named by its stage

 @example
 ```ts
 const sheets = renderedSheets();
 ```
 */
export function renderedSheets(): readonly RenderedSheet[] {
  return [
    { name: 'house policy', text: HOUSE_POLICY_BLOCK, },
    {
      name: 'critic',
      text: joined({
        messages: buildCriticMessages({
          sourceText: SOURCE,
          targetText: ARCHIVE,
          identityContext: IDENTITY,
          referenceContext: REFERENCES,
        },),
      },),
    },
    {
      name: 'editor',
      text: joined({
        messages: buildEditorMessages({
          sourceText: SOURCE,
          targetText: ARCHIVE,
          envelopes: [],
          issues: [],
        },).messages,
      },),
    },
    {
      name: 'refiner',
      text: joined({
        messages: buildRefineMessages({
          sourceText: SOURCE,
          envelopes: [],
          identityContext: IDENTITY,
          referenceContext: REFERENCES,
        },).messages,
      },),
    },
    {
      name: 'translate writer',
      text: joined({
        messages: buildTranslateMessages({
          sourceText: SOURCE,
          existingText: ARCHIVE,
          identityContext: IDENTITY,
        },).messages,
      },),
    },
    {
      name: 'consolidation writer',
      text: joined({
        messages: buildConsolidateMessages({
          subject: {
            sourceText: SOURCE,
            incumbentText: ARCHIVE,
            repairText: REPAIR,
            translateText: REPAIR,
            ballots: [],
            lineStructured: false,
            identityContext: IDENTITY,
            referenceContext: REFERENCES,
          },
        },),
      },),
    },
    {
      name: 'lane contest',
      text: joined({
        messages: buildLaneContestMessages({
          subject: {
            sourceText: SOURCE,
            incumbentText: ARCHIVE,
            repairText: REPAIR,
            translateText: REPAIR,
            identityContext: IDENTITY,
            referenceContext: REFERENCES,
          },
        },),
      },),
    },
    {
      name: 'consolidate gate',
      text: joined({
        messages: buildConsolidateGateMessages({
          subject: {
            sourceText: SOURCE,
            incumbentText: ARCHIVE,
            consolidatedText: REPAIR,
            standingText: ARCHIVE,
            identityContext: IDENTITY,
            referenceContext: REFERENCES,
          },
        },),
      },),
    },
    {
      name: 'polish gate',
      text: joined({
        messages: buildConsolidationPolishGateMessages({
          subject: {
            sourceText: SOURCE,
            archiveText: ARCHIVE,
            baseText: ARCHIVE,
            polishedText: REPAIR,
            mode: { kind: 'comparative', },
            lineStructured: false,
            identityContext: IDENTITY,
            referenceContext: REFERENCES,
          },
        },),
      },),
    },
    {
      name: 'translate slate',
      text: joined({
        messages: buildCandidateSelectMessages({
          task: TRANSLATE_SELECTION_TASK,
          criteria: translateSelectionCriteria({ lineStructured: false, },),
          evidence: [{ label: 'ORIGINAL (Chinese)', text: SOURCE, },],
          rendered: [
            ARCHIVE,
            REPAIR,
          ],
          sourceText: SOURCE,
        },),
      },),
    },
    {
      name: 'coverage',
      text: joined({
        messages: buildCoverageMessages({
          sourcePassage: SOURCE,
          translationText: ARCHIVE,
        },).messages,
      },),
    },
    {
      name: 'naturalness review',
      text: joined({
        messages: buildAbsoluteNaturalnessReviewMessages({
          subject: {
            sourceText: SOURCE,
            candidateText: ARCHIVE,
            paragraphs: [ARCHIVE,],
            identityContext: IDENTITY,
          },
        },),
      },),
    },
    {
      name: 'rendering audit',
      text: joined({
        messages: buildRenderingAuditMessages({
          subject: {
            sourceText: SOURCE,
            candidateText: ARCHIVE,
          },
        },),
      },),
    },
    {
      name: 'resolution',
      text: joined({
        messages: buildResolutionMessages({
          sourceText: SOURCE,
          patchedText: ARCHIVE,
          issues: [],
        },).messages,
      },),
    },
  ];
}

//endregion Rendered sheets
