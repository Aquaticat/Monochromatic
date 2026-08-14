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
import nanoSpawn from 'nano-spawn';
import { resolveGit, } from '../resolve-git.ts';
import { discoverConfig, CONFIG_ABSENT, type DiscoveredConfig, } from './config-discovery.ts';
import { TrustedConfigError, } from './config-loader.ts';
import { listTrustRecords, trustIdentityKey, } from './registry-catalog.ts';
import {
  DIRECTORY_MODE,
  protectPath,
  TrustStorageError,
  writePrivateFile,
} from './registry-io.ts';
import { recordDirectory, } from './registry-path.ts';
import { recoverProvenanceTransactions, } from './registry-transaction.ts';
import {
  inspectTrust,
  loadTrustedConfig,
  trustMjs,
  trustTypeScript,
  untrustConfig,
  untrustRepository,
} from './trust-service.ts';
import type {
  TrustConsentAdapters,
  TrustConsentOutcome,
} from './types.ts';

/** Real Git binary for nested disposable repositories. */
const REAL_GIT = await resolveGit();
/** Config requesting recursive descendants. */
const RECURSIVE_CONFIG = `export default { trust: { children: true } };\n`;
/** Ordinary descendant config. */
const ORDINARY_CONFIG = `export default {};\n`;
/** Disposable recursive trust fixture. */
type RecursiveFixture = Readonly<{
  /** Canonical fixture root. */
  root: string;
  /** Outer repository. */
  outer: string;
  /** Nested repository. */
  nested: string;
  /** Sibling nested repository. */
  sibling: string;
  /** Private registry root. */
  registryRoot: string;
  /** Removes fixture. */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 * Initializes one real repository with config.
 *
 * @param path - repository path
 * @param source - config source
 */
async function initializeRepository({
  path,
  source,
}: Readonly<{
  path: string;
  source: string;
}>,): Promise<void> {
  await mkdir(path, { recursive: true, },);
  await nanoSpawn(REAL_GIT, ['init', '--quiet',], { cwd: path, },);
  await writeFile(join(path, 'cli-git.config.mjs',), source,);
}

/**
 * Creates nested disposable repositories.
 *
 * @returns recursive trust fixture
 */
async function createFixture(): Promise<RecursiveFixture> {
  /** Canonical disposable root. */
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'cli-git-recursive-',),),
  );
  /** Outer repository root. */
  const outer = join(root, 'outer',);
  /** Nested repository root. */
  const nested = join(outer, 'nested',);
  /** Sibling nested repository root. */
  const sibling = join(outer, 'sibling',);
  await initializeRepository({ path: outer, source: RECURSIVE_CONFIG, },);
  await initializeRepository({ path: nested, source: ORDINARY_CONFIG, },);
  await initializeRepository({ path: sibling, source: ORDINARY_CONFIG, },);
  return {
    root,
    outer,
    nested,
    sibling,
    registryRoot: join(root, 'registry',),
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(root, { recursive: true, force: true, },);
    },
  };
}

/**
 * Discovers required fixture config.
 *
 * @param repository - repository root
 * @returns discovered MJS config
 */
async function discoverFixture(repository: string,): Promise<DiscoveredConfig> {
  /** Required discovered config. */
  const discovered = await discoverConfig(['-C', repository, 'future-command',],);
  if (discovered === CONFIG_ABSENT)
    throw new Error(`Missing fixture config: ${repository}`,);
  return discovered;
}

/**
 * Creates deterministic queued consent adapters.
 *
 * @param answers - interactive answers in prompt order
 * @param disclosures - captured disclosure text
 * @returns deterministic consent adapters
 */
function consentAdapters({
  answers,
  disclosures,
}: Readonly<{
  answers: readonly TrustConsentOutcome[];
  disclosures: string[];
}>,): TrustConsentAdapters {
  /** Prompt cursor isolated to adapter fixture. */
  const state = { index: 0, };
  return {
    disclose: function captureDisclosure(text,) {
      disclosures.push(text,);
    },
    prompt: function nextConsent() {
      /** Next explicit answer. */
      const answer = answers[state.index] ?? 'declined';
      state.index += 1;
      return Promise.resolve(answer,);
    },
    now: function fixedTime() {
      return new Date('2026-07-10T00:00:00.000Z',);
    },
  };
}

await describe({
  name: 'recursive snapshot trust',
  children: [
    it({
      name: 'requires and records second recursive consent',
      fn: async function testSecondConsent() {
        await using fixture = await createFixture();
        /** Root disclosure sequence. */
        const disclosures: string[] = [];
        /** Recursive root config. */
        const outer = await discoverFixture(fixture.outer,);
        const trusted = await trustMjs({
          discovered: outer,
          registryRoot: fixture.registryRoot,
          yes: false,
          adapters: consentAdapters({ answers: ['approved', 'approved',], disclosures, },),
        },);
        expect(disclosures,).toHaveLength(2,);
        expect(disclosures[1],).toContain(fixture.outer,);
        expect(disclosures[1],).toContain('future descendant repositories',);
        expect(disclosures[1],).toContain('crosses filesystem',);
        expect(trusted.record.recursiveChildren,).toBe(true,);
        expect(trusted.record.authorizingRoots.map(trustIdentityKey,),).toContain(trustIdentityKey(trusted.record.identity,),);
      },
    },),
    it({
      name: 'yes prints and accepts both disclosures',
      fn: async function testNoninteractiveRecursiveConsent() {
        await using fixture = await createFixture();
        /** Captured mandatory disclosures. */
        const disclosures: string[] = [];
        /** Recursive root config. */
        const outer = await discoverFixture(fixture.outer,);
        const trusted = await trustMjs({
          discovered: outer,
          registryRoot: fixture.registryRoot,
          yes: true,
          adapters: consentAdapters({ answers: [], disclosures, },),
        },);
        expect(disclosures,).toHaveLength(2,);
        expect(trusted.record.recursiveChildren,).toBe(true,);
      },
    },),
    it({
      name: 'declining second stage installs ordinary explicit trust',
      fn: async function testDeclinedRecursiveConsent() {
        await using fixture = await createFixture();
        /** Recursive root config. */
        const outer = await discoverFixture(fixture.outer,);
        const trusted = await trustMjs({
          discovered: outer,
          registryRoot: fixture.registryRoot,
          yes: false,
          adapters: consentAdapters({ answers: ['approved', 'declined',], disclosures: [], },),
        },);
        expect(trusted.record.recursiveChildren,).toBe(false,);
        /** Descendant remains untrusted without recursive authority. */
        const nested = await discoverFixture(fixture.nested,);
        const failure = await (async function captureUntrustedFailure(): Promise<unknown> {
          try {
            return await loadTrustedConfig({ discovered: nested, registryRoot: fixture.registryRoot, },);
          }
          catch (error: unknown) {
            return error;
          }
        })();
        expect(failure,).toBeInstanceOf(TrustedConfigError,);
      },
    },),
    it({
      name: 'unavailable recursive consent leaves root untrusted',
      fn: async function testUnavailableRecursiveConsent() {
        await using fixture = await createFixture();
        /** Recursive root config. */
        const outer = await discoverFixture(fixture.outer,);
        /** Failure from unavailable second consent stage. */
        const failure = await (async function captureUnavailableConsent(): Promise<unknown> {
          try {
            return await trustMjs({
              discovered: outer,
              registryRoot: fixture.registryRoot,
              yes: false,
              adapters: consentAdapters({
                answers: ['approved', 'unavailable',],
                disclosures: [],
              },),
            },);
          }
          catch (error: unknown) {
            return error;
          }
        })();
        expect(failure,).toBeInstanceOf(TrustedConfigError,);
        if (failure instanceof TrustedConfigError)
          expect(failure.code,).toBe('trust-consent-unavailable',);
        expect((await inspectTrust({
          discovered: outer,
          registryRoot: fixture.registryRoot,
        },)).reason,).toBe('untrusted',);
      },
    },),
    it({
      name: 'unavailable recursive re-trust preserves previous MJS record',
      fn: async function testUnavailableRecursiveRetrust() {
        await using fixture = await createFixture();
        /** Recursive root config. */
        const outer = await discoverFixture(fixture.outer,);
        /** Previously installed recursive record. */
        const initial = await trustMjs({
          discovered: outer,
          registryRoot: fixture.registryRoot,
          yes: true,
          adapters: consentAdapters({ answers: [], disclosures: [], },),
        },);
        /** Failure from unavailable second-stage re-trust consent. */
        const failure = await (async function captureUnavailableRetrust(): Promise<unknown> {
          try {
            return await trustMjs({
              discovered: outer,
              registryRoot: fixture.registryRoot,
              yes: false,
              adapters: consentAdapters({
                answers: ['approved', 'unavailable',],
                disclosures: [],
              },),
            },);
          }
          catch (error: unknown) {
            return error;
          }
        })();
        expect(failure,).toBeInstanceOf(TrustedConfigError,);
        if (failure instanceof TrustedConfigError)
          expect(failure.code,).toBe('trust-consent-unavailable',);
        expect((await loadTrustedConfig({
          discovered: outer,
          registryRoot: fixture.registryRoot,
        },)).record,).toEqual(initial.record,);
      },
    },),
    it({
      name: 'auto-enrolls descendants and blocks later byte changes',
      fn: async function testAutoEnrollment() {
        await using fixture = await createFixture();
        /** Recursive root config. */
        const outer = await discoverFixture(fixture.outer,);
        await trustMjs({
          discovered: outer,
          registryRoot: fixture.registryRoot,
          yes: true,
          adapters: consentAdapters({ answers: [], disclosures: [], },),
        },);
        /** Newly encountered descendant config. */
        const nested = await discoverFixture(fixture.nested,);
        const loaded = await loadTrustedConfig({ discovered: nested, registryRoot: fixture.registryRoot, },);
        expect(loaded.record.authorizingRoots,).toHaveLength(1,);
        expect(loaded.record.authorizingRoots[0]?.canonicalConfigPath,).toBe(outer.configPath,);
        await writeFile(nested.configPath, 'export default { policies: {} };\n',);
        const failure = await (async function captureChangedFailure(): Promise<unknown> {
          try {
            return await loadTrustedConfig({ discovered: nested, registryRoot: fixture.registryRoot, },);
          }
          catch (error: unknown) {
            return error;
          }
        })();
        expect(failure,).toBeInstanceOf(TrustedConfigError,);
        if (failure instanceof TrustedConfigError)
          expect(failure.code,).toBe('config-changed',);
      },
    },),
    it({
      name: 'TypeScript recursive root authorizes descendant only while exact',
      fn: async function testTypeScriptRecursiveRoot() {
        await using fixture = await createFixture();
        await rm(join(fixture.outer, 'cli-git.config.mjs',),);
        await writeFile(join(fixture.outer, 'recursive.ts',), 'export const recursive: boolean = true;\n',);
        await writeFile(join(fixture.outer, 'cli-git.config.ts',), `import { recursive } from './recursive.ts';\nexport default { trust: { children: recursive } };\n`,);
        const outer = await discoverFixture(fixture.outer,);
        await trustTypeScript({
          discovered: outer,
          registryRoot: fixture.registryRoot,
          yes: true,
          adapters: consentAdapters({ answers: [], disclosures: [], },),
        },);
        const nested = await discoverFixture(fixture.nested,);
        await loadTrustedConfig({ discovered: nested, registryRoot: fixture.registryRoot, },);
        await writeFile(join(fixture.outer, 'recursive.ts',), 'export const recursive: boolean = false;\n',);
        const sibling = await discoverFixture(fixture.sibling,);
        const failure = await (async function captureChangedRoot(): Promise<unknown> {
          try {
            return await loadTrustedConfig({ discovered: sibling, registryRoot: fixture.registryRoot, },);
          }
          catch (error: unknown) {
            return error;
          }
        })();
        expect(failure,).toBeInstanceOf(TrustedConfigError,);
      },
    },),
    it({
      name: 'auto-enrolls TypeScript descendant stored bundle',
      fn: async function testTypeScriptDescendant() {
        await using fixture = await createFixture();
        /** Recursive MJS outer authority. */
        const outer = await discoverFixture(fixture.outer,);
        await trustMjs({ discovered: outer, registryRoot: fixture.registryRoot, yes: true, adapters: consentAdapters({ answers: [], disclosures: [], },), },);
        /** Replace nested MJS with TypeScript config and relative source. */
        await rm(join(fixture.nested, 'cli-git.config.mjs',),);
        await writeFile(join(fixture.nested, 'value.ts',), 'export const enabled: boolean = false;\n',);
        await writeFile(join(fixture.nested, 'cli-git.config.ts',), `import { enabled } from './value.ts';\nexport default { trust: { children: enabled } };\n`,);
        const nested = await discoverFixture(fixture.nested,);
        expect(nested.format,).toBe('typescript',);
        const loaded = await loadTrustedConfig({ discovered: nested, registryRoot: fixture.registryRoot, },);
        expect(loaded.record.format,).toBe('typescript',);
        expect(loaded.record.sources,).toHaveLength(2,);
        await writeFile(join(fixture.nested, 'value.ts',), 'export const enabled: boolean = true;\n',);
        const failure = await (async function captureChangedTypeScript(): Promise<unknown> {
          try {
            return await loadTrustedConfig({ discovered: nested, registryRoot: fixture.registryRoot, },);
          }
          catch (error: unknown) {
            return error;
          }
        })();
        expect(failure,).toBeInstanceOf(TrustedConfigError,);
      },
    },),
    it({
      name: 'revalidates recursive root after descendant bundle execution',
      fn: async function testRootChangesDuringEnrollment() {
        await using fixture = await createFixture();
        const outer = await discoverFixture(fixture.outer,);
        await trustMjs({ discovered: outer, registryRoot: fixture.registryRoot, yes: true, adapters: consentAdapters({ answers: [], disclosures: [], },), },);
        await rm(join(fixture.nested, 'cli-git.config.mjs',),);
        await writeFile(join(fixture.nested, 'cli-git.config.ts',), `import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(outer.configPath,)}, 'export default {};\\n');\nexport default {};\n`,);
        const nested = await discoverFixture(fixture.nested,);
        const failure = await (async function captureMidEnrollmentChange(): Promise<unknown> {
          try {
            return await loadTrustedConfig({ discovered: nested, registryRoot: fixture.registryRoot, },);
          }
          catch (error: unknown) {
            return error;
          }
        })();
        expect(failure,).toBeInstanceOf(Error,);
        expect((await inspectTrust({ discovered: nested, registryRoot: fixture.registryRoot, },)).reason,).toBe('untrusted',);
      },
    },),
    it({
      name: 'rejects enrollment when recursive root bytes changed',
      fn: async function testChangedRootCannotAuthorize() {
        await using fixture = await createFixture();
        /** Recursive outer config. */
        const outer = await discoverFixture(fixture.outer,);
        await trustMjs({ discovered: outer, registryRoot: fixture.registryRoot, yes: true, adapters: consentAdapters({ answers: [], disclosures: [], },), },);
        await writeFile(outer.configPath, 'export default {};\n',);
        /** Fresh descendant has no record before changed-root attempt. */
        const nested = await discoverFixture(fixture.nested,);
        const failure = await (async function captureRootFailure(): Promise<unknown> {
          try {
            return await loadTrustedConfig({ discovered: nested, registryRoot: fixture.registryRoot, },);
          }
          catch (error: unknown) {
            return error;
          }
        })();
        expect(failure,).toBeInstanceOf(TrustedConfigError,);
        if (failure instanceof TrustedConfigError)
          expect(failure.code,).toBe('config-changed',);
        expect(await listTrustRecords({ registryRoot: fixture.registryRoot, },),).toHaveLength(1,);
      },
    },),
    it({
      name: 'revokes recursive authority after root config deletion',
      fn: async function testDeletedRootRevocation() {
        await using fixture = await createFixture();
        /** Recursive outer config. */
        const outer = await discoverFixture(fixture.outer,);
        await trustMjs({ discovered: outer, registryRoot: fixture.registryRoot, yes: true, adapters: consentAdapters({ answers: [], disclosures: [], },), },);
        /** Auto-enrolled descendant requiring cascade. */
        const nested = await discoverFixture(fixture.nested,);
        await loadTrustedConfig({ discovered: nested, registryRoot: fixture.registryRoot, },);
        await rm(outer.configPath,);
        const result = await untrustRepository({
          repositoryRoot: fixture.outer,
          registryRoot: fixture.registryRoot,
        },);
        expect(result.removed,).toBe(true,);
        expect(await listTrustRecords({ registryRoot: fixture.registryRoot, },),).toEqual([],);
      },
    },),
    it({
      name: 'rejects symbolic-link transaction journals',
      fn: async function testJournalSymlink() {
        await using fixture = await createFixture();
        /** Recursive outer creates private transaction directory. */
        const outer = await discoverFixture(fixture.outer,);
        await trustMjs({ discovered: outer, registryRoot: fixture.registryRoot, yes: true, adapters: consentAdapters({ answers: [], disclosures: [], },), },);
        await symlink(outer.configPath, join(fixture.registryRoot, 'transactions', 'unsafe.json',),);
        const failure = await (async function captureJournalFailure(): Promise<unknown> {
          try {
            return await recoverProvenanceTransactions({ registryRoot: fixture.registryRoot, },);
          }
          catch (error: unknown) {
            return error;
          }
        })();
        expect(failure,).toBeInstanceOf(TrustStorageError,);
      },
    },),
    it({
      name: 'rejects symbolic-link transaction directory',
      fn: async function testJournalDirectorySymlink() {
        await using fixture = await createFixture();
        await mkdir(fixture.registryRoot, { mode: DIRECTORY_MODE, },);
        await protectPath({ path: fixture.registryRoot, directory: true, },);
        /** External directory substituted for private transaction root. */
        const external = join(fixture.root, 'external-transactions',);
        await mkdir(external,);
        await symlink(external, join(fixture.registryRoot, 'transactions',), 'dir',);
        const failure = await (async function captureDirectoryFailure(): Promise<unknown> {
          try {
            return await recoverProvenanceTransactions({ registryRoot: fixture.registryRoot, },);
          }
          catch (error: unknown) {
            return error;
          }
        })();
        expect(failure,).toBeInstanceOf(TrustStorageError,);
      },
    },),
    it({
      name: 'preserves separately explicit descendant after root untrust',
      fn: async function testExplicitDescendantSurvives() {
        await using fixture = await createFixture();
        /** Recursive outer config. */
        const outer = await discoverFixture(fixture.outer,);
        await trustMjs({ discovered: outer, registryRoot: fixture.registryRoot, yes: true, adapters: consentAdapters({ answers: [], disclosures: [], },), },);
        /** Explicitly trusted descendant config. */
        const nested = await discoverFixture(fixture.nested,);
        await trustMjs({ discovered: nested, registryRoot: fixture.registryRoot, yes: true, adapters: consentAdapters({ answers: [], disclosures: [], },), },);
        const result = await untrustConfig({ discovered: outer, registryRoot: fixture.registryRoot, },);
        expect(result.removed,).toBe(true,);
        expect((await inspectTrust({ discovered: nested, registryRoot: fixture.registryRoot, },)).reason,).toBe('trusted',);
        const records = await listTrustRecords({ registryRoot: fixture.registryRoot, },);
        const nestedRecord = records.find(function matchesNested(entry,) {
          return entry.record.identity.canonicalConfigPath === nested.configPath;
        },);
        expect(nestedRecord?.record.authorizingRoots,).toHaveLength(1,);
        expect(nestedRecord?.record.authorizingRoots[0]?.canonicalConfigPath,).toBe(nested.configPath,);
      },
    },),
    it({
      name: 'nested recursive untrust cascades outer and sibling authority',
      fn: async function testNestedCascade() {
        await using fixture = await createFixture();
        /** Recursive outer config. */
        const outer = await discoverFixture(fixture.outer,);
        await trustMjs({ discovered: outer, registryRoot: fixture.registryRoot, yes: true, adapters: consentAdapters({ answers: [], disclosures: [], },), },);
        /** Nested config changed to recursive declaration before first encounter. */
        const nested = await discoverFixture(fixture.nested,);
        await writeFile(nested.configPath, RECURSIVE_CONFIG,);
        await loadTrustedConfig({ discovered: nested, registryRoot: fixture.registryRoot, },);
        /** Sibling auto-enrolled only through outer root. */
        const sibling = await discoverFixture(fixture.sibling,);
        await loadTrustedConfig({ discovered: sibling, registryRoot: fixture.registryRoot, },);
        /** Pre-mutation cascade disclosure. */
        const disclosures: string[] = [];
        const result = await untrustConfig({
          discovered: nested,
          registryRoot: fixture.registryRoot,
          disclose: function captureCascade(text,) { disclosures.push(text,); },
        },);
        expect(result.affectedRoots,).toEqual([fixture.outer, fixture.nested,],);
        expect(disclosures[0],).toContain(fixture.outer,);
        expect(disclosures[0],).toContain(fixture.nested,);
        expect(await listTrustRecords({ registryRoot: fixture.registryRoot, },),).toEqual([],);
      },
    },),
    it({
      name: 'recovers interrupted revocation journal and stale lock',
      fn: async function testInterruptedRecovery() {
        await using fixture = await createFixture();
        /** Recursive outer config. */
        const outer = await discoverFixture(fixture.outer,);
        await trustMjs({ discovered: outer, registryRoot: fixture.registryRoot, yes: true, adapters: consentAdapters({ answers: [], disclosures: [], },), },);
        /** Auto-enrolled sibling selected for interrupted removal. */
        const sibling = await discoverFixture(fixture.sibling,);
        const loaded = await loadTrustedConfig({ discovered: sibling, registryRoot: fixture.registryRoot, },);
        /** Synthetic interrupted transaction identifier. */
        const transactionId = 'interrupted-revocation-fixture';
        /** Durable recovery journal path. */
        const journalPath = join(fixture.registryRoot, 'transactions', `${transactionId}.json`,);
        await writePrivateFile({
          path: journalPath,
          bytes: Buffer.from(`${JSON.stringify({
            schemaVersion: 1,
            ownerPid: process.pid,
            transactionId,
            operations: [{ identity: loaded.record.identity, action: 'remove', },],
          },)}\n`, 'utf8',),
        },);
        /** Stale per-record lock left by interrupted owner. */
        const lockPath = `${recordDirectory({ registryRoot: fixture.registryRoot, identity: loaded.record.identity, },)}.lock`;
        await mkdir(lockPath, { mode: DIRECTORY_MODE, },);
        await protectPath({ path: lockPath, directory: true, },);
        await recoverProvenanceTransactions({ registryRoot: fixture.registryRoot, },);
        expect((await inspectTrust({ discovered: sibling, registryRoot: fixture.registryRoot, },)).reason,).toBe('untrusted',);
      },
    },),
    it({
      name: 'concurrent enrollment and revocation fail closed without orphan',
      fn: async function testConcurrentEnrollmentRevocation() {
        await using fixture = await createFixture();
        /** Recursive outer config. */
        const outer = await discoverFixture(fixture.outer,);
        await trustMjs({ discovered: outer, registryRoot: fixture.registryRoot, yes: true, adapters: consentAdapters({ answers: [], disclosures: [], },), },);
        /** Descendant racing outer revocation. */
        const nested = await discoverFixture(fixture.nested,);
        await Promise.allSettled([
          loadTrustedConfig({ discovered: nested, registryRoot: fixture.registryRoot, },),
          untrustConfig({ discovered: outer, registryRoot: fixture.registryRoot, },),
        ],);
        const records = await listTrustRecords({ registryRoot: fixture.registryRoot, },);
        const rootPresent = records.some(function isOuter(entry,) {
          return entry.record.identity.canonicalConfigPath === outer.configPath;
        },);
        const orphan = records.find(function isNested(entry,) {
          return entry.record.identity.canonicalConfigPath === nested.configPath;
        },);
        if (!rootPresent)
          expect(orphan,).toBe(undefined,);
      },
    },),
    it({
      name: 'concurrent sibling enrollment retains both records',
      fn: async function testConcurrentEnrollment() {
        await using fixture = await createFixture();
        /** Recursive outer config. */
        const outer = await discoverFixture(fixture.outer,);
        await trustMjs({ discovered: outer, registryRoot: fixture.registryRoot, yes: true, adapters: consentAdapters({ answers: [], disclosures: [], },), },);
        /** Two independent descendants. */
        const [nested, sibling,] = await Promise.all([
          discoverFixture(fixture.nested,),
          discoverFixture(fixture.sibling,),
        ],);
        await Promise.all([
          loadTrustedConfig({ discovered: nested, registryRoot: fixture.registryRoot, },),
          loadTrustedConfig({ discovered: sibling, registryRoot: fixture.registryRoot, },),
        ],);
        const records = await listTrustRecords({ registryRoot: fixture.registryRoot, },);
        expect(records,).toHaveLength(3,);
      },
    },),
  ],
},);
