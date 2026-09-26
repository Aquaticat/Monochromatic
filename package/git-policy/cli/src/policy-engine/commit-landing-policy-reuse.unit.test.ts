/**
 Policy reuse after a replay, through the built wrapper on disposable repositories:
 a context-only policy keeps its preparation result,
 an unrestricted one re-runs,
 and a declared worktree input changed by the winning commit forces a re-run.

 @module
 */
import { join, } from 'node:path';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  createLandingRepository,
  git,
  type LandingRepository,
  leftovers,
  readText,
  runWrapper,
  writeWorktreeFile,
} from './commit-landing-fixture.unit.test.ts';
import {
  eventTypes,
  holdInEditor,
} from './commit-landing-replay-fixture.unit.test.ts';

/**
 Trusted config whose policies append `<policy> <candidate paths>` to a log on every run.

 @param log - run log

 @returns MJS config source
 */
function countingConfig(log: string,): string {
  /**
   One logging policy declaration.

   @param name - policy name

   @param inputs - inputs source, empty for unrestricted

   @returns object literal source
   */
  function policy(name: string, inputs: string,): string {
    return `{
      name: '${name}',
      defaultSeverity: 'warn',
      warnSafe: true,
      triggers: ['pre-forward'],
      ${inputs}
      check: async ({ context }) => {
        const candidates = await context.git.candidates();
        for (const candidate of candidates) await candidate.bytes();
        appendFileSync(${JSON.stringify(log,)}, '${name} ' + candidates.map((candidate) => candidate.path).join(',') + '\\n');
        return [];
      },
    }`;
  }
  return `import { appendFileSync } from 'node:fs';
export default {
  plugins: {
    probe: {
      name: 'probe',
      policies: [
        ${policy('context', 'inputs: { external: [] },',)},
        ${policy('unrestricted', '',)},
        ${policy('rules', 'inputs: { external: [{ kind: \'worktree\', pathspecs: [\'rules.txt\'] }] },',)},
      ],
    },
  },
};
`;
}

/**
 Repository with a tracked rules file and the trusted counting config.

 @returns repository and its run log
 */
async function createCountingRepository(): Promise<Readonly<{
  repository: LandingRepository;
  log: string;
}>> {
  /**
   Repository.
   */
  const repository = await createLandingRepository();
  /**
   Run log outside the worktree.
   */
  const log = join(repository.scratch, 'runs.log',);
  await writeWorktreeFile({ repository, name: 'rules.txt', content: 'rule\n', },);
  await writeWorktreeFile({ repository, name: 'cli-git.config.mjs', content: countingConfig(log,), },);
  await git({ repository, args: ['add', 'rules.txt', 'cli-git.config.mjs',], },);
  await git({ repository, args: ['commit', '--quiet', '-m', 'config',], },);
  expect((await runWrapper({ repository, args: ['cli-git', 'trust', '--yes',], },)).exitCode,).toBe(0,);
  return {
    repository,
    log,
  };
}

/**
 Runs of each policy over one candidate list.

 @param log - run log

 @param paths - candidate paths as logged

 @returns runs by policy
 */
async function runsOver({
  log,
  paths,
}: Readonly<{
  log: string;
  paths: string;
}>,): Promise<Readonly<Record<string, number>>> {
  /**
   Logged lines.
   */
  const lines = (await readText(log,)).split('\n',);
  return Object.fromEntries(['context', 'unrestricted', 'rules',].map(function count(name,) {
    return [
      name,
      lines.filter(function matches(line,): boolean {
        return line === `${name} ${paths}`;
      },).length,
    ];
  },),);
}

await describe({
  name: 'policy reuse after a replay',
  children: [
    it({
      name: 'a disjoint replay skips context-only and unchanged declared policies and re-runs the unrestricted one',
      fn: async function testDisjoint(): Promise<void> {
        /** Counting repository. */
        const { repository, log, } = await createCountingRepository();
        await using _repository = repository;
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
        await writeWorktreeFile({ repository, name: 'b.txt', content: 'b\n', },);
        /** Held commit of a.txt. */
        const held = await holdInEditor({ repository, name: 'held', args: ['commit', '-e', '-m', 'held', 'a.txt',], },);
        expect(await runsOver({ log, paths: 'a.txt', },),).toEqual({ context: 1, unrestricted: 1, rules: 1, },);
        expect((await runWrapper({ repository, args: ['commit', '-m', 'winner', 'b.txt',], },)).exitCode,).toBe(0,);
        await held.release();
        /** Replayed outcome. */
        const outcome = await held.outcome;
        expect(outcome.exitCode,).toBe(0,);
        expect(eventTypes(outcome,),).toEqual(['landing-race-lost', 'landing-reserved', 'commit-replayed',],);
        expect(await git({ repository, args: ['log', '--format=%s', '-3',], },),).toBe('held\nwinner\nconfig',);
        expect(await runsOver({ log, paths: 'a.txt', },),).toEqual({ context: 1, unrestricted: 2, rules: 1, },);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'a winning commit that changes a declared worktree input re-runs that policy only',
      fn: async function testDeclaredInput(): Promise<void> {
        /** Counting repository. */
        const { repository, log, } = await createCountingRepository();
        await using _repository = repository;
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
        /** Held commit of a.txt. */
        const held = await holdInEditor({ repository, name: 'held', args: ['commit', '-e', '-m', 'held', 'a.txt',], },);
        await writeWorktreeFile({ repository, name: 'rules.txt', content: 'stricter rule\n', },);
        expect((await runWrapper({ repository, args: ['commit', '-m', 'winner', 'rules.txt',], },)).exitCode,).toBe(0,);
        await held.release();
        /** Replayed outcome. */
        const outcome = await held.outcome;
        expect(outcome.exitCode,).toBe(0,);
        expect(eventTypes(outcome,),).toContain('commit-replayed',);
        expect(await runsOver({ log, paths: 'a.txt', },),).toEqual({ context: 1, unrestricted: 2, rules: 2, },);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
  ],
},);
