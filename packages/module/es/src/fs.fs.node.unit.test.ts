import {
  mkdir,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  describe,
  expect,
  test,
} from 'vitest';
import { readTextFile } from './fs.fs.node.ts';

//region Test Setup -- Creates temporary files for filesystem testing

const testDir = join(tmpdir(), 'monochromatic-fs-test');
const testFilePath = join(testDir, 'test-file.txt');
const testContent = 'Hello, World!\nThis is a test file.\n🚀 Unicode support test.';

//endregion Test Setup

describe('readTextFile', () => {
  test('reads UTF-8 text file correctly', async () => {
    // Setup: Create test directory and file
    await mkdir(testDir, { recursive: true });
    await writeFile(testFilePath, testContent, 'utf8');

    // Execute: Read the file
    const result = await readTextFile(testFilePath);

    // Verify: Content matches exactly
    expect(result).toBe(testContent);

    // Cleanup
    await unlink(testFilePath);
  });

  test('reads empty file correctly', async () => {
    const emptyFilePath = join(testDir, 'empty-file.txt');

    // Setup: Create empty file
    await mkdir(testDir, { recursive: true });
    await writeFile(emptyFilePath, '', 'utf8');

    // Execute: Read the empty file
    const result = await readTextFile(emptyFilePath);

    // Verify: Returns empty string
    expect(result).toBe('');

    // Cleanup
    await unlink(emptyFilePath);
  });

  test('handles files with special characters', async () => {
    const specialContent =
      'Special chars: æøå ñ 中文 🎉\nNewlines\n\tTabs\r\nWindows line endings';
    const specialFilePath = join(testDir, 'special-chars.txt');

    // Setup: Create file with special characters
    await mkdir(testDir, { recursive: true });
    await writeFile(specialFilePath, specialContent, 'utf8');

    // Execute: Read the file
    const result = await readTextFile(specialFilePath);

    // Verify: Special characters are preserved
    expect(result).toBe(specialContent);

    // Cleanup
    await unlink(specialFilePath);
  });

  test('throws error for non-existent file', async () => {
    const nonExistentPath = join(testDir, 'does-not-exist.txt');

    // Execute & Verify: Should throw ENOENT error
    await expect(readTextFile(nonExistentPath)).rejects.toThrow();
  });

  test('throws error for directory instead of file', async () => {
    // Setup: Ensure test directory exists
    await mkdir(testDir, { recursive: true });

    // Execute & Verify: Should throw EISDIR error when trying to read directory
    await expect(readTextFile(testDir)).rejects.toThrow();
  });
});
