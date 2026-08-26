import type { ExtensionAPI, } from '@earendil-works/pi-coding-agent';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { createRequestRegistry, } from './request-registry.ts';
import { requestExternalAnswer, } from './request-external-answer.ts';
import {
  type ExternalAnswerRequester,
  registerAskUserQuestionTool,
} from './tool.ts';

//region Logger

/**
 * Tagged logger for extension registration and shutdown.
 */
const l = tagged({ tag: 'ask-user-question:index', },);

//endregion Logger

//region Registration

/**
 * Registers ask-user tool with session-scoped external-request cleanup.
 *
 * @param pi - host extension API
 *
 * @param requestAnswer - optional test requester
 *
 * @example
 * ```ts
 * registerAskUserQuestionExtension({ pi });
 * ```
 */
export function registerAskUserQuestionExtension(
  {
    pi,
    requestAnswer,
  }: {
    readonly pi: ExtensionAPI;
    readonly requestAnswer?: ExternalAnswerRequester;
  },
): void {
  /**
   * Controllers for external helpers active in current extension session.
   */
  const registry = createRequestRegistry();
  /**
   * Production requester or test boundary override.
   */
  const requester: ExternalAnswerRequester = requestAnswer
    ?? (function requestThroughDefaultTerminal({
      cwd,
      signal,
    },): ReturnType<ExternalAnswerRequester> {
      return requestExternalAnswer({
        cwd,
        registry,
        ...(signal === undefined ? {} : { signal, }),
      },);
    });
  registerAskUserQuestionTool({
    pi,
    requestAnswer: requester,
  },);
  pi.on(
    'session_shutdown',
    function abortPendingAnswers(): void {
      l.info('aborting pending answer helpers for session shutdown',);
      registry.abortAll();
    },
  );
}

/**
 * Pi extension entry point.
 *
 * @param pi - host extension API
 *
 * @example
 * ```ts
 * askUserQuestionExtension(pi);
 * ```
 */
export default function askUserQuestionExtension(pi: ExtensionAPI,): void {
  registerAskUserQuestionExtension({ pi, },);
}

//endregion Registration

export {
  createAnswerChannel,
  type AnswerChannel,
} from './answer-channel.ts';
export {
  isBlankAnswer,
  normalizeEditorAnswer,
} from './answer-text.ts';
export {
  resolveEditorCommand,
  EditorCommandError,
  type EditorEnvironment,
} from './editor-command.ts';
export {
  readHelperRequest,
  type HelperRequest,
} from './helper-request.ts';
export {
  type HelperCompletion,
  HelperProtocolError,
  parseHelperCompletion,
  serializeHelperCompletion,
} from './helper-protocol.ts';
export {
  requestExternalAnswer,
  type AnswerTerminalLauncher,
  type ExternalAnswerOutcome,
} from './request-external-answer.ts';
export {
  createRequestRegistry,
  type RequestRegistry,
} from './request-registry.ts';
export { visibleTerminalText, } from './terminal-text.ts';
export {
  ASK_USER_QUESTION_TOOL_NAME,
  AskUserQuestionUnavailableError,
  type AskUserQuestionParameters,
  type ExternalAnswerRequester,
} from './tool.ts';
export {
  buildAnsweredResult,
  buildCancelledResult,
  type AskUserQuestionDetails,
} from './tool-result.ts';
