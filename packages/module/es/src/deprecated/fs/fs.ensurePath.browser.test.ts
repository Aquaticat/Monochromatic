import {
  expect,
  test,
} from '@playwright/test';

test.describe('fs.ensurePath browser tests', () => {
  const testFilePath = '/test/file.txt';
  const testDirPath = '/test/dir';

  test.beforeEach(async ({ page, }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.moduleEs !== undefined);

    await page.evaluate(async ([filePath, dirPath]) => {
      const { rm, } = window.moduleEs;
      await rm(filePath, { force: true, recursive: true, });
      await rm(dirPath, { force: true, recursive: true, });
    }, [testFilePath, testDirPath] as const);
  });

  test.describe('ensurePath', () => {
    test('should handle file paths correctly', async ({ page, }) => {
      const result = await page.evaluate(async (filePath) => {
        const { ensurePath, } = window.moduleEs;
        return await ensurePath(filePath);
      }, testFilePath);
      expect(result).toBe(testFilePath);
    });

    test('should handle directory paths correctly', async ({ page, }) => {
      const result = await page.evaluate(async (dirPath) => {
        const { ensurePath, } = window.moduleEs;
        return await ensurePath(dirPath);
      }, testDirPath);
      expect(result).toBe(testDirPath);
    });
  });

  test.describe('ensureDir', () => {
    test('should create and return directory path', async ({ page, }) => {
      const result = await page.evaluate(async (dirPath) => {
        const { ensureDir, } = window.moduleEs;
        return await ensureDir(dirPath);
      }, testDirPath);
      expect(result).toBe(testDirPath);
    });
  });

  test.describe('ensureFile', () => {
    test('should create and return file path', async ({ page, }) => {
      const result = await page.evaluate(async (filePath) => {
        const { ensureFile, } = window.moduleEs;
        return await ensureFile(filePath);
      }, testFilePath);
      expect(result).toBe(testFilePath);
    });
  });
});
