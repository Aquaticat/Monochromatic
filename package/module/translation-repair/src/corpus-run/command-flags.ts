import { StatedRefusalError, } from '../stated-refusal.ts';
import {
  isNegativeWholeNumberText,
  isWholeNumberText,
  WHOLE_NUMBER_RULE,
} from '../whole-number-text.ts';
import type { FlagValue, } from './command-line-types.ts';

//region Command flags
// The readers of flag VALUES the package's command lines share, so every
// probe and audit answers a mistyped value the same way (ledger B73). Which
// flags a command reads, and whether each was written once with a value, is
// read before any of these runs (`command-line.ts`, ledger B75), so each
// reader here is handed a value already known to be written and not empty,
// or that the flag was not written at all.
//
// THE PROBES EACH HAD THEIR OWN. The rendering audit's refused a flag written
// last and a cap that was no number; the fidelity and coverage probes read
// both as the default, truncated `4.9` to 4 and took `-3` as a cap, so a
// mistyped flag spent trials nobody asked for and said nothing. One reader
// now holds the refusals, and each probe names only its flags and defaults.

/**
 Separator between the ids one flag names.
 */
const ID_SEPARATOR = ',';

/**
 Reads the text written after a flag, or a default when it was not written.

 ONLY AN UNWRITTEN FLAG TAKES THE DEFAULT. Two score reports read a flag
 written last, or followed by an empty argument, as not written and scored
 the default sheet, which is the file the override was typed to replace;
 the command-line reader now refuses those before this runs (ledger B75).

 @param asked - what the flag carried, or that nobody wrote it

 @param unwritten - text to use when the flag was not written

 @returns Text written, or `unwritten`

 @example
 ```ts
 const sheet = writtenOr({ asked: line.flag('sheet',), unwritten: defaultSheet, },);
 ```
 */
export function writtenOr(
  {
    asked,
    unwritten,
  }: {
    readonly asked: FlagValue;
    readonly unwritten: string;
  },
): string {
  return (asked.kind === 'written') ? asked.value : unwritten;
}

/**
 Reads a whole number written after a flag, zero included.

 DIGITS ONLY, by the package's one count rule: `Number` read `fourty` as no
 number, which two probes then replaced with their default, and `4.9`,
 `1e1`, `0x4` and `+4` as numbers nobody typed (ledger B73). A MINUS SIGN
 BEFORE DIGITS is answered as a number below zero, since that is what the
 person typed, and the refusal says what leaving the flag off would do.

 @param asked - what the flag carried, or that nobody wrote it

 @param unwritten - number to use when the flag was not written, which may be
 a sentinel the caller reads as "no limit"

 @param leaveOffTo - what leaving the flag off does, completing "leave it off
 to ..." in the refusal of a number below zero

 @returns Number written, or `unwritten` when the flag was not

 @throws StatedRefusalError when the flag was written with a number below
 zero, or with anything that is not a whole number written in digits

 @example
 ```ts
 const cap = wholeNumberFlag({ asked: line.flag('cap',), unwritten: 16, leaveOffTo: 'run the default of 16 trials', },);
 ```
 */
export function wholeNumberFlag(
  {
    asked,
    unwritten,
    leaveOffTo,
  }: {
    readonly asked: FlagValue;
    readonly unwritten: number;
    readonly leaveOffTo: string;
  },
): number {
  if (asked.kind === 'unwritten')
    return unwritten;

  if (isNegativeWholeNumberText({ text: asked.value, },))
    throw new StatedRefusalError({
      says: `${asked.flag} cannot be below zero, and ${asked.value} is; leave it off to ${leaveOffTo}`,
    },);

  if (!isWholeNumberText({ text: asked.value, },))
    throw new StatedRefusalError({
      says: `${asked.flag} needs ${WHOLE_NUMBER_RULE}, and ${JSON.stringify(asked.value,)} is not one`,
    },);

  return Number(asked.value,);
}

/**
 Reads the ids written after a flag, comma separated.

 SPACE AROUND AN ID IS DROPPED, and so is the gap a stray comma leaves: no id
 any of these flags names holds either, so `tabby, ginger` can only mean the
 two ids it shows. The entry filter trimmed and the candidate and provider
 readers did not, so one spelling named two entries to the pass and an
 unknown model to the probes (ledger B75).

 @param asked - what the flag carried, or that nobody wrote it

 @param naming - what one id names, for the refusal: `entry id`,
 `seatable id`, `provider`

 @returns Ids named, in the order written; empty when the flag was not
 written, which callers read as no restriction

 @throws StatedRefusalError when the flag was written with separators and
 space naming no id, which would otherwise read as no restriction one line
 later

 @example
 ```ts
 const onlyIds = idListFlag({ asked: line.flag('only',), naming: 'entry id', },);
 ```
 */
export function idListFlag(
  {
    asked,
    naming,
  }: {
    readonly asked: FlagValue;
    readonly naming: string;
  },
): readonly string[] {
  if (asked.kind === 'unwritten')
    return [];

  /**
   Ids the text actually names.
   */
  const named = asked.value
    .split(ID_SEPARATOR,)
    .map(function trimmed(id,): string {
      return id.trim();
    },)
    .filter(function isNamed(id,): boolean {
      return id !== '';
    },);

  if (named.length === 0)
    throw new StatedRefusalError({
      says: `${asked.flag} needs at least one ${naming}, and ${JSON.stringify(asked.value,)} names none`,
    },);

  return named;
}

//endregion Command flags
