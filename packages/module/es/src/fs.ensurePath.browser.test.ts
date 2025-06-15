import {
  ensureDir,
  ensureFile,
  ensurePath,
  logtapeConfiguration,
  logtapeConfigure,
  rm,
} from '@monochromatic-dev/module-es';
import {
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe('fs.ensurePath browser tests', () => {
  // Define test paths that should work in browser environment
  const testFilePath = '/test/file.txt';
  const testDirPath = '/test/dir';

  beforeEach(async () => {
    await rm(testFilePath, { force: true, recursive: true });
    await rm(testDirPath, { force: true, recursive: true });
  });

  describe(ensurePath, () => {
    it('should handle file paths correctly', async () => {
      const result = await ensurePath(testFilePath);
      expect(result).toBe(testFilePath);
    });

    it('should handle directory paths correctly', async () => {
      const result = await ensurePath(testDirPath);
      expect(result).toBe(testDirPath);
    });
  });

  describe(ensureDir, () => {
    it('should create and return directory path', async () => {
      const result = await ensureDir(testDirPath);
      expect(result).toBe(testDirPath);
    });
  });

  describe(ensureFile, () => {
    it('should create and return file path', async () => {
      const result = await ensureFile(testFilePath);
      expect(result).toBe(testFilePath);
    });
  });
});
