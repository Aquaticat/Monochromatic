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
 * Parses one canonical compact LF-terminated JSON object.
 *
 * @param text - complete machine stream
 *
 * @param context - assertion label
 *
 * @returns parsed object after exact framing and canonical encoding checks
 *
 * @example
 * ```ts
 * parseJsonObjectLine({ text: '{"ok":true}\n', context: 'sample' });
 * ```
 */
export function parseJsonObjectLine({
  text,
  context,
}: Readonly<{
  text: string;
  context: string;
}>,): Record<string, unknown> {
  if (!text.endsWith('\n',))
    throw new Error(`${context} expected terminal LF\n${text}`,);
  /** Complete compact JSON text without terminal LF. */
  const json = text.slice(0, -1,);
  if (json.includes('\n',) || json.includes('\r',))
    throw new Error(`${context} expected one compact JSON object\n${text}`,);
  /** Parsed unknown machine value. */
  const value: unknown = JSON.parse(json,);
  if (((typeof value) !== 'object') || (value === null) || Array.isArray(value,))
    throw new Error(`${context} expected one JSON object\n${text}`,);
  /** Parsed machine object behind shape guard. */
  const event = value as Record<string, unknown>;
  if (JSON.stringify(event,) !== json)
    throw new Error(`${context} expected canonical compact JSON encoding\n${text}`,);
  return event;
}

/**
 * Parses canonical compact LF-terminated JSONL objects.
 *
 * @param text - complete nonempty machine stream
 *
 * @param context - assertion label
 *
 * @returns parsed objects in wire order
 *
 * @example
 * ```ts
 * parseJsonObjectLines({ text: '{"sequence":0}\n{"sequence":1}\n', context: 'sample' });
 * ```
 */
export function parseJsonObjectLines({
  text,
  context,
}: Readonly<{
  text: string;
  context: string;
}>,): readonly Record<string, unknown>[] {
  if (!text.endsWith('\n',))
    throw new Error(`${context} expected terminal LF\n${text}`,);
  return text.slice(0, -1,)
    .split('\n',)
    .map(function parseLine(line, ordinal,) {
      return parseJsonObjectLine({
        text: `${line}\n`,
        context: `${context} line ${String(ordinal,)}`,
      },);
    },);
}

/**
 * Asserts one pure compact LF-terminated JSONL policy event.
 *
 * @param text - complete machine stream
 *
 * @param expectedCode - stable failure code
 *
 * @param context - assertion label
 *
 * @example
 * ```ts
 * assertJsonl({ text: '{"schemaVersion":1,"sequence":0,"type":"engine-failure","code":"x"}\n', expectedCode: 'x', context: 'sample' });
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
  /** Parsed canonical event objects. */
  const events = parseJsonObjectLines({ text, context, },);
  if (events.length !== 1)
    throw new Error(`${context} expected one event, got ${String(events.length,)}\n${text}`,);
  /** Sole event behind exact count guard. */
  const event = events[0] as Record<string, unknown>;
  if ((event.schemaVersion !== 1)
    || (event.sequence !== 0)
    || ((typeof event.type) !== 'string')
    || (event.code !== expectedCode))
    throw new Error(`${context} expected schema-one sequence-zero event code ${expectedCode}\n${text}`,);
}
