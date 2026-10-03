/**
 Raw commit parsing and rewriting, replay options, event renumbering, test-phase markers,
 and the commit a replay writes, on disposable repositories.

 @module
 */
import {
  execFileSync,
  spawn,
} from 'node:child_process';
import { once, } from 'node:events';
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import { wait, } from '@monochromatic-dev/module-async-time/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { internalTestExports, } from '../../dist/final/node/index.mjs';
import {
  FIXED_IDENTITY,
  REAL_GIT,
  WRAPPER_PATH,
} from './commit-landing-fixture.unit.test.ts';

const {
  appendEvents,
  droppedReplayHeaders,
  identityEnvironment,
  parsePhaseSignal,
  parseRawCommit,
  reachTransactionPhase,
  replayOptions,
  rewriteCommitObject,
  TestPhaseSignalError,
  writeReplayedCommit,
} = internalTestExports;

/**
 Raw unsigned commit with a Latin-1 message and a multi-line custom header.
 */
const RAW = Buffer.concat([
  Buffer.from('tree aaaa\nparent bbbb\nauthor A U Thor <a@example.com> 1700000000 +0100\ncommitter C O Mitter <c@example.com> 1700000001 -0200\nencoding ISO-8859-1\nx-custom one\n two\n\n', 'latin1',),
  Buffer.from([0x63, 0x61, 0x66, 0xE9, 0x0A,],),
],);

/**
 Disposable bare repository standing in for a shadow repository.

 @returns path and disposer
 */
async function scratchRepository(): Promise<AsyncDisposable & Readonly<{ path: string; env: NodeJS.ProcessEnv; }>> {
  /**
   Scratch root.
   */
  const root = await mkdtemp(join(tmpdir(), 'cli-git-replay-object-',),);
  /**
   Isolated environment.
   */
  const env = { ...process.env, ...FIXED_IDENTITY, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', };
  execFileSync(REAL_GIT, ['init', '--quiet', '--bare', join(root, 'shadow',),], { env, },);
  return {
    path: join(root, 'shadow',),
    env,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(root, { recursive: true, force: true, },);
    },
  };
}

await describe({
  name: 'replay objects and options',
  children: [
    it({
      name: `${parseRawCommit.name} keeps header bytes, continuation lines, the encoding, and message bytes`,
      fn: async function testParse(): Promise<void> {
        /** Parsed commit. */
        const parsed = parseRawCommit(RAW,);
        expect(parsed.treeOid,).toBe('aaaa',);
        expect(parsed.encoding,).toBe('ISO-8859-1',);
        expect(parsed.signed,).toBe(false,);
        expect(parsed.headers.map(function nameOf(header,): string {
          return header.name;
        },),).toEqual(['tree', 'parent', 'author', 'committer', 'encoding', 'x-custom',],);
        expect(Buffer.from(parsed.headers.at(-1,)?.bytes ?? [],).toString('latin1',),).toBe('x-custom one\n two\n',);
        expect(Buffer.compare(Buffer.from(parsed.message,), Buffer.from([0x63, 0x61, 0x66, 0xE9, 0x0A,],),),).toBe(0,);
        expect(parseRawCommit(Buffer.from('tree t\ngpgsig -----BEGIN-----\n line\n -----END-----\n\nm\n',),).signed,).toBe(true,);
        expect(function missingTree(): unknown {
          return parseRawCommit(Buffer.from('author x\n\nm\n',),);
        },).toThrow('no tree header',);
      },
    },),
    it({
      name: `${rewriteCommitObject.name} replaces only the tree and parent, and adds a parent to a root commit`,
      fn: async function testRewrite(): Promise<void> {
        /** Rewritten bytes. */
        const rewritten = Buffer.from(rewriteCommitObject({ commit: parseRawCommit(RAW,), treeOid: 'cccc', parentOid: 'dddd', },),);
        expect(Buffer.compare(rewritten, Buffer.from(RAW.toString('latin1',).replace('tree aaaa\nparent bbbb\n', 'tree cccc\nparent dddd\n',), 'latin1',),),).toBe(0,);
        /** Root commit rewritten onto a parent. */
        const root = Buffer.from(rewriteCommitObject({ commit: parseRawCommit(Buffer.from('tree aaaa\nauthor a <a> 1 +0000\n\nm\n',),), treeOid: 'cccc', parentOid: 'dddd', },),).toString();
        expect(root,).toBe('tree cccc\nparent dddd\nauthor a <a> 1 +0000\n\nm\n',);
      },
    },),
    it({
      name: `${droppedReplayHeaders.name} and ${identityEnvironment.name} read what a signed rebuild drops and keeps`,
      fn: async function testSignedInputs(): Promise<void> {
        /** Parsed commit. */
        const parsed = parseRawCommit(Buffer.concat([RAW.subarray(0, RAW.indexOf('\n\n',) + 1,), Buffer.from('x-custom again\nx-other 1\n\nm\n',),],),);
        expect(droppedReplayHeaders(parsed,),).toEqual(['x-custom', 'x-other',],);
        expect(identityEnvironment({ commit: parsed, role: 'author', },),).toEqual({ GIT_AUTHOR_NAME: 'A U Thor', GIT_AUTHOR_EMAIL: 'a@example.com', GIT_AUTHOR_DATE: '@1700000000 +0100', },);
        expect(identityEnvironment({ commit: parsed, role: 'committer', },),).toEqual({ GIT_COMMITTER_NAME: 'C O Mitter', GIT_COMMITTER_EMAIL: 'c@example.com', GIT_COMMITTER_DATE: '@1700000001 -0200', },);
        expect(function malformed(): unknown {
          return identityEnvironment({ commit: parseRawCommit(Buffer.from('tree t\nauthor nobody\n\nm\n',),), role: 'author', },);
        },).toThrow('malformed',);
      },
    },),
    it({
      name: `${replayOptions.name} reads --no-verify and the signing key through clusters, values, and the pathspec separator`,
      fn: async function testOptions(): Promise<void> {
        expect(replayOptions(['-m', 'x',],),).toEqual({ noVerify: false, },);
        expect(replayOptions(['-anm', 'x',],),).toEqual({ noVerify: true, },);
        expect(replayOptions(['--no-verify', '--verify',],),).toEqual({ noVerify: false, },);
        expect(replayOptions(['-m', '-n', '--', '-n',],),).toEqual({ noVerify: false, },);
        expect(replayOptions(['-Skey123', '-m', 'x',],),).toEqual({ noVerify: false, signingKey: 'key123', },);
        expect(replayOptions(['-S', '-m', 'x',],),).toEqual({ noVerify: false, },);
        expect(replayOptions(['--gpg-sign=abc', '-n',],),).toEqual({ noVerify: true, signingKey: 'abc', },);
        expect(replayOptions(['--message', '-Sx',],),).toEqual({ noVerify: false, },);
      },
    },),
    it({
      name: `${appendEvents.name} renumbers appended events after the existing ones`,
      fn: async function testAppend(): Promise<void> {
        /** Existing event. */
        const existing = { schemaVersion: 1, sequence: 0, type: 'landing-race-lost', attempt: 1, winningOid: 'a', } as const;
        expect(appendEvents({ events: [existing,], appended: [{ ...existing, sequence: 0, attempt: 2, }, { ...existing, sequence: 0, attempt: 3, },], },).map(function sequenceOf(event,): number {
          return event.sequence;
        },),).toEqual([0, 1, 2,],);
      },
    },),
    it({
      name: `${writeReplayedCommit.name} keeps custom headers on an unsigned rewrite and drops them from a re-signed commit`,
      fn: async function testWriteReplayed(): Promise<void> {
        await using shadow = await scratchRepository();
        /** Git in the scratch repository. */
        function run(args: readonly string[], input?: string | Buffer,): Buffer {
          return execFileSync(REAL_GIT, [`--git-dir=${shadow.path}`, ...args,], { env: shadow.env, ...(input === undefined ? {} : { input, }), },);
        }
        /** Empty tree. */
        const tree = run(['hash-object', '-t', 'tree', '-w', '--stdin',], '',).toString().trim();
        /** Parent commit. */
        const parent = run(['commit-tree', tree, '-m', 'parent',],).toString().trim();
        /** Unsigned prepared commit. */
        const prepared = parseRawCommit(Buffer.from(RAW.toString('latin1',).replace('tree aaaa', `tree ${tree}`,).replace('parent bbbb', `parent ${tree}`,), 'latin1',),);
        /** Unsigned replay. */
        const unsigned = await writeReplayedCommit({ gitPath: REAL_GIT, shadowPath: shadow.path, directory: join(shadow.path, '..',), attempt: 1, commit: prepared, treeOid: tree, parentOid: parent, globalArgs: [], },);
        expect(unsigned.droppedHeaders,).toEqual([],);
        expect(run(['cat-file', 'commit', unsigned.oid,],).toString('latin1',),).toBe(RAW.toString('latin1',).replace('tree aaaa\nparent bbbb', `tree ${tree}\nparent ${parent}`,),);
        /** SSH signing key. */
        const key = join(shadow.path, '..', 'key',);
        execFileSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', 'replay', '-f', key,],);
        run(['config', 'gpg.format', 'ssh',],);
        run(['config', 'user.signingKey', `${key}.pub`,],);
        /** Signed commit carrying a custom header after signing. */
        const signedRaw = run(['cat-file', 'commit', run(['commit-tree', tree, '-p', parent, '-S', '-m', 'signed',], '',).toString().trim(),],).toString('latin1',).replace('\ngpgsig ', '\nx-custom kept?\ngpgsig ',);
        /** Signed replay. */
        const signed = await writeReplayedCommit({ gitPath: REAL_GIT, shadowPath: shadow.path, directory: join(shadow.path, '..',), attempt: 2, commit: parseRawCommit(Buffer.from(signedRaw, 'latin1',),), treeOid: tree, parentOid: parent, globalArgs: [], },);
        expect(signed.droppedHeaders,).toEqual(['x-custom',],);
        /** Re-signed object. */
        const resigned = run(['cat-file', 'commit', signed.oid,],).toString();
        expect(resigned,).toContain('gpgsig -----BEGIN SSH SIGNATURE-----',);
        expect(resigned,).not.toContain('x-custom',);
        expect(await readFile(join(shadow.path, '..', 'replay-message-2',), 'utf8',),).toBe('signed\n',);
      },
    },),
    it({
      name: `${parsePhaseSignal.name} accepts kill and pause forms and rejects every malformed value`,
      fn: async function testParsePhase(): Promise<void> {
        expect(parsePhaseSignal('ref-updated:kill',),).toEqual({ phase: 'ref-updated', action: 'kill', },);
        expect(parsePhaseSignal('landing-locked:kill:/tmp/markers',),).toEqual({ phase: 'landing-locked', action: 'kill', directory: '/tmp/markers', },);
        expect(parsePhaseSignal('index-installed:pause:/tmp/a:b',),).toEqual({ phase: 'index-installed', action: 'pause', directory: '/tmp/a:b', },);
        expect(['', 'ref-updated', 'nope:kill', 'ref-updated:stop', 'ref-updated:pause', 'ref-updated:pause:relative',].map(function rejects(value,): boolean {
          try {
            parsePhaseSignal(value,);
            return false;
          }
          catch (error: unknown) {
            return error instanceof TestPhaseSignalError;
          }
        },),).toEqual([true, true, true, true, true, true,],);
      },
    },),
    it({
      name: `${reachTransactionPhase.name} pauses at the armed phase until released, ignores other phases, and kills when asked`,
      fn: async function testReachPhase(): Promise<void> {
        /** Marker directory. */
        const directory = await mkdtemp(join(tmpdir(), 'cli-git-phase-',),);
        await using _cleanup = { async [Symbol.asyncDispose](): Promise<void> {
          await rm(directory, { recursive: true, force: true, },);
        }, };
        /** Armed environment. */
        const environment = { CLI_GIT_TEST_ONLY_PHASE_SIGNAL: `objects-migrated:pause:${directory}`, };
        await reachTransactionPhase({ phase: 'ref-updated', environment, },);
        /** Paused phase. */
        const paused = reachTransactionPhase({ phase: 'objects-migrated', environment, },);
        /** Whether the pause ended early. */
        const settled = { done: false, };
        void (async function track(): Promise<void> {
          await paused;
          settled.done = true;
        })();
        await wait(200,);
        expect(settled.done,).toBe(false,);
        expect(await readFile(join(directory, 'objects-migrated.reached',), 'utf8',),).toBe(String(process.pid,),);
        await writeFile(join(directory, 'objects-migrated.release',), '',);
        await paused;
        /** Child killed at its armed phase. */
        const child = spawn(process.execPath, ['--input-type=module', '--eval', `const { internalTestExports } = await import(${JSON.stringify(WRAPPER_PATH,)}); await internalTestExports.reachTransactionPhase({ phase: 'ref-updated' }); console.log('survived');`,], { env: { ...process.env, CLI_GIT_TEST_ONLY_PHASE_SIGNAL: `ref-updated:kill:${directory}`, }, stdio: ['ignore', 'pipe', 'ignore',], },);
        /** Exit code and signal. */
        const exit: readonly unknown[] = await once(child, 'exit',);
        expect(exit,).toEqual([null, 'SIGKILL',],);
        expect(await readFile(join(directory, 'ref-updated.reached',), 'utf8',),).toBe(String(child.pid,),);
      },
    },),
  ],
},);
