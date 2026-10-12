/**
 Tests for the preconditions of a run. The rest of the run needs a display, PipeWire and systemd; the end-to-end task
 exercises it.
 
 @module
 */

import {
  chmod,
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
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
    it({
      name: 'refuses a compositor that does not exist, before asking PipeWire',
      fn: async ({ expect, }) => {
        const appDir = await mkdtemp(join(tmpdir(), 'e2e-pre-',),);
        await mkdir(join(appDir, 'target', 'release',), { recursive: true, },);
        await writeFile(join(appDir, 'target', 'release', 'music-player',), '',);
        const compositor = join(appDir, 'no-such-compositor',);
        let caught: unknown;
        try {
          await checkPreconditions(loadRunConfig({
            appDir,
            home: tmpdir(),
            overrides: { compositorPath: compositor, },
          },),);
        }
        catch (error: unknown) {
          caught = error;
        }
        await rm(appDir, { recursive: true, force: true, },);
        expect((caught as Error).message,).toBe(
          `the compositor ${compositor} does not exist; install it or set E2E_COMPOSITOR`,
        );
      },
    },),
    it({
      name: 'refuses a compositor older than the checks need, naming both ways out',
      fn: async ({ expect, }) => {
        const appDir = await mkdtemp(join(tmpdir(), 'e2e-pre-',),);
        await mkdir(join(appDir, 'target', 'release',), { recursive: true, },);
        await writeFile(join(appDir, 'target', 'release', 'music-player',), '',);
        const compositor = join(appDir, 'old-compositor',);
        await writeFile(compositor, '#!/usr/bin/env node\nconsole.log("monochromatic-nested-wayland-session 0.3.0");\n',);
        await chmod(compositor, 0o700,);
        let caught: unknown;
        try {
          await checkPreconditions(loadRunConfig({
            appDir,
            home: tmpdir(),
            overrides: { compositorPath: compositor, },
          },),);
        }
        catch (error: unknown) {
          caught = error;
        }
        await rm(appDir, { recursive: true, force: true, },);
        expect((caught as Error).message,).toContain(`the compositor ${compositor} is 0.3.0`,);
        expect((caught as Error).message,).toContain('E2E_COMPOSITOR',);
      },
    },),
  ],
},);
