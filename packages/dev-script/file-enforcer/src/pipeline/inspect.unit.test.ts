import {
  afterEach,
  describe,
  expect,
  spyOn,
  test,
} from 'bun:test';
import { l, } from '../log.ts';
import { inspect, } from './inspect.ts';

//region inspect

describe('inspect', () => {
  /** Spy on l.info to verify inspect output -- tagged wrapper calls through l */
  const infoSpy = spyOn(l, 'info',);

  afterEach(() => {
    infoSpy.mockClear();
  },);

  test('returns a string unchanged', () => {
    expect(inspect('hello world',),).toBe('hello world',);
  });

  test('returns a number unchanged', () => {
    /** Numeric input should pass through with its type preserved */
    const result = inspect(42,);
    expect(result,).toBe(42,);
  });

  test('returns an array unchanged', () => {
    /** Array input should be returned by reference */
    const arr = [1, 2, 3,];
    expect(inspect(arr,),).toBe(arr,);
  });

  test('returns an object unchanged', () => {
    /** Object input should be returned by reference */
    const obj = { key: 'value', };
    expect(inspect(obj,),).toBe(obj,);
  });

  test('returns boolean unchanged', () => {
    expect(inspect(true,),).toBe(true,);
  });

  test('returns null unchanged', () => {
    expect(inspect(null,),).toBeNull();
  });

  test('logs string content via tagged logger', () => {
    inspect('test-content',);
    expect(infoSpy,).toHaveBeenCalledWith(
      expect.stringContaining('test-content',),
    );
  });

  test('logs non-string content as JSON', () => {
    inspect({ a: 1, },);
    /** Non-string values should be JSON-stringified in the log */
    const loggedMessage = infoSpy.mock.calls[0]?.[0] as string;
    expect(loggedMessage,).toContain('"a": 1',);
  });

  test('truncates long string content in log output', () => {
    /** Content longer than the 200-char preview limit */
    const longContent = 'x'.repeat(300,);
    /** Return value should still be the full content */
    const result = inspect(longContent,);
    expect(result,).toBe(longContent,);
    /** Logged preview should be truncated with ellipsis */
    const loggedMessage = infoSpy.mock.calls[0]?.[0] as string;
    expect(loggedMessage,).toContain('...',);
  });

  test('does not truncate content exactly at preview limit', () => {
    /** Content exactly at the 200-char boundary */
    const exactContent = 'y'.repeat(200,);
    inspect(exactContent,);
    /** Should not contain ellipsis since it's not over the limit */
    const loggedMessage = infoSpy.mock.calls[0]?.[0] as string;
    expect(loggedMessage,).not.toContain('...',);
  });

  test('handles empty string', () => {
    expect(inspect('',),).toBe('',);
    expect(infoSpy,).toHaveBeenCalled();
  });

  test('handles GlobResult-like array', () => {
    /** Simulates the shape returned by cat(string) */
    const globResults = [
      { path: '/a.ts', content: 'code', },
      { path: '/b.ts', content: 'more', },
    ];
    /** Should return the same array by reference */
    expect(inspect(globResults,),).toBe(globResults,);
  });

  test('truncates large JSON objects in log output', () => {
    /** Large object whose JSON is over the preview limit */
    const largeObj = Object.fromEntries(
      Array.from({ length: 50, }, (_, idx,) => [`key${String(idx,)}`, 'x'.repeat(20,),],),
    );
    inspect(largeObj,);
    const loggedMessage = infoSpy.mock.calls[0]?.[0] as string;
    expect(loggedMessage,).toContain('...',);
  });
});

//endregion inspect
