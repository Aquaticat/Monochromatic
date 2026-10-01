/**
 Tests for the one reader of `--flag value` pairs the probes and the
 rendering audit share (ledger B73): what an unwritten flag, a flag written
 with nothing after it, a whole number and an entry list each read as.
 Fixtures are cat-themed invention only.

 @module
 */

import {
  caught,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  flagValue,
  idListFlag,
  StatedRefusalError,
  wholeNumberFlag,
} from '../../dist/final/node/index.mjs';

/**
 Largest whole number a double holds exactly, as digits.
 */
const LARGEST = String(Number.MAX_SAFE_INTEGER,);

/**
 Naps a probe takes when nobody names a number.
 */
const DEFAULT_NAPS = 12;

/**
 Message of the stated refusal a read threw.

 @param read - read that must refuse

 @returns The refusal's message

 @example
 ```ts
 const said = refusalOf({ read: () => napCap({ typed: ['--naps',], },), },);
 ```
 */
function refusalOf({ read, }: { readonly read: () => void; },): string {
  /**
   What the read threw.
   */
  const refusal = caught(read,);
  expect(refusal,).toBeInstanceOf(StatedRefusalError,);
  return (refusal as Error).message;
}

/**
 Reads a nap cap the way a probe reads its cap.

 @param typed - what the operator wrote after the script path

 @returns Naps asked for, or the default

 @throws StatedRefusalError when the reader refuses what was typed

 @example
 ```ts
 const naps = napCap({ typed: ['--naps', '3',], },);
 ```
 */
function napCap({ typed, }: { readonly typed: readonly string[]; },): number {
  return wholeNumberFlag({
    args: typed,
    flag: '--naps',
    unwritten: DEFAULT_NAPS,
    leaveOffTo: `take the default of ${String(DEFAULT_NAPS,)} naps`,
  },);
}

await describe({
  name: flagValue.name,
  children: [
    it({
      name: 'ANSWERS that a flag nobody wrote is unwritten, which is not the answer for a flag written empty',
      fn: async () => {
        expect(flagValue({
          args: ['--cats', 'tabby',],
          flag: '--naps',
        },),).toEqual({ kind: 'unwritten', },);
      },
    },),
    it({
      name: 'READS the value written after the flag, wherever on the line the flag stands',
      fn: async () => {
        expect(flagValue({
          args: ['--cats', 'tabby', '--naps', '3',],
          flag: '--naps',
        },),).toEqual({
          kind: 'written',
          value: '3',
        },);
      },
    },),
    it({
      name: 'READS the equals form as the value it carries, which once read as no flag and took the default '
        + '(ledger B75)',
      fn: async () => {
        expect(flagValue({
          args: ['--naps=3',],
          flag: '--naps',
        },),).toEqual({
          kind: 'written',
          value: '3',
        },);
      },
    },),
    it({
      name: 'REFUSES the flag written twice, which read the first value and dropped the second in silence '
        + '(ledger B75)',
      fn: async () => {
        expect(refusalOf({
          read: function readsTwice(): void {
            flagValue({
              args: ['--naps', '3', '--naps', '4',],
              flag: '--naps',
            },);
          },
        },),).toContain('--naps',);
      },
    },),
    it({
      name: 'REFUSES a flag written last, followed by the next flag, or followed by an empty argument, each of '
        + 'which once read as unwritten and took the default nobody asked for',
      fn: async () => {
        /**
         Command lines whose flag carries nothing usable.
         */
        const valueless: readonly (readonly string[])[] = [
          ['--naps',],
          ['--naps', '--cats', 'tabby',],
          ['--naps', '',],
        ];
        expect(valueless.map(function readsValueless(args,): string {
          return refusalOf({
            read: function read(): void {
              flagValue({
                args,
                flag: '--naps',
              },);
            },
          },);
        },),).toEqual(valueless.map(function expectedOf(): string {
          return '--naps needs a value written after it';
        },),);
      },
    },),
  ],
},);

await describe({
  name: wholeNumberFlag.name,
  children: [
    it({
      name: 'TAKES THE CALLER\'S NUMBER when the flag is not written, a sentinel the caller reads as no limit '
        + 'among them',
      fn: async () => {
        expect(napCap({ typed: [], },),).toBe(DEFAULT_NAPS,);
        expect(wholeNumberFlag({
          args: [],
          flag: '--naps',
          unwritten: -1,
          leaveOffTo: 'nap without limit',
        },),).toBe(-1,);
      },
    },),
    it({
      name: 'READS zero, a leading zero and the largest whole number a double holds exactly as the numbers written',
      fn: async () => {
        expect(['0', '04', LARGEST,].map(function readsDigits(written,): number {
          return napCap({ typed: ['--naps', written,], },);
        },),).toEqual([0, 4, Number.MAX_SAFE_INTEGER,],);
      },
    },),
    it({
      name: 'REFUSES a minus sign before digits as a number below zero, saying what leaving the flag off does',
      fn: async () => {
        expect(refusalOf({
          read: function readsNegative(): void {
            napCap({ typed: ['--naps', '-3',], },);
          },
        },),).toBe('--naps cannot be below zero, and -3 is; leave it off to take the default of 12 naps',);
      },
    },),
    it({
      name: 'REFUSES what is no whole number written in digits, by the package\'s one rule: a word, a point, an '
        + 'exponent, a radix, a sign, a space, minus zero, which names no number below zero, and one past the '
        + 'exact range',
      fn: async () => {
        /**
         Numbers as an operator mistypes them.
         */
        const mistyped = [
          'fourty',
          '4.9',
          '1e1',
          '0x4',
          '+4',
          ' 4',
          '-0',
          String(BigInt(Number.MAX_SAFE_INTEGER,) + 2n,),
        ];
        expect(mistyped.map(function readsMistyped(written,): string {
          return refusalOf({
            read: function read(): void {
              napCap({ typed: ['--naps', written,], },);
            },
          },);
        },),).toEqual(mistyped.map(function expectedOf(written,): string {
          return `--naps needs a whole number written in digits, at most ${LARGEST}, and ${written} is not one`;
        },),);
      },
    },),
    it({
      name: 'REFUSES the flag written with nothing after it, rather than taking the default',
      fn: async () => {
        expect(refusalOf({
          read: function readsLast(): void {
            napCap({ typed: ['--naps',], },);
          },
        },),).toBe('--naps needs a value written after it',);
      },
    },),
  ],
},);

await describe({
  name: idListFlag.name,
  children: [
    it({
      name: 'ANSWERS with no entries when the flag is not written, which callers read as every entry',
      fn: async () => {
        expect(idListFlag({
          args: [],
          flag: '--only',
        },),).toEqual([],);
      },
    },),
    it({
      name: 'READS the entries named, dropping the gaps a stray comma leaves',
      fn: async () => {
        expect(idListFlag({
          args: ['--only', ',tabby,,ginger,',],
          flag: '--only',
        },),).toEqual(['tabby', 'ginger',],);
      },
    },),
    it({
      name: 'REFUSES separators that name no entry, which would read as every entry one line later, and the flag '
        + 'written with nothing after it',
      fn: async () => {
        expect([
          ['--only', ',',],
          ['--only', ',,',],
          ['--only',],
        ].map(function readsNobody(args,): string {
          return refusalOf({
            read: function read(): void {
              idListFlag({
                args,
                flag: '--only',
              },);
            },
          },);
        },),).toEqual([
          '--only needs at least one entry id, and , names none',
          '--only needs at least one entry id, and ,, names none',
          '--only needs a value written after it',
        ],);
      },
    },),
  ],
},);
