/**
 Tests for the preconditions of a run. The rest of the run needs a display, PipeWire and systemd; the end-to-end task
 exercises it.
 
 @module
 */

import { join, } from 'node:path';
import { tmpdir, } from 'node:os';

import {
  describe,
  it,
} from '@monochromatic-dev/module-test/ts';

import { loadRunConfig, } from './config.ts';
import { checkPreconditions, } from './run.ts';

await describe({
  name: checkPreconditions.name,
  children: [
    it({
      name: 'refuses to start without the release binary, before touching anything else',
      fn: async ({ expect, }) => {
        const appDir = join(tmpdir(), 'e2e-no-such-app',);
        let caught: unknown;
        try {
          await checkPreconditions(loadRunConfig({ appDir, home: tmpdir(), overrides: {}, },),);
        }
        catch (error: unknown) {
          caught = error;
        }
        expect((caught as Error).message,).toBe(
          `the release binary ${join(appDir, 'target', 'release', 'music-player',)} does not exist; the task builds it first`,
        );
      },
    },),
  ],
},);
