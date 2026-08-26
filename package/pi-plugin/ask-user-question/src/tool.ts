import type {
  AgentToolResult,
  ExtensionAPI,
  ExtensionContext,
  Theme,
  ToolDefinition,
} from '@earendil-works/pi-coding-agent';
import { Text, } from '@earendil-works/pi-tui';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignHostCapability, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import {
  type Static,
  Type,
  type TObject,
  type TString,
} from 'typebox';

import type { ExternalAnswerOutcome, } from './request-external-answer.ts';
import { visibleTerminalText, } from './terminal-text.ts';
import {
  type AskUserQuestionDetails,
  buildAnsweredResult,
  buildCancelledResult,
} from './tool-result.ts';

//region Constants

/**
 * Stable model-facing tool name.
 */
export const ASK_USER_QUESTION_TOOL_NAME = 'ask_user_question';

/**
 * One unrestricted model-authored question.
 */
const AskUserQuestionParameters: TObject<{ question: TString; }> = Type.Object({
  question: Type.String({
    description: 'Complete free-form question to show in the Pi transcript while waiting for the user answer.',
  }),
},);

//endregion Constants

//region Logger

/**
 * Tagged logger for ask-user tool boundary.
 */
const l = tagged({ tag: 'ask-user-question:tool', },);

//endregion Logger

//region Types

/**
 * Model input validated by ask-user tool schema.
 */
export type AskUserQuestionParameters = Static<typeof AskUserQuestionParameters>;

/**
 * Injected external-answer boundary.
 */
export type ExternalAnswerRequester = (
  options: {
    readonly cwd: string;
    readonly signal?: AbortSignal;
  },
) => Promise<ExternalAnswerOutcome>;

/**
 * Concrete tool definition returned to Pi host.
 */
type AskUserQuestionToolDefinition = ToolDefinition<
  typeof AskUserQuestionParameters,
  AskUserQuestionDetails
>;

//endregion Types

//region Error

/**
 * Reports ask-user invocation outside interactive TUI.
 *
 * @example
 * ```ts
 * new AskUserQuestionUnavailableError();
 * ```
 */
export class AskUserQuestionUnavailableError extends Error {
  /**
   * Creates noninteractive-mode diagnostic.
   */
  constructor() {
    super('ask_user_question requires interactive TUI mode.',);
    this.name = 'AskUserQuestionUnavailableError';
  }
}

//endregion Error

//region Registration

/**
 * Creates free-form blocking question tool.
 *
 * @param requestAnswer - external editor interaction boundary
 *
 * @returns concrete Pi tool definition
 */
function createAskUserQuestionTool(
  { requestAnswer, }: { readonly requestAnswer: ExternalAnswerRequester; },
): AskUserQuestionToolDefinition {
  return {
    name: ASK_USER_QUESTION_TOOL_NAME,
    label: 'Ask User Question',
    description: 'Ask the user one free-form question and block model execution until the user submits or cancels a multiline answer in the default editor.',
    promptSnippet: 'Ask the user one free-form question and wait for a multiline answer',
    promptGuidelines: [
      'Use ask_user_question when work requires a user decision or free-form information that cannot be measured from available evidence.',
      'Ask one complete question per ask_user_question call. The user can inspect the full Pi transcript while answering.',
      'Never request passwords, tokens, credentials, or other secrets through ask_user_question.',
    ],
    parameters: AskUserQuestionParameters,
    executionMode: 'sequential',
    execute:
    /**
     * Waits for external editor answer while Pi host remains interactive.
     *
     * @param _toolCallId - unused host tool-call identifier
     *
     * @param params - readonly model-authored question
     *
     * @param signal - host cancellation signal
     *
     * @param _onUpdate - unused progress callback
     *
     * @param ctx - host mode and working directory
     *
     * @returns answered or cancelled tool result
     *
     * @mutates ctx - external requester uses host cancellation and working directory capabilities
     */
      async function executeAskUserQuestion(
      _toolCallId: string,
      params: { readonly question: string; },
      // oxlint-disable-next-line no-restricted-syntax/no-nullish-union -- Pi ToolDefinition.execute dictates this positional signal before required callback and context parameters.
      signal: ForeignHostCapability<AbortSignal> | undefined,
      _onUpdate: unknown,
      ctx: ForeignHostCapability<ExtensionContext>,
    ): Promise<AgentToolResult<AskUserQuestionDetails>> {
      /**
       * UTF-8 question size logged without exposing model-authored content.
       */
      const questionBytes = Buffer.byteLength(
        params.question,
        'utf8',
      );
      l.info(`invoked in ${ctx.mode} mode with ${String(questionBytes,)} question bytes`,);
      if (ctx.mode !== 'tui')
        throw new AskUserQuestionUnavailableError();
      /**
       * External editor interaction while model remains blocked.
       */
      const outcome = await requestAnswer({
        cwd: ctx.cwd,
        ...(signal === undefined ? {} : { signal, }),
      },);
      if (outcome.status === 'cancelled')
        return buildCancelledResult();
      return buildAnsweredResult({ answer: outcome.answer, },);
    },
    /* oxlint-disable unicorn/consistent-function-scoping -- ToolDefinition.renderCall expects positional host arguments. */
    renderCall:
    /**
     * Renders complete question in transcript independently from expansion state.
     *
     * @param args - readonly model-authored question
     *
     * @param theme - Pi transcript theme capability
     *
     * @param _context - unused host render context
     *
     * @returns wrapped full-question component
     *
     * @mutates theme - theme methods can update Pi host styling caches
     */
      function renderAskUserQuestionCall(
      args: { readonly question: string; },
      theme: ForeignHostCapability<Theme>,
      _context: unknown,
    ) {
      /**
       * Complete question with terminal controls made visible instead of executable.
       */
      const question = visibleTerminalText({ text: args.question, },);
      return new Text(
        [
          theme.fg(
            'toolTitle',
            theme.bold('ask_user_question',),
          ),
          question,
        ].join('\n',),
        0,
        0,
      );
    },
    /* oxlint-enable unicorn/consistent-function-scoping */
  };
}

/**
 * Registers free-form blocking question tool.
 *
 * @param pi - Pi extension API
 *
 * @param requestAnswer - external-answer requester
 *
 * @example
 * ```ts
 * registerAskUserQuestionTool({ pi, requestAnswer });
 * ```
 */
export function registerAskUserQuestionTool(
  {
    pi,
    requestAnswer,
  }: {
    readonly pi: ExtensionAPI;
    readonly requestAnswer: ExternalAnswerRequester;
  },
): void {
  pi.registerTool(createAskUserQuestionTool({ requestAnswer, }),);
}

//endregion Registration
