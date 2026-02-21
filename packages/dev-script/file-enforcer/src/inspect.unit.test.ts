import {
  afterEach,
  describe,
  expect,
  spyOn,
  test,
} from 'bun:test';
import { inspect, } from './inspect.ts';

//region inspect

describe('inspect', () => {
  /** Spy on console.log to verify inspect output */
  const logSpy = spyOn(console, 'log');

  afterEach(() => {
    logSpy.mockClear();
  });

  test('returns a string unchanged', () => {
    expect.assertions(1);
    expect(inspect('hello world')).toBe('hello world');
  });

  test('returns a number unchanged', () => {
    expect.assertions(1);
    /** Numeric input should pass through with its type preserved */
    const result = inspect(42);
    expect(result).toBe(42);
  });

  test('returns an array unchanged', () => {
    expect.assertions(1);
    /** Array input should be returned by reference */
    const arr = [1, 2, 3];
    expect(inspect(arr)).toBe(arr);
  });

  test('returns an object unchanged', () => {
    expect.assertions(1);
    /** Object input should be returned by reference */
    const obj = { key: 'value', };
    expect(inspect(obj)).toBe(obj);
  });

  test('returns boolean unchanged', () => {
    expect.assertions(1);
    expect(inspect(true)).toBe(true);
  });

  test('returns null unchanged', () => {
    expect.assertions(1);
    expect(inspect(null)).toBeNull();
  });

  test('logs string content directly', () => {
    expect.assertions(1);
    inspect('test-content');
    expect(logSpy).toHaveBeenCalledWith(
      '[file-enforcer] inspect: test-content',
    );
  });

  test('logs non-string content as JSON', () => {
    expect.assertions(1);
    inspect({ a: 1, });
    /** Non-string values should be JSON-stringified in the log */
    const loggedMessage = logSpy.mock.calls[0]?.[0] as string;
    expect(loggedMessage).toContain('"a": 1');
  });

  test('truncates long string content in log output', () => {
    expect.assertions(2);
    /** Content longer than the 200-char preview limit */
    const longContent = 'x'.repeat(300);
    /** Return value should still be the full content */
    const result = inspect(longContent);
    expect(result).toBe(longContent);
    /** Logged preview should be truncated with ellipsis */
    const loggedMessage = logSpy.mock.calls[0]?.[0] as string;
    expect(loggedMessage).toContain('...');
  });

  test('does not truncate content exactly at preview limit', () => {
    expect.assertions(1);
    /** Content exactly at the 200-char boundary */
    const exactContent = 'y'.repeat(200);
    inspect(exactContent);
    /** Should not contain ellipsis since it's not over the limit */
    const loggedMessage = logSpy.mock.calls[0]?.[0] as string;
    expect(loggedMessage).not.toContain('...');
  });

  test('handles empty string', () => {
    expect.assertions(2);
    expect(inspect('')).toBe('');
    expect(logSpy).toHaveBeenCalledWith('[file-enforcer] inspect: ');
  });

  test('handles GlobResult-like array', () => {
    expect.assertions(1);
    /** Simulates the shape returned by cat(string) */
    const globResults = [
      { path: '/a.ts', content: 'code', },
      { path: '/b.ts', content: 'more', },
    ];
    /** Should return the same array by reference */
    expect(inspect(globResults)).toBe(globResults);
  });

  test('truncates large JSON objects in log output', () => {
    expect.assertions(1);
    /** Large object whose JSON is over the preview limit */
    const largeObj = Object.fromEntries(
      Array.from({ length: 50, }, (_, idx) => [`key${String(idx)}`, 'x'.repeat(20)]),
    );
    inspect(largeObj);
    const loggedMessage = logSpy.mock.calls[0]?.[0] as string;
    expect(loggedMessage).toContain('...');
  });
});

//endregion inspect
