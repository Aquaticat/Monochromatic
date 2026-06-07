import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  buildContainerArgs,
  type ContainerArgsOptions,
  volumeMount,
} from '../dist/final/node/index.mjs';

/**
 * Builds representative container argv options for unit tests.
 *
 * @returns Complete options object.
 *
 * @example
 * ```ts
 * fixtureOptions();
 * ```
 */
function fixtureOptions(): ContainerArgsOptions {
  return {
    repoRoot: '/repo',
    hostReportDir: '/tmp/reports',
    runtimeImage: 'localhost/runtime:tag',
    targetPackagePath: 'packages/dev-script/file-enforcer',
    mutateFile: 'src/io/glob.ts',
    reportFileName: 'glob.json',
    tests: ['src/io/glob.unit.test.ts',],
    resources: {
      memory: '4g',
      cpus: '2',
      pidsLimit: 512,
      sessionTimeoutSeconds: 3_600,
      workTmpfsSize: '6g',
    },
    selinuxRelabel: false,
    dryRunOnly: false,
    fullSuite: false,
    timeoutMS: 5_000,
    prioritizePerformanceOverAccuracy: false,
  };
}

await describe({
  name: buildContainerArgs.name,
  children: [
    it({
      name: 'builds hardened Podman args without Docker or tsx',
      fn: async () => {
        const args = buildContainerArgs(fixtureOptions(),);

        expect(args,).toContain('--network=none',);
        expect(args,).toContain('--read-only',);
        expect(args,).toContain('--cap-drop=ALL',);
        expect(args,).toContain('--security-opt=no-new-privileges',);
        expect(args.join(' ',),).not.toContain('docker',);
        expect(args.join(' ',),).not.toContain('tsx',);
      },
    },),
    it({
      name: 'mounts source read-only and reports read-write',
      fn: async () => {
        const args = buildContainerArgs(fixtureOptions(),);

        expect(args,).toContain('/repo:/src-ro:ro',);
        expect(args,).toContain('/tmp/reports:/out:rw',);
      },
    },),
    it({
      name: 'passes selected tests and checker settings through environment',
      fn: async () => {
        const args = buildContainerArgs(fixtureOptions(),);
        const joined = args.join('\n',);

        expect(joined,).toContain('MUTATION_SELECTED_TEST_FILES_JSON=',);
        expect(joined,).toContain('MUTATION_TIMEOUT_MS=5000',);
        expect(joined,).toContain('MUTATION_TYPESCRIPT_PERFORMANCE_MODE=false',);
      },
    },),
  ],
},);

await describe({
  name: volumeMount.name,
  children: [
    it({
      name: 'adds SELinux relabel suffix only when requested',
      fn: async () => {
        expect(volumeMount({ hostPath: '/a', containerPath: '/b', mode: 'ro', selinuxRelabel: true, },),)
          .toBe('/a:/b:ro,Z',);
        expect(volumeMount({ hostPath: '/a', containerPath: '/b', mode: 'ro', selinuxRelabel: false, },),)
          .toBe('/a:/b:ro',);
      },
    },),
  ],
},);
