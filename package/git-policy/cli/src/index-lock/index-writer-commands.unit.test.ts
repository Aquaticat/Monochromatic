/**
 Alias resolution and index-writer classification of forwarded commands.

 @module
 */
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { internalTestExports, } from '../../dist/final/node/index.mjs';

const {
  ALIAS_SPLIT_FAILED,
  createsOrMovesWorktrees,
  isIndexWriter,
  resolveForwardedCommand,
  splitAliasCommand,
} = internalTestExports;

/**
 Resolved command shape.
 */
type Resolved = Awaited<ReturnType<typeof resolveForwardedCommand>>;

/**
 Resolves arguments against a fixed alias table, recording every lookup as `<global options>|<name>`.

 @param args - forwarded arguments

 @param aliases - alias table

 @returns resolved command and lookups
 */
async function resolveWith({
  args,
  aliases = {},
}: Readonly<{
  args: readonly string[];
  aliases?: Readonly<Record<string, string>>;
}>,): Promise<Readonly<{
  command: Resolved;
  lookups: readonly string[];
}>> {
  /** Looked-up names. */
  const lookups: string[] = [];
  /** Resolution. */
  const command = await resolveForwardedCommand({
    args,
    gitPath: '/nonexistent/git',
    lookup: async function tableLookup({
      name,
      globalArgs,
    },): ReturnType<NonNullable<Parameters<typeof resolveForwardedCommand>[0]['lookup']>> {
      lookups.push(`${globalArgs.join(' ',)}|${name}`,);
      return await Promise.resolve(aliases[name] ?? internalTestExports.ALIAS_UNSET,);
    },
  },);
  return {
    command,
    lookups,
  };
}

/**
 Classifies built-in arguments without aliases.

 @param args - forwarded arguments

 @returns whether they write the real index
 */
async function writes(args: readonly string[],): Promise<boolean> {
  return isIndexWriter((await resolveWith({ args, },)).command,);
}

await describe({
  name: 'forwarded command classification',
  children: [
    it({
      name: 'splits alias values with Git split_cmdline quoting',
      fn: async function testSplit(): Promise<void> {
        await Promise.resolve();
        expect(splitAliasCommand(String.raw`worktree add  "a b" c\ d 'e "f"'`,),).toEqual(['worktree', 'add', 'a b', 'c d', 'e "f"',],);
        expect(splitAliasCommand('commit -m ""',),).toEqual(['commit', '-m', '',],);
        expect(splitAliasCommand('say "unclosed',),).toBe(ALIAS_SPLIT_FAILED,);
        expect(splitAliasCommand('trailing\\',),).toBe(ALIAS_SPLIT_FAILED,);
      },
    },),
    it({
      name: 'never looks up an alias for a built-in name',
      fn: async function testBuiltin(): Promise<void> {
        /** Resolution of a built-in shadowed by an alias Git ignores. */
        const { command, lookups, } = await resolveWith({ args: ['-C', '/repo', 'status',], aliases: { status: 'worktree add ../x', }, },);
        expect(lookups,).toEqual([],);
        expect(command.route,).toBe('direct',);
        expect(command.subcommand,).toBe('status',);
        expect(createsOrMovesWorktrees(command,),).toBe(false,);
      },
    },),
    it({
      name: 'follows alias chains, keeps outer global options, and applies alias-supplied global options',
      fn: async function testChain(): Promise<void> {
        /** Resolution through two aliases. */
        const { command, lookups, } = await resolveWith({
          args: ['-C', '/repo', 'wt', '../topic',],
          aliases: { wt: 'new-tree -b topic', 'new-tree': '-c core.quotePath=false worktree add', },
        },);
        expect(lookups,).toEqual(['-C /repo|wt', '-C /repo|new-tree',],);
        expect(command.route,).toBe('alias',);
        expect(command.args,).toEqual(['-C', '/repo', '-c', 'core.quotePath=false', 'worktree', 'add', '-b', 'topic', '../topic',],);
        expect(command.subcommand,).toBe('worktree',);
        expect(createsOrMovesWorktrees(command,),).toBe(true,);
      },
    },),
    it({
      name: 'stops at alias loops, shell aliases, malformed aliases, and unknown names',
      fn: async function testUnresolved(): Promise<void> {
        expect((await resolveWith({ args: ['a',], aliases: { a: 'b', b: 'a', }, },)).command.route,).toBe('unresolved',);
        expect((await resolveWith({ args: ['sh',], aliases: { sh: '!git worktree add ../x', }, },)).command.route,).toBe('shell-alias',);
        expect((await resolveWith({ args: ['bad',], aliases: { bad: 'worktree "add', }, },)).command.route,).toBe('unresolved',);
        /** External or unknown command. */
        const unknown = await resolveWith({ args: ['lfs', 'status',], },);
        expect(unknown.command.route,).toBe('unresolved',);
        expect(isIndexWriter(unknown.command,),).toBe(false,);
        expect(createsOrMovesWorktrees((await resolveWith({ args: ['sh',], aliases: { sh: '!git worktree add ../x', }, },)).command,),).toBe(false,);
      },
    },),
    it({
      name: 'marks only worktree add and move as worktree-copy applicable sources',
      fn: async function testWorktreeForms(): Promise<void> {
        /** Worktree subcommands. */
        const forms = await Promise.all(['add', 'move', 'list', 'prune', 'remove', 'lock', 'repair',].map(async function classify(action,): Promise<boolean> {
          return createsOrMovesWorktrees((await resolveWith({ args: ['worktree', action, '../x',], },)).command,);
        },),);
        expect(forms,).toEqual([true, true, false, false, false, false, false,],);
        expect(createsOrMovesWorktrees((await resolveWith({ args: ['status',], },)).command,),).toBe(false,);
        expect(createsOrMovesWorktrees((await resolveWith({ args: ['--version',], },)).command,),).toBe(false,);
      },
    },),
    it({
      name: 'classifies every always-writing index writer',
      fn: async function testAlwaysWriters(): Promise<void> {
        /** Commands that write the index in every form. */
        const commands = ['add', 'rm', 'mv', 'stash', 'checkout', 'switch', 'merge', 'rebase', 'cherry-pick', 'revert', 'update-index', 'read-tree', 'am', 'pull', 'sparse-checkout',];
        expect(
          await Promise.all(commands.map(async function classify(command,): Promise<boolean> {
          return await writes([command,],);
        },),),
        ).toEqual(commands.map(function always(): boolean {
          return true;
        },),);
        expect(
          await Promise.all(['status', 'diff', 'log', 'commit', 'restore', 'apply', 'worktree', 'fetch', 'push',].map(async function classify(command,): Promise<boolean> {
          return await writes([command,],);
        },),),
        ).toEqual([false, false, false, false, false, false, false, false, false,],);
      },
    },),
    it({
      name: 'classifies restore, reset, and apply from their options before the separator',
      fn: async function testOptionWriters(): Promise<void> {
        expect(await writes(['restore', '--staged', 'a',],),).toBe(true,);
        expect(await writes(['restore', '--st', 'a',],),).toBe(true,);
        expect(await writes(['restore', '-WS', 'a',],),).toBe(true,);
        expect(await writes(['restore', '-sS', 'a',],),).toBe(false,);
        expect(await writes(['restore', '--', '--staged',],),).toBe(false,);
        expect(await writes(['restore', '--source=HEAD', 'a',],),).toBe(false,);
        expect(await writes(['reset',],),).toBe(true,);
        expect(await writes(['reset', '--hard', 'HEAD~',],),).toBe(true,);
        expect(await writes(['reset', '--soft', 'HEAD~',],),).toBe(false,);
        expect(await writes(['reset', '--s', 'HEAD~',],),).toBe(false,);
        expect(await writes(['reset', '--', '--soft',],),).toBe(true,);
        expect(await writes(['apply', 'x.patch',],),).toBe(false,);
        expect(await writes(['apply', '--cached', 'x.patch',],),).toBe(true,);
        expect(await writes(['apply', '--ca', 'x.patch',],),).toBe(true,);
        expect(await writes(['apply', '--index', 'x.patch',],),).toBe(true,);
        expect(await writes(['apply', '--ind', 'x.patch',],),).toBe(true,);
        expect(await writes(['apply', '--check', 'x.patch',],),).toBe(false,);
      },
    },),
    it({
      name: 'classifies an alias that expands to an index writer',
      fn: async function testAliasWriter(): Promise<void> {
        expect(isIndexWriter((await resolveWith({ args: ['unstage', 'a',], aliases: { unstage: 'restore --staged', }, },)).command,),).toBe(true,);
        expect(isIndexWriter((await resolveWith({ args: ['aa',], aliases: { aa: 'add --all', }, },)).command,),).toBe(true,);
      },
    },),
  ],
},);
