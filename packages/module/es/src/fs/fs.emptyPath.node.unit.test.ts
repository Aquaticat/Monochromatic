import {
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest';
import {
  emptyDir,
  emptyFile,
  emptyPath,
  removeEmptyFilesInDir,
} from './fs.emptyPath.ts';

await logtapeConfigure(await logtapeConfiguration(),);

describe('fs.emptyPath', () => {
  describe(emptyPath, () => {
    test('empties file when path has extension', async () => {
      const testDir = await mkdtemp(join(tmpdir(), 'fs-emptyPath-test-',),);
      const filePath = join(testDir, 'test.txt',);
      await writeFile(filePath, 'some content',);

      const result = await emptyPath(filePath,);

      expect(result,).toBe(filePath,);
      const content = await readFile(filePath, 'utf8',);
      expect(content,).toBe('',);
    });

    test('empties directory when path has no extension', async () => {
      const testDir = await mkdtemp(join(tmpdir(), 'fs-emptyPath-test-',),);
      // Create some files in the directory
      const file1 = join(testDir, 'file1.txt',);
      const file2 = join(testDir, 'file2.txt',);
      await writeFile(file1, 'content1',);
      await writeFile(file2, 'content2',);

      const result = await emptyPath(testDir,);

      expect(result,).toBe(testDir,);
      const entries = await readdir(testDir,);
      expect(entries,).toHaveLength(0,);
    });

    test('handles file path with subdirectory', async () => {
      const testDir = await mkdtemp(join(tmpdir(), 'fs-emptyPath-test-',),);
      const subDir = join(testDir, 'subdir',);
      await mkdir(subDir, { recursive: true, },);
      const filePath = join(subDir, 'test.txt',);
      await writeFile(filePath, 'content',);

      const result = await emptyPath(filePath,);

      expect(result,).toBe(filePath,);
      const content = await readFile(filePath, 'utf8',);
      expect(content,).toBe('',);
    });
  },);

  describe(emptyDir, () => {
    test('removes all files from directory', async () => {
      const testDir = await mkdtemp(join(tmpdir(), 'fs-emptyPath-test-',),);
      const file1 = join(testDir, 'file1.txt',);
      const file2 = join(testDir, 'file2.json',);
      await writeFile(file1, 'content1',);
      await writeFile(file2, 'content2',);

      const result = await emptyDir(testDir,);

      expect(result,).toBe(testDir,);
      const entries = await readdir(testDir,);
      expect(entries,).toHaveLength(0,);
    });

    test('removes subdirectories recursively', async () => {
      const testDir = await mkdtemp(join(tmpdir(), 'fs-emptyPath-test-',),);
      const subDir = join(testDir, 'subdir',);
      await mkdir(subDir, { recursive: true, },);
      const nestedFile = join(subDir, 'nested.txt',);
      await writeFile(nestedFile, 'nested content',);

      const result = await emptyDir(testDir,);

      expect(result,).toBe(testDir,);
      const entries = await readdir(testDir,);
      expect(entries,).toHaveLength(0,);
    });

    test('handles empty directory', async () => {
      const testDir = await mkdtemp(join(tmpdir(), 'fs-emptyPath-test-',),);
      const emptySubDir = join(testDir, 'empty',);
      await mkdir(emptySubDir, { recursive: true, },);

      const result = await emptyDir(emptySubDir,);

      expect(result,).toBe(emptySubDir,);
      const entries = await readdir(emptySubDir,);
      expect(entries,).toHaveLength(0,);
    });
  },);

  describe(emptyFile, () => {
    test('empties existing file', async () => {
      const testDir = await mkdtemp(join(tmpdir(), 'fs-emptyPath-test-',),);
      const filePath = join(testDir, 'test.txt',);
      await writeFile(filePath, 'existing content',);

      const result = await emptyFile(filePath,);

      expect(result,).toBe(filePath,);
      const content = await readFile(filePath, 'utf8',);
      expect(content,).toBe('',);
    });

    test('creates empty file if not exists', async () => {
      const testDir = await mkdtemp(join(tmpdir(), 'fs-emptyPath-test-',),);
      const filePath = join(testDir, 'new.txt',);

      const result = await emptyFile(filePath,);

      expect(result,).toBe(filePath,);
      const content = await readFile(filePath, 'utf8',);
      expect(content,).toBe('',);
    });

    test('handles nested file paths', async () => {
      const testDir = await mkdtemp(join(tmpdir(), 'fs-emptyPath-test-',),);
      const subDir = join(testDir, 'nested', 'path',);
      await mkdir(subDir, { recursive: true, },);
      const filePath = join(subDir, 'test.txt',);
      await writeFile(filePath, 'content',);

      const result = await emptyFile(filePath,);

      expect(result,).toBe(filePath,);
      const content = await readFile(filePath, 'utf8',);
      expect(content,).toBe('',);
    });

    test('handles paths with Vite query parameters', async () => {
      const testDir = await mkdtemp(join(tmpdir(), 'fs-emptyPath-test-',),);
      const filePath = join(testDir, 'styles.css',);
      await writeFile(filePath, '.class { color: red; }',);

      // Test with ?raw query parameter
      const result = await emptyFile(filePath + '?raw',);

      expect(result,).toBe(filePath + '?raw',);
      const content = await readFile(filePath, 'utf8',);
      expect(content,).toBe('',);
    });
  },);

  describe(removeEmptyFilesInDir, () => {
    test('removes empty files', async () => {
      const testDir = await mkdtemp(join(tmpdir(), 'fs-emptyPath-test-',),);
      const emptyFile1 = join(testDir, 'empty1.txt',);
      const emptyFile2 = join(testDir, 'empty2.txt',);
      const nonEmptyFile = join(testDir, 'nonempty.txt',);

      await writeFile(emptyFile1, '',);
      await writeFile(emptyFile2, '   ',); // whitespace only
      await writeFile(nonEmptyFile, 'content',);

      const result = await removeEmptyFilesInDir(testDir,);

      expect(result,).toBe(testDir,);
      const entries = await readdir(testDir,);
      expect(entries,).toHaveLength(1,);
      expect(entries[0],).toBe('nonempty.txt',);
    });

    test('ignores directories', async () => {
      const testDir = await mkdtemp(join(tmpdir(), 'fs-emptyPath-test-',),);
      const subDir = join(testDir, 'subdir',);
      const emptyFile = join(testDir, 'empty.txt',);

      await mkdir(subDir, { recursive: true, },);
      await writeFile(emptyFile, '',);

      const result = await removeEmptyFilesInDir(testDir,);

      expect(result,).toBe(testDir,);
      const entries = await readdir(testDir,);
      expect(entries,).toHaveLength(1,);
      expect(entries[0],).toBe('subdir',);

      // Verify directory still exists
      const stats = await stat(join(testDir, 'subdir',),);
      expect(stats.isDirectory(),).toBe(true,);
    });

    test('handles directory with no empty files', async () => {
      const testDir = await mkdtemp(join(tmpdir(), 'fs-emptyPath-test-',),);
      const file1 = join(testDir, 'file1.txt',);
      const file2 = join(testDir, 'file2.txt',);

      await writeFile(file1, 'content1',);
      await writeFile(file2, 'content2',);

      const result = await removeEmptyFilesInDir(testDir,);

      expect(result,).toBe(testDir,);
      const entries = await readdir(testDir,);
      expect(entries,).toHaveLength(2,);
      expect(entries.sort(),).toEqual(['file1.txt', 'file2.txt',],);
    });

    test('handles empty directory', async () => {
      const testDir = await mkdtemp(join(tmpdir(), 'fs-emptyPath-test-',),);
      const result = await removeEmptyFilesInDir(testDir,);

      expect(result,).toBe(testDir,);
      const entries = await readdir(testDir,);
      expect(entries,).toHaveLength(0,);
    });
  },);
});
