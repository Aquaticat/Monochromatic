import {
  describe,
  expect,
  test,
} from 'bun:test';
import { exec, } from './exec.ts';

//region exec (direct)

describe('exec (direct)', () => {
  test('captures stdout from a successful command', async () => {
    /** Simple echo command to verify stdout capture */
    const result = await exec('echo', ['hello',],);
    expect(result.trim(),).toBe('hello',);
  });

  test('passes multiple arguments to the command', async () => {
    /** Multiple args should all be forwarded */
    const result = await exec('echo', ['hello', 'world',],);
    expect(result.trim(),).toBe('hello world',);
  });

  test('throws on non-zero exit code', async () => {
    /** `false` always exits with code 1 */
    await expect(exec('false',),).rejects.toThrow(
      'Command failed with exit code 1: false',
    );
  });

  test('includes stderr in the error message', async () => {
    /** Command that writes to stderr and fails */
    await expect(
      exec('sh', ['-c', 'echo error-msg >&2; exit 1',],),
    )
      .rejects
      .toThrow('error-msg',);
  });

  test('handles command with no arguments', async () => {
    /** `true` exits successfully with no output */
    const result = await exec('true',);
    expect(result,).toBe('',);
  });

  test('preserves newlines in stdout', async () => {
    /** printf outputs exact bytes without a trailing newline */
    const result = await exec('printf', [String.raw`line1\nline2\nline3`,],);
    expect(result,).toBe('line1\nline2\nline3',);
  });

  test('handles large stdout output', async () => {
    /** Generate 1000 lines of output */
    const result = await exec('seq', ['1', '1000',],);
    /** Should have 1000 lines (seq output ends with newline) */
    const lineCount = 1_000;
    expect(result.trim().split('\n',).length,).toBe(lineCount,);
  });
});

//endregion exec (direct)

//region exec (platform-aware)

describe('exec (platform-aware)', () => {
  test('executes the command of the first matching predicate', async () => {
    /** First entry predicate succeeds, so its command runs */
    const result = await exec([
      [['true',], ['echo', 'first',],],
      [['true',], ['echo', 'second',],],
    ],);
    expect(result.trim(),).toBe('first',);
  });

  test('skips entries whose predicate fails', async () => {
    /** First predicate fails, second succeeds */
    const result = await exec([
      [['false',], ['echo', 'skipped',],],
      [['true',], ['echo', 'matched',],],
    ],);
    expect(result.trim(),).toBe('matched',);
  });

  test('supports command with no arguments', async () => {
    /** Command as single-element array */
    const result = await exec([
      [['true',], ['true',],],
    ],);
    expect(result,).toBe('',);
  });

  test('supports predicate with arguments', async () => {
    /** Predicate with multiple args */
    const result = await exec([
      [['ls', '/dev/null',], ['echo', 'found',],],
    ],);
    expect(result.trim(),).toBe('found',);
  });

  test('throws PlatformMatchError when no predicate matches', async () => {
    /** All predicates fail */
    await expect(
      exec([
        [['false',], ['echo', 'a',],],
        [['false',], ['echo', 'b',],],
      ],),
    )
      .rejects
      .toThrow('No platform predicate matched',);
  });

  test('error message includes tested predicates', async () => {
    /** Verify predicate names appear in the error for debuggability */
    await expect(
      exec([
        [['nonexistent-check-1',], ['echo', 'a',],],
        [['nonexistent-check-2', '--flag',], ['echo', 'b',],],
      ],),
    )
      .rejects
      .toThrow('nonexistent-check-1',);
  });

  test('throws when matched command fails', async () => {
    /** Predicate matches but the command itself exits non-zero */
    await expect(
      exec([
        [['true',], ['false',],],
      ],),
    )
      .rejects
      .toThrow('Command failed',);
  });

  test('supports nested PlatformCommands as command value', async () => {
    /** Outer predicate matches, inner dispatch selects the actual command */
    const innerCommands = [
      [['false',], ['echo', 'inner-skipped',],],
      [['true',], ['echo', 'inner-matched',],],
    ] as const;
    const result = await exec([
      [['true',], innerCommands,],
    ],);
    expect(result.trim(),).toBe('inner-matched',);
  });

  test('nested PlatformCommands throws when no inner predicate matches', async () => {
    /** Outer matches but all inner predicates fail */
    const innerCommands = [
      [['false',], ['echo', 'unreachable',],],
    ] as const;
    await expect(
      exec([
        [['true',], innerCommands,],
      ],),
    )
      .rejects
      .toThrow('No platform predicate matched',);
  });
});

//endregion exec (platform-aware)
