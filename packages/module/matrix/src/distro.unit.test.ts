/**
 * Tests for distro-to-package-manager mapping, prerequisite commands,
 * and user creation commands.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  detectPackageManager,
  prerequisiteCommand,
  userCreationCommand,
} from './distro.ts';

await describe({
  name: 'distro',
  children: [
    //region detectPackageManager

    describe({
      name: detectPackageManager.name,
      children: [
        it({
          name: 'ubuntu resolves to apt',
          fn: async () => {
            expect(detectPackageManager('ubuntu',),).toBe('apt',);
          },
        },),

        it({
          name: 'debian resolves to apt',
          fn: async () => {
            expect(detectPackageManager('debian',),).toBe('apt',);
          },
        },),

        it({
          name: 'fedora resolves to dnf',
          fn: async () => {
            expect(detectPackageManager('fedora',),).toBe('dnf',);
          },
        },),

        it({
          name: 'centos resolves to dnf',
          fn: async () => {
            expect(detectPackageManager('centos',),).toBe('dnf',);
          },
        },),

        it({
          name: 'rhel resolves to dnf',
          fn: async () => {
            expect(detectPackageManager('rhel',),).toBe('dnf',);
          },
        },),

        it({
          name: 'rocky resolves to dnf',
          fn: async () => {
            expect(detectPackageManager('rocky',),).toBe('dnf',);
          },
        },),

        it({
          name: 'alma resolves to dnf',
          fn: async () => {
            expect(detectPackageManager('alma',),).toBe('dnf',);
          },
        },),

        it({
          name: 'alpine resolves to apk',
          fn: async () => {
            expect(detectPackageManager('alpine',),).toBe('apk',);
          },
        },),

        it({
          name: 'arch resolves to pacman',
          fn: async () => {
            expect(detectPackageManager('arch',),).toBe('pacman',);
          },
        },),

        it({
          name: 'strips tag suffix before lookup',
          fn: async () => {
            expect(detectPackageManager('fedora:39',),).toBe('dnf',);
          },
        },),

        it({
          name: 'throws on unknown distro',
          fn: async () => {
            expect(function unknownDistro() {
              detectPackageManager('gentoo',);
            },)
              .toThrow('Unknown distro "gentoo"',);
          },
        },),
      ],
    },),

    //endregion detectPackageManager

    //region prerequisiteCommand

    describe({
      name: prerequisiteCommand.name,
      children: [
        it({
          name: 'apt root installs curl and unzip without sudo',
          fn: async () => {
            const cmd = prerequisiteCommand({
              manager: 'apt',
              user: 'root',
            },);
            expect(cmd,).toContain('curl',);
            expect(cmd,).toContain('unzip',);
            expect(cmd,).not.toContain('sudo',);
          },
        },),

        it({
          name: 'apt non-root installs sudo',
          fn: async () => {
            const cmd = prerequisiteCommand({
              manager: 'apt',
              user: 'user',
            },);
            expect(cmd,).toContain('sudo',);
          },
        },),

        it({
          name: 'dnf root uses dnf install',
          fn: async () => {
            const cmd = prerequisiteCommand({
              manager: 'dnf',
              user: 'root',
            },);
            expect(cmd.startsWith('dnf install',),).toBe(true,);
          },
        },),

        it({
          name: 'apk root uses apk add',
          fn: async () => {
            const cmd = prerequisiteCommand({
              manager: 'apk',
              user: 'root',
            },);
            expect(cmd.startsWith('apk add',),).toBe(true,);
            expect(cmd,).toContain('bash',);
          },
        },),

        it({
          name: 'pacman root uses pacman -Sy',
          fn: async () => {
            const cmd = prerequisiteCommand({
              manager: 'pacman',
              user: 'root',
            },);
            expect(cmd.startsWith('pacman -Sy',),).toBe(true,);
          },
        },),

        it({
          name: 'dnf non-root includes sudo',
          fn: async () => {
            const cmd = prerequisiteCommand({
              manager: 'dnf',
              user: 'user',
            },);
            expect(cmd,).toContain('sudo',);
          },
        },),

        it({
          name: 'apk non-root includes sudo',
          fn: async () => {
            const cmd = prerequisiteCommand({
              manager: 'apk',
              user: 'user',
            },);
            expect(cmd,).toContain('sudo',);
          },
        },),

        it({
          name: 'pacman non-root includes sudo',
          fn: async () => {
            const cmd = prerequisiteCommand({
              manager: 'pacman',
              user: 'user',
            },);
            expect(cmd,).toContain('sudo',);
          },
        },),
      ],
    },),

    //endregion prerequisiteCommand

    //region userCreationCommand

    describe({
      name: userCreationCommand.name,
      children: [
        it({
          name: 'root returns empty string',
          fn: async () => {
            expect(userCreationCommand({
              manager: 'apt',
              user: 'root',
            },),)
              .toBe('',);
          },
        },),

        it({
          name: 'non-root with apt uses useradd',
          fn: async () => {
            const cmd = userCreationCommand({
              manager: 'apt',
              user: 'user',
            },);
            expect(cmd,).toContain('useradd -m testuser',);
            expect(cmd,).toContain('NOPASSWD:ALL',);
          },
        },),

        it({
          name: 'non-root with dnf uses useradd',
          fn: async () => {
            const cmd = userCreationCommand({
              manager: 'dnf',
              user: 'user',
            },);
            expect(cmd,).toContain('useradd -m testuser',);
          },
        },),

        it({
          name: 'non-root with apk uses adduser -D',
          fn: async () => {
            const cmd = userCreationCommand({
              manager: 'apk',
              user: 'user',
            },);
            expect(cmd,).toContain('adduser -D testuser',);
            expect(cmd,).toContain('NOPASSWD:ALL',);
          },
        },),

        it({
          name: 'non-root with pacman uses useradd',
          fn: async () => {
            const cmd = userCreationCommand({
              manager: 'pacman',
              user: 'user',
            },);
            expect(cmd,).toContain('useradd -m testuser',);
          },
        },),
      ],
    },),
    //endregion userCreationCommand
  ],
},);
