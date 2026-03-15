import {
  describe,
  expect,
  test,
} from 'bun:test';

/** Prefix emitted by the tagged logger on info-level lines */
const LOG_PREFIX = '[info]';

/**
 * Filters out logger `[info]` lines from raw stdout,
 * returning only the application output.
 *
 * @param raw - Raw stdout string including logger lines
 * @returns Lines that are not logger output, joined with newlines
 *
 * @example
 * ```ts
 * stripLogLines({ raw: '[info] ...debug\n/tmp/test\n' });
 * // => '/tmp/test'
 * ```
 */
function stripLogLines({ raw, }: { raw: string; },): string {
  return raw
    .split('\n',)
    .filter(function isNotLogLine(line,) {
      return !line.startsWith(LOG_PREFIX,);
    },)
    .join('\n',)
    .trim();
}

/**
 * Runs cli-fy as a subprocess and returns stdout (with log lines stripped),
 * raw stderr, and exit code.
 *
 * @param args - CLI arguments to pass after `cli-fy`
 * @returns Cleaned stdout text, raw stderr text, and numeric exit code
 *
 * @example
 * ```ts
 * const result = await runCliFy({ args: ['node:path', 'join', '/tmp', 'test'] });
 * // result.stdout === '/tmp/test'
 * ```
 */
async function runCliFy({ args, }: { args: readonly string[]; },): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  const proc = Bun.spawn(['bun', 'packages/cli/fy/src/index.ts', ...args,], {
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
  },);

  const [rawStdout, stderr,] = await Promise.all([
    new Response(proc.stdout,).text(),
    new Response(proc.stderr,).text(),
  ],);

  const exitCode = await proc.exited;
  return { exitCode, stderr, stdout: stripLogLines({ raw: rawStdout, },), };
}

describe('cli-fy integration', () => {
  //region Function calls -- calling exported functions with arguments

  test('calls node:path join with two arguments', async () => {
    const result = await runCliFy({ args: ['node:path', 'join', '/tmp', 'test',], },);
    expect(result.stdout.trim(),).toBe('/tmp/test',);
    expect(result.exitCode,).toBe(0,);
  });

  test('calls node:path basename with ext argument', async () => {
    const result = await runCliFy({
      args: ['node:path', 'basename', '/tmp/foo.txt', '.txt',],
    },);
    expect(result.stdout.trim(),).toBe('foo',);
    expect(result.exitCode,).toBe(0,);
  });

  test('coerces numeric arguments for arithmetic', async () => {
    const result = await runCliFy({ args: ['node:path', 'join', '/a', 'b',], },);
    expect(result.stdout.trim(),).toBe('/a/b',);
    expect(result.exitCode,).toBe(0,);
  });

  //endregion Function calls

  //region Non-function exports -- accessing values without calling

  test('prints non-function export value when no args given', async () => {
    const result = await runCliFy({ args: ['node:path', 'sep',], },);
    expect(result.stdout.trim(),).toBe('/',);
    expect(result.exitCode,).toBe(0,);
  });

  test('prints delimiter export value', async () => {
    const result = await runCliFy({ args: ['node:path', 'delimiter',], },);
    expect(result.stdout.trim(),).toBe(':',);
    expect(result.exitCode,).toBe(0,);
  });

  //endregion Non-function exports

  //region Default export -- accessing default export via "default" keyword

  test('prints default export value from a local fixture', async () => {
    const result = await runCliFy({
      args: ['./packages/cli/fy/src/fixtures/return1.ts', 'default',],
    },);
    expect(result.stdout,).toBe('1',);
    expect(result.exitCode,).toBe(0,);
  });

  test('calls default export function and prints its return value', async () => {
    const result = await runCliFy({
      args: ['./packages/cli/fy/src/fixtures/return1-fn.ts', 'default',],
    },);
    expect(result.stdout,).toBe('1',);
    expect(result.exitCode,).toBe(0,);
  });

  //endregion Default export

  //region Error cases -- non-existent exports, type mismatches, bad specifiers

  test('errors when export does not exist', async () => {
    const result = await runCliFy({ args: ['node:path', 'doesNotExist',], },);
    expect(result.exitCode,).not.toBe(0,);
    expect(result.stderr,).toContain('not found',);
    expect(result.stderr,).toContain('Available exports',);
  });

  test('errors when non-function export receives arguments', async () => {
    const result = await runCliFy({ args: ['node:path', 'sep', 'extraArg',], },);
    expect(result.exitCode,).not.toBe(0,);
    expect(result.stderr,).toContain('not a function',);
  });

  test('errors when specifier cannot be resolved', async () => {
    const result = await runCliFy({ args: ['nonexistent-pkg-99999', 'foo',], },);
    expect(result.exitCode,).not.toBe(0,);
    expect(result.stderr,).toContain('Cannot resolve',);
  });

  //endregion Error cases

  //region Help -- verifies --help output

  test('prints help with --help flag', async () => {
    const result = await runCliFy({ args: ['--help',], },);
    expect(result.stdout,).toContain('cli-fy',);
    expect(result.stdout,).toContain('SPECIFIER',);
    expect(result.stdout,).toContain('EXPORT',);
  });

  //endregion Help

  //region Missing arguments -- verifies parser errors

  test('errors when no arguments provided', async () => {
    const result = await runCliFy({ args: [], },);
    expect(result.exitCode,).not.toBe(0,);
  });

  test('errors when only specifier provided', async () => {
    const result = await runCliFy({ args: ['node:path',], },);
    expect(result.exitCode,).not.toBe(0,);
  });

  //endregion Missing arguments
});
