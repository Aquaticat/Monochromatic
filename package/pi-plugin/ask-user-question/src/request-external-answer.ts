import { fileURLToPath, } from 'node:url';

import { launchTerminal, } from '@monochromatic-dev/cli-terminal-exec/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { createAnswerChannel, } from './answer-channel.ts';
import {
  createAnswerWorkspace,
  readWorkspaceAnswer,
  writeHelperRequest,
} from './answer-workspace.ts';
import {
  isBlankAnswer,
  normalizeEditorAnswer,
} from './answer-text.ts';
import type { RequestRegistry, } from './request-registry.ts';

//region Constants

/**
 * Stable helper bundle emitted next to extension entry.
 */
const ANSWER_HELPER_FILENAME = 'answer-helper.mjs';

/**
 * Terminal title documents save-and-exit submission gesture.
 */
const ANSWER_TERMINAL_TITLE = 'Pi answer: save and exit to submit (:wq)';

//endregion Constants

//region Logger

/**
 * Tagged logger for detached answer request lifecycle.
 */
const l = tagged({ tag: 'ask-user-question:request-external-answer', },);

//endregion Logger

//region Types

/**
 * Result returned from external answer interaction.
 */
export type ExternalAnswerOutcome =
  | {
    readonly status: 'answered';
    readonly answer: string
  }
  | { readonly status: 'cancelled'; };

/**
 * Terminal launcher shape injected by tests.
 */
export type AnswerTerminalLauncher = (
  options: {
    readonly dir: string;
    readonly command: readonly string[];
    readonly title: string;
  },
) => Promise<void>;

//endregion Types

//region Request

/**
 * Launches default terminal and awaits editor completion through private channel.
 *
 * @param cwd - Pi working directory for launched terminal
 *
 * @param signal - tool cancellation signal
 *
 * @param registry - session-scoped request cleanup registry
 *
 * @param launch - injectable terminal launcher
 *
 * @returns normalized answer or cancellation
 *
 * @throws when terminal,
 * helper,
 * channel,
 * or editor reports operational failure
 *
 * @example
 * ```ts
 * await requestExternalAnswer({ cwd: '/project', registry, launch: launchTerminal });
 * ```
 */
export async function requestExternalAnswer(
  {
    cwd,
    signal,
    registry,
    launch = launchTerminal,
  }: {
    readonly cwd: string;
    readonly signal?: AbortSignal;
    readonly registry: RequestRegistry;
    readonly launch?: AnswerTerminalLauncher;
  },
): Promise<ExternalAnswerOutcome> {
  /**
   * Session-scoped cancellation handle for pending helper.
   */
  using request = registry.open();
  /**
   * Tool abort and session-shutdown abort combined for one request.
   */
  const requestSignal = signal === undefined
    ? request.signal
    : AbortSignal.any([
      signal,
      request.signal,
    ],);
  /**
   * Private answer and coordination files.
   */
  await using workspace = await createAnswerWorkspace();
  /**
   * Authenticated one-shot helper return channel.
   */
  await using channel = await createAnswerChannel();
  await writeHelperRequest({
    workspace,
    request: {
      host: channel.host,
      port: channel.port,
      token: channel.token,
      answerPath: workspace.answerPath,
    },
  },);
  /**
   * Built helper path relative to installed extension bundle.
   */
  const helperPath = fileURLToPath(new URL(
    ANSWER_HELPER_FILENAME,
    import.meta.url,
  ),);
  /**
   * Wait begins before detached launch to avoid missing fast helper connection.
   */
  const completionTask = channel.wait({ signal: requestSignal, },);
  try {
    await launch({
      dir: cwd,
      title: ANSWER_TERMINAL_TITLE,
      command: [
        process.execPath,
        helperPath,
        '--request',
        workspace.requestPath,
      ],
    },);
  }
  catch (error: unknown) {
    request.abort();
    try {
      await completionTask;
    }
    catch (completionError: unknown) {
      l.debug(`answer channel stopped after launch failure: ${String(completionError,)}`,);
    }
    l.error(`answer terminal launch failed: ${String(error,)}`,);
    throw error;
  }
  /**
   * Helper completion while model tool remains blocked.
   */
  const completion = await completionTask;
  if (completion.status === 'cancelled') {
    l.info('answer helper cancelled',);
    return { status: 'cancelled', };
  }
  if (completion.status === 'error')
    throw new Error(`Answer helper failed: ${completion.message}`,);
  /**
   * Raw editor file after successful attached editor exit.
   */
  const rawAnswer = await readWorkspaceAnswer({ workspace, },);
  /**
   * Answer with one editor-added final line ending removed.
   */
  const answer = normalizeEditorAnswer({ text: rawAnswer, },);
  if (isBlankAnswer({ text: answer, })) {
    l.info('answer helper submitted blank content as cancellation',);
    return { status: 'cancelled', };
  }
  l.info(`answer helper submitted ${String(Buffer.byteLength(
    answer,
    'utf8',
  ),)} UTF-8 bytes`,);
  return {
    status: 'answered',
    answer,
  };
}

//endregion Request
