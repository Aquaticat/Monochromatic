/**
 * Tests for trusted temporary read allowlist roots.
 */

import {
  chmod,
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

import { isTrustedReadAllowlistDir, } from './temp-read-allowlist.ts';

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

        expect(isTrustedReadAllowlistDir(root,),).toBe(true,);
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

        expect(isTrustedReadAllowlistDir(root,),).toBe(false,);
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
        expect(isTrustedReadAllowlistDir('/tmp/agent-missing-for-auto-mode-test',),)
          .toBe(false,);
      },
    },),
  ],
},);
