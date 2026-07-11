import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { dirname, join, } from 'node:path';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import nanoSpawn from 'nano-spawn';
import { resolveGit, } from '../resolve-git.ts';
import { discoverConfig, CONFIG_ABSENT, } from './config-discovery.ts';
import { TrustedConfigError, } from './config-loader.ts';
import { recordDirectory, } from './registry-path.ts';
import { prepareMjsRecord, } from './registry-storage.ts';
import {
  resolveRuntimeConfig,
  RUNTIME_CONFIG_ABSENT,
} from './runtime-config.ts';
import {
  inspectTrust,
  loadTrustedConfig,
  trustMjs,
  untrustConfig,
} from './trust-service.ts';
import { captureTrustCandidate, } from './candidate.ts';
import type { TrustWarning, } from './types.ts';

/** Real Git binary for disposable fixtures. */
const REAL_GIT = await resolveGit();
/** Self-contained plugin config producing direct finding. */
const VALID_CONFIG = `
export default {
  plugins: {
    example: {
      name: 'example',
      policies: [{
        name: 'deny',
        defaultSeverity: 'error',
        warnSafe: true,
        triggers: ['direct-check'],
        check: async () => [{ code: 'denied', message: 'stored policy ran' }],
      }],
    },
  },
};
`;
/** Disposable trust fixture. */
type TrustFixture = Readonly<{
  /** Fixture root. */
  root: string;
  /** Repository root. */
  repository: string;
  /** Config path. */
  configPath: string;
  /** Private registry root. */
  registryRoot: string;
  /** Removes fixture. */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 * Creates disposable real Git repository and private registry.
 *
 * @param source - MJS config source
 *
 * @returns disposable trust fixture
 */
async function createTrustFixture(source: string = VALID_CONFIG,): Promise<TrustFixture> {
  /** Disposable fixture root. */
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'cli-git-trust-',),),
  );
  /** Disposable repository root. */
  const repository = join(root, 'repo',);
  /** Private injected registry root. */
  const registryRoot = join(root, 'registry',);
  await mkdir(repository,);
  await nanoSpawn(REAL_GIT, ['init', '--quiet',], { cwd: repository, },);
  /** Canonical config source path. */
  const configPath = join(repository, 'cli-git.config.mjs',);
  await writeFile(configPath, source,);
  return {
    root,
    repository,
    configPath,
    registryRoot,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(root, { recursive: true, force: true, },);
    },
  };
}

/**
 * Discovers fixture config and rejects impossible absence.
 *
 * @param fixture - disposable fixture
 *
 * @returns discovered MJS config
 */
async function fixtureConfig(fixture: TrustFixture,) {
  const discovered = await discoverConfig(['-C', fixture.repository, 'future-command',],);
  if (discovered === CONFIG_ABSENT)
    throw new Error('Fixture config was not discovered.',);
  return discovered;
}

/**
 * Creates deterministic noninteractive trust adapters.
 *
 * @param disclosures - captured disclosure output
 *
 * @returns trust consent adapters
 */
function trustAdapters(disclosures: string[],) {
  return {
    disclose: function captureDisclosure(text: string,) {
      disclosures.push(text,);
    },
    prompt: function rejectUnexpectedPrompt() {
      return Promise.resolve(false,);
    },
    now: function fixedAuditTime() {
      return new Date('2026-07-10T00:00:00.000Z',);
    },
  };
}

await describe({
  name: 'single-artifact MJS trust',
  children: [
    it({
      name: 'blocks first config-loading use but skips known read-only use',
      fn: async function testFirstUseBlock() {
        await using fixture = await createTrustFixture();
        /** Untrusted config-loading failure. */
        const failure = await (async function captureFirstUseFailure(): Promise<unknown> {
          try {
            return await resolveRuntimeConfig({
              args: ['-C', fixture.repository, 'future-command',],
              registryRoot: fixture.registryRoot,
            },);
          }
          catch (error: unknown) {
            return error;
          }
        })();
        expect(failure,).toBeInstanceOf(TrustedConfigError,);
        if (failure instanceof TrustedConfigError)
          expect(failure.code,).toBe('config-untrusted',);
        expect(await resolveRuntimeConfig({
          args: ['-C', fixture.repository, 'status',],
          registryRoot: fixture.registryRoot,
        },),).toBe(RUNTIME_CONFIG_ABSENT,);
      },
    },),
    it({
      name: 'trusts executes and inspects exact stored snapshot',
      fn: async function testTrustLifecycle() {
        await using fixture = await createTrustFixture();
        /** Canonical discovered config. */
        const discovered = await fixtureConfig(fixture,);
        /** Captured mandatory trust disclosure. */
        const disclosures: string[] = [];
        /** Trust result loaded from private candidate snapshot. */
        const trusted = await trustMjs({
          discovered,
          registryRoot: fixture.registryRoot,
          yes: true,
          adapters: trustAdapters(disclosures,),
        },);
        expect(disclosures[0],).toContain(fixture.configPath,);
        expect(disclosures[0],).toContain('Filesystem identity:',);
        expect(disclosures[0],).toContain('Exact snapshot state: new',);
        expect(disclosures[0],).toContain('full account permissions',);
        expect(trusted.validated.registeredPolicies.map(function policyId(policy,) {
          return policy.name;
        },),).toEqual([
      'require-root',
      'linked-worktree-only',
      'branch-worktree-only',
      'add-explicit',
      'final-newline',
      'example/deny',
    ],);
        /** Strict load from installed stored snapshot. */
        const loaded = await loadTrustedConfig({
          discovered,
          registryRoot: fixture.registryRoot,
        },);
        expect(loaded.validated.policySeverities['example/deny'],).toBe('error',);
        expect(await inspectTrust({ discovered, registryRoot: fixture.registryRoot, },),).toMatchObject({
          trusted: true,
          unchanged: true,
          reason: 'trusted',
        },);
      },
    },),
    it({
      name: 'blocks changed live bytes without executing them',
      fn: async function testChangedBytes() {
        await using fixture = await createTrustFixture();
        /** Canonical discovered config. */
        const discovered = await fixtureConfig(fixture,);
        await trustMjs({
          discovered,
          registryRoot: fixture.registryRoot,
          yes: true,
          adapters: trustAdapters([],),
        },);
        await writeFile(fixture.configPath, "throw new Error('live file executed');\nexport default {};\n",);
        /** Changed-byte strict load failure. */
        const failure = await (async function captureChangedFailure(): Promise<unknown> {
          try {
            return await loadTrustedConfig({
              discovered,
              registryRoot: fixture.registryRoot,
            },);
          }
          catch (error: unknown) {
            return error;
          }
        })();
        expect(failure,).toBeInstanceOf(TrustedConfigError,);
        if (failure instanceof TrustedConfigError)
          expect(failure.code,).toBe('config-changed',);
        expect(await inspectTrust({ discovered, registryRoot: fixture.registryRoot, },),).toMatchObject({
          trusted: false,
          reason: 'changed',
        },);
      },
    },),
    it({
      name: 'relaxed unchanged metadata executes stored MJS snapshot',
      fn: async function testRelaxedMetadataHit() {
        /** Equal-length safe and throwing source bytes. */
        const safeSource = 'export default {};\n';
        const changedSource = 'throw new Error();\n';
        expect(safeSource.length,).toBe(changedSource.length,);
        await using fixture = await createTrustFixture(safeSource,);
        /** Stable exact metadata timestamp. */
        const fixedTime = new Date('2026-07-10T00:00:00.000Z',);
        await utimes(fixture.configPath, fixedTime, fixedTime,);
        const discovered = await fixtureConfig(fixture,);
        const trusted = await trustMjs({
          discovered,
          registryRoot: fixture.registryRoot,
          yes: true,
          adapters: trustAdapters([],),
        },);
        await writeFile(fixture.configPath, changedSource,);
        await utimes(fixture.configPath, fixedTime, fixedTime,);
        /** Exact relaxed identity entry. */
        const relaxedValue = `${trusted.record.identity.filesystemId}:${trusted.record.identity.canonicalConfigPath}`;
        const loaded = await loadTrustedConfig({
          discovered,
          registryRoot: fixture.registryRoot,
          relaxedValue,
        },);
        expect(loaded.record.recordedAt,).toBe(trusted.record.recordedAt,);
      },
    },),
    it({
      name: 'relaxed changed metadata validates and replaces MJS snapshot',
      fn: async function testRelaxedMetadataRefresh() {
        await using fixture = await createTrustFixture('export default {};\n',);
        const discovered = await fixtureConfig(fixture,);
        const trusted = await trustMjs({
          discovered,
          registryRoot: fixture.registryRoot,
          yes: true,
          adapters: trustAdapters([],),
        },);
        await writeFile(fixture.configPath, 'export default { policies: {} };\n',);
        /** Exact relaxed identity entry. */
        const relaxedValue = `${trusted.record.identity.filesystemId}:${trusted.record.identity.canonicalConfigPath}`;
        const refreshed = await loadTrustedConfig({
          discovered,
          registryRoot: fixture.registryRoot,
          relaxedValue,
        },);
        expect(refreshed.record.recordedAt === trusted.record.recordedAt,).toBe(false,);
        expect((await inspectTrust({ discovered, registryRoot: fixture.registryRoot, },)).reason,).toBe('trusted',);
      },
    },),
    it({
      name: 'malformed relaxed entry warns and retains strict block',
      fn: async function testMalformedRelaxedEntry() {
        await using fixture = await createTrustFixture('export default {};\n',);
        const discovered = await fixtureConfig(fixture,);
        await trustMjs({
          discovered,
          registryRoot: fixture.registryRoot,
          yes: true,
          adapters: trustAdapters([],),
        },);
        await writeFile(fixture.configPath, 'export default { policies: {} };\n',);
        /** Captured prominent parser warnings. */
        const warnings: TrustWarning[] = [];
        const failure = await (async function captureMalformedFailure(): Promise<unknown> {
          try {
            return await loadTrustedConfig({
              discovered,
              registryRoot: fixture.registryRoot,
              relaxedValue: 'bad%20entry',
              warn: function warn(warning,) { warnings.push(warning,); },
            },);
          }
          catch (error: unknown) {
            return error;
          }
        })();
        expect(warnings,).toHaveLength(1,);
        expect(failure,).toBeInstanceOf(TrustedConfigError,);
        if (failure instanceof TrustedConfigError)
          expect(failure.code,).toBe('config-changed',);
      },
    },),
    it({
      name: 'does not execute candidate before declined consent',
      fn: async function testDeclinedConsent() {
        /** Side-effect marker outside repository config. */
        const marker = join(tmpdir(), `cli-git-preconsent-${String(Date.now(),)}.txt`,);
        /** Candidate whose top-level evaluation would create marker. */
        const source = `import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(marker,)}, 'executed');\nexport default {};\n`;
        await using fixture = await createTrustFixture(source,);
        /** Canonical discovered config. */
        const discovered = await fixtureConfig(fixture,);
        /** Declined trust failure. */
        const failure = await (async function captureDeclineFailure(): Promise<unknown> {
          try {
            return await trustMjs({
              discovered,
              registryRoot: fixture.registryRoot,
              yes: false,
              adapters: trustAdapters([],),
            },);
          }
          catch (error: unknown) {
            return error;
          }
        })();
        expect(failure,).toBeInstanceOf(TrustedConfigError,);
        /** Marker existence after declined trust. */
        const markerExists = await (async function probeMarker(): Promise<boolean> {
          try {
            await access(marker,);
            return true;
          }
          catch (error: unknown) {
            if (Error.isError(error,) && ('code' in error) && (error.code === 'ENOENT'))
              return false;
            throw error;
          }
        })();
        expect(markerExists,).toBe(false,);
      },
    },),
    it({
      name: 'rejects non-self-contained config before consent',
      fn: async function testPreConsentRejection() {
        await using fixture = await createTrustFixture("import './local.mjs'; export default {};\n",);
        /** Canonical discovered config. */
        const discovered = await fixtureConfig(fixture,);
        /** Disclosure remains empty because validation precedes consent. */
        const disclosures: string[] = [];
        /** Validation failure. */
        const failure = await (async function captureValidationFailure(): Promise<unknown> {
          try {
            return await trustMjs({
              discovered,
              registryRoot: fixture.registryRoot,
              yes: true,
              adapters: trustAdapters(disclosures,),
            },);
          }
          catch (error: unknown) {
            return error;
          }
        })();
        expect(failure,).toBeInstanceOf(Error,);
        expect(disclosures,).toEqual([],);
        expect(await inspectTrust({ discovered, registryRoot: fixture.registryRoot, },),).toMatchObject({
          trusted: false,
          reason: 'untrusted',
        },);
      },
    },),
    it({
      name: 'does not persist throwing candidate',
      fn: async function testThrowingCandidate() {
        await using fixture = await createTrustFixture("throw new Error('candidate failed');\nexport default {};\n",);
        /** Canonical discovered config. */
        const discovered = await fixtureConfig(fixture,);
        /** Candidate execution failure. */
        const failure = await (async function captureCandidateFailure(): Promise<unknown> {
          try {
            return await trustMjs({
              discovered,
              registryRoot: fixture.registryRoot,
              yes: true,
              adapters: trustAdapters([],),
            },);
          }
          catch (error: unknown) {
            return error;
          }
        })();
        expect(failure,).toBeInstanceOf(TrustedConfigError,);
        expect(await inspectTrust({ discovered, registryRoot: fixture.registryRoot, },),).toMatchObject({
          trusted: false,
          reason: 'untrusted',
        },);
      },
    },),
    it({
      name: 'untrust removes exact identity record',
      fn: async function testUntrust() {
        await using fixture = await createTrustFixture();
        /** Canonical discovered config. */
        const discovered = await fixtureConfig(fixture,);
        await trustMjs({ discovered, registryRoot: fixture.registryRoot, yes: true, adapters: trustAdapters([],), },);
        expect((await untrustConfig({ discovered, registryRoot: fixture.registryRoot, },)).removed,).toBe(true,);
        expect((await untrustConfig({ discovered, registryRoot: fixture.registryRoot, },)).removed,).toBe(false,);
      },
    },),
    it({
      name: 'releases writer lock after preparation failure',
      fn: async function testPreparationCleanup() {
        await using fixture = await createTrustFixture();
        /** Canonical discovered config. */
        const discovered = await fixtureConfig(fixture,);
        /** Exact candidate used for direct storage preparation. */
        const candidate = await captureTrustCandidate(discovered,);
        /** Invalid-record preparation failure after lock acquisition. */
        const failure = await (async function capturePreparationFailure(): Promise<unknown> {
          try {
            return await prepareMjsRecord({
              registryRoot: fixture.registryRoot,
              candidate,
              recordedAt: 'not-a-timestamp',
            },);
          }
          catch (error: unknown) {
            return error;
          }
        })();
        expect(failure,).toBeInstanceOf(Error,);
        await using prepared = await prepareMjsRecord({
          registryRoot: fixture.registryRoot,
          candidate,
          recordedAt: '2026-07-10T00:00:00.000Z',
        },);
        expect(prepared.record.identity,).toEqual(candidate.identity,);
      },
    },),
    it({
      name: 'fails one concurrent writer closed',
      fn: async function testConcurrentWriters() {
        await using fixture = await createTrustFixture("await new Promise(resolve => setTimeout(resolve, 50));\nexport default {};\n",);
        /** Canonical discovered config. */
        const discovered = await fixtureConfig(fixture,);
        /** Concurrent explicit trust attempts for same identity. */
        const results = await Promise.allSettled([
          trustMjs({ discovered, registryRoot: fixture.registryRoot, yes: true, adapters: trustAdapters([],), },),
          trustMjs({ discovered, registryRoot: fixture.registryRoot, yes: true, adapters: trustAdapters([],), },),
        ],);
        expect(results.filter(function isFulfilled(result,) {
          return result.status === 'fulfilled';
        },),).toHaveLength(1,);
        expect(results.filter(function isRejected(result,) {
          return result.status === 'rejected';
        },),).toHaveLength(1,);
      },
    },),
    it({
      name: 'ignores interrupted candidate directories',
      fn: async function testInterruptedCandidate() {
        await using fixture = await createTrustFixture();
        /** Canonical discovered config. */
        const discovered = await fixtureConfig(fixture,);
        /** Fresh identity locates exact final path. */
        const candidate = await captureTrustCandidate(discovered,);
        /** Exact final record directory. */
        const directory = recordDirectory({ registryRoot: fixture.registryRoot, identity: candidate.identity, },);
        await mkdir(`${directory}.tmp-interrupted`, { recursive: true, mode: 0o700, },);
        expect(await inspectTrust({ discovered, registryRoot: fixture.registryRoot, },),).toMatchObject({ reason: 'untrusted', },);
        await trustMjs({ discovered, registryRoot: fixture.registryRoot, yes: true, adapters: trustAdapters([],), },);
        expect(await inspectTrust({ discovered, registryRoot: fixture.registryRoot, },),).toMatchObject({ reason: 'trusted', },);
      },
    },),
    it({
      name: 'rejects registry paths with symlinked ancestors',
      fn: async function testRegistryAncestorSymlink() {
        await using fixture = await createTrustFixture();
        /** Canonical discovered config. */
        const discovered = await fixtureConfig(fixture,);
        /** Real directory hidden behind injected ancestor link. */
        const realAncestor = join(fixture.root, 'real-registry-parent',);
        /** Symlinked injected ancestor. */
        const linkedAncestor = join(fixture.root, 'linked-registry-parent',);
        await mkdir(realAncestor, { mode: 0o700, },);
        await symlink(realAncestor, linkedAncestor, 'dir',);
        /** Unsafe-root trust failure. */
        const failure = await (async function captureUnsafeRootFailure(): Promise<unknown> {
          try {
            return await trustMjs({
              discovered,
              registryRoot: join(linkedAncestor, 'registry',),
              yes: true,
              adapters: trustAdapters([],),
            },);
          }
          catch (error: unknown) {
            return error;
          }
        })();
        expect(failure,).toBeInstanceOf(Error,);
      },
    },),
    it({
      name: 'fails closed on unsafe record permissions and symlinks',
      fn: async function testUnsafeRecord() {
        await using fixture = await createTrustFixture();
        /** Canonical discovered config. */
        const discovered = await fixtureConfig(fixture,);
        await trustMjs({ discovered, registryRoot: fixture.registryRoot, yes: true, adapters: trustAdapters([],), },);
        /** Fresh identity locates exact record path. */
        const candidate = await captureTrustCandidate(discovered,);
        /** Exact record directory. */
        const directory = recordDirectory({ registryRoot: fixture.registryRoot, identity: candidate.identity, },);
        if (process.platform !== 'win32') {
          await chmod(join(directory, 'record.json',), 0o644,);
          expect(await inspectTrust({ discovered, registryRoot: fixture.registryRoot, },),).toMatchObject({ reason: 'corrupt', },);
          await chmod(join(directory, 'record.json',), 0o600,);
        }
        /** Real registry moved behind a root-level symbolic link. */
        const movedRegistry = `${fixture.registryRoot}-moved`;
        await rename(fixture.registryRoot, movedRegistry,);
        await symlink(movedRegistry, fixture.registryRoot, 'dir',);
        expect(await inspectTrust({ discovered, registryRoot: fixture.registryRoot, },),).toMatchObject({ reason: 'corrupt', },);
        await rm(fixture.registryRoot,);
        await rename(movedRegistry, fixture.registryRoot,);
        /** Original record bytes preserved across symlink substitution. */
        const recordBytes = await readFile(join(directory, 'record.json',),);
        await rm(directory, { recursive: true, force: true, },);
        /** Symlink target outside encoded record path. */
        const externalDirectory = join(fixture.root, 'external-record',);
        await mkdir(externalDirectory,);
        await writeFile(join(externalDirectory, 'record.json',), recordBytes,);
        await symlink(externalDirectory, directory, 'dir',);
        expect(await inspectTrust({ discovered, registryRoot: fixture.registryRoot, },),).toMatchObject({ reason: 'corrupt', },);
      },
    },),
  ],
},);
