import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir, } from 'node:os';
import {
  join,
  resolve,
} from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type OxlintRuleDiagnostic,
  runOxlintFixture,
} from '../dist/final/node/index.mjs';
import { PROBE_FAILURE_TEXT, } from './harness-probe-plugin.test-fixture.ts';

//region Helpers

/** Plugin that reports, stays quiet, or throws, depending on which of its rules a config enables. */
const PROBE_PLUGIN = resolve(
  import.meta.dirname,
  'harness-probe-plugin.test-fixture.ts',
);

/** Disposable project holding one valid source and a config enabling the named probe rules. */
type ProbeProject = {
  /** Absolute path of the config. */
  readonly configPath: string;
  /** Absolute path of the source, which no rule has any reason to report. */
  readonly sourcePath: string;
  /** Removes the project. */
  readonly [Symbol.dispose]: () => void;
};

/**
 Writes a project whose config enables the named rules of the probe plugin.

 @example
 ```ts
 using project = probeProject(['always-throws',],);
 ```
 */
function probeProject(rules: readonly string[],): ProbeProject {
  /** Unique temp directory. */
  const directory = mkdtempSync(join(
    tmpdir(),
    'oxlint-harness-probe-',
  ),);
  /** Config path. */
  const configPath = join(
    directory,
    '.oxlintrc.json',
  );
  /** Source path. */
  const sourcePath = join(
    directory,
    'valid.ts',
  );
  writeFileSync(
    configPath,
    JSON.stringify({
      jsPlugins: [PROBE_PLUGIN,],
      rules: Object.fromEntries(rules.map(function enable(rule,): [string, string,] {
        return [`harness-probe/${rule}`, 'error',];
      },),),
    },),
  );
  writeFileSync(
    sourcePath,
    'export const answer = 42;\n',
  );
  return {
    configPath,
    sourcePath,
    [Symbol.dispose]: function cleanup(): void {
      rmSync(
        directory,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

/**
 Runs the fixture runner over a project, keeping the failure when it fails.

 @example
 ```ts
 const outcome = await attempt(project,);
 ```
 */
async function attempt(
  project: ProbeProject,
): Promise<{ readonly diagnostics: readonly OxlintRuleDiagnostic[]; readonly failure: unknown; }> {
  try {
    return {
      diagnostics: await runOxlintFixture({
        codePrefix: 'harness-probe(',
        configFlag: '--config',
        fixtureConfig: project.configPath,
        target: project.sourcePath,
        threads: 1,
      },),
      failure: undefined,
    };
  }
  catch (error: unknown) {
    return { diagnostics: [], failure: error, };
  }
}

//endregion Helpers

await describe({
  name: '',
  children: [
    describe({
      name: runOxlintFixture.name,
      children: [
        it({
          name: 'returns the diagnostics of a plugin that reports',
          fn: async () => {
            using project = probeProject(['reports-program',],);
            const outcome = await attempt(project,);

            expect(outcome.failure,).toBeUndefined();
            expect(outcome.diagnostics.map(function codeOf(diagnostic,): string {
              return diagnostic.code;
            },),).toEqual(['harness-probe(reports-program)',],);
          },
        },),
        it({
          name: 'returns no diagnostics for a plugin that stays quiet on a valid source',
          fn: async () => {
            using project = probeProject(['reports-nothing',],);
            const outcome = await attempt(project,);

            expect(outcome.failure,).toBeUndefined();
            expect(outcome.diagnostics,).toEqual([],);
          },
        },),
        it({
          name: 'fails when the plugin throws on a valid source, naming the plugin error',
          fn: async () => {
            using project = probeProject(['always-throws',],);
            const outcome = await attempt(project,);

            expect(outcome.failure,).toBeInstanceOf(Error,);
            expect(String(outcome.failure,),).toContain(PROBE_FAILURE_TEXT,);
            expect(String(outcome.failure,),).toContain(project.sourcePath,);
          },
        },),
        it({
          name: 'fails when the plugin throws even though another rule of it reported',
          fn: async () => {
            using project = probeProject(['reports-program', 'always-throws',],);
            const outcome = await attempt(project,);

            expect(outcome.failure,).toBeInstanceOf(Error,);
            expect(String(outcome.failure,),).toContain(PROBE_FAILURE_TEXT,);
          },
        },),
      ],
    },),
  ],
},);
