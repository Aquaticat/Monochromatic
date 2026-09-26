/**
 Hooks during private preparation and after landing, through the built wrapper on disposable repositories.

 @module
 */
import {
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  createLandingRepository,
  git,
  leftovers,
  REAL_GIT,
  readText,
  runWrapper,
  writeHook,
  writeNodeProgram,
  writeWorktreeFile,
} from './commit-landing-fixture.unit.test.ts';

/**
 Hook body reporting what a hook observes about the branch as JSON.

 @param report - report file

 @returns CommonJS statements
 */
function branchReportSource(report: string,): string {
  return `
const { execFileSync } = require('node:child_process');
const { writeFileSync } = require('node:fs');
const run = (args) => { try { return execFileSync(${JSON.stringify(REAL_GIT,)}, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return 'failed'; } };
const facts = {
  symbolicRef: run(['symbolic-ref', 'HEAD']),
  abbrevRef: run(['rev-parse', '--abbrev-ref', 'HEAD']),
  showCurrent: run(['branch', '--show-current']),
  upstream: run(['rev-parse', '--symbolic-full-name', '@{upstream}']),
  onbranch: run(['config', '--get', 'fixture.branch']),
  tag: run(['rev-parse', 'v1']),
  toplevel: run(['rev-parse', '--show-toplevel']),
  workTree: process.env.GIT_WORK_TREE,
};
writeFileSync(${JSON.stringify(report,)}, JSON.stringify(facts));
if (process.env.REJECT_MAIN === '1' && facts.showCurrent === 'main') process.exit(1);
`;
}

/**
 Hook body appending one line to a log.

 @param log - log file

 @param line - JavaScript expression producing the line

 @returns CommonJS statements
 */
function appendSource({
  log,
  line,
}: Readonly<{
  log: string;
  line: string;
}>,): string {
  return `require('node:fs').appendFileSync(${JSON.stringify(log,)}, ${line} + '\\n');`;
}

await describe({
  name: 'commit landing hooks',
  children: [
    it({
      name: 'pre-commit sees the real branch, upstream, onbranch include, and tags, and a hook rejecting main rejects',
      fn: async function testBranchFacts(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Include applied only on main. */
        const include = join(repository.scratch, 'main.inc',);
        await writeFile(include, '[fixture]\n\tbranch = main-include\n',);
        await git({ repository, args: ['config', 'includeIf.onbranch:main.path', include,], },);
        await git({ repository, args: ['update-ref', 'refs/remotes/origin/main', 'HEAD',], },);
        await git({ repository, args: ['config', 'remote.origin.url', join(repository.scratch, 'nowhere',),], },);
        await git({ repository, args: ['config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*',], },);
        await git({ repository, args: ['config', 'branch.main.remote', 'origin',], },);
        await git({ repository, args: ['config', 'branch.main.merge', 'refs/heads/main',], },);
        await git({ repository, args: ['tag', 'v1',], },);
        /** Report written by the hook. */
        const report = join(repository.scratch, 'facts.json',);
        await writeHook({ repository, event: 'pre-commit', source: branchReportSource(report,), },);
        /** Worktree list before any transaction. */
        const worktreesBefore = await git({ repository, args: ['worktree', 'list', '--porcelain',], },);
        /** Baseline commit. */
        const baseline = await git({ repository, args: ['rev-parse', 'HEAD',], },);
        /** Index bytes before the rejected commit. */
        const indexBefore = await readFile(join(repository.gitDir, 'index',),);
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
        /** Rejected commit. */
        const rejected = await runWrapper({ repository, args: ['commit', '-m', 'rejected', 'a.txt',], env: { REJECT_MAIN: '1', }, },);
        expect(rejected.exitCode,).toBe(1,);
        expect(await git({ repository, args: ['rev-parse', 'HEAD',], },),).toBe(baseline,);
        expect(Buffer.compare(indexBefore, await readFile(join(repository.gitDir, 'index',),),),).toBe(0,);
        expect(await leftovers(repository,),).toEqual([],);
        expect(await git({ repository, args: ['worktree', 'list', '--porcelain',], },),).toBe(worktreesBefore,);
        /** Facts the rejecting hook saw. */
        const facts: unknown = JSON.parse(await readText(report,),);
        expect(facts,).toEqual({
          symbolicRef: 'refs/heads/main',
          abbrevRef: 'main',
          showCurrent: 'main',
          upstream: 'refs/remotes/origin/main',
          onbranch: 'main-include',
          tag: baseline,
          toplevel: repository.path,
          workTree: repository.path,
        },);
        /** Accepted commit. */
        const accepted = await runWrapper({ repository, args: ['commit', '-m', 'accepted', 'a.txt',], },);
        expect(accepted.exitCode,).toBe(0,);
        expect(await git({ repository, args: ['log', '-1', '--format=%s',], },),).toBe('accepted',);
        expect(await git({ repository, args: ['rev-parse', 'HEAD~1',], },),).toBe(baseline,);
        expect((await git({ repository, args: ['worktree', 'list', '--porcelain',], },)).split('\n',)
          .filter(function isWorktreeLine(line,): boolean {
            return line.startsWith('worktree ',);
          },),).toEqual([`worktree ${repository.path}`,],);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'hookdir and config-based hooks each run once, and post-commit runs once after landing with native environment',
      fn: async function testHookCounts(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Shared hook log. */
        const log = join(repository.scratch, 'hooks.log',);
        /** Config-based hook program. */
        const configured = join(repository.scratch, 'configured.cjs',);
        await writeNodeProgram({ path: configured, source: appendSource({ log, line: '\'config pre-commit\'', },), },);
        await git({ repository, args: ['config', 'hook.fixture.command', `"${process.execPath}" "${configured}"`,], },);
        await git({ repository, args: ['config', 'hook.fixture.event', 'pre-commit',], },);
        await writeHook({ repository, event: 'pre-commit', source: appendSource({ log, line: '\'hookdir pre-commit\'', },), },);
        await writeHook({
          repository,
          event: 'post-commit',
          source: `const head = require('node:child_process').execFileSync(${JSON.stringify(REAL_GIT,)}, ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
${appendSource({ log, line: '[\'post-commit\', head, process.env.GIT_INDEX_FILE, process.env.GIT_EDITOR, process.env.GIT_AUTHOR_NAME].join(\' \')', },)}`,
        },);
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
        /** Commit outcome. */
        const outcome = await runWrapper({ repository, args: ['commit', '-m', 'hooks', 'a.txt',], },);
        expect(outcome.exitCode,).toBe(0,);
        /** Landed commit. */
        const landed = await git({ repository, args: ['rev-parse', 'HEAD',], },);
        /** Git minor version; config-based hooks exist from Git 2.54. */
        const [, minor = '0',] = (await git({ repository, args: ['version',], },)).replace('git version ', '',)
          .split('.',);
        /** Whether this Git runs config-based hooks. */
        const configuredHooks = Number(minor,) >= 54;
        /** Log lines in order. */
        const lines = (await readText(log,)).trim()
          .split('\n',);
        expect(lines.slice(0, -1,)
          .toSorted(),).toEqual(configuredHooks ? ['config pre-commit', 'hookdir pre-commit',] : ['hookdir pre-commit',],);
        expect(lines.at(-1,),).toBe(`post-commit ${landed} ${join(repository.gitDir, 'index',)} : cli-git landing fixture`,);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'a hook that changes into a subdirectory sees the worktree top level',
      fn: async function testSubdirectoryHook(): Promise<void> {
        await using repository = await createLandingRepository();
        await writeWorktreeFile({ repository, name: 'sub.txt', content: 'sub\n', },);
        /** Report file. */
        const report = join(repository.scratch, 'toplevel.txt',);
        await writeHook({
          repository,
          event: 'pre-commit',
          source: `require('node:fs').mkdirSync('sub', { recursive: true });
process.chdir('sub');
const top = require('node:child_process').execFileSync(${JSON.stringify(REAL_GIT,)}, ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
require('node:fs').writeFileSync(${JSON.stringify(report,)}, top + ' ' + process.env.GIT_WORK_TREE);`,
        },);
        /** Commit outcome. */
        const outcome = await runWrapper({ repository, args: ['commit', '-m', 'sub', 'sub.txt',], },);
        expect(outcome.exitCode,).toBe(0,);
        expect(await readText(report,),).toBe(`${repository.path} ${repository.path}`,);
      },
    },),
    it({
      name: 'a pre-commit hook that stages another path lands it, as native Git commits whatever the hook staged',
      fn: async function testTreeChangingHook(): Promise<void> {
        await using repository = await createLandingRepository();
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
        await writeWorktreeFile({ repository, name: 'extra.txt', content: 'extra\n', },);
        await writeHook({
          repository,
          event: 'pre-commit',
          source: `require('node:child_process').execFileSync(${JSON.stringify(REAL_GIT,)}, ['add', 'extra.txt']);`,
        },);
        /** Baseline commit. */
        const baseline = await git({ repository, args: ['rev-parse', 'HEAD',], },);
        /** Commit outcome. */
        const outcome = await runWrapper({ repository, args: ['commit', '-m', 'tree', 'a.txt',], },);
        expect(outcome.exitCode,).toBe(0,);
        expect(await git({ repository, args: ['rev-parse', 'HEAD~1',], },),).toBe(baseline,);
        expect(await git({ repository, args: ['show', '--name-only', '--format=', 'HEAD',], },),).toBe('a.txt\nextra.txt',);
        // The hook's path joins the real index too, because its entry was unchanged since invocation.
        expect(await git({ repository, args: ['status', '--porcelain',], },),).toBe('',);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'a reference-transaction hook sees only the landing\'s update of the real branch, never shadow ref writes',
      fn: async function testReferenceTransaction(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Reference-transaction log. */
        const log = join(repository.scratch, 'reference-transaction.log',);
        await writeHook({
          repository,
          event: 'reference-transaction',
          source: `const input = require('node:fs').readFileSync(0, 'utf8');
require('node:fs').appendFileSync(${JSON.stringify(log,)}, input.split('\\n').filter(Boolean).map((line) => process.argv[2] + ' ' + line + '\\n').join(''));`,
        },);
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
        /** Baseline commit. */
        const baseline = await git({ repository, args: ['rev-parse', 'HEAD',], },);
        /** Commit outcome. */
        const outcome = await runWrapper({ repository, args: ['commit', '-m', 'observed', 'a.txt',], },);
        expect(outcome.exitCode,).toBe(0,);
        /** Landed commit. */
        const landed = await git({ repository, args: ['rev-parse', 'HEAD',], },);
        expect((await readText(log,)).split('\n',)
          .filter(function isCommitted(line,): boolean {
            return line.startsWith('committed ',);
          },),).toEqual([`committed ${baseline} ${landed} refs/heads/main`,],);
      },
    },),
    it({
      name: 'an event the user disabled through hook.<event>.enabled does not run',
      fn: async function testDisabledEvent(): Promise<void> {
        await using repository = await createLandingRepository([['hook.pre-commit.enabled', 'false',],],);
        await writeHook({ repository, event: 'pre-commit', source: 'process.exit(1);', },);
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
        /** Commit outcome. */
        const outcome = await runWrapper({ repository, args: ['commit', '-m', 'disabled', 'a.txt',], },);
        expect(outcome.exitCode,).toBe(0,);
        expect(await git({ repository, args: ['log', '-1', '--format=%s',], },),).toBe('disabled',);
      },
    },),
  ],
},);
