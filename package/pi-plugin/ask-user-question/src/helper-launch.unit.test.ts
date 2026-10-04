import {
  mkdtemp,
  rm,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  AnswerLaunchError,
  resolveAnswerRuntime,
} from '../dist/final/node/index.mjs';

await describe({
  name: resolveAnswerRuntime.name,
  children: [
    it({
      name: 'uses original executable on platforms without procfs',
      fn: async () => {
        expect(await resolveAnswerRuntime({ platform: 'darwin', },),).toBe(process.execPath,);
      },
    },),
    it({
      name: 'falls back to installed executable when procfs is unavailable',
      fn: async () => {
        expect(await resolveAnswerRuntime({ platform: 'linux', pid: 0, },),).toBe(process.execPath,);
      },
    },),
    it({
      name: 'reports missing runtime with original cause and restart remediation',
      fn: async () => {
        const directory = await mkdtemp(join(tmpdir(), 'ask-runtime-',),);
        try {
          const execPath = join(directory, 'missing-node',);
          let caught: unknown;
          try {
            await resolveAnswerRuntime({ platform: 'darwin', execPath, },);
          }
          catch (error: unknown) {
            caught = error;
          }
          expect(caught,).toBeInstanceOf(AnswerLaunchError,);
          if (!(caught instanceof AnswerLaunchError))
            throw new Error('Expected runtime launch diagnostic.',);
          expect(caught.message,).toContain(execPath,);
          expect(caught.message,).toContain('Restart Pi',);
          expect(caught.cause,).toHaveProperty('code', 'ENOENT',);
        }
        finally {
          await rm(directory, { recursive: true, force: true, },);
        }
      },
    },),
  ],
},);
