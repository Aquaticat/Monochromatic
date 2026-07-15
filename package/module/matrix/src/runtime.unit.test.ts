/**
 * Tests for runtime installation and execution command generation.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  runtimeExecCommand,
  runtimeInstallCommand,
} from './runtime.ts';

await describe({
  name: 'runtime',
  children: [
    //region runtimeInstallCommand

    describe({
      name: runtimeInstallCommand.name,
      children: [
        it({
          name: 'bun install uses bun.sh',
          fn: async () => {
            const cmd = runtimeInstallCommand('bun',);
            expect(cmd,).toContain('bun.sh/install',);
            expect(cmd,).toContain('curl',);
          },
        },),

        it({
          name: 'deno install uses deno.land',
          fn: async () => {
            const cmd = runtimeInstallCommand('deno',);
            expect(cmd,).toContain('deno.land/install.sh',);
            expect(cmd,).toContain('curl',);
          },
        },),
      ],
    },),

    //endregion runtimeInstallCommand

    //region runtimeExecCommand

    describe({
      name: runtimeExecCommand.name,
      children: [
        it({
          name: 'bun exec uses $HOME/.bun/bin/bun run',
          fn: async () => {
            const cmd = runtimeExecCommand({
              runtime: 'bun',
              filePath: '/workspace/test.ts',
            },);
            expect(cmd,).toBe('$HOME/.bun/bin/bun run /workspace/test.ts',);
          },
        },),

        it({
          name: 'deno exec uses $HOME/.deno/bin/deno run --allow-all',
          fn: async () => {
            const cmd = runtimeExecCommand({
              runtime: 'deno',
              filePath: '/workspace/test.ts',
            },);
            expect(cmd,).toBe('$HOME/.deno/bin/deno run --allow-all /workspace/test.ts',);
          },
        },),

        it({
          name: 'preserves absolute file paths',
          fn: async () => {
            const cmd = runtimeExecCommand({
              runtime: 'bun',
              filePath: '/workspace/packages/foo/src/bar.ts',
            },);
            expect(cmd,).toContain('/workspace/packages/foo/src/bar.ts',);
          },
        },),
      ],
    },),
    //endregion runtimeExecCommand
  ],
},);
