/**
 * Tests for trusted temporary allowlist roots.
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
  agentTempAllowlistedDirs,
  isTrustedAgentTempDir,
} from './temp-allowlist.ts';

/** Private directory mode accepted for agent temp allowlisting. */
const PRIVATE_DIRECTORY_MODE = 0o700;

/** Group-readable directory mode rejected for agent temp allowlisting. */
const GROUP_READABLE_DIRECTORY_MODE = 0o750;

await describe({
  name: '',
  children: [
    describe({
      name: agentTempAllowlistedDirs.name,
      children: [
        it({
          name: 'includes private current and historical compatibility roots',
          fn: async function checksAgentTempRoots() {
            const home = await mkdtemp(join(
              tmpdir(),
              'auto-mode-home-',
            ),);
            const agentRoot = join(
              home,
              'temp',
              'agent',
            );
            const historicalAgentTempDir = await mkdtemp(join(
              tmpdir(),
              'auto-mode-historical-',
            ),);
            await mkdir(
              agentRoot,
              { recursive: true, },
            );
            await Promise.all([
              chmod(
                agentRoot,
                PRIVATE_DIRECTORY_MODE,
              ),
              chmod(
                historicalAgentTempDir,
                PRIVATE_DIRECTORY_MODE,
              ),
            ],);

            const trustedDirs = await agentTempAllowlistedDirs({
              home,
              historicalAgentTempDir,
            },);
            expect(trustedDirs,).toContain(agentRoot,);
            expect(trustedDirs,).toContain(historicalAgentTempDir,);

            await chmod(
              agentRoot,
              GROUP_READABLE_DIRECTORY_MODE,
            );

            expect(await agentTempAllowlistedDirs({
              home,
              historicalAgentTempDir,
            },),).not.toContain(agentRoot,);
            await Promise.all([
              rm(
                home,
                {
                  recursive: true,
                  force: true,
                },
              ),
              rm(
                historicalAgentTempDir,
                {
                  recursive: true,
                  force: true,
                },
              ),
            ],);
          },
        },),
      ],
    },),
    describe({
      name: isTrustedAgentTempDir.name,
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

            expect(await isTrustedAgentTempDir(root,),).toBe(true,);
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
          name: 'rejects current root when an ancestor is a symlink',
          fn: async function rejectsCurrentRootAncestorSymlink() {
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
              await isTrustedAgentTempDir(join(
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

            expect(await isTrustedAgentTempDir(root,),).toBe(false,);
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
          fn: async function rejectsMissingDirectory() {
            const parent = await mkdtemp(join(
              tmpdir(),
              'auto-mode-missing-',
            ),);
            const missing = join(
              parent,
              'agent',
            );

            expect(await isTrustedAgentTempDir(missing,),).toBe(false,);
            await rm(
              parent,
              {
                recursive: true,
                force: true,
              },
            );
          },
        },),
      ],
    },),
  ],
},);
