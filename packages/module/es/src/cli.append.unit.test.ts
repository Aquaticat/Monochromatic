import {
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import { findUp, } from 'find-up';
import { exec, } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { readFile, } from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';
import { promisify, } from 'node:util';
import {
  describe,
  expect,
  test as baseTest,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration(),);

const execAsync = promisify(exec,);

type AppendTestFixtures = {
  cliPath: string;
  testDir: string;
  testFile: string;
};

const test = baseTest.extend<AppendTestFixtures>({
  cliPath: async ({}, use,) => {
    const testFileDir = import.meta.dirname;
    const cliPath = join(testFileDir, 'cli.append.ts',);
    await use(cliPath,);
  },

  testDir: async ({}, use,) => {
    const testFileDir = import.meta.dirname;
    const packageJsonPath = await findUp('package.json', { cwd: testFileDir, },);
    if (!packageJsonPath)
      throw new Error('Could not find package.json',);

    const packageDir = dirname(packageJsonPath,);
    const timestamp = Date.now();
    const randomId = Math.random().toString(36,).substring(2, 8,);
    const testDir = join(packageDir, 'dist', 'temp', 'test',
      `cli-append-${timestamp}-${randomId}`,);

    // Create test directory
    if (!existsSync(testDir,))
      mkdirSync(testDir, { recursive: true, },);

    await use(testDir,);

    // Clean up test directory
    if (existsSync(testDir,))
      rmdirSync(testDir, { recursive: true, },);
  },

  testFile: async ({ testDir, }, use,) => {
    const testFile = join(testDir, 'test.txt',);

    // Create test file
    writeFileSync(testFile, 'Initial content\n',);

    await use(testFile,);

    // Clean up test file
    if (existsSync(testFile,))
      unlinkSync(testFile,);
  },
},);

describe('cli.append', () => {
  test('appends single line to existing file', async ({ cliPath, testFile, },) => {
    const { stdout, stderr, } = await execAsync(
      `bun ${cliPath} "new line" --to ${testFile}`,
    );

    expect(stderr,).toBe('',);

    const content = await readFile(testFile, 'utf-8',);
    expect(content,).toBe('Initial content\nnew line\n',);
  });

  test('appends multiple lines as separate arguments', async ({ cliPath, testFile, },) => {
    const { stdout, stderr, } = await execAsync(
      `bun ${cliPath} "line 1" "line 2" "line 3" --to ${testFile}`,
    );

    expect(stderr,).toBe('',);

    const content = await readFile(testFile, 'utf-8',);
    expect(content,).toBe('Initial content\nline 1\nline 2\nline 3\n',);
  });

  test('appends multiline text with newline characters', async ({ cliPath, testFile, },) => {
    const { stdout, stderr, } = await execAsync(
      `bun ${cliPath} "line 1\\nline 2" --to ${testFile}`,
    );

    expect(stderr,).toBe('',);

    const content = await readFile(testFile, 'utf-8',);
    expect(content,).toBe('Initial content\nline 1\\nline 2\n',);
  });

  test('uses short flag -t for target file', async ({ cliPath, testFile, },) => {
    const { stdout, stderr, } = await execAsync(
      `bun ${cliPath} "short flag test" -t ${testFile}`,
    );

    expect(stderr,).toBe('',);

    const content = await readFile(testFile, 'utf-8',);
    expect(content,).toBe('Initial content\nshort flag test\n',);
  });

  test('fails when no text is provided', async ({ cliPath, testFile, },) => {
    await expect(execAsync(`bun ${cliPath} --to ${testFile}`,),).rejects.toThrow();
  });

  test('fails when no target file is specified', async ({ cliPath, },) => {
    await expect(execAsync(`bun ${cliPath} "some text"`,),).rejects.toThrow();
  });

  test('fails when target file does not exist', async ({ cliPath, testDir, },) => {
    const nonExistentFile = join(testDir, 'non-existent.txt',);
    await expect(execAsync(`bun ${cliPath} "text" --to ${nonExistentFile}`,),)
      .rejects
      .toThrow();
  });

  test('fails when file has no write permissions', {
    skip: process.platform === 'win32',
  }, async ({ cliPath, testFile, },) => {
    // Make file read-only
    writeFileSync(testFile, 'read only content\n', { mode: 0o444, },);

    await expect(execAsync(`bun ${cliPath} "text" --to ${testFile}`,),).rejects.toThrow();
  },); // Skip on Windows as permissions work differently

  test('preserves existing file content', async ({ cliPath, testFile, },) => {
    // Add some initial content
    writeFileSync(testFile, 'Line 1\nLine 2\n',);

    await execAsync(`bun ${cliPath} "Line 3" --to ${testFile}`,);

    const content = await readFile(testFile, 'utf-8',);
    expect(content,).toBe('Line 1\nLine 2\nLine 3\n',);
  });

  test('handles empty string as valid input', async ({ cliPath, testFile, },) => {
    await execAsync(`bun ${cliPath} "" --to ${testFile}`,);

    const content = await readFile(testFile, 'utf-8',);
    expect(content,).toBe('Initial content\n\n',);
  });

  test('handles special characters in text', async ({ cliPath, testFile, },) => {
    const specialText = '"Hello $USER!" && echo \'test\' | cat';
    await execAsync(`bun ${cliPath} "${specialText}" --to ${testFile}`,);

    const content = await readFile(testFile, 'utf-8',);
    expect(content,).toBe(`Initial content\n${specialText}\n`,);
  });

  test('appends multiple times to the same file', async ({ cliPath, testFile, },) => {
    await execAsync(`bun ${cliPath} "First append" --to ${testFile}`,);
    await execAsync(`bun ${cliPath} "Second append" --to ${testFile}`,);
    await execAsync(`bun ${cliPath} "Third append" --to ${testFile}`,);

    const content = await readFile(testFile, 'utf-8',);
    expect(content,).toBe(
      'Initial content\nFirst append\nSecond append\nThird append\n',
    );
  });
});
