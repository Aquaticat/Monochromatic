import {
  access,
  mkdir,
  readFile,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import spawn from 'nano-spawn';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  DEAD_OWNER_PROCESS_ID,
  runConfigExpectingError,
  setupStalenessLockFixture,
  STALE_LOCK_DATE,
  teardownStalenessLockFixture,
  writeLockOwnerFixture,
  writeOverwriteConfig,
} from './staleness-lock-regression-fixture.ts';

await describe({
  name: 'file-enforcer stale-lock owner regressions',
  concurrency: 1,
  children: [
    it({
      name: 'recovers fresh manifest lock directories owned by dead process',
      timeout: 10_000,
      fn: async function recoversDeadOwnerManifestLock(): Promise<void> {
        const tempDir = await setupStalenessLockFixture();
        await using _cleanup = {
          [Symbol.asyncDispose](): Promise<void> {
            return teardownStalenessLockFixture(tempDir,);
          },
        };
        const manifestPath = join(
          tempDir,
          'manifest.json',
        );
        const lockPath = `${manifestPath}.lock`;
        const configPath = join(
          tempDir,
          'dead-owner-config.ts',
        );
        const outputPath = join(
          tempDir,
          'dead-owner-output.txt',
        );
        await mkdir(
          lockPath,
          { recursive: true, },
        );
        await writeLockOwnerFixture({
          lockPath,
          pid: DEAD_OWNER_PROCESS_ID,
        },);
        await writeOverwriteConfig({
          configPath,
          manifestPath,
          outputPath,
          content: 'bravo',
        },);

        await spawn(
          'bun',
          [configPath,],
          { cwd: tempDir, },
        );

        const manifest = JSON.parse(await readFile(manifestPath, 'utf8',),) as {
          readonly entries?: Record<string, unknown>;
        };
        expect(Object.keys(manifest.entries ?? {},),).toEqual([
          `single:${outputPath}`,
        ],);
      },
    },),

    it({
      name: 'does not reclaim old manifest lock directories owned by live process',
      timeout: 10_000,
      fn: async function doesNotReclaimLiveOwnerManifestLock(): Promise<void> {
        const tempDir = await setupStalenessLockFixture();
        await using _cleanup = {
          [Symbol.asyncDispose](): Promise<void> {
            return teardownStalenessLockFixture(tempDir,);
          },
        };
        const manifestPath = join(
          tempDir,
          'manifest.json',
        );
        const lockPath = `${manifestPath}.lock`;
        const configPath = join(
          tempDir,
          'live-owner-config.ts',
        );
        const outputPath = join(
          tempDir,
          'live-owner-output.txt',
        );
        await mkdir(
          lockPath,
          { recursive: true, },
        );
        await writeLockOwnerFixture({
          lockPath,
          pid: process.pid,
        },);
        await utimes(
          lockPath,
          STALE_LOCK_DATE,
          STALE_LOCK_DATE,
        );
        await writeOverwriteConfig({
          configPath,
          manifestPath,
          outputPath,
          content: 'charlie',
        },);

        const spawnError = await runConfigExpectingError({
          configPath,
          cwd: tempDir,
        },);

        expect(spawnError,).toBeInstanceOf(Error,);
        await access(lockPath,);
      },
    },),

    it({
      name: 'does not reclaim old manifest lock directories with malformed owner metadata',
      timeout: 10_000,
      fn: async function doesNotReclaimMalformedOwnerManifestLock(): Promise<void> {
        const tempDir = await setupStalenessLockFixture();
        await using _cleanup = {
          [Symbol.asyncDispose](): Promise<void> {
            return teardownStalenessLockFixture(tempDir,);
          },
        };
        const manifestPath = join(
          tempDir,
          'manifest.json',
        );
        const lockPath = `${manifestPath}.lock`;
        const configPath = join(
          tempDir,
          'malformed-owner-config.ts',
        );
        const outputPath = join(
          tempDir,
          'malformed-owner-output.txt',
        );
        await mkdir(
          lockPath,
          { recursive: true, },
        );
        await writeFile(
          join(
            lockPath,
            'owner.json',
          ),
          '{ malformed owner json',
        );
        await utimes(
          lockPath,
          STALE_LOCK_DATE,
          STALE_LOCK_DATE,
        );
        await writeOverwriteConfig({
          configPath,
          manifestPath,
          outputPath,
          content: 'delta',
        },);

        const spawnError = await runConfigExpectingError({
          configPath,
          cwd: tempDir,
        },);

        expect(spawnError,).toBeInstanceOf(Error,);
        await access(lockPath,);
      },
    },),
  ],
},);
