import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import { renderConsolidationBrief, } from './consolidate-brief.ts';
import { HOUSE_POLICY_BLOCK, } from './house-policy.ts';
import type { LaneContestBallot, } from './lane-contest-wire.ts';
import { selectFence, } from './prompt-fence.ts';
import { TRANSLATE_LINE_STRUCTURE_RULE, } from './translate-wire.ts';

//region Consolidate wire
// Asks for the rendering that ships, given the two the lanes produced and what
// the contest's judges said about them.
//
// WHY A THIRD RENDERING RATHER THAN A CHOICE. The lane contest answers which
// candidate the original supports BETTER, which is not the same as either being
// good. `doc/audit/eight-entries-read-against-the-original.md` found the lanes
// failing in opposite directions, the repair lane inheriting the archive's
// inventions and the translate lane discarding what the archive knew, and found
// at least one slice where each lane was better than the other in a DIFFERENT
// PLACE of the same passage. No selection can produce that slice's best text,
// because that text is neither candidate.
//
// So this call may take one clause from one candidate and the next from the
// other, and the sheet says so: a producer told only to pick a side will pick
// one.
//
// THE REPLY SHAPE IS THE TRANSLATE LANE'S OWN, `{"translation": "..."}`, so
// `isTranslateReportWire`, `repairInvalidCandidates`, `buildTranslateCandidates`
// and `judgeTranslateSlate` all serve this stage unchanged. The sheet is the
// only new thing in the producing half.
//
// THE FINDINGS ARE SHOWN AS CLAIMS. See `consolidate-brief.ts` for why that
// framing is load-bearing rather than polite.

/**
 * Instructions every consolidating producer shares.
 *
 * OPENS BY SAYING NEITHER CANDIDATE IS KNOWN TO BE GOOD. A producer shown two
 * renderings and asked to improve on them treats their agreement as settled,
 * which is exactly the inherited-invention case: where both lanes carry the
 * same archive invention, their agreement is the defect.
 */
const CONSOLIDATE_RULES =
  `You are a bilingual Chinese-to-English translator finishing one passage of a memorial archive for publication.

Two English renderings of this passage already exist. Neither is known to be good, and where they agree they may both be wrong. Write the rendering that ships.

THE ORIGINAL IS THE STANDARD. Judge everything against the Chinese, never against the archive rendering and never against either candidate.

Rules:
- Say everything the ORIGINAL says: every clause, qualifier, named object and speaker aside.
- Say nothing the ORIGINAL does not say. Do not strengthen a claim, invent a time period, or characterise anyone the original leaves uncharacterised.
- Accurate detail the ARCHIVE RENDERING adds and the ORIGINAL does not contradict is KEPT rather than stripped: a name, a spelled-out referent, a contributor credit, a citation's translator. It is correct information a reader benefits from, and the ORIGINAL not carrying it is not a reason to drop it.
- DECLARED NAMES from the documents' front matter are attested facts about this person. Carrying one is correct even where the passage never spells it out; omitting one drops something.
- Where a candidate already renders a clause well, KEEP ITS WORDING. Reaching the same English by different words is not an improvement, and a reader who knows this archive should not see it churn.
- You may take one clause from one candidate and the next from the other. Neither candidate has to be right about the whole passage, and that is the point of this call.
- Write English, not a repair of English. The result must read as prose a person wrote, carrying the original's voice: its warmth, grief, humour or anger. A stiff literal rendering that loses the feeling is not a good rendering.
- Preserve every Markdown structure the ORIGINAL uses: block quotes, list markers, headings, footnote markers, links, and the paragraph breaks between blocks.

THE JUDGE FINDINGS ARE CLAIMS, NOT FACTS. Other models wrote them about these two candidates, and they can be wrong. Check each one against the ORIGINAL before you act on it, and ignore any the ORIGINAL does not support. A finding you obey that the original does not support is a defect you introduced yourself.

${HOUSE_POLICY_BLOCK}`;

/**
 * Reply-format instruction, kept LAST in the assembled sheet.
 *
 * Split out for the same reason the translate sheet splits it: a conditional
 * rule has to sit above it, and wire instructions that end up above content
 * rules are the ones models drop first.
 */
const CONSOLIDATE_REPLY_RULE =
  'Reply with ONLY a JSON object of shape {"translation": "..."}. No prose, no code fences, no commentary.';

/**
 * What a consolidating producer is shown for one slice.
 */
export type ConsolidateSubject = {
  /**
   * Original passage, which is the standard.
   */
  readonly sourceText: string;

  /**
   * Archive rendering, as evidence rather than as the standard.
   */
  readonly incumbentText: string;

  /**
   * What the repair lane would ship.
   */
  readonly repairText: string;

  /**
   * What the translate lane would ship.
   */
  readonly translateText: string;

  /**
   * Lane contest ballots for this slice, shown as claims to check.
   *
   * MAY BE EMPTY, and the sheet then carries no findings block at all. A slice
   * whose contest never reached quorum still has two candidates worth
   * consolidating, and an empty findings heading would read as judges having
   * looked and found nothing.
   */
  readonly ballots: readonly LaneContestBallot[];

  /**
   * Names and handles both documents' front matter declares, when either does.
   */
  readonly identityContext?: string;

  /**
   * What the pictures in this passage say, when any were read.
   */
  readonly pictureContext?: string;

  /**
   * Whether the enclosing CHUNK's original is line-structured, decided by the
   * caller because a slice is too small a unit to decide it on.
   */
  readonly lineStructured?: boolean;
};

/**
 * Renders one labelled block, or nothing when its text is empty.
 *
 * @param fence - fence enclosing every block in this sheet
 *
 * @param label - heading naming what this block is
 *
 * @param text - block contents
 *
 * @returns Lines for this block, empty when there is nothing to show
 *
 * @example
 * ```ts
 * const lines = renderBlock({ fence: '=====', label: 'DECLARED NAMES', text, },);
 * ```
 */
function renderBlock(
  {
    fence,
    label,
    text,
  }: {
    readonly fence: string;
    readonly label: string;
    readonly text: string;
  },
): readonly string[] {
  if (text === '')
    return [];
  return [
    `${fence} ${label} ${fence}`,
    text,
    '',
  ];
}

/**
 * Builds the sheet asking one producer to consolidate one slice.
 *
 * @param subject - passage, archive rendering, both candidates and the ballots
 *
 * @returns Messages for one exchange
 *
 * @example
 * ```ts
 * const messages = buildConsolidateMessages({ subject, },);
 * ```
 */
export function buildConsolidateMessages(
  { subject, }: { readonly subject: ConsolidateSubject; },
): readonly ChatMessage[] {
  /**
   * Declared names as one block, empty when neither side declares any.
   */
  const declared = subject.identityContext ?? '';

  /**
   * What the pictures said, empty when none were read.
   */
  const pictures = subject.pictureContext ?? '';

  /**
   * Judge findings as the producer will see them, empty when none were heard.
   */
  const brief = renderConsolidationBrief({ ballots: subject.ballots, },);

  /**
   * Fence no enclosed text can reproduce, chosen against every string this
   * sheet carries, since all of them are arbitrary prose.
   */
  const fence = selectFence({
    texts: [
      subject.sourceText,
      subject.incumbentText,
      subject.repairText,
      subject.translateText,
      declared,
      pictures,
      brief,
    ],
  },);

  /**
   * Producer sheet, with the line-structure fact inserted above the reply
   * instruction when the enclosing chunk's original is verse.
   *
   * BORROWED FROM THE TRANSLATE WIRE rather than restated, because this
   * producer is a translator and a second wording of the same rule would drift
   * from the one `Toka_ls` was measured against.
   */
  const system = [
    CONSOLIDATE_RULES,
    ((subject.lineStructured ?? false) ? TRANSLATE_LINE_STRUCTURE_RULE : ''),
    CONSOLIDATE_REPLY_RULE,
  ]
    .filter(function isPresent(part,): boolean {
      return part !== '';
    },)
    .join('\n\n',);
  return [
    {
      role: 'system',
      content: system,
    },
    {
      role: 'user',
      content: [
        ...renderBlock({
          fence,
          label: 'DECLARED NAMES',
          text: declared,
        },),
        ...renderBlock({
          fence,
          label: 'ORIGINAL (Chinese), the standard',
          text: subject.sourceText,
        },),
        ...renderBlock({
          fence,
          label: 'WHAT THE PICTURES HERE SAY',
          text: pictures,
        },),
        ...renderBlock({
          fence,
          // NAMED AS THE EXISTING TRANSLATION TOO, because the verse rule
          // borrowed from the translate wire asks the producer to unmerge lines
          // the EXISTING TRANSLATION merged, and nothing else in this sheet
          // carries that label.
          label: 'ARCHIVE RENDERING, the EXISTING TRANSLATION, evidence only',
          text: subject.incumbentText,
        },),
        ...renderBlock({
          fence,
          label: 'CANDIDATE "repair"',
          text: subject.repairText,
        },),
        ...renderBlock({
          fence,
          label: 'CANDIDATE "translate"',
          text: subject.translateText,
        },),
        ...renderBlock({
          fence,
          label: 'WHAT THE JUDGES FOUND, claims to check against the original',
          text: brief,
        },),
        `${fence} END ${fence}`,
      ].join('\n',),
    },
  ];
}

//endregion Consolidate wire
