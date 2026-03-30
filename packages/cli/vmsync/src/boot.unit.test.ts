import {
  describe,
  expect,
  test,
} from 'bun:test';

import { parseMemoryToBytes, } from './boot.ts';

//region parseMemoryToBytes -- converts human-readable memory strings to byte counts

describe('parseMemoryToBytes', () => {
  test('parses gigabytes', () => {
    expect(parseMemoryToBytes('4G',),).toBe(4 * 1_073_741_824,);
  });

  test('parses megabytes', () => {
    expect(parseMemoryToBytes('2048M',),).toBe(2048 * 1_048_576,);
  });

  test('parses lowercase g', () => {
    expect(parseMemoryToBytes('8g',),).toBe(8 * 1_073_741_824,);
  });

  test('parses lowercase m', () => {
    expect(parseMemoryToBytes('512m',),).toBe(512 * 1_048_576,);
  });

  test('parses 1G correctly', () => {
    expect(parseMemoryToBytes('1G',),).toBe(1_073_741_824,);
  });

  test('rejects missing unit', () => {
    expect(() => {
      parseMemoryToBytes('4096',);
    },)
      .toThrow('invalid memory format',);
  });

  test('rejects invalid unit', () => {
    expect(() => {
      parseMemoryToBytes('4T',);
    },)
      .toThrow('invalid memory format',);
  });

  test('rejects empty string', () => {
    expect(() => {
      parseMemoryToBytes('',);
    },)
      .toThrow('invalid memory format',);
  });

  test('rejects non-numeric prefix', () => {
    expect(() => {
      parseMemoryToBytes('abcG',);
    },)
      .toThrow('invalid memory format',);
  });

  test('rejects decimal values', () => {
    expect(() => {
      parseMemoryToBytes('4.5G',);
    },)
      .toThrow('invalid memory format',);
  });
});

//endregion parseMemoryToBytes
