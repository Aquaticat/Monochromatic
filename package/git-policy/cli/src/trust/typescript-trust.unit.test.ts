import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import type { DiscoveredConfig, } from './config-discovery.ts';
import { TrustedConfigError, } from './config-loader.ts';
import {
  inspectTrust,
  loadTrustedConfig,
  trustTypeScript,
} from './trust-service.ts';
import type { TrustConsentAdapters, } from './types.ts';

/** Disposable TypeScript trust fixture. */
type TypeScriptTrustFixture = Readonly<{
  /** Canonical repository root. */
  repository: string;
  /** Canonical config path. */
  configPath: string;
  /** Private registry root. */
  registryRoot: string;
  /** Canonical discovery value. */
  discovered: DiscoveredConfig;
  /** Removes fixture. */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 * Creates disposable TypeScript trust fixture.
 *
 * @param source - config entry source
 * @returns initialized fixture
 */
async function createFixture(source: string,): Promise<TypeScriptTrustFixture> {
  /** Canonical disposable repository. */
  const repository = await realpath(
    await mkdtemp(join(tmpdir(), 'cli-git-typescript-trust-',),),
  );
  /** Canonical config entry. */
  const configPath = join(repository, 'cli-git.config.ts',);
  await writeFile(configPath, source,);
  return {
    repository,
    configPath,
    registryRoot: join(repository, '.registry',),
    discovered: { repositoryRoot: repository, configPath, format: 'typescript', },
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(repository, { recursive: true, force: true, },);
    },
  };
}

/**
 * Creates deterministic consent adapters.
 *
 * @param disclosures - captured disclosure text
 * @returns noninteractive fixed-clock adapters
 */
function adapters(disclosures: string[],): TrustConsentAdapters {
  return {
    disclose: function disclose(text,) { disclosures.push(text,); },
    prompt: function approve() { return Promise.resolve('approved',); },
    now: function fixedTime() { return new Date('2026-07-10T00:00:00.000Z',); },
  };
}

/**
 * Captures expected strict loading failure.
 *
 * @param fixture - trust fixture
 * @returns thrown value
 */
async function captureLoadFailure(fixture: TypeScriptTrustFixture,): Promise<unknown> {
  try {
    return await loadTrustedConfig({ discovered: fixture.discovered, registryRoot: fixture.registryRoot, },);
  }
  catch (error: unknown) {
    return error;
  }
}

await describe({
  name: 'TypeScript snapshot trust',
  children: [
    it({
      name: 'builds validates stores and strictly loads relative source graph',
      fn: async function testExplicitLifecycle() {
        await using fixture = await createFixture(`import { message } from './policy.ts';
export default {
  plugins: {
    sample: {
      name: 'sample',
      policies: [{
        name: 'deny',
        defaultSeverity: 'error',
        warnSafe: true,
        triggers: ['direct-check'],
        check: async () => [{ code: 'denied', message }],
      }],
    },
  },
};
`,);
        /** Relative tracked policy source. */
        const policyPath = join(fixture.repository, 'policy.ts',);
        await writeFile(policyPath, `export const message: string = 'stored TypeScript bundle ran';\n`,);
        /** Explicit trust disclosures. */
        const disclosures: string[] = [];
        const trusted = await trustTypeScript({
          discovered: fixture.discovered,
          registryRoot: fixture.registryRoot,
          yes: true,
          adapters: adapters(disclosures,),
        },);
        expect(trusted.record.format,).toBe('typescript',);
        expect(trusted.record.sources,).toHaveLength(2,);
        expect(disclosures[0],).toContain('Format: typescript',);
        expect(disclosures[0],).toContain('Exact bundle state: new',);
        const loaded = await loadTrustedConfig({
          discovered: fixture.discovered,
          registryRoot: fixture.registryRoot,
        },);
        expect(loaded.validated.registeredPolicies.map(function policyName(policy,) {
          return policy.name;
        },),).toContain('sample/deny',);
        expect((await inspectTrust({ discovered: fixture.discovered, registryRoot: fixture.registryRoot, },)).reason,)
          .toBe('trusted',);
        await writeFile(policyPath, `export const message: string = 'changed';\n`,);
        const failure = await captureLoadFailure(fixture,);
        expect(failure,).toBeInstanceOf(TrustedConfigError,);
        if (failure instanceof TrustedConfigError)
          expect(failure.code,).toBe('config-changed',);
      },
    },),
    it({
      name: 'rebuilds every explicit trust and discloses bundle change',
      fn: async function testRepeatTrust() {
        await using fixture = await createFixture('export default {};\n',);
        await trustTypeScript({
          discovered: fixture.discovered,
          registryRoot: fixture.registryRoot,
          yes: true,
          adapters: adapters([],),
        },);
        await writeFile(fixture.configPath, 'export default { policies: {} };\n',);
        const disclosures: string[] = [];
        await trustTypeScript({
          discovered: fixture.discovered,
          registryRoot: fixture.registryRoot,
          yes: true,
          adapters: adapters(disclosures,),
        },);
        expect(disclosures[0],).toContain('Exact bundle state: changed',);
      },
    },),
    it({
      name: 'warns for bare package while stored bundle remains self-contained',
      fn: async function testPackageWarning() {
        await using fixture = await createFixture(`import { object } from 'valibot';\nexport default { trust: { children: Boolean(object({})) } };\n`,);
        /** Workspace dependency tree available only during explicit build. */
        const packageNodeModules = await realpath(join(import.meta.dirname, '../../node_modules',),);
        await symlink(packageNodeModules, join(fixture.repository, 'node_modules',), 'dir',);
        const disclosures: string[] = [];
        await trustTypeScript({
          discovered: fixture.discovered,
          registryRoot: fixture.registryRoot,
          yes: true,
          adapters: adapters(disclosures,),
        },);
        expect(disclosures[0],).toContain('bare package import is bundled but excluded',);
        await rm(join(fixture.repository, 'node_modules',),);
        expect((await loadTrustedConfig({ discovered: fixture.discovered, registryRoot: fixture.registryRoot, })).record.format,)
          .toBe('typescript',);
      },
    },),
    it({
      name: 'relaxed tracked metadata change rebuilds without consent',
      fn: async function testRelaxedRebuild() {
        await using fixture = await createFixture(`import { value } from './value.ts';\nexport default { trust: { children: value } };\n`,);
        /** Tracked relative source. */
        const valuePath = join(fixture.repository, 'value.ts',);
        await writeFile(valuePath, 'export const value: boolean = false;\n',);
        const trusted = await trustTypeScript({
          discovered: fixture.discovered,
          registryRoot: fixture.registryRoot,
          yes: true,
          adapters: adapters([],),
        },);
        await writeFile(valuePath, 'export const value: boolean = true;\n',);
        /** Exact relaxed identity entry. */
        const relaxedValue = `${trusted.record.identity.filesystemId}:${trusted.record.identity.canonicalConfigPath}`;
        const rebuilt = await loadTrustedConfig({
          discovered: fixture.discovered,
          registryRoot: fixture.registryRoot,
          relaxedValue,
        },);
        expect(rebuilt.validated.recursiveChildren,).toBe(true,);
        expect((await inspectTrust({ discovered: fixture.discovered, registryRoot: fixture.registryRoot, },)).reason,)
          .toBe('trusted',);
      },
    },),
    it({
      name: 'relaxed rebuild failure retains previous exact record',
      fn: async function testRelaxedFailureRollback() {
        await using fixture = await createFixture('export default {};\n',);
        const trusted = await trustTypeScript({
          discovered: fixture.discovered,
          registryRoot: fixture.registryRoot,
          yes: true,
          adapters: adapters([],),
        },);
        await writeFile(fixture.configPath, `const target = './missing.ts';\nawait import(target);\nexport default {};\n`,);
        /** Exact relaxed identity entry. */
        const relaxedValue = `${trusted.record.identity.filesystemId}:${trusted.record.identity.canonicalConfigPath}`;
        const failure = await (async function captureRelaxedFailure(): Promise<unknown> {
          try {
            return await loadTrustedConfig({
              discovered: fixture.discovered,
              registryRoot: fixture.registryRoot,
              relaxedValue,
            },);
          }
          catch (error: unknown) {
            return error;
          }
        })();
        expect(failure,).toBeInstanceOf(Error,);
        await writeFile(fixture.configPath, 'export default {};\n',);
        expect((await loadTrustedConfig({ discovered: fixture.discovered, registryRoot: fixture.registryRoot, })).record.recordedAt,)
          .toBe(trusted.record.recordedAt,);
      },
    },),
    it({
      name: 'concurrent relaxed rebuilds leave one valid exact record',
      fn: async function testRelaxedRebuildRace() {
        await using fixture = await createFixture('export default {};\n',);
        const trusted = await trustTypeScript({
          discovered: fixture.discovered,
          registryRoot: fixture.registryRoot,
          yes: true,
          adapters: adapters([],),
        },);
        await writeFile(fixture.configPath, 'export default { policies: {} };\n',);
        /** Exact relaxed identity entry. */
        const relaxedValue = `${trusted.record.identity.filesystemId}:${trusted.record.identity.canonicalConfigPath}`;
        const results = await Promise.allSettled([
          loadTrustedConfig({ discovered: fixture.discovered, registryRoot: fixture.registryRoot, relaxedValue, }),
          loadTrustedConfig({ discovered: fixture.discovered, registryRoot: fixture.registryRoot, relaxedValue, }),
        ],);
        expect(results.some(function succeeded(result,) {
          return result.status === 'fulfilled';
        },),).toBe(true,);
        expect((await loadTrustedConfig({ discovered: fixture.discovered, registryRoot: fixture.registryRoot, })).record.format,)
          .toBe('typescript',);
      },
    },),
    it({
      name: 'leaves no record when build is invalid',
      fn: async function testFailedBuild() {
        await using fixture = await createFixture(`const target = './policy.ts';\nawait import(target);\nexport default {};\n`,);
        const failure = await (async function captureTrustFailure(): Promise<unknown> {
          try {
            return await trustTypeScript({
              discovered: fixture.discovered,
              registryRoot: fixture.registryRoot,
              yes: true,
              adapters: adapters([],),
            },);
          }
          catch (error: unknown) {
            return error;
          }
        })();
        expect(failure,).toBeInstanceOf(Error,);
        expect((await inspectTrust({ discovered: fixture.discovered, registryRoot: fixture.registryRoot, },)).reason,)
          .toBe('untrusted',);
      },
    },),
  ],
},);
