import {
  isLangString,
  isLongLangString,
  isShortLangString,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe(isShortLangString, () => {
  test('identifies valid short language codes', () => {
    expect(isShortLangString('en')).toBe(true);
    expect(isShortLangString('fr')).toBe(true);
    expect(isShortLangString('de')).toBe(true);
    expect(isShortLangString('es')).toBe(true);
    expect(isShortLangString('zh')).toBe(true);
    expect(isShortLangString('ja')).toBe(true);
    expect(isShortLangString('ko')).toBe(true);
    expect(isShortLangString('ar')).toBe(true);
    expect(isShortLangString('hi')).toBe(true);
    expect(isShortLangString('ru')).toBe(true);
  });

  test('rejects uppercase letters', () => {
    expect(isShortLangString('EN')).toBe(false);
    expect(isShortLangString('Fr')).toBe(false);
    expect(isShortLangString('eN')).toBe(false);
    expect(isShortLangString('DE')).toBe(false);
  });

  test('rejects wrong length strings', () => {
    expect(isShortLangString('e')).toBe(false);
    expect(isShortLangString('eng')).toBe(false);
    expect(isShortLangString('english')).toBe(false);
    expect(isShortLangString('')).toBe(false);
  });

  test('rejects non-letter characters', () => {
    expect(isShortLangString('e1')).toBe(false);
    expect(isShortLangString('1n')).toBe(false);
    expect(isShortLangString('e-')).toBe(false);
    expect(isShortLangString('e_')).toBe(false);
    expect(isShortLangString('e.')).toBe(false);
    expect(isShortLangString('e ')).toBe(false);
  });

  test('rejects non-string values', () => {
    expect(isShortLangString(null)).toBe(false);
    expect(isShortLangString(undefined)).toBe(false);
    expect(isShortLangString(12)).toBe(false);
    expect(isShortLangString(true)).toBe(false);
    expect(isShortLangString([])).toBe(false);
    expect(isShortLangString({})).toBe(false);
  });
});

describe(isLongLangString, () => {
  test('identifies valid long language codes', () => {
    expect(isLongLangString('en-US')).toBe(true);
    expect(isLongLangString('en-GB')).toBe(true);
    expect(isLongLangString('fr-FR')).toBe(true);
    expect(isLongLangString('fr-CA')).toBe(true);
    expect(isLongLangString('de-DE')).toBe(true);
    expect(isLongLangString('es-ES')).toBe(true);
    expect(isLongLangString('es-MX')).toBe(true);
    expect(isLongLangString('zh-CN')).toBe(true);
    expect(isLongLangString('zh-TW')).toBe(true);
    expect(isLongLangString('ja-JP')).toBe(true);
  });

  test('rejects incorrect case format', () => {
    expect(isLongLangString('EN-US')).toBe(false);
    expect(isLongLangString('en-us')).toBe(false);
    expect(isLongLangString('En-US')).toBe(false);
    expect(isLongLangString('en-Us')).toBe(false);
    expect(isLongLangString('en-uS')).toBe(false);
  });

  test('rejects wrong length strings', () => {
    expect(isLongLangString('en')).toBe(false);
    expect(isLongLangString('en-')).toBe(false);
    expect(isLongLangString('-US')).toBe(false);
    expect(isLongLangString('en-U')).toBe(false);
    expect(isLongLangString('e-US')).toBe(false);
    expect(isLongLangString('en-USA')).toBe(false);
    expect(isLongLangString('eng-US')).toBe(false);
    expect(isLongLangString('')).toBe(false);
  });

  test('rejects invalid separators', () => {
    expect(isLongLangString('en_US')).toBe(false);
    expect(isLongLangString('en.US')).toBe(false);
    expect(isLongLangString('en US')).toBe(false);
    expect(isLongLangString('en+US')).toBe(false);
    expect(isLongLangString('enUS')).toBe(false);
  });

  test('rejects non-letter characters', () => {
    expect(isLongLangString('e1-US')).toBe(false);
    expect(isLongLangString('en-U1')).toBe(false);
    expect(isLongLangString('en-1S')).toBe(false);
    expect(isLongLangString('1n-US')).toBe(false);
  });

  test('rejects non-string values', () => {
    expect(isLongLangString(null)).toBe(false);
    expect(isLongLangString(undefined)).toBe(false);
    expect(isLongLangString(12345)).toBe(false);
    expect(isLongLangString(true)).toBe(false);
    expect(isLongLangString([])).toBe(false);
    expect(isLongLangString({})).toBe(false);
  });
});

describe(isLangString, () => {
  test('identifies valid short language codes', () => {
    expect(isLangString('en')).toBe(true);
    expect(isLangString('fr')).toBe(true);
    expect(isLangString('de')).toBe(true);
    expect(isLangString('es')).toBe(true);
    expect(isLangString('zh')).toBe(true);
    expect(isLangString('ja')).toBe(true);
    expect(isLangString('ko')).toBe(true);
    expect(isLangString('ar')).toBe(true);
    expect(isLangString('hi')).toBe(true);
    expect(isLangString('ru')).toBe(true);
  });

  test('identifies valid long language codes', () => {
    expect(isLangString('en-US')).toBe(true);
    expect(isLangString('en-GB')).toBe(true);
    expect(isLangString('fr-FR')).toBe(true);
    expect(isLangString('fr-CA')).toBe(true);
    expect(isLangString('de-DE')).toBe(true);
    expect(isLangString('es-ES')).toBe(true);
    expect(isLangString('es-MX')).toBe(true);
    expect(isLangString('zh-CN')).toBe(true);
    expect(isLangString('zh-TW')).toBe(true);
    expect(isLangString('ja-JP')).toBe(true);
  });

  test('rejects invalid format combinations', () => {
    // Wrong case for short codes
    expect(isLangString('EN')).toBe(false);
    expect(isLangString('Fr')).toBe(false);
    
    // Wrong case for long codes
    expect(isLangString('EN-US')).toBe(false);
    expect(isLangString('en-us')).toBe(false);
    expect(isLangString('En-US')).toBe(false);
    expect(isLangString('en-Us')).toBe(false);
  });

  test('rejects wrong length strings', () => {
    expect(isLangString('e')).toBe(false);
    expect(isLangString('eng')).toBe(false);
    expect(isLangString('en-')).toBe(false);
    expect(isLangString('-US')).toBe(false);
    expect(isLangString('en-U')).toBe(false);
    expect(isLangString('e-US')).toBe(false);
    expect(isLangString('en-USA')).toBe(false);
    expect(isLangString('eng-US')).toBe(false);
    expect(isLangString('')).toBe(false);
  });

  test('rejects invalid separators and characters', () => {
    expect(isLangString('en_US')).toBe(false);
    expect(isLangString('en.US')).toBe(false);
    expect(isLangString('en US')).toBe(false);
    expect(isLangString('e1')).toBe(false);
    expect(isLangString('1n')).toBe(false);
    expect(isLangString('e1-US')).toBe(false);
    expect(isLangString('en-U1')).toBe(false);
  });

  test('rejects non-string values', () => {
    expect(isLangString(null)).toBe(false);
    expect(isLangString(undefined)).toBe(false);
    expect(isLangString(12)).toBe(false);
    expect(isLangString(12345)).toBe(false);
    expect(isLangString(true)).toBe(false);
    expect(isLangString(false)).toBe(false);
    expect(isLangString([])).toBe(false);
    expect(isLangString({})).toBe(false);
    expect(isLangString(new Date())).toBe(false);
  });
});