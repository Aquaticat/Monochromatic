/**
 * Tests for file-based IPC ({@link writeCompactFile}, {@link readCompactFile}).
 *
 * @module
 */

import { existsSync, } from 'node:fs';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';
import {
  readCompactFile,
  writeCompactFile,
  type WriteCompactFileResult,
} from './ipc-file.ts';

/** Disposable wrapper for writeCompactFile cleanup. */
class FileDisposable implements Disposable {
  readonly #cleanup: () => void;

  constructor(cleanup: () => void,) {
    this.#cleanup = cleanup;
  }

  [Symbol.dispose](): void {
    this.#cleanup();
  }
}

/** Wrap a writeCompactFile result so `using` calls cleanup automatically. */
function usingCompactFile(
  result: WriteCompactFileResult,
): FileDisposable & {
  filePath: string;
} {
  return {
    filePath: result.filePath,
    [Symbol.dispose]: result.cleanup,
  } as FileDisposable & {
    filePath: string;
  };
}

await describe({
  name: '',
  children: [
    describe({
      name: writeCompactFile.name,
      children: [
        it({
          name: 'writes text to a temp file under /tmp',
          fn: async () => {
            const text = 'compressed context content';
            using file = usingCompactFile(writeCompactFile(text,),);

            expect(file.filePath,).toContain('morph-compact-',);
            expect(existsSync(file.filePath,),).toBe(true,);

            const content = readCompactFile(file.filePath,);
            expect(content,).toBe(text,);
          },
        },),
        it({
          name: 'handles empty string',
          fn: async () => {
            using file = usingCompactFile(writeCompactFile('',),);

            const content = readCompactFile(file.filePath,);
            expect(content,).toBe('',);
          },
        },),
        it({
          name: 'handles large text (100KB+)',
          fn: async () => {
            const text = 'x'.repeat(150_000,);
            using file = usingCompactFile(writeCompactFile(text,),);

            const content = readCompactFile(file.filePath,);
            expect(content,).toBe(text,);
            expect(content.length,).toBe(150_000,);
          },
        },),
        it({
          name: 'handles text with special characters',
          fn: async () => {
            const text = 'hello\nworld\t"quotes" \'single\' $var `backtick` \\slash\\';
            using file = usingCompactFile(writeCompactFile(text,),);

            const content = readCompactFile(file.filePath,);
            expect(content,).toBe(text,);
          },
        },),
        it({
          name: 'handles binary-safe Unicode content',
          fn: async () => {
            const text = 'unicode: \u0000\u0001\u0002 emoji: 🎉🚀 cjk: 中文日本語';
            using file = usingCompactFile(writeCompactFile(text,),);

            const content = readCompactFile(file.filePath,);
            expect(content,).toBe(text,);
          },
        },),
        it({
          name: 'creates unique paths for each call',
          fn: async () => {
            const first = writeCompactFile('first',);
            const second = writeCompactFile('second',);

            expect(first.filePath,).not.toBe(second.filePath,);

            first.cleanup();
            second.cleanup();
          },
        },),
      ],
    },),
    describe({
      name: 'readCompactFile.name',
      children: [
        it({
          name: 'reads content written by writeCompactFile',
          fn: async () => {
            const text = 'round-trip test data';
            using file = usingCompactFile(writeCompactFile(text,),);

            const content = readCompactFile(file.filePath,);
            expect(content,).toBe(text,);
          },
        },),
      ],
    },),
    describe({
      name: 'cleanup',
      children: [
        it({
          name: 'removes the temp directory after cleanup',
          fn: async () => {
            const { filePath, cleanup } = writeCompactFile('data',);
            // oxlint-disable-next-line no-restricted-syntax -- verifying cleanup behavior
            const dir = filePath.split('/').slice(0, -1).join('/');

            expect(existsSync(filePath,),).toBe(true,);

            cleanup();

            expect(existsSync(filePath,),).toBe(false,);
            expect(existsSync(dir,),).toBe(false,);
          },
        },),
        it({
          name: 'is safe to call multiple times',
          fn: async () => {
            const { cleanup } = writeCompactFile('data',);

            cleanup();
            // Second call should not throw
            cleanup();
          },
        },),
      ],
    },),
  ],
},);
