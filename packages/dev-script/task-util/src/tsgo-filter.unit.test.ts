import { exec, } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, } from 'node:path';
import { promisify, } from 'node:util';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';

import {
  filterTsgoOutput,
  isContinuationLine,
  isDiagnosticLine,
  isNodeModulesDiagnostic,
} from './tsgo-filter.ts';

const execAsync = promisify(exec,);

//region Unit tests for pure filtering functions

describe('isDiagnosticLine', () => {
  test('matches standard tsgo diagnostic format', () => {
    expect(isDiagnosticLine(
      'src/index.ts(1,15): error TS2304: Cannot find name \'foo\'.',
    ),).toBe(true,);
  });

  test('matches node_modules diagnostic format', () => {
    expect(isDiagnosticLine(
      'node_modules/.bun/@jsr+zod__zod@4.3.6/src/v4/core/schemas.ts(2088,19): error TS2532: Object is possibly \'undefined\'.',
    ),).toBe(true,);
  });

  test('rejects continuation lines', () => {
    expect(isDiagnosticLine(
      '  Type \'string\' is not assignable to type \'number\'.',
    ),).toBe(false,);
  });

  test('rejects blank lines', () => {
    expect(isDiagnosticLine('',),).toBe(false,);
  });

  test('rejects summary lines', () => {
    expect(isDiagnosticLine('Found 3 errors in 2 files.',),).toBe(false,);
  });
});

describe('isNodeModulesDiagnostic', () => {
  test('detects forward-slash node_modules path', () => {
    expect(isNodeModulesDiagnostic(
      'node_modules/.bun/@jsr+zod__zod@4.3.6/src/index.ts(1,1): error TS2532: ...',
    ),).toBe(true,);
  });

  test('detects nested node_modules path', () => {
    expect(isNodeModulesDiagnostic(
      '../../node_modules/.bun/@jsr+zod__zod@4.3.6/src/index.ts(1,1): error TS2532: ...',
    ),).toBe(true,);
  });

  test('detects backslash node_modules path', () => {
    expect(isNodeModulesDiagnostic(
      String.raw`node_modules\.bun\@jsr+zod__zod@4.3.6\src\index.ts(1,1): error TS2532: ...`,
    ),).toBe(true,);
  });

  test('rejects project source path', () => {
    expect(isNodeModulesDiagnostic(
      'src/index.ts(1,1): error TS2304: Cannot find name \'foo\'.',
    ),).toBe(false,);
  });
});

describe('isContinuationLine', () => {
  test('detects space-indented continuation', () => {
    expect(isContinuationLine(
      '  Type \'string\' is not assignable to type \'number\'.',
    ),).toBe(true,);
  });

  test('detects tab-indented continuation', () => {
    expect(isContinuationLine(
      '\tType \'string\' is not assignable.',
    ),).toBe(true,);
  });

  test('rejects diagnostic lines', () => {
    expect(isContinuationLine(
      'src/index.ts(1,1): error TS2304: Cannot find name \'foo\'.',
    ),).toBe(false,);
  });

  test('rejects empty lines', () => {
    expect(isContinuationLine('',),).toBe(false,);
  });
});

describe('filterTsgoOutput', () => {
  test('passes through output with no node_modules diagnostics', () => {
    const input = [
      'src/index.ts(1,15): error TS2304: Cannot find name \'foo\'.',
      '  Did you mean \'bar\'?',
      'Found 1 error.',
    ].join('\n',);

    const result = filterTsgoOutput(input,);

    expect(result.filtered,).toBe(input,);
    expect(result.hasRemainingErrors,).toBe(true,);
  });

  test('removes node_modules diagnostics and their continuation lines', () => {
    const input = [
      'node_modules/.bun/@jsr+zod__zod@4.3.6/src/v4/core/schemas.ts(2088,19): error TS2532: Object is possibly \'undefined\'.',
      '  Type \'number | undefined\' is not assignable.',
      'src/app.ts(5,3): error TS2304: Cannot find name \'foo\'.',
      'Found 2 errors.',
    ].join('\n',);

    const result = filterTsgoOutput(input,);

    expect(result.filtered,).toBe([
      'src/app.ts(5,3): error TS2304: Cannot find name \'foo\'.',
      'Found 2 errors.',
    ].join('\n',),);
    expect(result.hasRemainingErrors,).toBe(true,);
  });

  test('returns hasRemainingErrors false when all errors are from node_modules', () => {
    const input = [
      'node_modules/.bun/@jsr+zod__zod@4.3.6/src/v4/core/schemas.ts(2088,19): error TS2532: Object is possibly \'undefined\'.',
      '  Type \'number | undefined\' is not assignable.',
      'node_modules/.bun/@jsr+zod__zod@4.3.6/src/v4/core/util.ts(930,41): error TS2345: Argument of type \'number | undefined\'.',
      'Found 2 errors.',
    ].join('\n',);

    const result = filterTsgoOutput(input,);

    expect(result.filtered,).toBe('Found 2 errors.',);
    expect(result.hasRemainingErrors,).toBe(false,);
  });

  test('handles empty output', () => {
    const result = filterTsgoOutput('',);

    expect(result.filtered,).toBe('',);
    expect(result.hasRemainingErrors,).toBe(false,);
  });

  test('handles multiple consecutive node_modules diagnostics with continuations', () => {
    const input = [
      'node_modules/.bun/@jsr+zod__zod@4.3.6/src/v4/core/schemas.ts(2088,19): error TS2532: Object is possibly \'undefined\'.',
      '  First continuation.',
      '  Second continuation.',
      'node_modules/.bun/@jsr+zod__zod@4.3.6/src/v4/locales/he.ts(44,17): error TS18048: \'TypeNames.unknown\' is possibly \'undefined\'.',
      '  Continuation of second diagnostic.',
      'Found 2 errors.',
    ].join('\n',);

    const result = filterTsgoOutput(input,);

    expect(result.filtered,).toBe('Found 2 errors.',);
    expect(result.hasRemainingErrors,).toBe(false,);
  });

  test('preserves interleaved project and node_modules diagnostics', () => {
    const input = [
      'src/a.ts(1,1): error TS2304: Cannot find name \'a\'.',
      '  Did you mean \'b\'?',
      'node_modules/.bun/pkg/src/index.ts(10,5): error TS2532: Object is possibly \'undefined\'.',
      '  Type mismatch detail.',
      'src/b.ts(3,7): error TS2322: Type \'string\' is not assignable to type \'number\'.',
      'Found 3 errors.',
    ].join('\n',);

    const result = filterTsgoOutput(input,);

    expect(result.filtered,).toBe([
      'src/a.ts(1,1): error TS2304: Cannot find name \'a\'.',
      '  Did you mean \'b\'?',
      'src/b.ts(3,7): error TS2322: Type \'string\' is not assignable to type \'number\'.',
      'Found 3 errors.',
    ].join('\n',),);
    expect(result.hasRemainingErrors,).toBe(true,);
  });

  test('handles relative node_modules paths with ../', () => {
    const input = [
      '../../node_modules/.bun/@jsr+zod__zod@4.3.6/src/index.ts(1,1): error TS2532: Object is possibly \'undefined\'.',
      'Found 1 error.',
    ].join('\n',);

    const result = filterTsgoOutput(input,);

    expect(result.filtered,).toBe('Found 1 error.',);
    expect(result.hasRemainingErrors,).toBe(false,);
  });

  test('preserves blank lines in output', () => {
    const input = [
      'src/a.ts(1,1): error TS2304: Cannot find name \'a\'.',
      '',
      'Found 1 error.',
    ].join('\n',);

    const result = filterTsgoOutput(input,);

    expect(result.filtered,).toBe(input,);
    expect(result.hasRemainingErrors,).toBe(true,);
  });
});

//endregion Unit tests for pure filtering functions

//region Integration tests for CLI execution

let cliPath: string;
let testDir: string;

beforeEach(() => {
  const testFileDir = import.meta.dirname;
  cliPath = join(testFileDir, 'tsgo-filter.ts',);

  const packageDir = join(testFileDir, '..',);
  const timestamp = Date.now();
  const randomId = Math.random().toString(36,).slice(2, 8,);
  testDir = join(packageDir, 'dist', 'temp', 'test',
    `tsgo-filter-${timestamp}-${randomId}`,);

  if (!existsSync(testDir,))
    mkdirSync(testDir, { recursive: true, },);
});

afterEach(() => {
  if (existsSync(testDir,))
    rmSync(testDir, { recursive: true, },);
});

describe('task-tsgo CLI', () => {
  test('forwards arguments to tsgo', async () => {
    // tsgo --version should succeed and print version info
    const { stdout, } = await execAsync(`bun ${cliPath} --version`,);

    expect(stdout.trim().length,).toBeGreaterThan(0,);
  });

  test('exits non-zero when tsgo reports project errors', async () => {
    // Create a tsconfig that references a non-existent file
    const tsconfig = join(testDir, 'tsconfig.json',);
    writeFileSync(tsconfig, JSON.stringify({
      compilerOptions: { strict: true, noEmit: true, },
      include: ['nonexistent.ts'],
    }),);

    const sourceFile = join(testDir, 'nonexistent.ts',);
    writeFileSync(sourceFile, 'const x: number = "not a number";\n',);

    try {
      await execAsync(`bun ${cliPath} --noEmit -p ${tsconfig}`,);
      // Should not reach here -- tsgo should fail on the type error
      expect(true,).toBe(false,);
    } catch (error: unknown) {
      const execError = error as { code: number; stdout: string; };
      expect(execError.code,).toBeGreaterThan(0,);
      expect(execError.stdout,).toContain('error TS',);
    }
  });
});

//endregion Integration tests for CLI execution
