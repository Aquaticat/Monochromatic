import {
  concatStrings,
  concatStringsAsync,
  concatStringsAsyncWithNewline,
  concatStringsAsyncWithSpace,
  concatStringsWithNewline,
  concatStringsWithSpace,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es/.js';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe('concatStrings', () => {
  test('concatenates string arguments without separator', () => {
    expect(concatStrings('hello', 'world')).toBe('helloworld');
    expect(concatStrings('a', 'b', 'c')).toBe('abc');
    expect(concatStrings('')).toBe('');
  });

  test('concatenates string iterables without separator', () => {
    expect(concatStrings(['hello', 'world'])).toBe('helloworld');
    expect(concatStrings(new Set(['a', 'b', 'c']))).toBe('abc');
    expect(concatStrings([])).toBe('');
  });

  test('throws TypeError for non-string iterables', () => {
    expect(() => concatStrings([1, 2, 3] as any)).toThrow(TypeError);
  });
});

describe('concatStringsWithSpace', () => {
  test('concatenates string arguments with space separator', () => {
    expect(concatStringsWithSpace('hello', 'world')).toBe('hello world');
    expect(concatStringsWithSpace('a', 'b', 'c')).toBe('a b c');
    expect(concatStringsWithSpace('')).toBe('');
  });

  test('concatenates string iterables with space separator', () => {
    expect(concatStringsWithSpace(['hello', 'world'])).toBe('hello world');
    expect(concatStringsWithSpace(new Set(['a', 'b', 'c']))).toBe('a b c');
    expect(concatStringsWithSpace([])).toBe('');
  });

  test('throws TypeError for non-string iterables', () => {
    expect(() => concatStringsWithSpace([1, 2, 3] as any)).toThrow(TypeError);
  });
});

describe('concatStringsWithNewline', () => {
  test('concatenates string arguments with newline separator', () => {
    expect(concatStringsWithNewline('hello', 'world')).toBe('hello\nworld');
    expect(concatStringsWithNewline('a', 'b', 'c')).toBe('a\nb\nc');
    expect(concatStringsWithNewline('')).toBe('');
  });

  test('concatenates string iterables with newline separator', () => {
    expect(concatStringsWithNewline(['hello', 'world'])).toBe('hello\nworld');
    expect(concatStringsWithNewline(new Set(['a', 'b', 'c']))).toBe('a\nb\nc');
    expect(concatStringsWithNewline([])).toBe('');
  });

  test('throws TypeError for non-string iterables', () => {
    expect(() => concatStringsWithNewline([1, 2, 3] as any)).toThrow(TypeError);
  });
});

describe('concatStringsAsync', () => {
  test('concatenates string arguments without separator asynchronously', async () => {
    expect(await concatStringsAsync('hello', 'world')).toBe('helloworld');
    expect(await concatStringsAsync('a', 'b', 'c')).toBe('abc');
    expect(await concatStringsAsync('')).toBe('');
  });

  test('concatenates async iterables without separator', async () => {
    async function* asyncGenerator() {
      yield 'hello';
      yield 'world';
    }
    expect(await concatStringsAsync(asyncGenerator())).toBe('helloworld');
  });

  test('concatenates normal iterables without separator asynchronously', async () => {
    expect(await concatStringsAsync(['hello', 'world'])).toBe('helloworld');
    expect(await concatStringsAsync(new Set(['a', 'b', 'c']))).toBe('abc');
    expect(await concatStringsAsync([])).toBe('');
  });

  test('throws TypeError for non-string iterables', async () => {
    await expect(concatStringsAsync([1, 2, 3] as any)).rejects.toThrow(TypeError);
  });
});

describe('concatStringsAsyncWithSpace', () => {
  test('concatenates string arguments with space separator asynchronously', async () => {
    expect(await concatStringsAsyncWithSpace('hello', 'world')).toBe('hello world');
    expect(await concatStringsAsyncWithSpace('a', 'b', 'c')).toBe('a b c');
    expect(await concatStringsAsyncWithSpace('')).toBe('');
  });

  test('concatenates async iterables with space separator', async () => {
    async function* asyncGenerator() {
      yield 'hello';
      yield 'world';
    }
    expect(await concatStringsAsyncWithSpace(asyncGenerator())).toBe('hello world');
  });

  test('concatenates normal iterables with space separator asynchronously', async () => {
    expect(await concatStringsAsyncWithSpace(['hello', 'world'])).toBe('hello world');
    expect(await concatStringsAsyncWithSpace(new Set(['a', 'b', 'c']))).toBe('a b c');
    expect(await concatStringsAsyncWithSpace([])).toBe('');
  });

  test('throws TypeError for non-string iterables', async () => {
    await expect(concatStringsAsyncWithSpace([1, 2, 3] as any)).rejects.toThrow(
      TypeError,
    );
  });
});

describe('concatStringsAsyncWithNewline', () => {
  test('concatenates string arguments with newline separator asynchronously', async () => {
    expect(await concatStringsAsyncWithNewline('hello', 'world')).toBe('hello\nworld');
    expect(await concatStringsAsyncWithNewline('a', 'b', 'c')).toBe('a\nb\nc');
    expect(await concatStringsAsyncWithNewline('')).toBe('');
  });

  test('concatenates async iterables with newline separator', async () => {
    async function* asyncGenerator() {
      yield 'hello';
      yield 'world';
    }
    expect(await concatStringsAsyncWithNewline(asyncGenerator())).toBe('hello\nworld');
  });

  test('concatenates normal iterables with newline separator asynchronously', async () => {
    expect(await concatStringsAsyncWithNewline(['hello', 'world'])).toBe('hello\nworld');
    expect(await concatStringsAsyncWithNewline(new Set(['a', 'b', 'c']))).toBe('a\nb\nc');
    expect(await concatStringsAsyncWithNewline([])).toBe('');
  });

  test('throws TypeError for non-string iterables', async () => {
    await expect(concatStringsAsyncWithNewline([1, 2, 3] as any)).rejects.toThrow(
      TypeError,
    );
  });
});

describe('edge cases', () => {
  test('handles empty arrays correctly', () => {
    expect(concatStrings([])).toBe('');
    expect(concatStringsWithSpace([])).toBe('');
    expect(concatStringsWithNewline([])).toBe('');
  });

  test('handles empty strings correctly', () => {
    expect(concatStrings('')).toBe('');
    expect(concatStringsWithSpace('', '')).toBe(' ');
    expect(concatStringsWithNewline('', '', '')).toBe('\n\n');
  });

  test('handles mixed empty and non-empty strings', () => {
    expect(concatStrings('a', '', 'b')).toBe('ab');
    expect(concatStringsWithSpace('a', '', 'b')).toBe('a  b');
    expect(concatStringsWithNewline('a', '', 'b')).toBe('a\n\nb');
  });
});
