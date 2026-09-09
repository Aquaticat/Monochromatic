/** Exercise generated mise orchestration through its real process boundary. @module */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  canonicalConfig,
  generatedConfig,
  runBuildAndTestFixture,
} from './build-and-test-fixture.ts';

/** Invocation shapes choose root builds, package builds, and usage-parser quoting. */
const INVOCATIONS = [
  { name: 'no arguments', args: [], build: 'root-build', },
  { name: 'package test', args: ['package/fixture/demo/test.ts',], build: 'package-build', },
  { name: 'dot-prefixed package test', args: ['./package/fixture/demo/test.ts',], build: 'package-build', },
  { name: 'package test with spaces', args: ['package/fixture/demo/test file.ts',], build: 'package-build', },
  { name: 'outside-package test', args: ['test.ts',], build: 'root-build', },
] as const;

/** Phase outcomes distinguish build failure from test failure and combined failure. */
const OUTCOMES = [
  { name: 'both phases pass', buildFails: false, testFails: false, },
  { name: 'build fails and test passes', buildFails: true, testFails: false, },
  { name: 'build passes and test fails', buildFails: false, testFails: true, },
  { name: 'both phases fail', buildFails: true, testFails: true, },
] as const;

await describe({
  name: 'generated buildAndTest task',
  concurrency: 1,
  timeout: 60_000,
  children: [
    it({
      name: 'generated mise configuration contains the current canonical source',
      fn: () => {
        expect(generatedConfig.startsWith(
          `# Generated from mise.no-env.toml by file-enforcer.\n${canonicalConfig}\n`,
        ),).toBe(true,);
      },
    },),
    ...INVOCATIONS.flatMap(function invocationTests(invocation,) {
      return OUTCOMES.map(function outcomeTest(outcome,) {
        return it({
          name: `${invocation.name}: ${outcome.name}`,
          fn: () => {
            /** Fresh processes prevent prior task status or output from influencing this case. */
            const result = runBuildAndTestFixture({ args: invocation.args, ...outcome, },);
            expect(result.process.signal,).toBeNull();
            expect(result.process.status,).toBe(outcome.buildFails || outcome.testFails ? 1 : 0,);
            expect(result.events,).toEqual([invocation.build, 'test',],);
            if (outcome.buildFails) {
              expect(result.output,).toContain(`fixture ${invocation.build} failed`,);
              expect(result.output,).toContain('build phase failed',);
            }
            if (outcome.testFails) {
              expect(result.output,).toContain('fixture test failed',);
              expect(result.output,).toContain('test phase failed',);
            }
          },
        },);
      },);
    },),
    ...[false, true,].map(function missingBuildTest(testFails,) {
      return it({
        name: `missing package build still runs ${testFails ? 'failing' : 'passing'} tests`,
        fn: () => {
          /** Missing build tasks are not equivalent to attempted builds returning failure. */
          const result = runBuildAndTestFixture({
            args: ['package/fixture/demo/test.ts',],
            packageBuild: false,
            buildFails: true,
            testFails,
          },);
          expect(result.process.signal,).toBeNull();
          expect(result.process.status,).toBe(testFails ? 1 : 0,);
          expect(result.events,).toEqual(['test',],);
        },
      },);
    },),
    it({
      name: 'explicit try task continues to tolerate build failure',
      fn: () => {
        /** The named tolerant boundary remains distinct from buildAndTest. */
        const result = runBuildAndTestFixture({ task: 'try', args: ['build',], buildFails: true, testFails: false, },);
        expect(result.process.signal,).toBeNull();
        expect(result.process.status,).toBe(0,);
        expect(result.events,).toEqual(['root-build',],);
        expect(result.output,).toContain('fixture root-build failed',);
      },
    },),
    it({
      name: 'explicit prepareAndBuild--allowFailure tolerates both phase failures',
      fn: () => {
        /** Preparation and build failures must both remain visible without failing this opt-in task. */
        const result = runBuildAndTestFixture({
          task: 'prepareAndBuild--allowFailure',
          args: [],
          prepareFails: true,
          buildFails: true,
          testFails: false,
        },);
        expect(result.process.signal,).toBeNull();
        expect(result.process.status,).toBe(0,);
        expect(result.events,).toEqual(['prepare', 'root-build',],);
        expect(result.output,).toContain('fixture prepare failed',);
        expect(result.output,).toContain('fixture root-build failed',);
      },
    },),
  ],
},);
