import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  classifyHeader,
  filterOxlintOutput,
  NOT_DIAGNOSTIC_HEADER,
  shouldForceSuccess,
} from './oxlint-suppress.ts';

/** Diagnostic block matched only by explicit test suppression input. */
const customSuppressibleBlock = [
  '  ! typescript(no-explicit-any): Unexpected any.',
  '     ,-[src/legacy/opaque.ts:10:20]',
  '  10 | export type LegacyOpaque = any;',
  '     :                                  ^^^',
  '     `----',
].join('\n',);

/** Genuine diagnostic not matched by test suppression input. */
const realViolationBlock = [
  '  ! typescript(no-explicit-any): Unexpected any.',
  '     ,-[src/server/handler.ts:10:20]',
  '  10 | export type RequestBody = any;',
  '     :                                 ^^^',
  '     `----',
].join('\n',);

/**
 * Builds oxlint's trailing summary block.
 *
 * @param warnings - warning count for the summary line
 *
 * @param errors - error count for the summary line
 *
 * @returns two-line summary block
 *
 * @example
 * ```ts
 * summary({ warnings: 1, errors: 0 });
 * ```
 */
function summary({
  warnings,
  errors,
}: {
  readonly warnings: number;
  readonly errors: number;
},): string {
  return [
    `Found ${warnings} warnings and ${errors} errors.`,
    'Finished in 5ms on 1 files with 460 rules using 16 threads.',
  ].join('\n',);
}

await describe({
  name: '',
  children: [
    describe({
      name: classifyHeader.name,
      children: [
        it({
          name: 'reads a warning header',
          fn: async () => {
            expect(classifyHeader('  ! typescript(no-explicit-any): msg',),)
              .toEqual({
                rule: 'no-explicit-any',
                severity: 'warning',
              },);
          },
        },),
        it({
          name: 'reads an error header',
          fn: async () => {
            expect(classifyHeader('  x typescript(no-explicit-any): msg',),)
              .toEqual({
                rule: 'no-explicit-any',
                severity: 'error',
              },);
          },
        },),
        it({
          name: 'rejects context lines',
          fn: async () => {
            expect(classifyHeader(' 253 | const x = 1;',),)
              .toBe(NOT_DIAGNOSTIC_HEADER,);
          },
        },),
        it({
          name: 'rejects the summary line',
          fn: async () => {
            expect(classifyHeader('Found 1 warnings and 0 errors.',),)
              .toBe(NOT_DIAGNOSTIC_HEADER,);
          },
        },),
      ],
    },),

    describe({
      name: filterOxlintOutput.name,
      children: [
        it({
          name: 'drops a custom-matched block and passes an all-suppressed run',
          fn: async () => {
            const result = filterOxlintOutput({
              output: [
                customSuppressibleBlock,
                '',
                summary({
                  warnings: 1,
                  errors: 0,
                },),
              ].join('\n',),
              suppressions: [
                {
                  rule: 'no-explicit-any',
                  snippetIncludes: 'LegacyOpaque',
                  reason: 'test-only suppression match',
                },
              ],
            },);
            expect(result.hasRemainingDiagnostics,).toBe(false,);
            expect(result.suppressedWarnings,).toBe(1,);
            expect(result.filtered
              .includes('LegacyOpaque',),).toBe(false,);
            expect(result.filtered
              .includes('Found 0 warnings and 0 errors.',),).toBe(true,);
          },
        },),
        it({
          name: 'keeps a genuine violation and recomputes the mixed summary',
          fn: async () => {
            const result = filterOxlintOutput({
              output: [
                customSuppressibleBlock,
                '',
                realViolationBlock,
                '',
                summary({
                  warnings: 2,
                  errors: 0,
                },),
              ].join('\n',),
              suppressions: [
                {
                  rule: 'no-explicit-any',
                  snippetIncludes: 'LegacyOpaque',
                  reason: 'test-only suppression match',
                },
              ],
            },);
            expect(result.hasRemainingDiagnostics,).toBe(true,);
            expect(result.suppressedWarnings,).toBe(1,);
            expect(result.filtered
              .includes('src/server/handler.ts',),).toBe(true,);
            expect(result.filtered
              .includes('src/legacy/opaque.ts',),).toBe(false,);
            expect(result.filtered
              .includes('Found 1 warning and 0 errors.',),).toBe(true,);
          },
        },),
        it({
          name: 'keeps a diagnostic when default registry is empty',
          fn: async () => {
            const result = filterOxlintOutput({
              output: [
                realViolationBlock,
                '',
                summary({
                  warnings: 1,
                  errors: 0,
                },),
              ].join('\n',),
            },);
            expect(result.hasRemainingDiagnostics,).toBe(true,);
            expect(result.suppressedWarnings,).toBe(0,);
          },
        },),
        it({
          name: 'returns empty for empty input',
          fn: async () => {
            expect(filterOxlintOutput({ output: '', },),).toEqual({
              filtered: '',
              suppressedWarnings: 0,
              suppressedErrors: 0,
              hasRemainingDiagnostics: false,
            },);
          },
        },),
        it({
          name: 'reports nothing suppressed for a non-diagnostic failure (wrapper must propagate exit)',
          fn: async () => {
            // A config error / panic emits no parseable diagnostic block. The
            // filter must not claim a suppression, so the wrapper preserves
            // oxlint's failure (suppressedTotal === 0 keeps the non-zero exit).
            const result = filterOxlintOutput({
              output: 'Error: invalid configuration file\n',
            },);
            expect(result.suppressedWarnings,).toBe(0,);
            expect(result.suppressedErrors,).toBe(0,);
            expect(result.hasRemainingDiagnostics,).toBe(false,);
            expect(result.filtered,).toBe('Error: invalid configuration file\n',);
          },
        },),
        it({
          name: 'honors a custom suppression path gate',
          fn: async () => {
            const result = filterOxlintOutput({
              output: [
                customSuppressibleBlock,
                '',
                summary({
                  warnings: 1,
                  errors: 0,
                },),
              ].join('\n',),
              suppressions: [
                {
                  rule: 'no-explicit-any',
                  snippetIncludes: 'LegacyOpaque',
                  pathIncludes: 'never/matches.ts',
                  reason: 'path gate excludes this file',
                },
              ],
            },);
            expect(result.hasRemainingDiagnostics,).toBe(true,);
            expect(result.suppressedWarnings,).toBe(0,);
          },
        },),
      ],
    },),

    describe({
      name: shouldForceSuccess.name,
      children: [
        it({
          name: 'forces success when only suppressed diagnostics caused the failure',
          fn: async () => {
            expect(shouldForceSuccess({
              hasRemainingDiagnostics: false,
              totalSuppressed: 1,
              exitCode: 1,
              stderr: '',
            },),).toBe(true,);
          },
        },),
        it({
          name: 'preserves failure when real diagnostics remain',
          fn: async () => {
            expect(shouldForceSuccess({
              hasRemainingDiagnostics: true,
              totalSuppressed: 1,
              exitCode: 1,
              stderr: '',
            },),).toBe(false,);
          },
        },),
        it({
          name: 'preserves failure when nothing was suppressed',
          fn: async () => {
            expect(shouldForceSuccess({
              hasRemainingDiagnostics: false,
              totalSuppressed: 0,
              exitCode: 1,
              stderr: '',
            },),).toBe(false,);
          },
        },),
        it({
          name: 'preserves failure on a non-diagnostics exit code',
          fn: async () => {
            expect(shouldForceSuccess({
              hasRemainingDiagnostics: false,
              totalSuppressed: 1,
              exitCode: 2,
              stderr: '',
            },),).toBe(false,);
          },
        },),
        it({
          name: 'preserves failure when stderr carries a non-diagnostic error',
          fn: async () => {
            // The finding's mixed-failure case: a suppressible block on stdout
            // plus a fatal message on stderr must not be converted to success.
            expect(shouldForceSuccess({
              hasRemainingDiagnostics: false,
              totalSuppressed: 1,
              exitCode: 1,
              stderr: 'fatal: cache database could not be read',
            },),).toBe(false,);
          },
        },),
      ],
    },),
  ],
},);
