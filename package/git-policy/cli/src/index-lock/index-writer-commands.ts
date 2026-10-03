/**
 Forwarded commands that write the real index, classified from parsed arguments after alias resolution.

 The set follows `SPEC.md` "Index-writer coordination":
 `add`,
 `rm`,
 `mv`,
 `restore --staged`,
 `reset` except `--soft`,
 `stash`,
 `checkout`,
 `switch`,
 `merge`,
 `rebase`,
 `cherry-pick`,
 `revert`,
 `apply --cached` and `apply --index`,
 `update-index`,
 `read-tree`,
 `am`,
 `pull`,
 and `sparse-checkout`.
 Options are read only before Git's `--` separator.
 Long options are matched in full or as the unambiguous abbreviations Git accepts for them.

 @module
 */
import type { ResolvedGitCommand, } from '../forwarded-command.ts';

/**
 Commands that write the index in every form.
 */
const ALWAYS_WRITING_COMMANDS: ReadonlySet<string> = new Set([
  'add',
  'am',
  'checkout',
  'cherry-pick',
  'merge',
  'mv',
  'pull',
  'read-tree',
  'rebase',
  'revert',
  'rm',
  'sparse-checkout',
  'stash',
  'switch',
  'update-index',
],);

/**
 Long option with the shortest abbreviation Git accepts for it in its command.
 */
type LongOption = Readonly<{
  /**
   Full spelling.
   */
  name: string;
  /**
   Shortest unambiguous prefix length, `--` included.
   */
  minimumLength: number;
}>;

/**
 `git restore --staged`; Git 2.55.0 rejects `--s` as ambiguous with `--source`.
 */
const RESTORE_STAGED: LongOption = {
  name: '--staged',
  minimumLength: 4,
};

/**
 `git reset --soft`; Git 2.55.0 accepts `--s`.
 */
const RESET_SOFT: LongOption = {
  name: '--soft',
  minimumLength: 3,
};

/**
 `git apply --cached`; Git 2.55.0 rejects `--c` as ambiguous with `--check`.
 */
const APPLY_CACHED: LongOption = {
  name: '--cached',
  minimumLength: 4,
};

/**
 `git apply --index`; Git 2.55.0 rejects `--in` as ambiguous with `--intent-to-add` and `--inaccurate-eof`.
 */
const APPLY_INDEX: LongOption = {
  name: '--index',
  minimumLength: 5,
};

/**
 Option tokens after the subcommand and before `--`.

 @param command - resolved command

 @returns option tokens

 @example
 ```ts
 optionTokens(resolved); // ['--staged']
 ```
 */
export function optionTokens(command: ResolvedGitCommand,): readonly string[] {
  /**
   Tokens after the subcommand.
   */
  const rest = command.args
    .slice(command.subcommandIndex + 1,);
  /**
   Separator position.
   */
  const separator = rest.indexOf('--',);
  return (separator === (-1) ? rest : rest.slice(
    0,
    separator,
  ))
    .filter(function isOption(token,): boolean {
      return token.startsWith('-',) && (token !== '-');
    },);
}

/**
 Reports whether a token spells a long option or an accepted abbreviation of it.

 @param token - argument token

 @param option - long option

 @returns whether it matches
 */
function matchesLong({
  token,
  option,
}: Readonly<{
  token: string;
  option: LongOption;
}>,): boolean {
  /**
   Option name without an attached `=value`.
   */
  const name = token.split('=',)[0] ?? token;
  return (name.length >= option.minimumLength)
    && option.name
    .startsWith(name,);
}

/**
 Reports whether a short-option cluster sets a letter before a value-taking letter consumes the rest.

 @param token - argument token

 @param letter - flag letter

 @param valueLetters - letters that take the rest of the cluster as their value

 @returns whether the letter is set
 */
function clusterHas({
  token,
  letter,
  valueLetters,
}: Readonly<{
  token: string;
  letter: string;
  valueLetters: string;
}>,): boolean {
  if ((!token.startsWith('-',)) || token.startsWith('--',))
    return false;
  for (const character of token.slice(1,)) {
    if (character === letter)
      return true;
    if (valueLetters.includes(character,))
      return false;
  }
  return false;
}

/**
 Reports whether a resolved forwarded command writes the real index.

 @param command - resolved command

 @returns whether it coordinates with landings

 @example
 ```ts
 isIndexWriter(await resolveForwardedCommand({ args: ['add', '--', 'a.txt'], gitPath })); // true
 ```
 */
export function isIndexWriter(command: ResolvedGitCommand,): boolean {
  if ((command.route === 'shell-alias') || (command.route === 'unresolved')
    || (command.subcommand === undefined))
    return false;
  if (ALWAYS_WRITING_COMMANDS.has(command.subcommand,))
    return true;
  /**
   Options before `--`.
   */
  const options = optionTokens(command,);
  if (command.subcommand === 'restore')
    return options.some(function staged(token,): boolean {
      return matchesLong({
        token,
        option: RESTORE_STAGED,
      },) || clusterHas({
        token,
        letter: 'S',
        valueLetters: 's',
      },);
    },);
  if (command.subcommand === 'reset')
    return !options.some(function soft(token,): boolean {
      return matchesLong({
        token,
        option: RESET_SOFT,
      },);
    },);
  if (command.subcommand === 'apply')
    return options.some(function touchesIndex(token,): boolean {
      return matchesLong({
        token,
        option: APPLY_CACHED,
      },) || matchesLong({
        token,
        option: APPLY_INDEX,
      },);
    },);
  return false;
}
