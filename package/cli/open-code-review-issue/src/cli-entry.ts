/**
 * CLI invocation error mapping and logger lifecycle.
 *
 * @module
 */

import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import {
  logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';

import {
  CliInvocationError,
  parseCliArguments,
} from './cli-args.ts';
import {
  HELP_TEXT,
  writeCancellation,
} from './cli-output.ts';
import { isPromptCancellation, } from './interactive-prompts.ts';
import {
  executeRun,
  type CliStreams,
} from './run-cli.ts';

/**
 * Successful or clean-cancellation exit status.
 */
const EXIT_SUCCESS = 0;

/**
 * Handled runtime or publication failure status.
 */
const EXIT_RUNTIME_FAILURE = 1;

/**
 * Invocation misuse exit status.
 */
const EXIT_INVOCATION_MISUSE = 2;

/**
 * Tagged entry logger; messages never include finding content or paths.
 */
const l = tagged({ tag: 'cli-entry', },);

/**
 * Runs adapter command and maps every handled outcome to compact exit status.
 *
 * @param arguments - CLI tokens excluding executable and script paths.
 *
 * @param cwd - Process working directory.
 *
 * @param streams - Process standard streams.
 *
 * @returns Settled exit status without terminating host process.
 *
 * @example
 * ```ts
 * const status = await runCli({ arguments: ['--help'], cwd: process.cwd(), streams });
 * ```
 */
export async function runCli({
  arguments: arguments_,
  cwd,
  streams,
}: {
  readonly arguments: readonly string[];
  readonly cwd: string;
  readonly streams: CliStreams;
},): Promise<number> {
  /**
   * Async cleanup that flushes logger on every return or throw path.
   */
  await using loggerCleanup = {
    async [Symbol.asyncDispose](): Promise<void> {
      await logger.flush();
    },
  };
  try {
    l.debug('parsing invocation',);
    /**
     * Validated help or run command.
     */
    const command = parseCliArguments({ arguments: arguments_, });
    if (command.kind === 'help') {
      streams.stdout
        .write(`${HELP_TEXT}\n`,);
      return EXIT_SUCCESS;
    }
    return await executeRun({
      command,
      cwd,
      streams,
    });
  }
  catch (error: unknown) {
    if (isPromptCancellation(error,)) {
      writeCancellation(streams.stdout,);
      return EXIT_SUCCESS;
    }
    /**
     * Safe handled error message; implementations never include finding content.
     */
    const message = caughtValueText(error,);
    l.error(message,);
    streams.stderr
      .write(`${message}\n`,);
    return error instanceof CliInvocationError
      ? EXIT_INVOCATION_MISUSE
      : EXIT_RUNTIME_FAILURE;
  }
}
