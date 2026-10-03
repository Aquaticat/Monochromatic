/**
 The Git command a forwarded invocation actually runs, after ordinary alias resolution.

 Git expands an alias only when no built-in has that name,
 reads it from `alias.<name>` or `alias.<name>.command`,
 splits it with `split_cmdline` quoting rules,
 lets its leading words be global options,
 and expands again when the result is itself an alias.
 A value starting with `!` runs a shell command;
 Git commands inside it pass through the wrapper on their own.

 @module
 */
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import nanoSpawn, { SubprocessError, } from 'nano-spawn';
import { GIT_BUILTIN_COMMANDS, } from './git-builtin-commands.ts';
import { parseGlobalOptions, } from './parse-global-options.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Alias expansions followed before giving up, well above any realistic chain.
 */
const MAX_ALIAS_EXPANSIONS = 16;

/**
 How the command was reached.
 */
export type ForwardedCommandRoute = 'direct' | 'alias' | 'shell-alias' | 'unresolved';

/**
 Resolved forwarded command.
 */
export type ResolvedGitCommand = Readonly<{
  /**
   Arguments after expansion, global options included.
   */
  args: readonly string[];
  /**
   Index of the subcommand in `args`.
   */
  subcommandIndex: number;
  /**
   Built-in subcommand name, or the unresolved name; absent for a bare `git` or a help or version form.
   */
  subcommand?: string;
  /**
   How it was reached;
   `unresolved` covers external commands,
   unknown names,
   alias loops,
   and malformed alias values.
   */
  route: ForwardedCommandRoute;
}>;

/**
 The alias value has an unclosed quote or a trailing backslash, which Git rejects.
 */
export const ALIAS_SPLIT_FAILED: unique symbol = Symbol('Git alias value has an unclosed quote or trailing backslash',);

/**
 No `alias.<name>` or `alias.<name>.command` is configured.
 */
export const ALIAS_UNSET: unique symbol = Symbol('Git config defines no alias under this subcommand spelling',);

/**
 Mutable split state isolated to one call.
 */
type SplitState = {
  words: string[];
  current: string;
  started: boolean;
  quote: '' | '"' | '\'';
  escaped: boolean;
};

/**
 Reports whether a character is ASCII whitespace as C `isspace` sees it.

 @param character - one character

 @returns whether it separates words
 */
function isSpace(character: string,): boolean {
  return (character === ' ') || (character === '\t')
    || (character === '\n')
    || (character === '\r')
    || (character === '\v')
    || (character === '\f');
}

/**
 Splits an alias value the way Git's `split_cmdline` does:
 whitespace separates words outside quotes,
 single and double quotes group,
 and a backslash escapes the next character except inside single quotes.

 @param value - alias value

 @returns words, or the failure sentinel for an unclosed quote or a trailing backslash

 @example
 ```ts
 splitAliasCommand(`worktree add "a b"`); // ['worktree', 'add', 'a b']
 ```
 */
export function splitAliasCommand(value: string,): readonly string[] | typeof ALIAS_SPLIT_FAILED {
  /**
   Linear scan state.
   */
  const state: SplitState = {
    words: [],
    current: '',
    started: true,
    quote: '',
    escaped: false,
  };
  for (const character of value) {
    if (state.escaped) {
      state.current += character;
      state.escaped = false;
    }
    else if ((state.quote === '') && isSpace(character,)) {
      if (state.started)
        state.words
          .push(state.current,);
      state.current = '';
      state.started = false;
    }
    else if ((state.quote === '') && ((character === '\'') || (character === '"'))) {
      state.quote = character;
      state.started = true;
    }
    else if (character === state.quote) {
      state.quote = '';
    }
    else if ((character === '\\') && (state.quote !== '\'')) {
      state.escaped = true;
      state.started = true;
    }
    else {
      state.current += character;
      state.started = true;
    }
  }
  if ((state.quote !== '') || state.escaped)
    return ALIAS_SPLIT_FAILED;
  if (state.started)
    state.words
      .push(state.current,);
  return state.words;
}

/**
 Reads one alias definition.

 @param gitPath - real Git executable

 @param globalArgs - global options in effect, including `-C` and `-c`

 @param key - configuration key

 @returns value, or the unset sentinel
 */
async function readAliasKey({
  gitPath,
  globalArgs,
  key,
}: Readonly<{
  gitPath: string;
  globalArgs: readonly string[];
  key: string;
}>,): Promise<string | typeof ALIAS_UNSET> {
  try {
    /**
     `git config --get` output.
     */
    const { stdout, } = await nanoSpawn(
      gitPath,
      [
        ...globalArgs,
        'config',
        '--get',
        key,
      ],
    );
    return stdout;
  }
  catch (error: unknown) {
    if (error instanceof SubprocessError) {
      l.debug(`no ${key}: ${caughtValueText(error,)}`,);
      return ALIAS_UNSET;
    }
    throw error;
  }
}

/**
 Looks up an alias in both of Git's spellings.

 @param gitPath - real Git executable

 @param globalArgs - global options in effect

 @param name - alias name

 @returns value, or the unset sentinel

 @example
 ```ts
 await lookupAlias({ gitPath: '/usr/bin/git', globalArgs: [], name: 'wta' });
 ```
 */
export async function lookupAlias({
  gitPath,
  globalArgs,
  name,
}: Readonly<{
  gitPath: string;
  globalArgs: readonly string[];
  name: string;
}>,): Promise<string | typeof ALIAS_UNSET> {
  /**
   Plain `alias.<name>` value.
   */
  const plain = await readAliasKey({
    gitPath,
    globalArgs,
    key: `alias.${name}`,
  },);
  if (plain !== ALIAS_UNSET)
    return plain;
  return await readAliasKey({
    gitPath,
    globalArgs,
    key: `alias.${name}.command`,
  },);
}

/**
 Resolves the command a forwarded invocation runs.

 @param args - forwarded arguments

 @param gitPath - real Git executable

 @param lookup - alias source, injectable for tests

 @returns resolved command

 @example
 ```ts
 await resolveForwardedCommand({ args: ['wta', '../topic'], gitPath: '/usr/bin/git' });
 ```
 */
export async function resolveForwardedCommand({
  args,
  gitPath,
  lookup = lookupAlias,
}: Readonly<{
  args: readonly string[];
  gitPath: string;
  lookup?: typeof lookupAlias;
}>,): Promise<ResolvedGitCommand> {
  /**
   Tagged resolver logger.
   */
  const rl = tagged({
    tag: resolveForwardedCommand.name,
    l,
  },);
  /**
   Expansion state: current arguments and names already expanded.
   */
  const state: {
    args: readonly string[];
    seen: Set<string>;
  } = {
    args,
    seen: new Set(),
  };
  for (let expansion = 0; expansion <= MAX_ALIAS_EXPANSIONS; expansion += 1) {
    /**
     Current layout.
     */
    const {
      subcommandIndex,
      willShortCircuit,
    } = parseGlobalOptions(state.args,);
    /**
     Current subcommand.
     */
    const subcommand = willShortCircuit ? undefined : state.args[subcommandIndex];
    /**
     Resolution with the current arguments.
     */
    const resolved = {
      args: state.args,
      subcommandIndex,
      ...(subcommand === undefined ? {} : { subcommand, }),
    };
    if ((subcommand === undefined) || GIT_BUILTIN_COMMANDS.has(subcommand,))
      return {
        ...resolved,
        route: state.seen
          .size
          === 0 ? 'direct' : 'alias',
      };
    if (state.seen
      .has(subcommand,)) {
      rl.debug(`alias loop at ${subcommand}`,);
      return {
        ...resolved,
        route: 'unresolved',
      };
    }
    state.seen
      .add(subcommand,);
    /**
     Global options in effect for the lookup.
     */
    const globalArgs = state.args
      .slice(
        0,
        subcommandIndex,
      );
    /* oxlint-disable no-await-in-loop -- Each expansion depends on the previous one. */
    /**
     Alias value.
     */
    const value = await lookup({
      gitPath,
      globalArgs,
      name: subcommand,
    },);
    /* oxlint-enable no-await-in-loop */
    if (value === ALIAS_UNSET)
      return {
        ...resolved,
        route: 'unresolved',
      };
    if (value.trimStart()
      .startsWith('!',))
      return {
        ...resolved,
        route: 'shell-alias',
      };
    /**
     Alias words.
     */
    const words = splitAliasCommand(value.trim(),);
    if ((words === ALIAS_SPLIT_FAILED) || (words.length === 0))
      return {
        ...resolved,
        route: 'unresolved',
      };
    rl.debug(`expanded alias ${subcommand} to ${words.join(' ',)}`,);
    state.args = [
      ...globalArgs,
      ...words,
      ...state.args
        .slice(subcommandIndex + 1,),
    ];
  }
  /**
   Layout after the expansion limit.
   */
  const { subcommandIndex, } = parseGlobalOptions(state.args,);
  /**
   Last unresolved name.
   */
  const subcommand = state.args[subcommandIndex];
  return {
    args: state.args,
    subcommandIndex,
    ...(subcommand === undefined ? {} : { subcommand, }),
    route: 'unresolved',
  };
}

/**
 Reports whether a resolved command creates or moves linked worktrees:
 `git worktree add` and `git worktree move`.

 @param command - resolved command

 @returns whether it is a worktree-copy applicable source

 @example
 ```ts
 createsOrMovesWorktrees(await resolveForwardedCommand({ args: ['worktree', 'add', '../t'], gitPath }));
 ```
 */
export function createsOrMovesWorktrees(command: ResolvedGitCommand,): boolean {
  if ((command.route === 'shell-alias') || (command.route === 'unresolved')
    || (command.subcommand !== 'worktree'))
    return false;
  /**
   Worktree action: the first positional token after `worktree`.
   */
  const action = command.args
    .slice(command.subcommandIndex + 1,)
    .find(function isPositional(token,): boolean {
      return !token.startsWith('-',);
    },);
  return (action === 'add') || (action === 'move');
}
