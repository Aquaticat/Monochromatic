import {
  describe,
  expect,
  test,
} from 'bun:test';

import {
  RULE_GUIDANCE,
  augmentOxlintOutput,
  extractRuleName,
  formatGuidanceLine,
  isHelpLine,
  stripAnsi,
} from './oxlint-augment.ts';

//region stripAnsi

describe('stripAnsi', () => {
  test('removes single color code', () => {
    expect(stripAnsi('\u001B[31merror\u001B[0m',),).toBe('error',);
  });

  test('removes multiple color codes', () => {
    expect(stripAnsi('\u001B[1;31mx\u001B[0m \u001B[33mwarning\u001B[0m',),)
      .toBe('x warning',);
  });

  test('returns plain text unchanged', () => {
    expect(stripAnsi('no colors here',),).toBe('no colors here',);
  });

  test('handles empty string', () => {
    expect(stripAnsi('',),).toBe('',);
  });
});

//endregion stripAnsi

//region extractRuleName

describe('extractRuleName', () => {
  test('extracts from error diagnostic header', () => {
    expect(extractRuleName(
      '  x typescript-eslint(no-misused-promises): Promise-returning function provided to method that expects a function returning void.',
    ),).toBe('no-misused-promises',);
  });

  test('extracts from warning diagnostic header', () => {
    expect(extractRuleName(
      '  ! eslint(no-magic-numbers): No magic number: 42.',
    ),).toBe('no-magic-numbers',);
  });

  test('extracts from unicorn plugin format', () => {
    expect(extractRuleName(
      '  x eslint-plugin-unicorn(no-process-exit): Don\'t use `process.exit()`',
    ),).toBe('no-process-exit',);
  });

  test('extracts from custom plugin format', () => {
    expect(extractRuleName(
      '  x no-restricted-syntax(no-arrow-function): Arrow functions are banned.',
    ),).toBe('no-arrow-function',);
  });

  test('extracts with ANSI codes present', () => {
    expect(extractRuleName(
      '  \u001B[31mx\u001B[0m \u001B[33mtypescript-eslint(no-misused-promises)\u001B[0m: Promise-returning function.',
    ),).toBe('no-misused-promises',);
  });

  test('returns null for context lines', () => {
    expect(extractRuleName('  92 |   const form = document.querySelector();',),)
      .toBeNull();
  });

  test('returns null for blank lines', () => {
    expect(extractRuleName('',),).toBeNull();
  });

  test('returns null for box-drawing lines', () => {
    expect(extractRuleName('   ,-[src/client.ts:93:30]',),).toBeNull();
  });

  test('returns null for help lines', () => {
    expect(extractRuleName('  help: Expected void return type.',),).toBeNull();
  });
});

//endregion extractRuleName

//region isHelpLine

describe('isHelpLine', () => {
  test('detects help line', () => {
    expect(isHelpLine('  help: Expected void return type.',),).toBe(true,);
  });

  test('detects help line with ANSI codes', () => {
    expect(isHelpLine('  \u001B[36mhelp:\u001B[0m Expected void return type.',),)
      .toBe(true,);
  });

  test('rejects diagnostic header', () => {
    expect(isHelpLine('  x typescript-eslint(no-misused-promises): ...',),).toBe(false,);
  });

  test('rejects context line', () => {
    expect(isHelpLine('  92 |   const form = ...',),).toBe(false,);
  });
});

//endregion isHelpLine

//region formatGuidanceLine

describe('formatGuidanceLine', () => {
  test('formats guidance with note prefix', () => {
    expect(formatGuidanceLine('Fix the issue.',),)
      .toBe('  note: Fix the issue.',);
  });
});

//endregion formatGuidanceLine

//region augmentOxlintOutput

describe('augmentOxlintOutput', () => {
  /** Convenience helper to build a diagnostic block in oxlint's miette format. */
  function buildDiagnostic({ rule, plugin, message, file, helpText, }: {
    rule: string;
    plugin: string;
    message: string;
    file: string;
    helpText?: string;
  }): string[] {
    const lines = [
      `  x ${plugin}(${rule}): ${message}`,
      `    ,-[${file}:93:30]`,
      ' 92 |   const form = document.querySelector();',
      ' 93 |   form?.addEventListener(\'submit\', async function handleSubmit(event) {',
      '    |                                    ^^^^',
      '    `----',
    ];
    if (helpText !== undefined)
      lines.push(`  help: ${helpText}`,);
    return lines;
  }

  test('injects guidance after help line for matched rule', () => {
    const input = [
      ...buildDiagnostic({
        rule: 'no-misused-promises',
        plugin: 'typescript-eslint',
        message: 'Promise-returning function provided to method that expects a function returning void.',
        file: 'src/client.ts',
        helpText: 'Expected void return type.',
      }),
      '',
    ].join('\n',);

    const result = augmentOxlintOutput(input,);

    expect(result,).toContain('  help: Expected void return type.',);
    expect(result,).toContain(`  note: ${RULE_GUIDANCE['no-misused-promises']}`,);

    // Note should appear after help
    const helpIdx = result.indexOf('help:',);
    const noteIdx = result.indexOf('note:',);
    expect(noteIdx,).toBeGreaterThan(helpIdx,);
  });

  test('injects guidance before blank line when no help line exists', () => {
    const input = [
      ...buildDiagnostic({
        rule: 'no-misused-promises',
        plugin: 'typescript-eslint',
        message: 'Promise-returning function.',
        file: 'src/client.ts',
      }),
      '',
    ].join('\n',);

    const result = augmentOxlintOutput(input,);

    expect(result,).toContain(`  note: ${RULE_GUIDANCE['no-misused-promises']}`,);

    // Note should appear before the trailing blank line
    const lines = result.split('\n',);
    const noteLine = lines.findIndex(
      (l,) => l.includes('note:',),
    );
    expect(lines[noteLine + 1],).toBe('',);
  });

  test('does not inject guidance for unmatched rules', () => {
    const input = [
      ...buildDiagnostic({
        rule: 'no-explicit-any',
        plugin: 'typescript-eslint',
        message: 'Unexpected any.',
        file: 'src/index.ts',
        helpText: 'Use unknown instead.',
      }),
      '',
    ].join('\n',);

    const result = augmentOxlintOutput(input,);

    expect(result,).not.toContain('note:',);
    expect(result,).toBe(input,);
  });

  test('handles multiple diagnostics with mixed matching', () => {
    const input = [
      ...buildDiagnostic({
        rule: 'no-explicit-any',
        plugin: 'typescript-eslint',
        message: 'Unexpected any.',
        file: 'src/index.ts',
        helpText: 'Use unknown instead.',
      }),
      '',
      ...buildDiagnostic({
        rule: 'no-misused-promises',
        plugin: 'typescript-eslint',
        message: 'Promise-returning function.',
        file: 'src/client.ts',
        helpText: 'Expected void return type.',
      }),
      '',
      ...buildDiagnostic({
        rule: 'no-magic-numbers',
        plugin: 'eslint',
        message: 'No magic number: 42.',
        file: 'src/config.ts',
        helpText: 'Extract to a named constant.',
      }),
      '',
    ].join('\n',);

    const result = augmentOxlintOutput(input,);
    const noteOccurrences = result.split('note:',).length - 1;

    // Only one note injected -- for no-misused-promises
    expect(noteOccurrences,).toBe(1,);
    expect(result,).toContain(RULE_GUIDANCE['no-misused-promises'] ?? '',);
  });

  test('handles empty output', () => {
    expect(augmentOxlintOutput('',),).toBe('',);
  });

  test('handles output with no diagnostics', () => {
    const input = 'Finished in 42ms on 150 files with 300 rules using 8 threads.\n';

    expect(augmentOxlintOutput(input,),).toBe(input,);
  });

  test('handles trailing diagnostic without blank line', () => {
    const input = [
      ...buildDiagnostic({
        rule: 'no-misused-promises',
        plugin: 'typescript-eslint',
        message: 'Promise-returning function.',
        file: 'src/client.ts',
      }),
    ].join('\n',);

    const result = augmentOxlintOutput(input,);

    expect(result,).toContain(`  note: ${RULE_GUIDANCE['no-misused-promises']}`,);
  });

  test('preserves ANSI codes in output while still matching', () => {
    const input = [
      '  \u001B[31mx\u001B[0m \u001B[33mtypescript-eslint(no-misused-promises)\u001B[0m: Promise-returning function.',
      '    ,-[src/client.ts:93:30]',
      '    `----',
      '  \u001B[36mhelp:\u001B[0m Expected void return type.',
      '',
    ].join('\n',);

    const result = augmentOxlintOutput(input,);

    // Original ANSI codes preserved
    expect(result,).toContain('\u001B[31m',);
    expect(result,).toContain('\u001B[33m',);
    // Guidance injected
    expect(result,).toContain('note:',);
  });
});

//endregion augmentOxlintOutput
