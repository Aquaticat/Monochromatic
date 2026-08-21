/**
 * Tests for the refusal that stops a translate replacement dropping a name the
 * archive itself declared.
 *
 * WHAT THIS EXISTS TO CATCH. Asked whether a rendering that removed a
 * front-matter alias had left anything out, every judge on the roster said it
 * had not, and rewording their criteria moved half of them. A rule half a panel
 * disagrees with is not a rule, so {@link findDroppedDeclaredNames} decides this
 * one without asking anybody. That makes the wiring the whole question: a guard
 * that is computed and not consulted looks identical to a guard that passed.
 *
 * A GUARD PROVES NOTHING UNTIL SHOWN TO FAIL, so the cases come in threes. One
 * settlement accepts a replacement, one refuses the same shape of replacement
 * for dropping a declared name, and one accepts that same dropping replacement
 * once nothing is declared. The outer two are what say the refusal came from
 * the declared list rather than from a run that fell over before deciding
 * anything.
 *
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type ChunkPair,
  messageText,
  type PreparedDocumentPair,
  settleTranslateSlice,
  type SyntheticClient,
  type SyntheticModelId,
  type TranslateSliceRecord,
} from '../dist/final/node/index.mjs';

/**
 * Logger the lane writes its progress to.
 */
const l = tagged({ tag: 'translate-declared-name-test', },);

/**
 * Schema name the translate stage asks translators for, which is how a request
 * is told apart from a judge's ballot without reading its prose.
 */
const TRANSLATE_SCHEMA = 'translation_report';

/**
 * Heading the selection sheet puts before each candidate, followed by its
 * number.
 */
const CANDIDATE_MARKER = 'CANDIDATE ';

/**
 * Ballot answer meaning no candidate is acceptable.
 */
const DECLINE = 0;

/**
 * Original this slice renders.
 */
const SOURCE_TEXT = '喵喵是家里最小的猫，大家都叫她团子，她整天睡在窗台上。';

/**
 * Name the archive's own front matter declares.
 */
const DECLARED_NAME = 'Meowmeow';

/**
 * Alias the same front matter declares, which is the form real judges removed.
 */
const DECLARED_ALIAS = 'Dumpling';

/**
 * Translation already in the archive, carrying both declared forms.
 */
const INCUMBENT_TEXT =
  'Meowmeow is the smallest cat in the house, and everyone calls her Dumpling; she sleeps on the windowsill all day.';

/**
 * Wording common to both fresh renderings and to neither the original nor the
 * incumbent, so a judge can find which numbered candidate is the fresh one
 * without being told.
 */
const FRESH_SENTINEL = 'youngest cat here';

/**
 * Fresh rendering that reads better and keeps every declared form.
 */
const KEEPS_EVERY_NAME =
  'Meowmeow is the youngest cat here, known to all as Dumpling, and she naps on the windowsill from dawn to dusk.';

/**
 * Fresh rendering that reads better and drops one declared form, which is the
 * trade real judges accepted.
 */
const DROPS_THE_ALIAS =
  'Meowmeow is the youngest cat here, and she naps on the windowsill from dawn to dusk.';

/**
 * Forms the archive declares for this person.
 */
const DECLARED_NAMES: readonly string[] = [
  DECLARED_NAME,
  DECLARED_ALIAS,
];

/**
 * Models that render the slice.
 */
const TRANSLATORS: readonly SyntheticModelId[] = [
  'hf:moonshotai/Kimi-K3',
  'hf:zai-org/GLM-5.2',
  'hf:zai-org/GLM-4.7-Flash',
];

/**
 * Whole roster the judges are drawn from, translators included.
 */
const JUDGES: readonly SyntheticModelId[] = [
  ...TRANSLATORS,
  'hf:Qwen/Qwen3.8-27B',
  'hf:openai/gpt-oss-120b',
];

/**
 * Slice pair the lane settles.
 */
const SLICE: ChunkPair = {
  source: {
    chunkIndex: 1,
    nodes: [],
    startOffset: 0,
    endOffset: SOURCE_TEXT.length,
    text: SOURCE_TEXT,
  },
  target: {
    chunkIndex: 1,
    nodes: [],
    startOffset: 0,
    endOffset: INCUMBENT_TEXT.length,
    text: INCUMBENT_TEXT,
  },
};

/**
 * Finds where a run of digits ends.
 *
 * @param text - sheet being read
 *
 * @param from - offset the digits start at
 *
 * @returns Offset of first character that is not a digit
 *
 * @example
 * ```ts
 * const end = firstNonDigit({ text: sheet, from: 12, },);
 * ```
 */
function firstNonDigit(
  { text, from, }: { readonly text: string; readonly from: number; },
): number {
  for (let cursor = from; cursor < text.length; cursor += 1) {
    /**
     * Character under the cursor.
     */
    const character = text.charAt(cursor,);
    if ((character < '0') || (character > '9'))
      return cursor;
  }
  return text.length;
}

/**
 * Reads which numbered candidate on a sheet carries some wording.
 *
 * JUDGES VOTE BY POSITION AND THE SLATE IS ROTATED PER SLICE, so a fixture that
 * always answered 1 would be voting for whichever candidate the rotation
 * happened to put there. This finds the candidate by its text instead, which is
 * what a judge does.
 *
 * @param sheet - whole sheet one judge received
 *
 * @param sentinel - wording only one candidate carries
 *
 * @returns Candidate number, or {@link DECLINE} when no candidate carries it
 *
 * @throws When a candidate heading is not followed by its number, which means
 * the sheet no longer numbers candidates the way this fixture reads them
 *
 * @example
 * ```ts
 * const best = candidateNumberCarrying({ sheet, sentinel: FRESH_SENTINEL, },);
 * ```
 */
function candidateNumberCarrying(
  { sheet, sentinel, }: { readonly sheet: string; readonly sentinel: string; },
): number {
  /**
   * Where the wording appears.
   */
  const at = sheet.indexOf(sentinel,);
  if (at === (-1))
    return DECLINE;

  /**
   * Heading opening the candidate that carries it.
   */
  const marker = sheet.lastIndexOf(CANDIDATE_MARKER, at,);
  if (marker === (-1))
    return DECLINE;

  /**
   * Where its number starts.
   */
  const start = marker + CANDIDATE_MARKER.length;

  /**
   * Number as the sheet spells it.
   */
  const digits = sheet.slice(start, firstNonDigit({ text: sheet, from: start, },),);
  if (digits === '')
    throw new Error(`candidate heading at ${String(marker,)} carries no number`,);
  return Number(digits,);
}

/**
 * Builds a client whose translators all return one rendering and whose judges
 * all choose it.
 *
 * EVERY TRANSLATOR RETURNS THE SAME TEXT on purpose. The slate then holds
 * exactly two candidates, the archive's and the fresh one, which is the
 * comparison the guard sits in front of.
 *
 * @param rendering - translation every translator proposes
 *
 * @returns Client answering both roles
 *
 * @example
 * ```ts
 * const client = judgingClient({ rendering: DROPS_THE_ALIAS, },);
 * ```
 */
function judgingClient({ rendering, }: { readonly rendering: string; },): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused by the translate lane',);
    },
    quotas: async () => {
      throw new Error('quotas unused by the translate lane',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      /**
       * Whole sheet this role received, in call order.
       */
      const content = request.messages
        .map(function toContent(message,) {
          return messageText({ message, },);
        },)
        .join('\n',);

      /**
       * Schema the caller asked for, which names the role.
       */
      const schema = request.responseFormat
        ?.json_schema
        .name;

      /**
       * Answer this role gives.
       */
      const reply: unknown = (schema === TRANSLATE_SCHEMA)
        ? { translation: rendering, }
        : {
          best: candidateNumberCarrying({ sheet: content, sentinel: FRESH_SENTINEL, },),
          reason: 'fixture',
        };
      if (!request.validate(reply,)) {
        return {
          kind: 'schema-mismatch',
          rawText: JSON.stringify(reply,),
          detail: 'reply failed the wire guard',
        };
      }
      return {
        kind: 'ok',
        value: reply,
        rawText: JSON.stringify(reply,),
      };
    },
  };
}

/**
 * Settles the slice once with one rendering and one declared-name list.
 *
 * @param rendering - translation every translator proposes and every judge
 * chooses
 *
 * @param declaredNames - forms preparation found in the front matter
 *
 * @returns Record the lane settled on
 *
 * @example
 * ```ts
 * const record = await settleWith({ rendering: DROPS_THE_ALIAS, declaredNames: DECLARED_NAMES, },);
 * ```
 */
async function settleWith(
  { rendering, declaredNames, }: {
    readonly rendering: string;
    readonly declaredNames: readonly string[];
  },
): Promise<TranslateSliceRecord> {
  /**
   * Preparation the slice belongs to.
   */
  const prepared: PreparedDocumentPair = {
    sourceText: SOURCE_TEXT,
    targetText: INCUMBENT_TEXT,
    slices: [SLICE,],
    lineStructuredSliceIndices: new Set<number>(),
    declaredNames,
    alignmentFindings: [],
    alignmentPairCount: 1,
  };

  return await settleTranslateSlice({
    client: judgingClient({ rendering, },),
    slice: SLICE,
    prepared,
    models: {
      translatorModelIds: TRANSLATORS,
      judgeModelIds: JUDGES,
    },
    signal: AbortSignal.timeout(30_000,),
    perCallTimeoutMs: 5_000,
    l,
  },);
}

await describe({
  name: 'translate declared-name survival',
  children: [
    it({
      name: 'POSITIVE CONTROL: ACCEPTS a replacement that keeps every declared form, so a later '
        + 'assertion that some settlement kept the archive text is reading a guard rather than a '
        + 'harness whose judges never chose anything',
      fn: async () => {
        const record = await settleWith({
          rendering: KEEPS_EVERY_NAME,
          declaredNames: DECLARED_NAMES,
        },);
        expect(record.disposition,).toBe('stage-result',);
        expect(record.outputText,).toBe(KEEPS_EVERY_NAME,);
        expect(record.changed,).toBe(true,);
      },
    },),
    it({
      name: 'REFUSES a replacement that drops a declared form, keeping the archive text and naming '
        + 'what was lost, which is the decision no judge on the roster made unaided',
      fn: async () => {
        const record = await settleWith({
          rendering: DROPS_THE_ALIAS,
          declaredNames: DECLARED_NAMES,
        },);
        expect(record.disposition,).toBe('refused-declared-name',);
        expect(record.outputText,).toBe(INCUMBENT_TEXT,);
        expect(record.changed,).toBe(false,);
        expect(record.droppedDeclaredNames,).toEqual([DECLARED_ALIAS,],);
      },
    },),
    it({
      name: 'ACCEPTS that same dropping replacement when the archive declares nothing, so the '
        + 'refusal is attributable to the declared list and not to anything else about that wording',
      fn: async () => {
        const record = await settleWith({
          rendering: DROPS_THE_ALIAS,
          declaredNames: [],
        },);
        expect(record.disposition,).toBe('stage-result',);
        expect(record.outputText,).toBe(DROPS_THE_ALIAS,);
      },
    },),
  ],
},);
