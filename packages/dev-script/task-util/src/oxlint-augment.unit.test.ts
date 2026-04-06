import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

import {
  augmentOxlintOutput,
  extractRuleName,
  formatGuidanceLine,
  isHelpLine,
  RULE_GUIDANCE,
  stripAnsi,
} from './oxlint-augment.ts';

//region augmentOxlintOutput helpers

/** Convenience helper to build a diagnostic block in oxlint's miette format. */
function buildDiagnostic({ rule, plugin, message, file, helpText, }: {
  rule: string;
  plugin: string;
  message: string;
  file: string;
  helpText?: string;
},): string[] {
  const lines = [
    `  x ${plugin}(${rule}): ${message}`,
    `    ,-[${file}:93:30]`,
    ' 92 |   const form = document.querySelector();',
    " 93 |   form?.addEventListener('submit', async function handleSubmit(event) {",
    '    |                                    ^^^^',
    '    `----',
  ];
  if (helpText !== undefined)
    lines.push(`  help: ${helpText}`,);
  return lines;
}

//endregion augmentOxlintOutput helpers

//region stripAnsi

await describe({
  name: '',
  children: [
    describe({
      name: stripAnsi.name,
      children: [
        it({
          name: 'removes single color code',
          fn: async () => {
            expect(stripAnsi('\u001B[31merror\u001B[0m',),).toBe('error',);
          },
        },),
        it({
          name: 'removes multiple color codes',
          fn: async () => {
            expect(stripAnsi('\u001B[1;31mx\u001B[0m \u001B[33mwarning\u001B[0m',),)
              .toBe('x warning',);
          },
        },),
        it({
          name: 'returns plain text unchanged',
          fn: async () => {
            expect(stripAnsi('no colors here',),).toBe('no colors here',);
          },
        },),
        it({
          name: 'handles empty string',
          fn: async () => {
            expect(stripAnsi('',),).toBe('',);
          },
        },),
      ],
    },),

    //endregion stripAnsi

    //region extractRuleName

    describe({
      name: extractRuleName.name,
      children: [
        it({
          name: 'extracts from error diagnostic header',
          fn: async () => {
            expect(extractRuleName(
              '  x typescript-eslint(no-misused-promises): Promise-returning function provided to method that expects a function returning void.',
            ),)
              .toBe('no-misused-promises',);
          },
        },),
        it({
          name: 'extracts from warning diagnostic header',
          fn: async () => {
            expect(extractRuleName(
              '  ! eslint(no-magic-numbers): No magic number: 42.',
            ),)
              .toBe('no-magic-numbers',);
          },
        },),
        it({
          name: 'extracts from unicorn plugin format',
          fn: async () => {
            expect(extractRuleName(
              "  x eslint-plugin-unicorn(no-process-exit): Don't use `process.exit()`",
            ),)
              .toBe('no-process-exit',);
          },
        },),
        it({
          name: 'extracts from custom plugin format',
          fn: async () => {
            expect(extractRuleName(
              '  x no-restricted-syntax(no-arrow-function): Arrow functions are banned.',
            ),)
              .toBe('no-arrow-function',);
          },
        },),
        it({
          name: 'extracts with ANSI codes present',
          fn: async () => {
            expect(extractRuleName(
              '  \u001B[31mx\u001B[0m \u001B[33mtypescript-eslint(no-misused-promises)\u001B[0m: Promise-returning function.',
            ),)
              .toBe('no-misused-promises',);
          },
        },),
        it({
          name: 'returns null for context lines',
          fn: async () => {
            expect(extractRuleName('  92 |   const form = document.querySelector();',),)
              .toBeNull();
          },
        },),
        it({
          name: 'returns null for blank lines',
          fn: async () => {
            expect(extractRuleName('',),).toBeNull();
          },
        },),
        it({
          name: 'returns null for box-drawing lines',
          fn: async () => {
            expect(extractRuleName('   ,-[src/client.ts:93:30]',),).toBeNull();
          },
        },),
        it({
          name: 'returns null for help lines',
          fn: async () => {
            expect(extractRuleName('  help: Expected void return type.',),).toBeNull();
          },
        },),
      ],
    },),

    //endregion extractRuleName

    //region isHelpLine

    describe({
      name: isHelpLine.name,
      children: [
        it({
          name: 'detects help line',
          fn: async () => {
            expect(isHelpLine('  help: Expected void return type.',),).toBe(true,);
          },
        },),
        it({
          name: 'detects help line with ANSI codes',
          fn: async () => {
            expect(isHelpLine('  \u001B[36mhelp:\u001B[0m Expected void return type.',),)
              .toBe(true,);
          },
        },),
        it({
          name: 'rejects diagnostic header',
          fn: async () => {
            expect(isHelpLine('  x typescript-eslint(no-misused-promises): ...',),).toBe(
              false,
            );
          },
        },),
        it({
          name: 'rejects context line',
          fn: async () => {
            expect(isHelpLine('  92 |   const form = ...',),).toBe(false,);
          },
        },),
      ],
    },),

    //endregion isHelpLine

    //region formatGuidanceLine

    describe({
      name: formatGuidanceLine.name,
      children: [
        it({
          name: 'formats guidance with note prefix',
          fn: async () => {
            expect(formatGuidanceLine('Fix the issue.',),)
              .toBe('  note: Fix the issue.',);
          },
        },),
      ],
    },),

    //endregion formatGuidanceLine

    //region augmentOxlintOutput

    describe({
      name: augmentOxlintOutput.name,
      children: [
        it({
          name: 'injects guidance after help line for matched rule',
          fn: async () => {
            const input = [
              ...buildDiagnostic({
                rule: 'no-misused-promises',
                plugin: 'typescript-eslint',
                message:
                  'Promise-returning function provided to method that expects a function returning void.',
                file: 'src/client.ts',
                helpText: 'Expected void return type.',
              },),
              '',
            ]
              .join('\n',);

            const result = augmentOxlintOutput(input,);

            expect(result,).toContain('  help: Expected void return type.',);
            expect(result,).toContain(`  note: ${RULE_GUIDANCE['no-misused-promises']}`,);

            // Note should appear after help
            const helpIdx = result.indexOf('help:',);
            const noteIdx = result.indexOf('note:',);
            expect(noteIdx,).toBeGreaterThan(helpIdx,);
          },
        },),
        it({
          name: 'injects guidance before blank line when no help line exists',
          fn: async () => {
            const input = [
              ...buildDiagnostic({
                rule: 'no-misused-promises',
                plugin: 'typescript-eslint',
                message: 'Promise-returning function.',
                file: 'src/client.ts',
              },),
              '',
            ]
              .join('\n',);

            const result = augmentOxlintOutput(input,);

            expect(result,).toContain(`  note: ${RULE_GUIDANCE['no-misused-promises']}`,);

            // Note should appear before the trailing blank line
            const lines = result.split('\n',);
            const noteLine = lines.findIndex(
              l => l.includes('note:',),
            );
            expect(lines[noteLine + 1],).toBe('',);
          },
        },),
        it({
          name: 'does not inject guidance for unmatched rules',
          fn: async () => {
            const input = [
              ...buildDiagnostic({
                rule: 'no-explicit-any',
                plugin: 'typescript-eslint',
                message: 'Unexpected any.',
                file: 'src/index.ts',
                helpText: 'Use unknown instead.',
              },),
              '',
            ]
              .join('\n',);

            const result = augmentOxlintOutput(input,);

            expect(result,).not.toContain('note:',);
            expect(result,).toBe(input,);
          },
        },),
        it({
          name: 'handles multiple diagnostics with mixed matching',
          fn: async () => {
            const input = [
              ...buildDiagnostic({
                rule: 'no-explicit-any',
                plugin: 'typescript-eslint',
                message: 'Unexpected any.',
                file: 'src/index.ts',
                helpText: 'Use unknown instead.',
              },),
              '',
              ...buildDiagnostic({
                rule: 'no-misused-promises',
                plugin: 'typescript-eslint',
                message: 'Promise-returning function.',
                file: 'src/client.ts',
                helpText: 'Expected void return type.',
              },),
              '',
              ...buildDiagnostic({
                rule: 'no-magic-numbers',
                plugin: 'eslint',
                message: 'No magic number: 42.',
                file: 'src/config.ts',
                helpText: 'Extract to a named constant.',
              },),
              '',
            ]
              .join('\n',);

            const result = augmentOxlintOutput(input,);
            const noteOccurrences = result.split('note:',).length - 1;

            // Only one note injected -- for no-misused-promises
            expect(noteOccurrences,).toBe(1,);
            expect(result,).toContain(RULE_GUIDANCE['no-misused-promises'] ?? '',);
          },
        },),
        it({
          name: 'handles empty output',
          fn: async () => {
            expect(augmentOxlintOutput('',),).toBe('',);
          },
        },),
        it({
          name: 'handles output with no diagnostics',
          fn: async () => {
            const input =
              'Finished in 42ms on 150 files with 300 rules using 8 threads.\n';

            expect(augmentOxlintOutput(input,),).toBe(input,);
          },
        },),
        it({
          name: 'handles trailing diagnostic without blank line',
          fn: async () => {
            const input = [
              ...buildDiagnostic({
                rule: 'no-misused-promises',
                plugin: 'typescript-eslint',
                message: 'Promise-returning function.',
                file: 'src/client.ts',
              },),
            ]
              .join('\n',);

            const result = augmentOxlintOutput(input,);

            expect(result,).toContain(`  note: ${RULE_GUIDANCE['no-misused-promises']}`,);
          },
        },),
        it({
          name: 'preserves ANSI codes in output while still matching',
          fn: async () => {
            const input = [
              '  \u001B[31mx\u001B[0m \u001B[33mtypescript-eslint(no-misused-promises)\u001B[0m: Promise-returning function.',
              '    ,-[src/client.ts:93:30]',
              '    `----',
              '  \u001B[36mhelp:\u001B[0m Expected void return type.',
              '',
            ]
              .join('\n',);

            const result = augmentOxlintOutput(input,);

            // Original ANSI codes preserved
            expect(result,).toContain('\u001B[31m',);
            expect(result,).toContain('\u001B[33m',);
            // Guidance injected
            expect(result,).toContain('note:',);
          },
        },),
      ],
    },),
    //endregion augmentOxlintOutput
  ],
},);
