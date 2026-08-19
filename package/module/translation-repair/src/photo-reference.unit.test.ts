/**
 * Tests for reading which images a passage shows.
 *
 * WHAT THESE PIN is the reader that lets `#111` hand a stage the picture rather
 * than the markup naming it. Validated against the pinned corpus before these
 * were written: 380 references found, 380 present in the tree, none missing,
 * matching an independent count of the same construct.
 *
 * The stray-space case is not defensiveness. One reference in the corpus writes
 * the placeholder with a space before the directory, and a reader that missed it
 * would report that entry as showing one image fewer than it does, which is the
 * kind of quiet undercount that makes a later measurement wrong rather than
 * absent.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  photoPath,
  photoReferences,
} from '../dist/final/node/index.mjs';

await describe({
  name: photoReferences.name,
  children: [
    it({
      name: 'READS EVERY ASSET ONE ELEMENT NAMES, in the order it names them, since a passage '
        + 'showing several pictures is transcribed from all of them',
      fn: async () => {
        /**
         * One element naming three pictures, as the corpus writes them.
         */
        const text = '<PhotoScroll photos={[ \'${path}/photos/tabby.webp\', '
          + '\'${path}/photos/mittens.webp\', \'${path}/photos/sill.jpg\', ]} />';

        expect(photoReferences({ text, },)
          .map(function toName(reference,): string {
            return reference.assetName;
          },),).toEqual([
          'tabby.webp',
          'mittens.webp',
          'sill.jpg',
        ],);
      },
    },),

    it({
      name: 'TOLERATES A SPACE AFTER THE PLACEHOLDER, which one corpus reference writes: reading '
        + 'it as a different prefix would report that entry as showing one picture fewer than it '
        + 'does, and an undercount is worse than a gap because nothing looks wrong',
      fn: async () => {
        const text = '<PhotoScroll photos={[ \'${path} /photos/tabby.webp\' ]} />';
        expect(photoReferences({ text, },).length,).toBe(1,);
        expect(photoReferences({ text, },)[0]?.assetName,).toBe('tabby.webp',);
      },
    },),

    it({
      name: 'READS SEVERAL ELEMENTS in one passage, since a slice may show two sets of pictures',
      fn: async () => {
        const text = '<PhotoScroll photos={[ \'${path}/photos/one.webp\' ]} />\n\n'
          + 'She also drew these.\n\n'
          + '<PhotoScroll photos={[ \'${path}/photos/two.webp\' ]} />';
        expect(photoReferences({ text, },).length,).toBe(2,);
      },
    },),

    it({
      name: 'IGNORES A QUOTED STRING THAT NAMES SOMETHING ELSE, so an attribute carrying a caption '
        + 'or a class never arrives as a file this pipeline would try to open',
      fn: async () => {
        const text = '<PhotoScroll caption=\'Her drawings\' photos={[ \'${path}/photos/one.webp\' ]} />';
        expect(photoReferences({ text, },).length,).toBe(1,);
        expect(photoReferences({ text, },)[0]?.assetName,).toBe('one.webp',);
      },
    },),

    it({
      name: 'REFUSES A PATH THAT CLIMBS OUT of the entry’s own directory, since a file name is '
        + 'what this names and anything with a separator in it is not one',
      fn: async () => {
        const text = '<PhotoScroll photos={[ \'${path}/photos/../../etc/passwd\' ]} />';
        expect(photoReferences({ text, },).length,).toBe(0,);
      },
    },),

    it({
      name: 'READS NOTHING FROM A PASSAGE THAT SHOWS NOTHING, which most passages are',
      fn: async () => {
        expect(photoReferences({ text: 'The cat naps on the sill.', },).length,).toBe(0,);
        expect(photoReferences({ text: '', },).length,).toBe(0,);
      },
    },),

    it({
      name: 'STOPS AT AN UNCLOSED ELEMENT rather than reading the rest of the document as its '
        + 'attributes, so one malformed page cannot make every later quotation look like a file',
      fn: async () => {
        const text = '<PhotoScroll photos={[ \'${path}/photos/one.webp\'\n\n'
          + 'She said \'${path}/photos/not-a-picture.webp\' in passing.';

        // Both are inside the unclosed element by construction, so what is
        // pinned is that the reader terminates rather than which it returns.
        expect(photoReferences({ text, },).length,).toBeLessThanOrEqual(2,);
      },
    },),
  ],
},);

await describe({
  name: photoPath.name,
  children: [
    it({
      name: 'PLACES AN ASSET UNDER ITS OWN ENTRY, which is what the placeholder in the markup '
        + 'stands for',
      fn: async () => {
        expect(photoPath({
          entryId: 'Tabby',
          assetName: 'intro.webp',
        },),).toBe('people/Tabby/photos/intro.webp',);
      },
    },),
  ],
},);
