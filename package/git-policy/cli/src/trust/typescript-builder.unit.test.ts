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
import { executeStoredConfig, } from './config-loader.ts';
import { writePrivateFile, } from './registry-io.ts';
import { TypeScriptBuildError, } from './typescript-build-error.ts';
import { buildTypeScriptCandidate, } from './typescript-builder.ts';

/** Disposable TypeScript builder fixture. */
type BuilderFixture = Readonly<{
  /** Canonical repository root. */
  repository: string;
  /** Canonical TypeScript entry. */
  configPath: string;
  /** Private output directory. */
  buildDirectory: string;
  /** Canonical discovered config. */
  discovered: DiscoveredConfig;
  /** Removes fixture. */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 * Creates disposable TypeScript repository fixture.
 *
 * @param source - entry source
 * @returns initialized fixture
 */
async function createFixture(source: string,): Promise<BuilderFixture> {
  /** Canonical disposable repository. */
  const repository = await realpath(
    await mkdtemp(join(tmpdir(), 'cli-git-typescript-',),),
  );
  /** Canonical TypeScript config. */
  const configPath = join(repository, 'cli-git.config.ts',);
  await writeFile(configPath, source,);
  /** Private tsdown output location. */
  const buildDirectory = join(repository, '.private-build',);
  await mkdir(buildDirectory,);
  return {
    repository,
    configPath,
    buildDirectory,
    discovered: { repositoryRoot: repository, configPath, format: 'typescript', },
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(repository, { recursive: true, force: true, },);
    },
  };
}

/**
 * Captures expected build failure.
 *
 * @param fixture - TypeScript builder fixture
 * @returns thrown failure
 */
async function captureBuildFailure(fixture: BuilderFixture,): Promise<unknown> {
  try {
    return await buildTypeScriptCandidate({
      discovered: fixture.discovered,
      buildDirectory: fixture.buildDirectory,
    },);
  }
  catch (error: unknown) {
    return error;
  }
}

await describe({
  name: 'TypeScript trust candidate builder',
  children: [
    it({
      name: 'bundles one entry and relative local graph into executable ESM',
      fn: async function testRelativeGraph() {
        await using fixture = await createFixture(`import { message } from './policy.ts';
export default {
  plugins: {
    example: {
      name: 'example',
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
        await writeFile(join(fixture.repository, 'policy.ts',), `export const message: string = 'bundled TypeScript ran';\n`,);
        const candidate = await buildTypeScriptCandidate({
          discovered: fixture.discovered,
          buildDirectory: fixture.buildDirectory,
        },);
        expect(candidate.sources.map(function sourcePath(source,) {
          return source.canonicalPath;
        },),)
          .toEqual([fixture.configPath, join(fixture.repository, 'policy.ts',),],);
        /** Private executable copy for import verification. */
        const executablePath = join(fixture.repository, 'stored.mjs',);
        await writePrivateFile({ path: executablePath, bytes: candidate.executableBytes, },);
        const validated = await executeStoredConfig(executablePath,);
        expect(validated.registeredPolicies.map(function policyName(policy,) {
          return policy.name;
        },),)
          .toContain('example/deny',);
      },
    },),
    it({
      name: 'inlines literal dynamic local import into one bundle',
      fn: async function testLiteralDynamicImport() {
        await using fixture = await createFixture(`export default {\n  plugins: {\n    dynamic: {\n      name: 'dynamic',\n      policies: [{\n        name: 'load',\n        defaultSeverity: 'off',\n        warnSafe: true,\n        triggers: ['direct-check'],\n        check: async () => { const loaded = await import('./dynamic.ts'); return loaded.findings; },\n      }],\n    },\n  },\n};\n`,);
        await writeFile(join(fixture.repository, 'dynamic.ts',), 'export const findings = [];\n',);
        const candidate = await buildTypeScriptCandidate({
          discovered: fixture.discovered,
          buildDirectory: fixture.buildDirectory,
        },);
        expect(candidate.sources,).toHaveLength(2,);
        expect(new TextDecoder().decode(candidate.executableBytes,),).not.toContain("import('./dynamic",);
      },
    },),
    it({
      name: 'tree shakes executable runtime from cli-git package-root authoring imports',
      fn: async function testCliGitPackageRootImport() {
        await using fixture = await createFixture(`import {
  defineConfig,
  repositoryPolicyPlugin,
} from '@monochromatic-dev/git-policy-cli';

export default defineConfig({
  plugins: { mono: repositoryPolicyPlugin },
});
`,);
        /** Current cli-git package exposed as installed scoped package to disposable fixture. */
        const packageDirectory = await realpath(join(import.meta.dirname, '../..',),);
        const fixtureScope = join(fixture.repository, 'node_modules', '@monochromatic-dev',);
        await mkdir(fixtureScope, { recursive: true, },);
        await symlink(packageDirectory, join(fixtureScope, 'git-policy-cli',), 'dir',);
        const candidate = await buildTypeScriptCandidate({
          discovered: fixture.discovered,
          buildDirectory: fixture.buildDirectory,
        },);
        expect(candidate.barePackageImports,).toContain('@monochromatic-dev/git-policy-cli',);
        /** Private executable copy for import verification. */
        const executablePath = join(fixture.repository, 'stored.mjs',);
        await writePrivateFile({ path: executablePath, bytes: candidate.executableBytes, },);
        const validated = await executeStoredConfig(executablePath,);
        expect(validated.registeredPolicies.map(function policyName(policy,) {
          return policy.name;
        },),)
          .toContain('mono/forbidden-root-context',);
      },
    },),
    it({
      name: 'inlines literal dynamic bare package into sole bundle',
      fn: async function testLiteralDynamicPackage() {
        await using fixture = await createFixture(`export default {\n  plugins: {\n    dynamic: {\n      name: 'dynamic',\n      policies: [{\n        name: 'load',\n        defaultSeverity: 'off',\n        warnSafe: true,\n        triggers: ['direct-check'],\n        check: async () => { await import('valibot'); return []; },\n      }],\n    },\n  },\n};\n`,);
        /** Workspace dependency tree exposed to disposable fixture. */
        const workspaceNodeModules = await realpath(join(import.meta.dirname, '../../node_modules',),);
        await symlink(workspaceNodeModules, join(fixture.repository, 'node_modules',), 'dir',);
        const candidate = await buildTypeScriptCandidate({
          discovered: fixture.discovered,
          buildDirectory: fixture.buildDirectory,
        },);
        expect(candidate.barePackageImports,).toContain('valibot',);
        expect(new TextDecoder().decode(candidate.executableBytes,),).not.toContain("import('valibot')",);
      },
    },),
    it({
      name: 'rejects computed dynamic imports left outside bundle graph',
      fn: async function testComputedDynamicImport() {
        await using fixture = await createFixture(`const target = './policy.ts';
await import(target);
export default {};
`,);
        await writeFile(join(fixture.repository, 'policy.ts',), 'export default {};\n',);
        const failure = await captureBuildFailure(fixture,);
        expect(failure,).toBeInstanceOf(Error,);
      },
    },),
    it({
      name: 'bundles bare package but reports it outside invalidation graph',
      fn: async function testBarePackageWarning() {
        await using fixture = await createFixture(`import { object } from 'valibot';
export default { policies: object({}) };
`,);
        /** Workspace dependency tree exposed to disposable fixture. */
        const workspaceNodeModules = await realpath(join(import.meta.dirname, '../../node_modules',),);
        await symlink(workspaceNodeModules, join(fixture.repository, 'node_modules',), 'dir',);
        const candidate = await buildTypeScriptCandidate({
          discovered: fixture.discovered,
          buildDirectory: fixture.buildDirectory,
        },);
        expect(candidate.barePackageImports,).toContain('valibot',);
        expect(candidate.sources,).toHaveLength(1,);
      },
    },),
    it({
      name: 'rejects unavailable scoped package subpath before output generation',
      fn: async function testUnavailablePackage() {
        await using fixture = await createFixture(`import missing from '@missing/package/subpath';
export default { trust: { children: Boolean(missing) } };
`,);
        const failure = await captureBuildFailure(fixture,);
        if ((!Error.isError(failure,))
          || (!('errors' in failure))
          || (!Array.isArray(failure.errors)))
          throw new Error('Expected Rolldown failure with nested plugin errors.',);
        expect(failure.errors[0],).toBeInstanceOf(TypeScriptBuildError,);
      },
    },),
    it({
      name: 'contains package asset within sole JavaScript bundle',
      fn: async function testPackageAsset() {
        await using fixture = await createFixture(`import value from 'asset-package';\nexport default { trust: { children: Boolean(value) } };\n`,);
        /** Disposable package with non-JavaScript asset edge. */
        const packageDirectory = join(fixture.repository, 'node_modules', 'asset-package',);
        await mkdir(packageDirectory, { recursive: true, },);
        await writeFile(join(packageDirectory, 'package.json',), '{"name":"asset-package","type":"module","exports":"./index.js"}\n',);
        await writeFile(join(packageDirectory, 'index.js',), `import text from './asset.txt';\nexport default text;\n`,);
        await writeFile(join(packageDirectory, 'asset.txt',), 'asset\n',);
        const candidate = await buildTypeScriptCandidate({
          discovered: fixture.discovered,
          buildDirectory: fixture.buildDirectory,
        },);
        expect(candidate.sources,).toHaveLength(1,);
        expect(candidate.barePackageImports,).toContain('asset-package',);
      },
    },),
    it({
      name: 'rejects native package module from executable bundle',
      fn: async function testNativeModule() {
        await using fixture = await createFixture(`import native from 'native-package';\nexport default { trust: { children: Boolean(native) } };\n`,);
        /** Disposable package resolving to native binary. */
        const packageDirectory = join(fixture.repository, 'node_modules', 'native-package',);
        await mkdir(packageDirectory, { recursive: true, },);
        await writeFile(join(packageDirectory, 'package.json',), '{"name":"native-package","exports":"./addon.node"}\n',);
        await writeFile(join(packageDirectory, 'addon.node',), new Uint8Array([0, 1, 2,]),);
        expect(await captureBuildFailure(fixture,),).toBeInstanceOf(Error,);
      },
    },),
    it({
      name: 'rejects dynamically imported native package module',
      fn: async function testDynamicNativeModule() {
        await using fixture = await createFixture(`export default {\n  plugins: {\n    native: {\n      name: 'native',\n      policies: [{\n        name: 'load',\n        defaultSeverity: 'off',\n        warnSafe: true,\n        triggers: ['direct-check'],\n        check: async () => { await import('dynamic-native-package'); return []; },\n      }],\n    },\n  },\n};\n`,);
        /** Disposable package resolving to native binary. */
        const packageDirectory = join(fixture.repository, 'node_modules', 'dynamic-native-package',);
        await mkdir(packageDirectory, { recursive: true, },);
        await writeFile(join(packageDirectory, 'package.json',), '{"name":"dynamic-native-package","exports":"./addon.node"}\n',);
        await writeFile(join(packageDirectory, 'addon.node',), new Uint8Array([0, 1, 2,]),);
        expect(await captureBuildFailure(fixture,),).toBeInstanceOf(Error,);
      },
    },),
    it({
      name: 'rejects relative source escaping repository through symlink',
      fn: async function testSymlinkEscape() {
        await using fixture = await createFixture(`import './outside.ts';\nexport default {};\n`,);
        /** Source outside canonical repository root. */
        const outside = join(fixture.repository, '..', 'outside.ts',);
        await writeFile(outside, 'export {};\n',);
        await symlink(outside, join(fixture.repository, 'outside.ts',),);
        const failure = await captureBuildFailure(fixture,);
        expect(failure,).toBeInstanceOf(Error,);
        await rm(outside, { force: true, },);
      },
    },),
  ],
},);
