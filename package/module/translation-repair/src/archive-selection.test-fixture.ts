/**
 * Test-only archive review clients exercising real stage boundaries.
 */
import {
  type ChatJsonOutcome,
  type ChatJsonRequest,
  messageText,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/**
 * Source containing every fact the complete replacement preserves.
 */
export const ARCHIVE_TEST_SOURCE = '猫猫有柔软的毛，也很勇敢。';
/**
 * Original with one unintended spelling error.
 */
export const ARCHIVE_TEST_BLOCK = '> Cat has soft fur and is couragous.';
/**
 * Complete correction, not an excerpt.
 */
export const ARCHIVE_TEST_CORRECTION = '> Cat has soft fur and is courageous.';
/**
 * Incomplete proposal the selector must see as a competing proposal.
 */
export const ARCHIVE_TEST_PARTIAL = 'Cat.';
/**
 * Archive context already available to the review stage.
 */
export const ARCHIVE_TEST_PAGE: string = `Earlier archive context.\n\n${ARCHIVE_TEST_BLOCK}\n\nFollowing archive context.`;
/**
 * Eleven seats require six schema-valid review voices.
 */
export const ARCHIVE_TEST_ROSTER = [
  'hf:zai-org/GLM-5.3-Flash',
  'hf:Qwen/Qwen3.8-27B',
  'hf:moonshotai/Kimi-K3',
  'hf:openai/gpt-oss-120b',
  'minimax-m3',
  'gemma-4-26b-a4b-it',
  'deepseek-v4-pro-0813',
  'deepseek-v4-flash-0731',
  'glm-5.3',
  'google.gemma-4-e2b',
  'inception/mercury-2.5',
] as const;

/**
 * Review shapes vary evidence, never the configured quorum.
 */
export type ArchiveReviewFixtureMode = 'mixed' | 'retention-only' | 'unavailable' | 'all-anchored' | 'single' | 'echo';
/**
 * Selector can deliberately choose original or lose quorum.
 */
export type ArchiveSelectionFixtureMode = 'revision' | 'original' | 'unavailable';

/**
 * Locates an actual numbered candidate rather than assuming proposal order.
 *
 * @param text - selector's user message
 *
 * @param wanted - exact candidate value expected on its slate
 *
 * @returns One-based candidate number
 */
function candidateNumber({
  text,
  wanted,
}: {
  readonly text: string;
  readonly wanted: string
},): number {
  /**
   * Controlled fixtures contain no candidate-header text in their prose.
   */
  const match = text.split('CANDIDATE ',)
    .slice(1,)
    .find(function containsValue(part,) {
    return part.includes(`\n${wanted}\n`,);
  },);
  if (match === undefined)
    throw new Error('Expected candidate was not offered to the selector',);
  return Number(match.slice(
    0,
    match.indexOf('\n',),
  ),);
}

/**
 * Builds schema-valid review replies and captures the real selection message.
 *
 * @param review - anchor and revision mixture
 *
 * @param selection - selector result independent of review replies
 *
 * @returns Scripted client and observable selector inputs
 *
 * @example
 * ```ts
 * const fixture = archiveSelectionFixture({ review: 'mixed' });
 * ```
 */
export function archiveSelectionFixture(
  {
    review = 'mixed',
    selection = 'revision',
  }: {
    readonly review?: ArchiveReviewFixtureMode;
    readonly selection?: ArchiveSelectionFixtureMode;
  },
): {
  readonly client: SyntheticClient;
  readonly selections: readonly string[];
  readonly reviews: () => number
} {
  /**
   * First-window review callbacks, with all seven schema-valid replies delivered.
   */
  const reviewRequests: string[] = [];
  /**
   * One entry for every selector request, containing no system instructions.
   */
  const selections: string[] = [];
  /**
   * Source-supported replies whose literal anchor is present.
   */
  const retained = {
    disposition: 'source-supported',
    sourceQuote: ARCHIVE_TEST_SOURCE,
    replacementText: '',
    finding: 'Valid retention opinion.',
  };
  /**
   * Invalid retention evidence remains in audit findings, not selector authority.
   */
  const unanchored = {
    ...retained,
    sourceQuote: 'This is not in the source.',
    finding: 'Unanchored retention opinion.',
  };
  /**
   * Both complete and incomplete schema-valid revisions require independent selection.
   */
  const corrected = {
    disposition: 'revise',
    sourceQuote: '',
    replacementText: ARCHIVE_TEST_CORRECTION,
    finding: 'Correct the spelling without changing meaning.',
  };
  /**
   * Incomplete value tests that independent selection receives the actual proposal.
   */
  const partial = {
    ...corrected,
    replacementText: ARCHIVE_TEST_PARTIAL,
    finding: 'A competing partial proposal.',
  };
  /**
   * Fixed review shapes make the guard independent of prompt-rotated model order.
   */
  const replies = review === 'retention-only'
    ? [
      retained,
      retained,
      unanchored,
      unanchored,
      unanchored,
      unanchored,
      unanchored,
    ]
    : review === 'all-anchored'
      ? [
        retained,
        retained,
        retained,
        retained,
        retained,
        corrected,
        partial,
      ]
      : review === 'single'
        ? [
          retained,
          unanchored,
          unanchored,
          unanchored,
          unanchored,
          unanchored,
          corrected,
        ]
        : [
          retained,
          retained,
          unanchored,
          unanchored,
          unanchored,
          corrected,
          partial,
        ];
  /**
   * Synchronous fixture logic, adapted to the provider's asynchronous interface.
   *
   * @param request - actual production role and schema
   * @returns Scripted schema-valid outcome or explicit unavailable voice
   */
  function respond<ValueT,>(request: ChatJsonRequest<ValueT>,): ChatJsonOutcome<ValueT> {
      /**
       * Role is identified by the actual production schema, not call order.
       */
      const schema = request.responseFormat
        ?.json_schema
        .name;
      if (schema === 'archive_block_review') {
        /**
         * First-window position, independent of the prompt-rotated model identity.
         */
        const index = reviewRequests.length;
        reviewRequests.push(request.modelId,);
        if ((review === 'unavailable') && (index > 0))
          return {
            kind: 'schema-mismatch',
            rawText: '{}',
            detail: 'Review quorum unavailable in fixture',
          };
        /**
         * Echoes remain actual revision replies but do not change the block.
         */
        const value: unknown = review === 'unavailable' ? corrected : review === 'echo'
          ? { ...corrected, replacementText: ARCHIVE_TEST_BLOCK, }
          : replies[index];
        if (!request.validate(value,))
          throw new Error('Unexpected review call or invalid fixture reply',);
        return {
          kind: 'ok',
          value,
          rawText: JSON.stringify(value,),
        };
      }
      if (schema !== 'candidate_ballot')
        throw new Error(`Unexpected schema ${String(schema,)}`,);
      /**
       * Actual candidate/evidence data used to identify the intended choice.
       */
      const text = request.messages
        .filter(function user(message,) {
        return message.role === 'user';
      },)
        .map(function content(message,) {
        return messageText({ message, },);
      },)
        .join('\n',);
      selections.push(text,);
      if (selection === 'unavailable')
        return {
          kind: 'schema-mismatch',
          rawText: '{}',
          detail: 'Selector quorum unavailable in fixture',
        };
      /**
       * Decision binds to the candidate's content rather than assumed order.
       */
      const value: unknown = {
        best: candidateNumber({
          text,
          wanted: selection === 'original' ? ARCHIVE_TEST_BLOCK : ARCHIVE_TEST_CORRECTION,
        },),
        reason: 'Fixture selects the exact intended block.',
      };
      if (!request.validate(value,))
        throw new Error('Invalid fixture selector reply',);
      return {
        kind: 'ok',
        value,
        rawText: JSON.stringify(value,),
      };
  }
  /**
   * No external provider is reachable through this fixture.
   */
  const client: SyntheticClient = {
    /**
     * Text-only calls are outside this scripted protocol.
     */
    chatText: function unexpectedText(): never {
      throw new Error('Unexpected text call',);
    },
    /**
     * Fixtures cannot query live provider resources.
     */
    quotas: function unexpectedQuotas(): never {
      throw new Error('Unexpected quota read',);
    },
    /**
     * Adapts deterministic reply construction to the provider interface.
     */
    chatJson: function chatJson<ValueT,>(request: ChatJsonRequest<ValueT>,): Promise<ChatJsonOutcome<ValueT>> {
      return Promise.resolve(respond(request,),);
    },
  };
  return {
    client,
    selections,
    /**
     * Read-only view of how many review calls the stage made.
     */
    reviews: function reviews(): number {
      return reviewRequests.length;
    },
  };
}
