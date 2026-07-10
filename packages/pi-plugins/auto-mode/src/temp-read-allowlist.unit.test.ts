/**
 * Tests for trusted temporary read allowlist roots.
 */

import {
  chmod,
  mkdir,
  mkdtemp,
  rm,
  symlink,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  agentTempReadAllowlistedDirs,
  isTrustedReadAllowlistDir,
} from './temp-read-allowlist.ts';

/** Private directory mode accepted for agent temp read allowlisting. */
const PRIVATE_DIRECTORY_MODE = 0o700;

/** Group-readable directory mode rejected for agent temp read allowlisting. */
const GROUP_READABLE_DIRECTORY_MODE = 0o750;

await describe({
  name: isTrustedReadAllowlistDir.name,
  children: [
    it({
      name: 'trusts private directory owned by current user',
      fn: async function trustsPrivateDirectory() {
        const root = await mkdtemp(join(
          tmpdir(),
          'auto-mode-temp-read-',
        ),);
        await chmod(
          root,
          PRIVATE_DIRECTORY_MODE,
        );

        expect(await isTrustedReadAllowlistDir(root,),).toBe(true,);
        await rm(
          root,
          {
            recursive: true,
            force: true,
          },
        );
      },
    },),

    it({
      name: 'includes private `~/temp/agent` and excludes it after group read access',
      fn: async function checksHomeTempAgentReadRoot() {
        const home = await mkdtemp(join(
          tmpdir(),
          'auto-mode-home-',
        ),);
        const agentRoot = join(
          home,
          'temp',
          'agent',
        );
        await mkdir(
          agentRoot,
          { recursive: true, },
        );
        await chmod(
          agentRoot,
          PRIVATE_DIRECTORY_MODE,
        );

        expect(await agentTempReadAllowlistedDirs({ home, },),).toContain(agentRoot,);

        await chmod(
          agentRoot,
          GROUP_READABLE_DIRECTORY_MODE,
        );

        expect(await agentTempReadAllowlistedDirs({ home, },),).not.toContain(agentRoot,);
        await rm(
          home,
          {
            recursive: true,
            force: true,
          },
        );
      },
    },),

    it({
      name: 'rejects `~/temp/agent` when an ancestor is a symlink',
      fn: async function rejectsHomeTempAgentAncestorSymlink() {
        const home = await mkdtemp(join(
          tmpdir(),
          'auto-mode-home-',
        ),);
        const redirectedTemp = await mkdtemp(join(
          tmpdir(),
          'auto-mode-redirected-temp-',
        ),);
        const redirectedAgentRoot = join(
          redirectedTemp,
          'agent',
        );
        await mkdir(
          redirectedAgentRoot,
          { recursive: true, },
        );
        await chmod(
          redirectedAgentRoot,
          PRIVATE_DIRECTORY_MODE,
        );
        await symlink(
          redirectedTemp,
          join(
            home,
            'temp',
          ),
          'dir',
        );

        expect(
          await isTrustedReadAllowlistDir(join(
          home,
          'temp',
          'agent',
        ),),
        ).toBe(false,);

        await rm(
          home,
          {
            recursive: true,
            force: true,
          },
        );
        await rm(
          redirectedTemp,
          {
            recursive: true,
            force: true,
          },
        );
      },
    },),

    it({
      name: 'rejects group-accessible directory',
      fn: async function rejectsGroupAccessibleDirectory() {
        const root = await mkdtemp(join(
          tmpdir(),
          'auto-mode-temp-read-',
        ),);
        await chmod(
          root,
          GROUP_READABLE_DIRECTORY_MODE,
        );

        expect(await isTrustedReadAllowlistDir(root,),).toBe(false,);
        await rm(
          root,
          {
            recursive: true,
            force: true,
          },
        );
      },
    },),

    it({
      name: 'rejects missing directory',
      fn: async () => {
        expect(await isTrustedReadAllowlistDir('/tmp/agent-missing-for-auto-mode-test',),)
          .toBe(false,);
      },
    },),
  ],
},);
