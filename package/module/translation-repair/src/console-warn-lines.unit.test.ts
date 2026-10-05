/**
 Tests that `warnLinesDuring` keeps the work's warnings apart from the
 logger's own report of a sink it could not verify.

 IN A CHILD PROCESS, because the logger is built once a process, on its first
 line: only a process whose first line is logged inside the divert shows what
 a case in the suite meets when its file is the first to log. The child's
 working directory holds a regular file where the logger's file sink wants its
 log directory, so that sink's verify fails at once and the logger reports it
 on `console.warn` itself, untagged. A file sink slow to verify under load
 reports the same way five seconds later (ledger B140); the regular file
 stands in for the load without waiting on it.

 Fixtures are cat-themed invention.

 @module
 */

import { spawnSync, } from 'node:child_process';
import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { pathToFileURL, } from 'node:url';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { scratchDir, } from './scratch-dir.test-fixture.ts';

//region Console warn lines tests

/**
 What the logger writes before its own report of a failure inside it.
 */
const LOGGER_REPORT_PREFIX = 'logger internal error: ';

/**
 Source the child runs: one warning logged through the built package inside
 `warnLinesDuring`, as the first line of the child's process, and the warnings
 kept printed as JSON.

 @returns Module source for `node --input-type=module --eval`

 @example
 ```ts
 spawnSync(process.execPath, ['--input-type=module', '--eval', childSource(),],);
 ```
 */
function childSource(): string {
  /**
   The fixture under test, by absolute URL so the child's working directory
   can be anywhere.
   */
  const fixture = pathToFileURL(join(
    import.meta.dirname,
    'console-warn-lines.test-fixture.ts',
  ),).href;
  /**
   The built package the fixture reads its logger from.
   */
  const built = pathToFileURL(join(
    import.meta.dirname,
    '..',
    'dist',
    'final',
    'node',
    'index.mjs',
  ),).href;
  return [
    `const { warnLinesDuring } = await import(${JSON.stringify(fixture,)});`,
    `const { contextRoot } = await import(${JSON.stringify(built,)});`,
    'const { warned } = await warnLinesDuring({',
    '  run: async () => { contextRoot({ tag: "whiskers" }).warn("purr"); return "napped"; },',
    '});',
    'process.stdout.write(JSON.stringify(warned));',
  ].join('\n',);
}

await describe({
  name: 'warnLinesDuring',
  children: [
    it({
      name: 'KEEPS the work\'s warning and SENDS the logger\'s own report of a sink it could not verify to the console '
        + 'the divert stood in for, where the first line of the process starts the logger inside the divert '
        + '(ledger B140)',
      fn: async () => {
        await using scratch = await scratchDir({ prefix: 'console-warn-lines-', },);
        await mkdir(join(
          scratch.path,
          'node_modules',
        ),);
        // A FILE WHERE THE LOG DIRECTORY GOES: the file sink's verify makes the
        // directory and fails on the file standing there.
        await writeFile(
          join(
            scratch.path,
            'node_modules',
            '.monochromatic',
          ),
          'a cat sleeps here, not a log\n',
        );
        /**
         The child as it finished, whatever it exited with.
         */
        const child = spawnSync(
          process.execPath,
          [
            '--input-type=module',
            '--eval',
            childSource(),
          ],
          {
            cwd: scratch.path,
            encoding: 'utf8',
          },
        );
        // A SPAWN FAULT IS NOT A RESULT: reading past it would compare two
        // empty streams.
        if (child.error !== undefined)
          throw new Error(`the child never started, so nothing was exercised (${child.error.name})`,);
        expect({
          status: child.status,
          stdout: child.stdout,
          reports: child.stderr
            .split('\n',)
            .filter(function isLoggerReport(line,): boolean {
              return line.startsWith(LOGGER_REPORT_PREFIX,);
            },),
        },).toStrictEqual({
          status: 0,
          stdout: JSON.stringify(['[whiskers] purr',],),
          reports: [
            `${LOGGER_REPORT_PREFIX}file sink verification failed: EEXIST: file already exists, mkdir '${
              join(
                scratch.path,
                'node_modules',
                '.monochromatic',
              )
            }'`,
          ],
        },);
      },
    },),
  ],
},);

//endregion Console warn lines tests
