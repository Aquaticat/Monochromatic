import {
  limitedGetComputedCss,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es/.js';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe(limitedGetComputedCss, () => {
  test('handles "none" value', () => {
    expect(limitedGetComputedCss('none')).toBe('none');
  });

  test('converts number strings to numbers', () => {
    expect(limitedGetComputedCss('42')).toBe(42);
    expect(limitedGetComputedCss('3.14')).toBe(3.14);
    expect(limitedGetComputedCss('-10')).toBe(-10);
  });

  test('converts numeric strings to numbers', () => {
    expect(limitedGetComputedCss('42px')).toBe(42);
    expect(limitedGetComputedCss('3.14px')).toBe(3.14);
    expect(limitedGetComputedCss('-10px')).toBe(-10);
  });

  test('processes simple CSS variables', () => {
    expect(limitedGetComputedCss('var(--a)')).toBe(0);
    expect(limitedGetComputedCss('var(--b)')).toBe('bString');
  });

  /*  test('throws for unimplemented CSS variables', () => {
    expect(() => limitedGetComputedCss('var(--unknown)')).toThrow(
      'Not implemented in limitedGetComputedCss'
    );
  });

  test('throws for other unimplemented CSS values', () => {
    expect(() => limitedGetComputedCss('rgb(255, 0, 0)')).toThrow('Not implemented yet');
    expect(() => limitedGetComputedCss('10px')).toThrow('Not implemented yet');
  });*/

  test('handles nested CSS variables with fallbacks', () => {
    expect(limitedGetComputedCss('var(--a, var(--b))')).toBe(0); // --a resolves to 0
    expect(limitedGetComputedCss('var(--unknown, var(--b))')).toBe("'bString'"); // Fallback to --b
  });

  test('handles string combinations', () => {
    expect(limitedGetComputedCss("var(--a) 'c'")).toBe('0c');
    expect(limitedGetComputedCss("'e' 'f'")).toBe('ef');
    expect(limitedGetComputedCss("'g' var(--b)")).toBe('gbString');
  });

  test('handles complex combinations', () => {
    expect(limitedGetComputedCss("var(--a, 'c') 'd'")).toBe('0d');
    expect(limitedGetComputedCss('var(--unknown, var(--b, var(--c)))')).toBe("'bString'");
  });

  test('handles quoted strings correctly', () => {
    expect(limitedGetComputedCss("'test'")).toBe("'test'");
    expect(limitedGetComputedCss('"double quotes"')).toBe('"double quotes"');
  });
});
