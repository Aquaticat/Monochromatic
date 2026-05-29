/**
 * Tests for OS specification parsing and container command building.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  buildContainerCommand,
  parseOs,
} from './container.ts';

await describe({
  name: 'container',
  children: [
    //region parseOs

    describe({
      name: parseOs.name,
      children: [
        it({
          name: 'parses container:ubuntu',
          fn: async () => {
            const result = parseOs('container:ubuntu',);
            expect(result.protocol,).toBe('container',);
            expect(result.distro,).toBe('ubuntu',);
          },
        },),

        it({
          name: 'parses container:fedora:39 preserving tag in distro',
          fn: async () => {
            const result = parseOs('container:fedora:39',);
            expect(result.protocol,).toBe('container',);
            expect(result.distro,).toBe('fedora:39',);
          },
        },),

        it({
          name: 'parses host: with empty distro',
          fn: async () => {
            const result = parseOs('host:',);
            expect(result.protocol,).toBe('host',);
            expect(result.distro,).toBe('',);
          },
        },),

        it({
          name: 'parses vm: protocol',
          fn: async () => {
            const result = parseOs('vm:fedora',);
            expect(result.protocol,).toBe('vm',);
            expect(result.distro,).toBe('fedora',);
          },
        },),

        it({
          name: 'throws on missing protocol prefix',
          fn: async () => {
            expect(function noProtocol() {
              parseOs('ubuntu',);
            },)
              .toThrow('must have a protocol prefix',);
          },
        },),

        it({
          name: 'throws on unknown protocol',
          fn: async () => {
            expect(function unknownProtocol() {
              parseOs('docker:ubuntu',);
            },)
              .toThrow('Unknown protocol "docker"',);
          },
        },),
      ],
    },),

    //endregion parseOs

    //region buildContainerCommand

    describe({
      name: buildContainerCommand.name,
      children: [
        it({
          name: 'root user builds a direct command chain',
          fn: async () => {
            const cmd = buildContainerCommand({
              combination: {
                file: '/home/user/Mono/packages/foo/test.ts',
                os: 'container:ubuntu',
                user: 'root',
                runtime: 'bun',
              },
              monorepoRoot: '/home/user/Mono',
            },);

            /** Should be a && chain without sudo -u or heredoc. */
            expect(cmd,).toContain('apt-get',);
            expect(cmd,).toContain('curl',);
            expect(cmd,).toContain('.bun/bin/bun',);
            expect(cmd,).toContain('/workspace/packages/foo/test.ts',);
            expect(cmd,).not.toContain('sudo -u',);
            expect(cmd,).not.toContain('run-test.sh',);
          },
        },),

        it({
          name: 'non-root user writes heredoc script and uses sudo -u',
          fn: async () => {
            const cmd = buildContainerCommand({
              combination: {
                file: '/home/user/Mono/packages/foo/test.ts',
                os: 'container:ubuntu',
                user: 'user',
                runtime: 'bun',
              },
              monorepoRoot: '/home/user/Mono',
            },);

            expect(cmd,).toContain('sudo -u testuser',);
            expect(cmd,).toContain('run-test.sh',);
            expect(cmd,).toContain('useradd',);
            expect(cmd,).toContain('NOPASSWD',);
          },
        },),

        it({
          name: 'converts host path to /workspace container path',
          fn: async () => {
            const cmd = buildContainerCommand({
              combination: {
                file: '/repo/root/packages/bar/src/test.ts',
                os: 'container:fedora',
                user: 'root',
                runtime: 'bun',
              },
              monorepoRoot: '/repo/root',
            },);

            expect(cmd,).toContain('/workspace/packages/bar/src/test.ts',);
            expect(cmd,).not.toContain('/repo/root',);
          },
        },),

        it({
          name: 'uses dnf for fedora',
          fn: async () => {
            const cmd = buildContainerCommand({
              combination: {
                file: '/repo/test.ts',
                os: 'container:fedora',
                user: 'root',
                runtime: 'bun',
              },
              monorepoRoot: '/repo',
            },);

            expect(cmd,).toContain('dnf install',);
          },
        },),

        it({
          name: 'uses apk for alpine',
          fn: async () => {
            const cmd = buildContainerCommand({
              combination: {
                file: '/repo/test.ts',
                os: 'container:alpine',
                user: 'root',
                runtime: 'deno',
              },
              monorepoRoot: '/repo',
            },);

            expect(cmd,).toContain('apk add',);
            expect(cmd,).toContain('.deno/bin/deno',);
          },
        },),

        it({
          name: 'alpine non-root uses adduser -D instead of useradd',
          fn: async () => {
            const cmd = buildContainerCommand({
              combination: {
                file: '/repo/test.ts',
                os: 'container:alpine',
                user: 'user',
                runtime: 'bun',
              },
              monorepoRoot: '/repo',
            },);

            expect(cmd,).toContain('adduser -D testuser',);
            expect(cmd,).not.toContain('useradd',);
          },
        },),

        it({
          name: 'deno exec includes --allow-all flag',
          fn: async () => {
            const cmd = buildContainerCommand({
              combination: {
                file: '/repo/test.ts',
                os: 'container:ubuntu',
                user: 'root',
                runtime: 'deno',
              },
              monorepoRoot: '/repo',
            },);

            expect(cmd,).toContain('--allow-all',);
          },
        },),

        it({
          name: 'non-root heredoc includes cd /workspace',
          fn: async () => {
            const cmd = buildContainerCommand({
              combination: {
                file: '/repo/test.ts',
                os: 'container:ubuntu',
                user: 'user',
                runtime: 'bun',
              },
              monorepoRoot: '/repo',
            },);

            expect(cmd,).toContain('cd /workspace',);
          },
        },),

        it({
          name: 'root command includes cd /workspace',
          fn: async () => {
            const cmd = buildContainerCommand({
              combination: {
                file: '/repo/test.ts',
                os: 'container:ubuntu',
                user: 'root',
                runtime: 'bun',
              },
              monorepoRoot: '/repo',
            },);

            expect(cmd,).toContain('cd /workspace',);
          },
        },),
      ],
    },),
    //endregion buildContainerCommand
  ],
},);
