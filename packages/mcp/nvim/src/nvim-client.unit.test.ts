import {
  describe,
  expect,
  test,
} from 'bun:test';

import {
  normalizeMessage,
  SEVERITY_MAP,
} from './nvim-client.ts';

//region SEVERITY_MAP -- maps vim.diagnostic.severity codes to human-readable labels

describe('SEVERITY_MAP', () => {
  test('maps 1 to ERROR', () => {
    expect(SEVERITY_MAP[1],).toBe('ERROR',);
  });

  test('maps 2 to WARN', () => {
    expect(SEVERITY_MAP[2],).toBe('WARN',);
  });

  test('maps 3 to INFO', () => {
    expect(SEVERITY_MAP[3],).toBe('INFO',);
  });

  test('maps 4 to HINT', () => {
    expect(SEVERITY_MAP[4],).toBe('HINT',);
  });

  test('returns undefined for unknown severity codes', () => {
    expect(SEVERITY_MAP[0],).toBeUndefined();
    expect(SEVERITY_MAP[5],).toBeUndefined();
  });

  test('contains exactly 4 entries', () => {
    expect(Object.keys(SEVERITY_MAP,),).toHaveLength(4,);
  });
});

//endregion SEVERITY_MAP

//region normalizeMessage -- reformats embedded help text from LSP diagnostics

describe('normalizeMessage', () => {
  test('reformats embedded help text inline', () => {
    expect(
      normalizeMessage(
        'Empty exports do nothing in module files\nhelp: Remove this empty export.',
      ),
    )
      .toBe(
        'Empty exports do nothing in module files (help: Remove this empty export.)',
      );
  });

  test('passes through message without help text unchanged', () => {
    expect(normalizeMessage("Type 'string' is not assignable to type 'number'.",),)
      .toBe("Type 'string' is not assignable to type 'number'.",);
  });

  test('handles message that is just help text prefix without content', () => {
    expect(normalizeMessage('Error\nhelp: ',),)
      .toBe('Error (help: )',);
  });

  test('only reformats the first help occurrence', () => {
    expect(normalizeMessage('Error\nhelp: Fix this\nhelp: Also this',),)
      .toBe('Error (help: Fix this\nhelp: Also this)',);
  });

  test('does not match help without preceding newline', () => {
    expect(normalizeMessage('See help: section for details',),)
      .toBe('See help: section for details',);
  });
});

//endregion normalizeMessage
