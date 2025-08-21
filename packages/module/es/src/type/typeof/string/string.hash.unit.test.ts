import {
  hashString,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration(),);

describe('string.hash', () => {
  describe(hashString, () => {
    test('generates consistent SHA-256 hash for same input', async () => {
      const input = 'hello world';
      const hash1 = await hashString(input,);
      const hash2 = await hashString(input,);

      expect(hash1,).toBe(hash2,);
      expect(hash1,).toBe(
        'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
      );
    });

    test('generates different hashes for different inputs', async () => {
      const hash1 = await hashString('hello',);
      const hash2 = await hashString('world',);
      const hash3 = await hashString('hello world',);

      expect(hash1,).not.toBe(hash2,);
      expect(hash2,).not.toBe(hash3,);
      expect(hash1,).not.toBe(hash3,);
    });

    test('handles empty string', async () => {
      const hash = await hashString('',);
      expect(hash,).toBe(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      );
      expect(typeof hash,).toBe('string',);
      expect(hash.length,).toBe(64,); // SHA-256 produces 64-character hex string
    });

    test('handles single character', async () => {
      const hash = await hashString('a',);
      expect(hash,).toBe(
        'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
      );
      expect(typeof hash,).toBe('string',);
      expect(hash.length,).toBe(64,);
    });

    test('handles Unicode characters', async () => {
      const hash1 = await hashString('Hello, 世界',);
      const hash2 = await hashString('café',);
      const hash3 = await hashString('🎉',);

      expect(typeof hash1,).toBe('string',);
      expect(typeof hash2,).toBe('string',);
      expect(typeof hash3,).toBe('string',);
      expect(hash1.length,).toBe(64,);
      expect(hash2.length,).toBe(64,);
      expect(hash3.length,).toBe(64,);

      // Ensure different Unicode strings produce different hashes
      expect(hash1,).not.toBe(hash2,);
      expect(hash2,).not.toBe(hash3,);
    });

    test('handles long strings', async () => {
      const longString = 'a'.repeat(10000,);
      const hash = await hashString(longString,);

      expect(typeof hash,).toBe('string',);
      expect(hash.length,).toBe(64,);
    });

    test('handles special characters and symbols', async () => {
      const specialChars = '!@#$%^&*()_+-={}[]|\\:";\'<>?,./~`';
      const hash = await hashString(specialChars,);

      expect(typeof hash,).toBe('string',);
      expect(hash.length,).toBe(64,);
    });

    test('handles whitespace variations', async () => {
      const hash1 = await hashString(' ',);
      const hash2 = await hashString('\t',);
      const hash3 = await hashString('\n',);
      const hash4 = await hashString('\r\n',);

      expect(hash1,).not.toBe(hash2,);
      expect(hash2,).not.toBe(hash3,);
      expect(hash3,).not.toBe(hash4,);

      expect(hash1.length,).toBe(64,);
      expect(hash2.length,).toBe(64,);
      expect(hash3.length,).toBe(64,);
      expect(hash4.length,).toBe(64,);
    });

    test('hash contains only hexadecimal characters', async () => {
      const hash = await hashString('test input',);
      const hexPattern = /^[\da-f]+$/;

      expect(hexPattern.test(hash,),).toBe(true,);
      expect(hash.length,).toBe(64,);
    });

    test('case sensitivity in input produces different hashes', async () => {
      const hash1 = await hashString('Hello',);
      const hash2 = await hashString('hello',);
      const hash3 = await hashString('HELLO',);

      expect(hash1,).not.toBe(hash2,);
      expect(hash2,).not.toBe(hash3,);
      expect(hash1,).not.toBe(hash3,);
    });

    test('leading and trailing spaces matter', async () => {
      const hash1 = await hashString('hello',);
      const hash2 = await hashString(' hello',);
      const hash3 = await hashString('hello ',);
      const hash4 = await hashString(' hello ',);

      expect(hash1,).not.toBe(hash2,);
      expect(hash2,).not.toBe(hash3,);
      expect(hash3,).not.toBe(hash4,);
      expect(hash1,).not.toBe(hash4,);
    });

    test('known test vectors', async () => {
      // Test against known SHA-256 values
      expect(await hashString('abc',),).toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      );

      expect(await hashString('The quick brown fox jumps over the lazy dog',),).toBe(
        'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592',
      );
    });

    test('handles multiline strings', async () => {
      const multiline = `Line 1
Line 2
Line 3`;
      const hash = await hashString(multiline,);

      expect(typeof hash,).toBe('string',);
      expect(hash.length,).toBe(64,);
    });

    test('reproducible across different calls', async () => {
      const input = 'consistency test';
      const hashes = await Promise.all([
        hashString(input,),
        hashString(input,),
        hashString(input,),
        hashString(input,),
        hashString(input,),
      ],);

      const firstHash = hashes[0];
      for (const hash of hashes)
        expect(hash,).toBe(firstHash,);
    });
  },);
});
