import {
  mkdir,
  mkdtemp,
  realpath,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import nanoSpawn, {
  type Result,
  SubprocessError,
} from 'nano-spawn';
import { resolveGit, } from '../resolve-git.ts';

/** Real Git binary for disposable management repository. */
const REAL_GIT = await resolveGit();
/** Internal management subprocess runner. */
const RUNNER = join(import.meta.dirname, 'fixture', 'management-runner.ts',);
/** Self-contained direct-check plugin. */
const CONFIG_SOURCE = `
export default {
  plugins: {
    example: {
      name: 'example',
      policies: [{
        name: 'deny',
        defaultSeverity: 'error',
        warnSafe: true,
        triggers: ['direct-check'],
        check: async () => [{ code: 'denied', message: 'trusted plugin ran' }],
      }],
    },
  },
};
`;
/** Disposable management fixture. */
type ManagementFixture = Readonly<{
  /** Fixture root. */
  root: string;
  /** Repository root. */
  repository: string;
  /** Registry root. */
  registry: string;
  /** Config path. */
  configPath: string;
  /** Removes fixture. */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 * Creates disposable real Git management fixture.
 *
 * @returns disposable fixture
 */
async function createFixture(): Promise<ManagementFixture> {
  /** Disposable fixture root. */
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'cli-git-management-',),),
  );
  /** Repository root. */
  const repository = join(root, 'repo',);
  /** Private registry root. */
  const registry = join(root, 'registry',);
  await mkdir(repository,);
  await nanoSpawn(REAL_GIT, ['init', '--quiet',], { cwd: repository, },);
  /** Root config path. */
  const configPath = join(repository, 'cli-git.config.mjs',);
  await writeFile(configPath, CONFIG_SOURCE,);
  return {
    root,
    repository,
    registry,
    configPath,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(root, { recursive: true, force: true, },);
    },
  };
}

/**
 * Runs internal management process with injected complete registry root.
 *
 * @param fixture - disposable fixture
 *
 * @param args - management arguments
 *
 * @returns captured result
 */
async function runManagement({
  fixture,
  args,
}: Readonly<{
  fixture: ManagementFixture;
  args: readonly string[];
}>,): Promise<Result> {
  return await nanoSpawn('node', [
    RUNNER,
    fixture.registry,
    fixture.repository,
    ...args,
  ],);
}

/**
 * Captures expected management subprocess failure.
 *
 * @param fixture - disposable fixture
 *
 * @param args - management arguments
 *
 * @returns subprocess error
 */
async function runManagementFailure({
  fixture,
  args,
}: Readonly<{
  fixture: ManagementFixture;
  args: readonly string[];
}>,): Promise<SubprocessError> {
  try {
    await runManagement({ fixture, args, },);
  }
  catch (error: unknown) {
    if (error instanceof SubprocessError)
      return error;
    throw error;
  }
  throw new Error('Management command unexpectedly succeeded.',);
}

/**
 * Parses one compact management JSON object captured after nano-spawn strips its terminal LF.
 *
 * @param output - complete captured management stdout
 *
 * @returns parsed object with exact single-line framing proven
 */
function parseManagementOutput(output: string,): Record<string, unknown> {
  expect(output.includes('\n',),).toBe(false,);
  /** Parsed unknown management value. */
  const value: unknown = JSON.parse(output,);
  if (((typeof value) !== 'object') || (value === null) || Array.isArray(value,))
    throw new TypeError('Management output is not one JSON object.',);
  return value as Record<string, unknown>;
}

await describe({
  name: 'trust management runtime',
  children: [
    it({
      name: 'trust status check and untrust complete one lifecycle',
      fn: async function testManagementLifecycle() {
        await using fixture = await createFixture();
        /** Explicit noninteractive trust result. */
        const trustResult = await runManagement({ fixture, args: ['trust', '--yes',], },);
        expect(trustResult.stderr,).toContain('Exact snapshot state: new',);
        expect(trustResult.stderr,).toContain('full account permissions',);
        expect(trustResult.stdout,).toBe(JSON.stringify({
          schemaVersion: 1,
          type: 'trust-summary',
          configPath: fixture.configPath,
          trusted: true,
        },),);
        /** Trusted status result. */
        const statusResult = await runManagement({ fixture, args: ['status',], },);
        /** Parsed trusted status compatibility object. */
        const trustedStatus = parseManagementOutput(statusResult.stdout,);
        expect(trustedStatus,).toMatchObject({
          schemaVersion: 1,
          type: 'trust-status',
          configPresent: true,
          trusted: true,
          unchanged: true,
          configPath: fixture.configPath,
          reason: 'trusted',
        },);
        expect(Object.keys(trustedStatus,).toSorted(),).toEqual([
          'configPath',
          'configPresent',
          'filesystemId',
          'reason',
          'schemaVersion',
          'trusted',
          'type',
          'unchanged',
        ],);
        /** Direct trusted plugin finding. */
        const checkError = await runManagementFailure({
          fixture,
          args: ['check', '--policy', 'example/deny', '--all',],
        },);
        expect(checkError.exitCode,).toBe(1,);
        expect(checkError.stdout,).toContain('"policyId":"example/deny"',);
        expect(checkError.stdout,).toContain('"trigger":"direct-check"',);
        /** Exact untrust summary. */
        const untrustResult = await runManagement({ fixture, args: ['untrust',], },);
        expect(untrustResult.stdout,).toBe(JSON.stringify({
          schemaVersion: 1,
          type: 'untrust-summary',
          configPath: fixture.configPath,
          removed: true,
          affectedRoots: [],
        },),);
        /** Untrusted status after exact record removal. */
        const untrustedStatus = parseManagementOutput((await runManagement({
          fixture,
          args: ['status',],
        },)).stdout,);
        expect(untrustedStatus,).toMatchObject({
          schemaVersion: 1,
          type: 'trust-status',
          configPresent: true,
          trusted: false,
          unchanged: false,
          configPath: fixture.configPath,
          reason: 'untrusted',
        },);
      },
    },),
    it({
      name: 'reports corrupt stored record through stable status reason',
      fn: async function testCorruptStatus() {
        await using fixture = await createFixture();
        await runManagement({ fixture, args: ['trust', '--yes',], },);
        /** Registry paths after exact trust enrollment. */
        const registryPaths = await readdir(fixture.registry, { recursive: true, },);
        /** Relative exact record path selected from registry. */
        const recordPath = registryPaths.find(function isRecordPath(path,) {
          return path.endsWith('record.json',);
        },);
        if (recordPath === undefined)
          throw new Error('Trusted fixture did not create record.json.',);
        await writeFile(join(fixture.registry, recordPath,), '{}\n',);
        /** Corrupt status result. */
        const status = parseManagementOutput((await runManagement({
          fixture,
          args: ['status',],
        },)).stdout,);
        expect(status,).toMatchObject({
          schemaVersion: 1,
          type: 'trust-status',
          configPresent: true,
          trusted: false,
          unchanged: false,
          configPath: fixture.configPath,
          reason: 'corrupt',
        },);
      },
    },),
    it({
      name: 'noninteractive trust without yes declines with exit two',
      fn: async function testNoninteractiveDecline() {
        await using fixture = await createFixture();
        /** Declined trust process. */
        const error = await runManagementFailure({ fixture, args: ['trust',], },);
        expect(error.exitCode,).toBe(2,);
        expect(parseManagementOutput(error.stdout,),).toMatchObject({
          schemaVersion: 1,
          sequence: 0,
          type: 'engine-failure',
          code: 'trust-failed',
          message: 'Trust declined; no persistent record was installed.',
        },);
        expect(error.stderr,).toContain('Exact snapshot state: new',);
        const status = await runManagement({ fixture, args: ['status',], },);
        expect(status.stdout,).toContain('"reason":"untrusted"',);
      },
    },),
    it({
      name: 'untrust recovers record after config deletion',
      fn: async function testDeletedConfigUntrust() {
        await using fixture = await createFixture();
        await writeFile(fixture.configPath, 'export default { trust: { children: true } };\n',);
        await runManagement({ fixture, args: ['trust', '--yes',], },);
        await rm(fixture.configPath,);
        const untrustResult = await runManagement({ fixture, args: ['untrust',], },);
        expect(untrustResult.stdout,).toContain('"removed":true',);
        expect(untrustResult.stdout,).toContain('"configPath":null',);
        const status = await runManagement({ fixture, args: ['status',], },);
        expect(status.stdout,).toBe('{"schemaVersion":1,"type":"trust-status","configPresent":false,"trusted":false,"unchanged":false,"reason":"no-config"}',);
      },
    },),
    it({
      name: 'changed bytes report changed and block direct check',
      fn: async function testChangedConfig() {
        await using fixture = await createFixture();
        await runManagement({ fixture, args: ['trust', '--yes',], },);
        await writeFile(fixture.configPath, 'export default {};\n',);
        const status = await runManagement({ fixture, args: ['status',], },);
        expect(parseManagementOutput(status.stdout,),).toMatchObject({
          schemaVersion: 1,
          type: 'trust-status',
          configPresent: true,
          trusted: false,
          unchanged: false,
          configPath: fixture.configPath,
          reason: 'changed',
        },);
        /** Direct changed-config engine failure. */
        const error = await runManagementFailure({ fixture, args: ['check', '--all',], },);
        expect(error.exitCode,).toBe(2,);
        expect(error.stderr,).toBe('',);
        expect(parseManagementOutput(error.stdout,),).toMatchObject({
          schemaVersion: 1,
          sequence: 0,
          type: 'engine-failure',
          code: 'config-changed',
        },);
      },
    },),
  ],
},);
