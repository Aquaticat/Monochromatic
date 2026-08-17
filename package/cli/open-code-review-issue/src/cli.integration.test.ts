import {
  chmod,
  mkdtempDisposable,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import {
  delimiter,
  join,
} from 'node:path';
import { fileURLToPath, } from 'node:url';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import spawn, { SubprocessError, } from 'nano-spawn';

/**
 * Built executable artifact under test.
 */
const CLI_PATH = fileURLToPath(new URL('../dist/final/node/cli.mjs', import.meta.url,),);

/**
 * Fake GitHub CLI source implementing version, label, high-water, and create paths.
 */
const FAKE_GH_SOURCE = `#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const args = process.argv.slice(2);
if (args[0] === '--version') {
  process.stdout.write('gh version ' + (process.env.FAKE_GH_VERSION ?? '2.97.0') + ' (fixture)\\n');
} else {
  const method = args[args.indexOf('--method') + 1];
  const endpoint = args[4];
  const inputIndex = args.indexOf('--input');
  const inputPath = inputIndex === -1 ? undefined : args[inputIndex + 1];
  const respond = (status, body) => {
    process.stdout.write('HTTP/2.0 ' + String(status) + ' Fixture\\nContent-Type: application/json\\n\\n' + JSON.stringify(body));
    if (status >= 400) process.exitCode = 1;
  };
  if (endpoint.endsWith('/labels/needs-triage')) {
    respond(404, { message: 'Not Found' });
  } else if (method === 'GET' && endpoint.includes('/issues?')) {
    respond(200, []);
  } else if (method === 'POST' && endpoint.endsWith('/issues')) {
    if (inputPath === undefined) {
      throw new Error('request file is missing');
    }
    const request = JSON.parse(readFileSync(inputPath, 'utf8'));
    if (typeof request.title !== 'string' || typeof request.body !== 'string') {
      throw new Error('invalid issue request');
    }
    respond(201, { number: 1, html_url: 'https://github.com/Aquaticat/issues-api/issues/1' });
  } else {
    respond(404, { message: 'Unexpected fixture endpoint ' + endpoint });
  }
}
`;

/**
 * Creates isolated fake `gh` and OCR input fixture.
 *
 * @param directory - Disposable test directory.
 *
 * @returns Input path and PATH value selecting fake executable.
 */
async function createFixture({
  directory,
}: {
  readonly directory: string;
},): Promise<{
  readonly inputPath: string;
  readonly executablePath: string;
}> {
  /**
   * Fake GitHub CLI executable path.
   */
  const ghPath = `${directory}/gh`;
  await writeFile(ghPath, FAKE_GH_SOURCE, 'utf8',);
  await chmod(ghPath, 0o700,);
  /**
   * Mixed ordinary and security OCR result fixture.
   */
  const inputPath = `${directory}/review.json`;
  await writeFile(inputPath, JSON.stringify({
    status: 'complete',
    comments: [
      {
        path: 'src/ordinary.ts',
        content: 'Ordinary finding.',
        start_line: 1,
        end_line: 1,
        category: 'bug',
      },
      {
        path: 'src/private.ts',
        content: 'SECRET SECURITY CONTENT',
        start_line: 2,
        end_line: 2,
        category: 'security',
      },
    ],
  },), 'utf8',);
  /**
   * Existing process PATH required after fake directory.
   */
  const inheritedPath = process.env.PATH;
  if (inheritedPath === undefined) {
    throw new Error('integration environment has no PATH',);
  }
  return {
    inputPath,
    executablePath: `${directory}${delimiter}${inheritedPath}`,
  };
}

await describe({
  name: 'built CLI with fake gh',
  concurrency: 1,
  children: [
    it({
      name: 'emits one redacted preview JSON object',
      fn: async () => {
        /**
         * Disposable integration directory.
         */
        await using directory = await mkdtempDisposable(join(tmpdir(), 'ocr-issue-cli-',),);
        /**
         * Fake process and OCR fixture paths.
         */
        const fixture = await createFixture({ directory: directory.path, },);
        /**
         * Built CLI preview result.
         */
        const result = await spawn(process.execPath, [
          CLI_PATH,
          '--non-interactive',
          '--repo',
          'https://github.com/Aquaticat/issues-api',
          fixture.inputPath,
        ], {
          cwd: directory.path,
          env: { PATH: fixture.executablePath, },
          stdin: 'ignore',
        },);
        /**
         * Exact preview object.
         */
        const preview: unknown = JSON.parse(result.stdout,);
        expect(result.stdout.trim().split('\n',)).toHaveLength(1,);
        expect(JSON.stringify(preview,),).not.toContain('SECRET',);
        expect(JSON.stringify(preview,),).toContain('"outcome":"preview"',);
        expect(JSON.stringify(preview,),).toContain('"count":1',);
      },
    },),
    it({
      name: 'applies ordinary Issue and emits one final result object',
      fn: async () => {
        /**
         * Disposable integration directory.
         */
        await using directory = await mkdtempDisposable(join(tmpdir(), 'ocr-issue-cli-',),);
        /**
         * Fake process and OCR fixture paths.
         */
        const fixture = await createFixture({ directory: directory.path, },);
        /**
         * Built CLI applied result.
         */
        const result = await spawn(process.execPath, [
          CLI_PATH,
          '--non-interactive',
          '--apply',
          '--non-security-only',
          '--repo',
          'https://github.com/Aquaticat/issues-api',
          fixture.inputPath,
        ], {
          cwd: directory.path,
          env: { PATH: fixture.executablePath, },
          stdin: 'ignore',
        },);
        /**
         * Exact applied object.
         */
        const applied: unknown = JSON.parse(result.stdout,);
        expect(result.stdout.trim().split('\n',)).toHaveLength(1,);
        expect(JSON.stringify(applied,),).toContain('"outcome":"success"',);
        expect(JSON.stringify(applied,),).toContain('"number":1',);
        expect(JSON.stringify(applied,),).toContain(
          '"withheldSecurityPositions":[{"kind":"record","value":2}]',
        );
      },
    },),
    it({
      name: 'emits one final JSON object for applied preflight failure',
      fn: async () => {
        /**
         * Disposable integration directory.
         */
        await using directory = await mkdtempDisposable(join(tmpdir(), 'ocr-issue-cli-',),);
        /**
         * Fake process and OCR fixture paths.
         */
        const fixture = await createFixture({ directory: directory.path, },);
        /**
         * Captured expected nonzero built CLI result.
         */
        let caught: unknown;
        try {
          await spawn(process.execPath, [
            CLI_PATH,
            '--non-interactive',
            '--apply',
            '--repo',
            'https://github.com/Aquaticat/issues-api',
            fixture.inputPath,
          ], {
            cwd: directory.path,
            env: {
              PATH: fixture.executablePath,
              FAKE_GH_VERSION: '2.96.0',
            },
            stdin: 'ignore',
          },);
        }
        catch (error: unknown) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(SubprocessError,);
        /**
         * Captured machine output from expected exit-one command.
         */
        const {stdout} = (caught as SubprocessError);
        expect(stdout.trim().split('\n',)).toHaveLength(1,);
        expect(stdout,).toContain('"outcome":"failed"',);
        expect(stdout,).toContain('GitHub CLI 2.96.0 is unsupported',);
      },
    },),
  ],
},);
