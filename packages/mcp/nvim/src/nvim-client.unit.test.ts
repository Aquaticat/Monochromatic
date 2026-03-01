import {
  describe,
  expect,
  test,
} from 'bun:test';

import { SEVERITY_MAP } from './nvim-client.ts';

//region SEVERITY_MAP -- maps vim.diagnostic.severity codes to human-readable labels

describe('SEVERITY_MAP', () => {
  test('maps 1 to ERROR', () => {
    expect.assertions(1);
    expect(SEVERITY_MAP[1]).toBe('ERROR');
  });

  test('maps 2 to WARN', () => {
    expect.assertions(1);
    expect(SEVERITY_MAP[2]).toBe('WARN');
  });

  test('maps 3 to INFO', () => {
    expect.assertions(1);
    expect(SEVERITY_MAP[3]).toBe('INFO');
  });

  test('maps 4 to HINT', () => {
    expect.assertions(1);
    expect(SEVERITY_MAP[4]).toBe('HINT');
  });

  test('returns undefined for unknown severity codes', () => {
    expect.assertions(2);
    expect(SEVERITY_MAP[0]).toBeUndefined();
    expect(SEVERITY_MAP[5]).toBeUndefined();
  });

  test('contains exactly 4 entries', () => {
    expect.assertions(1);
    expect(Object.keys(SEVERITY_MAP)).toHaveLength(4);
  });
});

//endregion SEVERITY_MAP
