/**
 Commit options a replay repeats outside native `git commit`:
 whether hooks were bypassed with `--no-verify`,
 and the key a signed commit is re-signed with.

 @module
 */
import { PATHSPEC_SEPARATOR, } from '../escape-hatch.ts';
import { normaliseCommitArgs, } from '../parser/commit-normalise.ts';

/**
 Short commit options that consume the next token.
 */
const VALUE_LETTERS: ReadonlySet<string> = new Set([
  'm',
  'F',
  'C',
  'c',
  't',
]);

/**
 Short commit options whose value, when present, is attached (`-S<key>`, `-u<mode>`).
 */
const ATTACHED_VALUE_LETTERS: ReadonlySet<string> = new Set([
  'S',
  'u',
]);

/**
 Long commit options that consume the next token when written without `=`.
 */
const LONG_VALUE_OPTIONS: ReadonlySet<string> = new Set([
  '--message',
  '--file',
  '--reuse-message',
  '--reedit-message',
  '--squash',
  '--fixup',
  '--author',
  '--date',
  '--cleanup',
  '--trailer',
  '--template',
  '--pathspec-from-file',
]);

/**
 Replay-relevant commit options.
 */
export type ReplayOptions = Readonly<{
  /**
   Whether `pre-commit` and `commit-msg` were bypassed.
   */
  noVerify: boolean;
  /**
   Key ID given to `-S` or `--gpg-sign`, absent for the configured key.
   */
  signingKey?: string;
}>;

/**
 Option state while scanning.
 */
type ScanState = Readonly<{
  /**
   Latest `--verify` or `--no-verify` decision.
   */
  noVerify: boolean;
  /**
   Latest signing key, empty for the configured key.
   */
  signingKey: string;
  /**
   Whether the next token is an option value.
   */
  valueNext: boolean;
  /**
   Whether the pathspec separator was passed.
   */
  done: boolean;
}>;

/**
 Applies one short-option cluster.

 @param state - state before the cluster

 @param token - cluster such as `-nS` or `-Skey`

 @returns state after the cluster
 */
function scanCluster({
  state,
  token,
}: Readonly<{
  state: ScanState;
  token: string;
}>,): ScanState {
  /**
   Letters after the dash.
   */
  const letters = Array.from(token.slice(1,),);
  /**
   First letter whose value follows, attached or separated.
   */
  const valueIndex = letters.findIndex(function takesValue(letter,): boolean {
    return VALUE_LETTERS.has(letter,) || ATTACHED_VALUE_LETTERS.has(letter,);
  },);
  /**
   Boolean flags before any value letter.
   */
  const flags = valueIndex === (-1) ? letters : letters.slice(
    0,
    valueIndex,
  );
  /**
   Value letter, when present.
   */
  const valueLetter = valueIndex === (-1) ? '' : letters[valueIndex] ?? '';
  /**
   Attached value after the value letter.
   */
  const attached = valueIndex === (-1) ? '' : letters.slice(valueIndex + 1,)
    .join('',);
  return {
    ...state,
    noVerify: state.noVerify || flags.includes('n',),
    signingKey: valueLetter === 'S' ? attached : state.signingKey,
    valueNext: VALUE_LETTERS.has(valueLetter,) && (attached === ''),
  };
}

/**
 Applies one token.

 @param state - state before the token

 @param token - argument

 @returns state after the token
 */
function scanToken({
  state,
  token,
}: Readonly<{
  state: ScanState;
  token: string;
}>,): ScanState {
  if (state.done)
    return state;
  if (state.valueNext)
    return {
      ...state,
      valueNext: false,
    };
  if (token === PATHSPEC_SEPARATOR)
    return {
      ...state,
      done: true,
    };
  if ((token === '--no-verify') || (token === '--verify'))
    return {
      ...state,
      noVerify: token === '--no-verify',
    };
  if ((token === '--gpg-sign') || token.startsWith('--gpg-sign=',))
    return {
      ...state,
      signingKey: token.slice('--gpg-sign='.length,),
    };
  if (LONG_VALUE_OPTIONS.has(token,))
    return {
      ...state,
      valueNext: true,
    };
  if (token.startsWith('-',) && (!token.startsWith('--',)) && (token.length > 1))
    return scanCluster({
      state,
      token,
    },);
  return state;
}

/**
 Reads the replay-relevant options from private commit arguments.

 @param commitArgs - post-`commit` arguments native preparation ran with

 @returns options

 @example
 ```ts
 replayOptions(['-n', '-Sabc', '-m', 'x']); // { noVerify: true, signingKey: 'abc' }
 ```
 */
export function replayOptions(commitArgs: readonly string[],): ReplayOptions {
  /**
   Final scan state.
   */
  const state = normaliseCommitArgs(commitArgs,)
    .reduce(
      function applyToken(
        current: ScanState,
        token,
      ): ScanState {
        return scanToken({
          state: current,
          token,
        },);
      },
      {
        noVerify: false,
        signingKey: '',
        valueNext: false,
        done: false,
      },
    );
  return {
    noVerify: state.noVerify,
    ...(state.signingKey === '' ? {} : { signingKey: state.signingKey, }),
  };
}
