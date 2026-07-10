/**
 * Helpers for packed shadow-bin trust verification. @module
 */
import { spawn, } from 'node:child_process';
import { once, } from 'node:events';
import { text as consumeText, } from 'node:stream/consumers';

/**
 * Captured command output.
 */
export type CommandResult = Readonly<{
  /**
   * Standard output text.
   */
  stdout: string;
  /**
   * Standard error text.
   */
  stderr: string;
}>;
/**
 * Runs one command and validates exact exit status.
 *
 * @param command - executable name or path
 *
 * @param args - exact argument vector
 *
 * @param expectedExit - required status or accepted race statuses
 *
 * @param cwd - optional working directory
 *
 * @param env - optional complete environment
 *
 * @param input - optional exact standard input
 *
 * @returns captured standard streams
 *
 * @example
 * ```ts
 * await execute({ command: 'git', args: ['status'] });
 * ```
 */
export async function execute({
  command,
  args,
  expectedExit = 0,
  cwd,
  env,
  input,
}: Readonly<{
  command: string;
  args: readonly string[];
  expectedExit?: number | readonly number[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string;
}>,): Promise<CommandResult> {
  /**
   * Child process with piped machine-readable streams.
   */
  const child = spawn(
    command,
    [...args,],
    {
    cwd,
    env,
    stdio: [
      input === undefined ? 'ignore' : 'pipe',
      'pipe',
      'pipe',
    ],
  },
  );
  if (input !== undefined)
    child.stdin
      ?.end(input,);
  if ((child.stdout === null) || (child.stderr === null))
    throw new TypeError('Fixture command capture streams are unavailable.',);
  /**
   * Captured output streams narrowed after spawn configuration.
   */
  const {
    stdout: stdoutStream,
    stderr: stderrStream,
  } = child;
  /**
   * Stream collection started before waiting for process settlement.
   */
  const outputPromise = Promise.all([
    consumeText(stdoutStream,),
    consumeText(stderrStream,),
  ],);
  await once(
    child,
    'close',
  );
  /**
   * Fully consumed standard streams.
   */
  const [stdout, stderr,] = await outputPromise;
  /**
   * Allowed status set, including explicitly nondeterministic race outcomes.
   */
  const expectedExits = (typeof expectedExit) === 'number'
    ? [expectedExit,]
    : expectedExit;
  if (!expectedExits.includes(child.exitCode ?? (-1),)) {
    throw new Error(
      `${command} ${args.join(' ',)} expected ${expectedExits.join(' or ',)}, got ${String(child.exitCode,)}\nstdout=${stdout}\nstderr=${stderr}`,
    );
  }
  return {
    stdout,
    stderr,
  };
}

/**
 * Asserts expected text fragment.
 *
 * @param text - captured output
 *
 * @param expected - required fragment
 *
 * @param context - assertion label
 *
 * @example
 * ```ts
 * assertIncludes({ text: 'abc', expected: 'b', context: 'sample' });
 * ```
 */
export function assertIncludes({
  text,
  expected,
  context,
}: Readonly<{
  text: string;
  expected: string;
  context: string;
}>,): void {
  if (!text.includes(expected,))
    throw new Error(`${context} missing ${expected}\n${text}`,);
}

/**
 * Asserts one pure JSONL engine-failure event.
 *
 * @param text - complete machine stream
 *
 * @param expectedCode - stable failure code
 *
 * @param context - assertion label
 *
 * @example
 * ```ts
 * assertJsonl({ text: '{"code":"x"}', expectedCode: 'x', context: 'sample' });
 * ```
 */
export function assertJsonl({
  text,
  expectedCode,
  context,
}: Readonly<{
  text: string;
  expectedCode: string;
  context: string;
}>,): void {
  /**
   * Nonempty machine output lines.
   */
  const lines = text.trim()
    .split('\n',);
  if (lines.length !== 1)
    throw new Error(`${context} expected one JSONL event, got ${String(lines.length,)}\n${text}`,);
  /**
   * Parsed event retained behind runtime checks.
   */
  const event: unknown = JSON.parse(lines[0] ?? '',);
  if (((typeof event) !== 'object') || (event === null)
    || (!('code' in event))
    || (event.code !== expectedCode))
    throw new Error(`${context} expected event code ${expectedCode}\n${text}`,);
}
