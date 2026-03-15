import {
  describe,
  expect,
  test,
} from 'bun:test';
import { exec, } from './exec.ts';

//region exec

describe('exec', () => {
  test('captures stdout from a successful command', async () => {
    expect.assertions(1,);
    /** Simple echo command to verify stdout capture */
    const result = await exec('echo', ['hello',],);
    expect(result.trim(),).toBe('hello',);
  });

  test('passes multiple arguments to the command', async () => {
    expect.assertions(1,);
    /** Multiple args should all be forwarded */
    const result = await exec('echo', ['hello', 'world',],);
    expect(result.trim(),).toBe('hello world',);
  });

  test('throws on non-zero exit code', async () => {
    expect.assertions(1,);
    /** `false` always exits with code 1 */
    await expect(exec('false',),).rejects.toThrow(
      'Command failed with exit code 1: false',
    );
  });

  test('includes stderr in the error message', async () => {
    expect.assertions(1,);
    /** Command that writes to stderr and fails */
    await expect(
      exec('sh', ['-c', 'echo error-msg >&2; exit 1',],),
    )
      .rejects
      .toThrow('error-msg',);
  });

  test('handles command with no arguments', async () => {
    expect.assertions(1,);
    /** `true` exits successfully with no output */
    const result = await exec('true',);
    expect(result,).toBe('',);
  });

  test('preserves newlines in stdout', async () => {
    expect.assertions(1,);
    /** printf outputs exact bytes without a trailing newline */
    const result = await exec('printf', [String.raw`line1\nline2\nline3`,],);
    expect(result,).toBe('line1\nline2\nline3',);
  });

  test('handles large stdout output', async () => {
    expect.assertions(1,);
    /** Generate 1000 lines of output */
    const result = await exec('seq', ['1', '1000',],);
    /** Should have 1000 lines (seq output ends with newline) */
    const lineCount = 1_000;
    expect(result.trim().split('\n',).length,).toBe(lineCount,);
  });
});

//endregion exec
