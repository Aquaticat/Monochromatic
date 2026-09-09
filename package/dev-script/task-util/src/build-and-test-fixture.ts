/** Disposable process boundary for generated mise task regression tests. @module */

import {
  spawnSync,
  type SpawnSyncReturns,
} from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempDisposableSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir, } from 'node:os';
import {
  delimiter,
  dirname,
  join,
} from 'node:path';

/** Generated configuration consumed by mise, not a reconstructed implementation. */
export const generatedConfig: string = readFileSync(new URL('../../../../mise.toml', import.meta.url,), 'utf8',);

/** Source owner used to detect stale generated task definitions. */
export const canonicalConfig: string = readFileSync(new URL('../../../../mise.no-env.toml', import.meta.url,), 'utf8',);

/** Upper bound prevents a broken orchestration fixture from hanging verification. */
const CHILD_TIMEOUT_MS = 20_000;

/** Captured diagnostics may include nested Node exception stacks. */
const MAX_OUTPUT_BYTES = 4 * 1_024 * 1_024;

/** Inputs independently select execution shape and phase outcomes. */
export type BuildAndTestFixture = {
  /** Repository-relative file arguments exercise the real usage parser. */
  readonly args: readonly string[];
  /** Build failure must survive passing tests. */
  readonly buildFails: boolean;
  /** Missing package build tasks retain their existing skip semantics. */
  readonly packageBuild?: boolean;
  /** Preparation failure is exercised only by the explicitly tolerant aggregate. */
  readonly prepareFails?: boolean;
  /** Entry point distinguishes ordinary orchestration from intentional tolerance. */
  readonly task?: string;
  /** Test failure must fail the aggregate independently of build status. */
  readonly testFails: boolean;
};

/** Fixture output includes an execution trace independent of displayed commands. */
export type BuildAndTestResult = {
  /** File-backed phase order proves which subprocesses actually executed. */
  readonly events: readonly string[];
  /** Both streams retain the aggregate and original child diagnostics. */
  readonly output: string;
  /** Raw process result distinguishes an exit from timeout or signal termination. */
  readonly process: SpawnSyncReturns<string>;
};

//region Configuration extraction: preserve task and helper bodies verbatim.

/**
 Extract one required configuration span, failing if its boundary changes.

 @param start - unique opening text in generated configuration
 @param end - closing boundary excluded from the result
 @returns original text without reimplementing the task
 @throws Error if the fixture's expected configuration shape is absent
 @example
 ```ts
 configurationSpan({ start: '[tasks.try]\n', end: '\n[tasks.', });
 ```
 */
function configurationSpan({ start, end, }: { readonly start: string; readonly end: string; },): string {
  /** Offset of the exact task or variable definition. */
  const startIndex = generatedConfig.indexOf(start,);
  /** Closing boundary after the opening text, not inside it. */
  const endIndex = generatedConfig.indexOf(end, startIndex + start.length,);
  if (startIndex < 0 || endIndex < 0)
    throw new Error(`Missing mise fixture configuration boundary: ${start} to ${end}`,);
  return generatedConfig.slice(startIndex, endIndex,);
}

/**
 Extract a root task together with its original interpreter and usage spec.

 @param name - task whose generated definition is exercised
 @returns original TOML task section
 @example
 ```ts
 taskSection('buildAndTest');
 ```
 */
function taskSection(name: string,): string {
  return configurationSpan({ start: `[tasks.${name}]\n`, end: '\n[tasks.', },);
}

/**
 Extract a shared triple-quoted helper including its closing delimiter.

 @param name - helper referenced by the task's Tera template
 @returns original TOML variable assignment
 @example
 ```ts
 variableSection('parse_usage_args');
 ```
 */
function variableSection(name: string,): string {
  return `${configurationSpan({ start: `${name} = """\n`, end: '\n"""', },)}\n"""`;
}

//endregion Configuration extraction

/**
 Run generated orchestration against fake phase scripts and isolated mise state.

 @param args - arguments forwarded through mise's own usage parser
 @param buildFails - whether fake builds throw after recording execution
 @param packageBuild - whether package discovery finds a build task
 @param prepareFails - whether preparation throws for the tolerant-wrapper control
 @param task - generated root task to invoke
 @param testFails - whether fake tests throw after recording execution
 @returns exit status, diagnostic output, and file-backed phase order
 @throws Error if mise is unavailable or the child cannot be started
 @example
 ```ts
 runBuildAndTestFixture({ args: [], buildFails: true, testFails: false, });
 ```
 */
export function runBuildAndTestFixture({
  args,
  buildFails,
  packageBuild = true,
  prepareFails = false,
  task = 'buildAndTest',
  testFails,
}: BuildAndTestFixture,): BuildAndTestResult {
  /** Disposable resource removes configuration and outputs even after assertion failure. */
  using directory = mkdtempDisposableSync(join(tmpdir(), 'mise-build-and-test-',),);
  /** Canonical paths keep mise's directory ceiling effective on symlinked homes. */
  const root = realpathSync(directory.path,);
  /** Direct executable lookup avoids inherited shell activation or repository dispatch. */
  const mise = (process.env['PATH'] ?? '').split(delimiter,)
    .map(function candidate(path,): string { return join(path, process.platform === 'win32' ? 'mise.exe' : 'mise',); },)
    .find(function available(path,): boolean { return existsSync(path,); },);
  if (mise === undefined)
    throw new Error('mise executable is required for buildAndTest regression tests',);
  /** Package path exercises monorepo task selection without invoking actual packages. */
  const packageRoot = join(root, 'package', 'fixture', 'demo',);
  mkdirSync(packageRoot, { recursive: true, },);
  writeFileSync(join(root, 'events',), '',);
  for (const phase of ['root-build', 'package-build', 'prepare', 'test',]) {
    /** Failure choice is encoded as a boolean literal, never executable caller input. */
    const fails = phase === 'test' ? testFails : phase === 'prepare' ? prepareFails : buildFails;
    /** JSON encoding preserves the destination JavaScript string grammar. */
    const script = `import { appendFileSync } from 'node:fs';
appendFileSync(process.env.FIXTURE_EVENTS, ${JSON.stringify(`${phase}\n`,)});
if (${JSON.stringify(fails,)}) { throw new Error(${JSON.stringify(`fixture ${phase} failed`,)}); }
`;
    writeFileSync(join(root, `${phase}.ts`,), script,);
    writeFileSync(join(packageRoot, `${phase}.ts`,), script,);
    if (phase === 'test')
      writeFileSync(join(packageRoot, 'test file.ts',), script,);
  }
  writeFileSync(join(packageRoot, 'mise.toml',), packageBuild ? '[tasks.build]\nrun = "node package-build.ts"\n' : '',);
  writeFileSync(join(root, 'mise.toml',), `experimental_monorepo_root = true
[monorepo]
config_roots = ["package/*/*"]
[settings]
experimental = true
task.disable_spec_from_run_scripts = true
[vars]
${variableSection('parse_usage_args',)}
${variableSection('run_test_files',)}
${taskSection('try',)}
${taskSection('buildAndTest',)}
${taskSection('prepareAndBuild--allowFailure',)}
[tasks.build]
run = "node root-build.ts"
[tasks.prepare]
run = "node prepare.ts"
[tasks.test]
run = "node test.ts"
`,);
  /** No credentials, Node options, usage arguments, or task settings leak into the fixture. */
  const result = spawnSync(mise, ['run', task, '--', ...args,], {
    cwd: root,
    encoding: 'utf8',
    timeout: CHILD_TIMEOUT_MS,
    maxBuffer: MAX_OUTPUT_BYTES,
    env: {
      PATH: [dirname(mise,), dirname(process.execPath,), process.env['PATH'] ?? '',].join(delimiter,),
      ...(process.env['SystemRoot'] === undefined ? {} : { SystemRoot: process.env['SystemRoot'], }),
      HOME: join(root, 'home',),
      XDG_CONFIG_HOME: join(root, 'config',),
      XDG_CACHE_HOME: join(root, 'cache',),
      XDG_DATA_HOME: join(root, 'data',),
      XDG_STATE_HOME: join(root, 'state',),
      MISE_CONFIG_DIR: join(root, 'config', 'mise',),
      MISE_SYSTEM_CONFIG_DIR: join(root, 'system',),
      MISE_GLOBAL_CONFIG_FILE: join(root, 'config', 'mise', 'config.toml',),
      MISE_STATE_DIR: join(root, 'state', 'mise',),
      MISE_CACHE_DIR: join(root, 'cache', 'mise',),
      MISE_DATA_DIR: join(root, 'data', 'mise',),
      MISE_CEILING_PATHS: dirname(root,),
      MISE_TRUSTED_CONFIG_PATHS: root,
      MISE_TASK_RUN_AUTO_INSTALL: 'false',
      MISE_JOBS: '1',
      NO_COLOR: '1',
      FIXTURE_EVENTS: join(root, 'events',),
    },
  },);
  if (result.error !== undefined)
    throw result.error;
  return {
    process: result,
    output: `${result.stdout}\n${result.stderr}`,
    events: readFileSync(join(root, 'events',), 'utf8',).trim().split('\n',),
  };
}
