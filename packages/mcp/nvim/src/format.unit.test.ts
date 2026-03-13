import {
  describe,
  expect,
  test,
} from 'bun:test';

import { formatDiagnostic } from './format.ts';

import type { FormattableDiagnostic } from './format.ts';

//region formatDiagnostic -- formats a diagnostic into a human-readable line

describe('formatDiagnostic', () => {
  test('formats diagnostic with source and code', () => {
    expect.assertions(1);
    const diagnostic: FormattableDiagnostic = {
      severity: 'ERROR',
      lnum: 10,
      col: 5,
      source: 'typescript',
      code: 2_345,
      message: 'Type mismatch',
    };
    expect(formatDiagnostic(diagnostic)).toBe('ERROR 10:5 [typescript 2345] Type mismatch');
  });

  test('formats diagnostic with source but no code', () => {
    expect.assertions(1);
    const diagnostic: FormattableDiagnostic = {
      severity: 'WARN',
      lnum: 3,
      col: 1,
      source: 'eslint',
      code: null,
      message: 'Unused variable',
    };
    expect(formatDiagnostic(diagnostic)).toBe('WARN 3:1 [eslint] Unused variable');
  });

  test('formats diagnostic without source', () => {
    expect.assertions(1);
    const diagnostic: FormattableDiagnostic = {
      severity: 'INFO',
      lnum: 1,
      col: 1,
      source: null,
      code: null,
      message: 'Some info',
    };
    expect(formatDiagnostic(diagnostic)).toBe('INFO 1:1 Some info');
  });

  test('formats diagnostic without source but with code (code is ignored)', () => {
    expect.assertions(1);
    const diagnostic: FormattableDiagnostic = {
      severity: 'HINT',
      lnum: 20,
      col: 15,
      source: null,
      code: 'some-code',
      message: 'Consider refactoring',
    };
    expect(formatDiagnostic(diagnostic)).toBe('HINT 20:15 Consider refactoring');
  });

  test('applies indent prefix', () => {
    expect.assertions(1);
    const diagnostic: FormattableDiagnostic = {
      severity: 'ERROR',
      lnum: 5,
      col: 3,
      source: 'ts',
      code: 1_000,
      message: 'Missing semicolon',
    };
    expect(formatDiagnostic(diagnostic, '  ')).toBe('  ERROR 5:3 [ts 1000] Missing semicolon');
  });

  test('defaults indent to empty string', () => {
    expect.assertions(1);
    const diagnostic: FormattableDiagnostic = {
      severity: 'WARN',
      lnum: 1,
      col: 1,
      source: null,
      code: null,
      message: 'Test',
    };
    const result = formatDiagnostic(diagnostic);
    expect(result.startsWith('WARN')).toBe(true);
  });

  test('handles string code', () => {
    expect.assertions(1);
    const diagnostic: FormattableDiagnostic = {
      severity: 'ERROR',
      lnum: 7,
      col: 12,
      source: 'oxlint',
      code: 'no-unused-vars',
      message: 'Variable is unused',
    };
    expect(formatDiagnostic(diagnostic)).toBe('ERROR 7:12 [oxlint no-unused-vars] Variable is unused');
  });

  test('handles zero-based line and column', () => {
    expect.assertions(1);
    const diagnostic: FormattableDiagnostic = {
      severity: 'ERROR',
      lnum: 0,
      col: 0,
      source: null,
      code: null,
      message: 'At origin',
    };
    expect(formatDiagnostic(diagnostic)).toBe('ERROR 0:0 At origin');
  });
});

//endregion formatDiagnostic
