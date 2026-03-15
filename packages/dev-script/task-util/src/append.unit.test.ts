import { exec, } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { readFile, } from 'node:fs/promises';
import { join, } from 'node:path';
import { promisify, } from 'node:util';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';

const execAsync = promisify(exec,);

//region Fixture Setup -- Per-test fixtures replacing vitest test.extend

let cliPath: string;
let testDir: string;
let testFile: string;

beforeEach(() => {
  // cliPath fixture
  const testFileDir = import.meta.dirname;
  cliPath = join(testFileDir, 'append.ts',);

  // testDir fixture — import.meta.dirname is src/, so parent is the package root
  const packageDir = join(testFileDir, '..',);
  const timestamp = Date.now();
  const randomId = Math.random().toString(36,).slice(2, 8,);
  testDir = join(packageDir, 'dist', 'temp', 'test',
    `cli-append-${timestamp}-${randomId}`,);

  if (!existsSync(testDir,))
    mkdirSync(testDir, { recursive: true, },);

  // testFile fixture
  testFile = join(testDir, 'test.txt',);
  writeFileSync(testFile, 'Initial content\n',);
});

afterEach(() => {
  // Clean up test file
  if (existsSync(testFile,))
    unlinkSync(testFile,);

  // Clean up test directory
  if (existsSync(testDir,))
    rmSync(testDir, { recursive: true, },);
});

//endregion Fixture Setup

describe('task-append', () => {
  test('appends single line to existing file', async () => {
    const { stdout, stderr, } = await execAsync(
      `bun ${cliPath} "new line" --to ${testFile}`,
    );

    expect(stderr,).toBe('',);

    const content = await readFile(testFile, 'utf8',);
    expect(content,).toBe('Initial content\nnew line\n',);
  });

  test('appends multiple lines as separate arguments', async () => {
    const { stdout, stderr, } = await execAsync(
      `bun ${cliPath} "line 1" "line 2" "line 3" --to ${testFile}`,
    );

    expect(stderr,).toBe('',);

    const content = await readFile(testFile, 'utf8',);
    expect(content,).toBe('Initial content\nline 1\nline 2\nline 3\n',);
  });

  test('appends multiline text with newline characters', async () => {
    const { stdout, stderr, } = await execAsync(
      `bun ${cliPath} "line 1\\nline 2" --to ${testFile}`,
    );

    expect(stderr,).toBe('',);

    const content = await readFile(testFile, 'utf8',);
    expect(content,).toBe('Initial content\nline 1\\nline 2\n',);
  });

  test('uses short flag -t for target file', async () => {
    const { stdout, stderr, } = await execAsync(
      `bun ${cliPath} "short flag test" -t ${testFile}`,
    );

    expect(stderr,).toBe('',);

    const content = await readFile(testFile, 'utf8',);
    expect(content,).toBe('Initial content\nshort flag test\n',);
  });

  test('fails when no text is provided', async () => {
    await expect(execAsync(`bun ${cliPath} --to ${testFile}`,),).rejects.toThrow();
  });

  test('fails when no target file is specified', async () => {
    await expect(execAsync(`bun ${cliPath} "some text"`,),).rejects.toThrow();
  });

  test('fails when target file does not exist', async () => {
    const nonExistentFile = join(testDir, 'non-existent.txt',);
    await expect(execAsync(`bun ${cliPath} "text" --to ${nonExistentFile}`,),)
      .rejects
      .toThrow();
  });

  test.skipIf(process.platform === 'win32',)('fails when file has no write permissions', async () => {
    // Make file read-only
    writeFileSync(testFile, 'read only content\n', { mode: 0o444, },);

    // Bun's appendFile may bypass POSIX permissions in some environments; skip when that happens
    try {
      const { appendFile: nodeAppendFile, } = await import('node:fs/promises');
      await nodeAppendFile(testFile, 'probe',);
      // If we get here, permissions aren't enforced — skip assertion
      return;
    }
    catch {
      // Permissions enforced, proceed with test
    }

    await expect(execAsync(`bun ${cliPath} "text" --to ${testFile}`,),).rejects.toThrow();
  },);

  test('preserves existing file content', async () => {
    // Add some initial content
    writeFileSync(testFile, 'Line 1\nLine 2\n',);

    await execAsync(`bun ${cliPath} "Line 3" --to ${testFile}`,);

    const content = await readFile(testFile, 'utf8',);
    expect(content,).toBe('Line 1\nLine 2\nLine 3\n',);
  });

  test('handles empty string as valid input', async () => {
    await execAsync(`bun ${cliPath} "" --to ${testFile}`,);

    const content = await readFile(testFile, 'utf8',);
    expect(content,).toBe('Initial content\n\n',);
  });

  test('handles special characters in text', async () => {
    // Use single quotes to prevent shell expansion of $USER and other special chars
    const specialText = 'Hello && echo test | cat';
    await execAsync(`bun ${cliPath} '${specialText}' --to ${testFile}`,);

    const content = await readFile(testFile, 'utf8',);
    expect(content,).toBe(`Initial content\n${specialText}\n`,);
  });

  test('appends multiple times to the same file', async () => {
    await execAsync(`bun ${cliPath} "First append" --to ${testFile}`,);
    await execAsync(`bun ${cliPath} "Second append" --to ${testFile}`,);
    await execAsync(`bun ${cliPath} "Third append" --to ${testFile}`,);

    const content = await readFile(testFile, 'utf8',);
    expect(content,).toBe(
      'Initial content\nFirst append\nSecond append\nThird append\n',
    );
  });
});
