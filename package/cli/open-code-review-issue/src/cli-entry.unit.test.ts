import { PassThrough, } from 'node:stream';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { runCli, } from '../dist/final/node/index.mjs';

/**
 * Writable capture stream for CLI output assertions.
 */
class CaptureStream extends PassThrough {
  /**
   * Captured output chunks.
   */
  readonly #chunks: Buffer[] = [];

  /**
   * Creates capture stream and data listener.
   */
  public constructor() {
    super();
    this.on('data', (chunk: Buffer,) => {
      this.#chunks.push(chunk,);
    },);
  }

  /**
   * Returns complete UTF-8 output.
   *
   * @returns Concatenated stream text.
   */
  public text(): string {
    return Buffer.concat(this.#chunks,).toString('utf8',);
  }
}

await describe({
  name: runCli.name,
  children: [
    it({
      name: 'prints help without requiring mode',
      fn: async () => {
        /**
         * Captured standard output.
         */
        const stdout = new CaptureStream();
        /**
         * Captured standard error.
         */
        const stderr = new CaptureStream();
        /**
         * Empty standard input.
         */
        const stdin = new PassThrough();

        expect(await runCli({
          arguments: ['--help',],
          cwd: process.cwd(),
          streams: { stdin, stdout, stderr, },
        },),).toBe(0,);
        expect(stdout.text(),).toContain('Usage:',);
        expect(stderr.text(),).toBe('',);
      },
    },),
    it({
      name: 'maps invocation misuse to status two',
      fn: async () => {
        /**
         * Captured standard output.
         */
        const stdout = new CaptureStream();
        /**
         * Captured standard error.
         */
        const stderr = new CaptureStream();
        /**
         * Empty standard input.
         */
        const stdin = new PassThrough();

        expect(await runCli({
          arguments: [],
          cwd: process.cwd(),
          streams: { stdin, stdout, stderr, },
        },),).toBe(2,);
        expect(stdout.text(),).toBe('',);
        expect(stderr.text(),).toContain('exactly one',);
      },
    },),
  ],
},);
