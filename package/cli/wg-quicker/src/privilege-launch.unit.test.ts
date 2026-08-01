import { spawn, } from 'node:child_process';
import { once, } from 'node:events';
import {
  chmod,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

/**
 * Built CLI artifact exercised at process privilege boundary.
 */
const CLI_BUNDLE_PATH = new URL(
  '../dist/final/node/index.mjs',
  import.meta.url,
).pathname;

await describe({
  name: 'privilege launch',
  children: [
    it({
      name: 'relaunches exact runtime and script through sudo before reading config',
      fn: async () => {
        /**
         * Disposable directory containing fake sudo command and invocation record.
         */
        const directory = await mkdtemp(join(
          tmpdir(),
          'wg-quicker-privilege-',
        ),);
        await using cleanup = {
          /**
           * Removes disposable fake command and record.
           */
          async [Symbol.asyncDispose](): Promise<void> {
            await rm(
              directory,
              {
                force: true,
                recursive: true,
              },
            );
          },
        };
        /**
         * Path at which fake sudo records exact argument vector.
         */
        const recordPath = join(
          directory,
          'invocation.json',
        );
        /**
         * Executable fake sudo found before system command in child PATH.
         */
        const sudoPath = join(
          directory,
          'sudo',
        );
        await writeFile(
          sudoPath,
          `#!/usr/bin/env node\nconst { writeFileSync } = require('node:fs');\nwriteFileSync(process.env.WG_QUICKER_TEST_SUDO_RECORD, JSON.stringify(process.argv.slice(2)));\n`,
        );
        await chmod(
          sudoPath,
          0o700,
        );
        /**
         * Non-root CLI process expected to delegate before opening absent config.
         */
        const child = spawn(
          process.execPath,
          [
            CLI_BUNDLE_PATH,
            'up',
            '/does-not-exist/restricted.conf',
          ],
          {
            env: {
              ...process.env,
              PATH: `${directory}:${process.env.PATH ?? ''}`,
              WG_QUICKER_TEST_SUDO_RECORD: recordPath,
            },
            stdio: 'ignore',
          },
        );
        await once(
          child,
          'close',
        );
        expect(child.exitCode,).toBe(0,);
        /**
         * Parsed exact sudo invocation recorded by fake command.
         */
        const invocation: unknown = JSON.parse(await readFile(
          recordPath,
          'utf8',
        ),);
        expect(invocation,).toEqual([
          '--',
          process.execPath,
          CLI_BUNDLE_PATH,
          'up',
          '/does-not-exist/restricted.conf',
        ],);
      },
    },),
  ],
},);
