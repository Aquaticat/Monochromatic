/**
 Tests the failure a branch chain ends in for a union member it does not
 name. Fixtures are cat-themed invention.

 @module
 */

import {
  caught,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { refuseUnhandledMember, } from '../dist/final/node/index.mjs';

/**
 Runs the refusal with a member a caller's types would never let through.

 @param what - union named in the message

 @param member - value no branch handled

 @returns What the refusal raised

 @example
 ```ts
 const refusal = refusalFor({ what: 'cat mood', member: 'purring', },);
 ```
 */
function refusalFor(
  {
    what,
    member,
  }: {
    readonly what: string;
    readonly member: unknown;
  },
): unknown {
  return caught(function act(): unknown {
    return Reflect.apply(
      refuseUnhandledMember,
      undefined,
      [{
        what,
        member,
      },],
    );
  },);
}

await describe({
  name: refuseUnhandledMember.name,
  concurrency: 1,
  children: [
    it({
      name: 'NAMES THE UNION AND THE DISCRIMINANT of a member that carries one, and leaves its other fields out '
        + 'of the message',
      fn: async () => {
        /**
         What the refusal raised for a member carrying a kind and wording.
         */
        const refusal = refusalFor({
          what: 'cat mood',
          member: {
            kind: 'purring',
            wording: 'Mittens naps on the warm sill.',
          },
        },);

        expect(refusal,).toBeInstanceOf(Error,);
        expect(String(refusal,),).toBe('Error: unreachable: cat mood carries a member no branch handles: kind purring',);
      },
    },),
    it({
      name: 'NAMES THE RUNTIME TYPE of a member with no discriminant, and never prints a text member',
      fn: async () => {
        /**
         What the refusal raised for a text member.
         */
        const textRefusal = refusalFor({
          what: 'cat mood',
          member: 'Mittens naps on the warm sill.',
        },);

        /**
         What the refusal raised for a record with no kind.
         */
        const recordRefusal = refusalFor({
          what: 'cat mood',
          member: { wording: 'Mittens naps on the warm sill.', },
        },);

        expect(String(textRefusal,),).toBe('Error: unreachable: cat mood carries a member no branch handles: type string',);
        expect(String(recordRefusal,),).toBe('Error: unreachable: cat mood carries a member no branch handles: type object',);
      },
    },),
    it({
      name: 'NAMES THE RUNTIME TYPE of a member whose kind is not text, and never prints its sibling field',
      fn: async () => {
        /**
         What the refusal raised for a member whose kind is a number.
         */
        const refusal = refusalFor({
          what: 'cat mood',
          member: {
            kind: 7,
            wording: 'Mittens naps on the warm sill.',
          },
        },);

        expect(String(refusal,),).toBe('Error: unreachable: cat mood carries a member no branch handles: type object',);
      },
    },),
    it({
      name: 'NAMES THE RUNTIME TYPE of null and of an array, neither of which has a discriminant',
      fn: async () => {
        /**
         What the refusal raised for null.
         */
        const nullRefusal = refusalFor({
          what: 'cat mood',
          member: null,
        },);

        /**
         What the refusal raised for an array holding a record with a kind.
         */
        const arrayRefusal = refusalFor({
          what: 'cat mood',
          member: [{ kind: 'purring', },],
        },);

        expect(String(nullRefusal,),).toBe('Error: unreachable: cat mood carries a member no branch handles: type object',);
        expect(String(arrayRefusal,),).toBe('Error: unreachable: cat mood carries a member no branch handles: type object',);
      },
    },),
  ],
},);
