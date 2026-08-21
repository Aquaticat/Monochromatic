/**
 * Tests for the guard that keeps a declared name from being edited away.
 *
 * WHY IT IS A GUARD. Measured against the repair lane's own judge sheet and
 * roster, six of six judges preferred the candidate that dropped a declared
 * alias, and adding a carve-out to the criterion did not flip the vote. The
 * check therefore cannot live in a prompt.
 *
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  declaredNameForms,
  findDroppedDeclaredNames,
} from '../dist/final/node/index.mjs';

await describe({
  name: declaredNameForms.name,
  children: [
    it({
      name: 'SPLITS a comma-joined alias field into handles, longest first',
      fn: async () => {
        expect(declaredNameForms({
          identity: {
            name: 'Mittens',
            alias: 'Blossom, Patch',
          },
        },),).toEqual([ 'Mittens', 'Blossom', 'Patch', ],);
      },
    },),
    it({
      name: 'IGNORES the declared location, which is a place and not a name',
      fn: async () => {
        // A translation may render or omit a place, and demanding its survival
        // would refuse candidates that did nothing wrong.
        expect(declaredNameForms({
          identity: {
            name: 'Mittens',
            location: 'Windowsill, Kyoto',
          },
        },),).toEqual([ 'Mittens', ],);
      },
    },),
    it({
      name: 'DROPS a handle too short for its survival to mean anything',
      fn: async () => {
        expect(declaredNameForms({ identity: { name: 'Mo', }, },),).toEqual([],);
      },
    },),
    it({
      name: 'NAMES one form once when two fields declare it',
      fn: async () => {
        expect(declaredNameForms({
          identity: {
            name: 'Mittens',
            alias: 'Mittens',
          },
        },),).toEqual([ 'Mittens', ],);
      },
    },),
    it({
      name: 'REPORTS nothing when neither field is declared',
      fn: async () => {
        expect(declaredNameForms({ identity: {}, },),).toEqual([],);
      },
    },),
  ],
},);

await describe({
  name: findDroppedDeclaredNames.name,
  children: [
    it({
      name: 'NAMES a declared handle the base carried and the candidate lost',
      fn: async () => {
        expect(findDroppedDeclaredNames({
          forms: [ 'Mittens', 'Blossom', ],
          baseText: 'Mittens (Blossom) is a calico cat.',
          candidateText: 'Mittens is a calico cat.',
        },),).toEqual([ 'Blossom', ],);
      },
    },),
    it({
      name: 'REQUIRES nothing the base text never carried',
      fn: async () => {
        // THE CONSERVATIVE PROPERTY THIS RESTS ON. Only what was already there
        // has to stay, so this can refuse a real loss and can never demand that
        // a translator insert a name the passage never had.
        expect(findDroppedDeclaredNames({
          forms: [ 'Mittens', 'Blossom', ],
          baseText: 'She is a calico cat.',
          candidateText: 'She is a calico cat who naps.',
        },),).toEqual([],);
      },
    },),
    it({
      name: 'ACCEPTS a respelled handle, since spelling is not loss',
      fn: async () => {
        expect(findDroppedDeclaredNames({
          forms: [ 'Blossom', ],
          baseText: 'Blossom naps.',
          candidateText: 'blossom naps.',
        },),).toEqual([],);
      },
    },),
    it({
      name: 'REPORTS a lost long form ONCE, not once per fragment inside it',
      fn: async () => {
        // Losing `Mittens Blossom` should not read as two separate losses when
        // the shorter form only ever appeared inside the longer one.
        expect(findDroppedDeclaredNames({
          forms: [ 'Mittens Blossom', 'Blossom', ],
          baseText: 'Mittens Blossom naps on the sill.',
          candidateText: 'The cat naps on the sill.',
        },),).toEqual([ 'Mittens Blossom', ],);
      },
    },),
    it({
      name: 'STAYS quiet when every declared handle survives',
      fn: async () => {
        expect(findDroppedDeclaredNames({
          forms: [ 'Mittens', 'Blossom', ],
          baseText: 'Mittens (Blossom) naps.',
          candidateText: 'Blossom, also called Mittens, naps in the sun.',
        },),).toEqual([],);
      },
    },),
    it({
      name: 'SEES a handle the archive escaped for Markdown, which a raw substring comparison '
        + 'cannot: the underscores are written back-slashed and the declaration is not, so the '
        + 'guard would have called the name absent and skipped it entirely',
      fn: async () => {
        expect(findDroppedDeclaredNames({
          forms: [ 'Mittens_the_Cat', ],
          baseText: String.raw`Mittens\_the\_Cat naps on the sill.`,
          candidateText: 'The cat naps on the sill.',
        },),).toEqual([ 'Mittens_the_Cat', ],);
      },
    },),
    it({
      name: 'SEES a handle the two sides separate differently, one writing a space where the other '
        + 'writes an underscore, since a handle is one name however it is punctuated',
      fn: async () => {
        expect(findDroppedDeclaredNames({
          forms: [ 'Mittens Cat', ],
          baseText: 'Everyone called her Mittens_Cat back then.',
          candidateText: 'Everyone called her that back then.',
        },),).toEqual([ 'Mittens Cat', ],);
      },
    },),
    it({
      name: 'SEES a handle the archive spaces and the declaration runs together, which is the same '
        + 'disagreement in the other direction',
      fn: async () => {
        expect(findDroppedDeclaredNames({
          forms: [ 'MittensCat', ],
          baseText: 'Mittens Cat slept through it.',
          candidateText: 'She slept through it.',
        },),).toEqual([ 'MittensCat', ],);
      },
    },),
    it({
      name: 'ACCEPTS a handle whose diacritic is spelled the other way, since a combining mark is '
        + 'neither letter nor digit and would otherwise vanish from one side only, reporting a '
        + 'name lost that is sitting right there',
      fn: async () => {
        expect(findDroppedDeclaredNames({
          forms: [ 'Mitt\u00EBns', ],
          baseText: 'Mitte\u0308ns naps.',
          candidateText: 'Mitte\u0308ns naps in the sun.',
        },),).toEqual([],);
      },
    },),
    it({
      name: 'REPORTS that same handle as lost when it really goes, so the case above is the '
        + 'comparison working rather than the comparison never firing',
      fn: async () => {
        expect(findDroppedDeclaredNames({
          forms: [ 'Mitt\u00EBns', ],
          baseText: 'Mitte\u0308ns naps.',
          candidateText: 'The cat naps in the sun.',
        },),).toEqual([ 'Mitt\u00EBns', ],);
      },
    },),
  ],
},);
