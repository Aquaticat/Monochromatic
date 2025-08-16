import {
  capitalizeString,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe('string.capitalize', () => {
  describe('capitalizeString', () => {
    test('capitalizes first character of basic English words', () => {
      expect(capitalizeString('hello')).toBe('Hello');
      expect(capitalizeString('world')).toBe('World');
      expect(capitalizeString('test')).toBe('Test');
      expect(capitalizeString('javascript')).toBe('Javascript');
    });

    test('handles already capitalized strings', () => {
      expect(capitalizeString('Hello')).toBe('Hello');
      expect(capitalizeString('World')).toBe('World');
      expect(capitalizeString('JavaScript')).toBe('JavaScript');
      expect(capitalizeString('UPPERCASE')).toBe('UPPERCASE');
    });

    test('preserves rest of string unchanged', () => {
      expect(capitalizeString('hello world')).toBe('Hello world');
      expect(capitalizeString('iPhone device')).toBe('IPhone device');
      expect(capitalizeString('mixed CaSe StRiNg')).toBe('Mixed CaSe StRiNg');
      expect(capitalizeString('multiple words here')).toBe('Multiple words here');
    });

    test('handles single character strings', () => {
      expect(capitalizeString('a')).toBe('A');
      expect(capitalizeString('z')).toBe('Z');
      expect(capitalizeString('A')).toBe('A');
      expect(capitalizeString('Z')).toBe('Z');
    });

    test('handles empty string', () => {
      expect(capitalizeString('')).toBe('');
    });

    test('handles strings starting with numbers', () => {
      expect(capitalizeString('1hello')).toBe('1hello');
      expect(capitalizeString('123abc')).toBe('123abc');
      expect(capitalizeString('9test')).toBe('9test');
    });

    test('handles strings starting with punctuation', () => {
      expect(capitalizeString('-hello')).toBe('-hello');
      expect(capitalizeString('!important')).toBe('!important');
      expect(capitalizeString('.class')).toBe('.class');
      expect(capitalizeString('@mention')).toBe('@mention');
      expect(capitalizeString('#hashtag')).toBe('#hashtag');
    });

    test('handles accented characters', () => {
      expect(capitalizeString('éléphant')).toBe('Éléphant');
      expect(capitalizeString('über')).toBe('Über');
      expect(capitalizeString('naïve')).toBe('Naïve');
      expect(capitalizeString('café')).toBe('Café');
      expect(capitalizeString('résumé')).toBe('Résumé');
    });

    test('handles Unicode characters', () => {
      expect(capitalizeString('ωmega')).toBe('Ωmega');
      expect(capitalizeString('αlpha')).toBe('Αlpha');
      expect(capitalizeString('βeta')).toBe('Βeta');
    });

    test('handles emoji and special Unicode', () => {
      expect(capitalizeString('🎉 party')).toBe('🎉 party');
      expect(capitalizeString('😀happy')).toBe('😀happy');
      expect(capitalizeString('hello 🌟')).toBe('Hello 🌟');
    });

    test('handles whitespace at start', () => {
      expect(capitalizeString(' hello')).toBe(' hello');
      expect(capitalizeString('\thello')).toBe('\thello');
      expect(capitalizeString('\nhello')).toBe('\nhello');
    });

    test('works with locale parameter for Turkish', () => {
      // Turkish has special case where 'i' should become 'İ' (dotted capital I)
      expect(capitalizeString('istanbul', 'tr-TR')).toBe('İstanbul');
      expect(capitalizeString('izmir', 'tr-TR')).toBe('İzmir');
      
      // English locale should use regular 'I'
      expect(capitalizeString('istanbul', 'en-US')).toBe('Istanbul');
      expect(capitalizeString('izmir', 'en-US')).toBe('Izmir');
    });

    test('handles other locale-specific cases', () => {
      // German with umlauts
      expect(capitalizeString('über', 'de-DE')).toBe('Über');
      
      // French with accents
      expect(capitalizeString('élève', 'fr-FR')).toBe('Élève');
    });

    test('works without locale parameter', () => {
      // Should use default locale behavior
      expect(capitalizeString('hello')).toBe('Hello');
      expect(capitalizeString('test')).toBe('Test');
    });

    test('handles complex Unicode cases', () => {
      // Ligatures and special combinations
      expect(capitalizeString('ﬀ test')).toBe('ﬀ test'); // ff ligature (no uppercase form)
      expect(capitalizeString('ß test')).toBe('SS test'); // German eszett becomes SS when uppercased
    });

    test('handles mixed scripts', () => {
      expect(capitalizeString('hello мир')).toBe('Hello мир');
      expect(capitalizeString('мир hello')).toBe('Мир hello');
      expect(capitalizeString('こんにちは world')).toBe('こんにちは world');
    });

    test('performance with long strings', () => {
      const longString = 'a'.repeat(10000);
      const expectedResult = 'A' + 'a'.repeat(9999);
      expect(capitalizeString(longString)).toBe(expectedResult);
    });

    test('handles RTL languages', () => {
      // Arabic text
      expect(capitalizeString('مرحبا')).toBe('مرحبا'); // Arabic doesn't have case distinction
      
      // Hebrew text  
      expect(capitalizeString('שלום')).toBe('שלום'); // Hebrew doesn't have case distinction
    });

    test('edge cases with special characters', () => {
      expect(capitalizeString('²test')).toBe('²test'); // Superscript 2 has no uppercase
      expect(capitalizeString('½test')).toBe('½test'); // Fraction has no uppercase
      expect(capitalizeString('©test')).toBe('©test'); // Copyright symbol has no uppercase
    });
  });

  describe('capitalizeString type inference', () => {
    test('returns string type', () => {
      const result = capitalizeString('test');
      expect(typeof result).toBe('string');
    });
  });
});