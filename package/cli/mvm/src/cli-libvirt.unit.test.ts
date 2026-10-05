/**
 Tests of the built `mvm` executable against stand-in host tools: which
 command it runs `virsh` through, and what it says when libvirt is out of reach.

 Each test has its own sandbox, so the tests run side by side.

 @module
 */

import { readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  createSandbox,
  fakeVirshEnv,
  installFakeFlatpak,
  runCli,
} from './fixture.cli-harness.ts';

/**
 Domains the fake virsh lists: one managed by mvm and one that is not.
 */
const DOMAINS = [
  {
    name: 'mvm-dev',
    state: 'running',
  },
  {
    name: 'someone-elses-vm',
    state: 'shut off',
  },
];

await describe({
  name: 'mvm with configured or detected libvirt tools',
  children: [
    //region Configured command

    it({
      name: 'runs virsh through the command in MVM_VIRSH_COMMAND',
      fn: async () => {
        await using sandbox = await createSandbox({ domains: DOMAINS, },);
        const result = await runCli({
          args: ['list',],
          env: fakeVirshEnv(sandbox,),
          sandbox,
        },);
        expect(result.exitCode,).toBe(0,);
        expect(result.stdout,).toContain('dev',);
        expect(result.stdout,).toContain('running',);
        expect(result.stdout,).not.toContain('someone-elses-vm',);
        expect(await sandbox.calls(),).toEqual([
          [
            '--connect',
            'qemu:///session',
            'list',
            '--all',
          ],
        ],);
      },
    },),

    it({
      name: 'explains the expected form when MVM_VIRSH_COMMAND is not a JSON array',
      fn: async () => {
        await using sandbox = await createSandbox({},);
        const result = await runCli({
          args: ['list',],
          env: { MVM_VIRSH_COMMAND: 'flatpak run --command=virsh org.virt_manager.virt-manager', },
          sandbox,
        },);
        expect(result.exitCode,).not.toBe(0,);
        expect(result.stderr,).toContain('MVM_VIRSH_COMMAND must be a JSON array',);
        expect(result.stderr,).toContain('Example: MVM_VIRSH_COMMAND=',);
      },
    },),

    //endregion Configured command

    //region Detected Flatpak

    it({
      name: 'runs virsh inside the virt-manager Flatpak when PATH has no virsh and the Flatpak is installed',
      fn: async () => {
        await using sandbox = await createSandbox({ domains: DOMAINS, },);
        await installFakeFlatpak(sandbox,);
        const result = await runCli({
          args: ['list',],
          sandbox,
        },);
        expect(result.exitCode,).toBe(0,);
        expect(result.stdout,).toContain('dev',);
        const flatpakCalls = await readFile(
          join(
            sandbox.state,
            'flatpak-calls.jsonl',
          ),
          'utf8',
        );
        expect(flatpakCalls,).toContain(
          JSON.stringify([
            'run',
            '--command=virsh',
            'org.virt_manager.virt-manager',
            '--connect',
            'qemu:///session',
            'list',
            '--all',
          ],),
        );
      },
    },),

    it({
      name: 'says how to start the session daemon inside the Flatpak when virsh cannot connect',
      fn: async () => {
        await using sandbox = await createSandbox({ connectFailure: true, },);
        await installFakeFlatpak(sandbox,);
        const result = await runCli({
          args: ['list',],
          sandbox,
        },);
        expect(result.exitCode,).not.toBe(0,);
        expect(result.stderr,).toContain('virsh could not connect to libvirt\'s session daemon',);
        expect(result.stderr,).toContain('virtqemud-sock',);
        expect(result.stderr,).toContain(
          'flatpak run --command=virtqemud org.virt_manager.virt-manager --verbose',
        );
      },
    },),

    //endregion Detected Flatpak
  ],
},);
