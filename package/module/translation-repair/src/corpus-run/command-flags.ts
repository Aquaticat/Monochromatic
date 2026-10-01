import { StatedRefusalError, } from '../stated-refusal.ts';
import {
  isNegativeWholeNumberText,
  isWholeNumberText,
  WHOLE_NUMBER_RULE,
} from '../whole-number-text.ts';

//region Command flags
// The one reader of `--flag value` pairs on the package's command lines, so
// every probe and audit answers a mistyped flag the same way (ledger B73).
//
// THE PROBES EACH HAD THEIR OWN. The rendering audit's refused a flag written
// last and a cap that was no number; the fidelity and coverage probes read
// both as the default, truncated `4.9` to 4 and took `-3` as a cap, so a
// mistyped flag spent trials nobody asked for and said nothing. One reader
// now holds the refusals, and each probe names only its flags and defaults.

/**
 What `indexOf` returns for a flag nobody wrote.
 */
const FLAG_ABSENT = -1;

/**
 Marker every flag here starts with, so a missing value is distinguishable
 from the next flag standing where a value should be.
 */
const FLAG_PREFIX = '--';

/**
 Separator between the entry ids one flag names.
 */
const ID_SEPARATOR = ',';

/**
 What a flag carried, or that nobody wrote it.

 NAMED RATHER THAN LEFT NULLISH because the two answers lead to opposite
 behaviour one line later: an unwritten flag takes a default, and a written
 one that carries nothing is a typo this refuses. A nullish union puts both
 behind the same check and invites the collapse that was the defect here.

 @example
 ```ts
 const asked: FlagValue = { kind: 'written', value: '4', };
 ```
 */
export type FlagValue = {
  readonly kind: 'written';

  /**
   What was written after the flag.
   */
  readonly value: string;
} | { readonly kind: 'unwritten'; };

/**
 Reads the value written after a named flag.

 ABSENT AND EMPTY ARE DIFFERENT ANSWERS. Both once came back as the empty
 string, which every caller then read as "not asked for", so `--cap` written
 at the end of the line bought everything and `--only` written at the end
 audited everything: the opposite of what the person typing them asked for,
 and neither said a word about it.

 @param args - arguments after the script path

 @param flag - flag to look for

 @returns Value written after it, or that the flag itself was not written

 @throws StatedRefusalError when the flag was written with nothing usable
 after it

 @example
 ```ts
 const asked = flagValue({ args: ['--cap', '4',], flag: '--cap', },);
 ```
 */
export function flagValue(
  {
    args,
    flag,
  }: {
    readonly args: readonly string[];
    readonly flag: string;
  },
): FlagValue {
  /**
   Where the flag was written.
   */
  const at = args.indexOf(flag,);
  if (at === FLAG_ABSENT)
    return { kind: 'unwritten', };

  /**
   What was written after it, empty when the flag ended the line.
   */
  const written = args[at + 1] ?? '';

  if ((written === '') || written.startsWith(FLAG_PREFIX,))
    throw new StatedRefusalError({
      says: `${flag} needs a value written after it`,
    },);

  return {
    kind: 'written',
    value: written,
  };
}

/**
 Reads a whole number written after a named flag, zero included.

 DIGITS ONLY, by the package's one count rule: `Number` read `fourty` as no
 number, which two probes then replaced with their default, and `4.9`,
 `1e1`, `0x4` and `+4` as numbers nobody typed (ledger B73). A MINUS SIGN
 BEFORE DIGITS is answered as a number below zero, since that is what the
 person typed, and the refusal says what leaving the flag off would do.

 @param args - arguments after the script path

 @param flag - flag to look for

 @param unwritten - number to use when the flag was not written, which may be
 a sentinel the caller reads as "no limit"

 @param leaveOffTo - what leaving the flag off does, completing "leave it off
 to ..." in the refusal of a number below zero

 @returns Number written, or `unwritten` when the flag was not

 @throws StatedRefusalError when the flag was written with nothing after it,
 with a number below zero, or with anything that is not a whole number
 written in digits

 @example
 ```ts
 const cap = wholeNumberFlag({ args, flag: '--cap', unwritten: 16, leaveOffTo: 'run the default of 16 trials', },);
 ```
 */
export function wholeNumberFlag(
  {
    args,
    flag,
    unwritten,
    leaveOffTo,
  }: {
    readonly args: readonly string[];
    readonly flag: string;
    readonly unwritten: number;
    readonly leaveOffTo: string;
  },
): number {
  /**
   Number as written, absent when the flag was not.
   */
  const asked = flagValue({
    args,
    flag,
  },);
  if (asked.kind === 'unwritten')
    return unwritten;

  if (isNegativeWholeNumberText({ text: asked.value, },))
    throw new StatedRefusalError({
      says: `${flag} cannot be below zero, and ${asked.value} is; leave it off to ${leaveOffTo}`,
    },);

  if (!isWholeNumberText({ text: asked.value, },))
    throw new StatedRefusalError({
      says: `${flag} needs ${WHOLE_NUMBER_RULE}, and ${asked.value} is not one`,
    },);

  return Number(asked.value,);
}

/**
 Reads the entry ids written after a named flag, comma separated.

 @param args - arguments after the script path

 @param flag - flag to look for

 @returns Entry ids named, dropping the gaps a stray comma leaves; empty when
 the flag was not written, which callers read as every entry

 @throws StatedRefusalError when the flag was written with nothing after it,
 or with separators naming no entry, which would otherwise read as every
 entry one line later

 @example
 ```ts
 const onlyIds = idListFlag({ args: ['--only', 'tabby,ginger',], flag: '--only', },);
 ```
 */
export function idListFlag(
  {
    args,
    flag,
  }: {
    readonly args: readonly string[];
    readonly flag: string;
  },
): readonly string[] {
  /**
   Entries as written, absent when the flag was not.
   */
  const asked = flagValue({
    args,
    flag,
  },);
  if (asked.kind === 'unwritten')
    return [];

  /**
   Entries the text actually names.
   */
  const named = asked.value
    .split(ID_SEPARATOR,)
    .filter(function isNamed(id,): boolean {
      return id !== '';
    },);

  if (named.length === 0)
    throw new StatedRefusalError({
      says: `${flag} needs at least one entry id, and ${asked.value} names none`,
    },);

  return named;
}

//endregion Command flags
