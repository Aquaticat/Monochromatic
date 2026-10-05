/**
 Tests for the lone container tag masker's tag read.

 A LINE IS A CONTAINER TAG AND NOTHING ELSE to be masked, and the read
 refuses the shapes that name no element: a name that is no letter word, and
 a closer carrying anything past its name.

 FIXTURES ARE CAT-THEMED.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  maskLoneContainerTags,
} from '../dist/final/node/index.mjs';

//region Mask container tags tests

await describe({
  name: maskLoneContainerTags.name,
  children: [
    it({
      name: 'READS NO TAG where the name starts with no letter and where a closer carries anything past '
        + 'its name, since neither names an element',
      fn: async () => {
        expect(maskLoneContainerTags({ text: '<3>\n', },),).toEqual({
          masked: '<3>\n',
          tags: [],
        },);
        expect(maskLoneContainerTags({ text: '</p x>\n', },),).toEqual({
          masked: '</p x>\n',
          tags: [],
        },);
      },
    },),

    it({
      name: 'MASKS A LONE CLOSER WITH A SPACE BEFORE ITS BRACKET as the closer of its element, since the strict '
        + 'grammar reads that spelling as closing the element and refuses it alone',
      fn: async () => {
        expect(maskLoneContainerTags({ text: 'A cat naps.\n\n</details >\n', },),).toEqual({
          masked: `A cat naps.\n\n${' '.repeat(11,)}\n`,
          tags: [{
            kind: 'close',
            name: 'details',
            text: '</details >',
            startOffset: 13,
            endOffset: 24,
          },],
        },);
      },
    },),

    it({
      name: 'MASKS A LONE CLOSER WITH A TAB BEFORE ITS BRACKET under the element\'s name alone, and an opener '
        + 'whose attribute follows a tab under its name alone',
      fn: async () => {
        expect(maskLoneContainerTags({ text: 'A cat naps.\n\n</details\t>\n', },),).toEqual({
          masked: `A cat naps.\n\n${' '.repeat(11,)}\n`,
          tags: [{
            kind: 'close',
            name: 'details',
            text: '</details\t>',
            startOffset: 13,
            endOffset: 24,
          },],
        },);
        expect(maskLoneContainerTags({ text: '<details\topen>\n\nA cat naps.\n', },),).toEqual({
          masked: `${' '.repeat(14,)}\n\nA cat naps.\n`,
          tags: [{
            kind: 'open',
            name: 'details',
            text: '<details\topen>',
            startOffset: 0,
            endOffset: 14,
          },],
        },);
      },
    },),

    it({
      name: 'PAIRS AN OPENER WITH A CLOSER WRITTEN WITH A SPACE OR A TAB BEFORE ITS BRACKET, so a whole element '
        + 'is masked nowhere',
      fn: async () => {
        expect(maskLoneContainerTags({ text: '<details>\n\nA cat naps.\n\n</details >\n', },),).toEqual({
          masked: '<details>\n\nA cat naps.\n\n</details >\n',
          tags: [],
        },);
        expect(maskLoneContainerTags({ text: '<details>\n\nA cat naps.\n\n</details\t>\n', },),).toEqual({
          masked: '<details>\n\nA cat naps.\n\n</details\t>\n',
          tags: [],
        },);
      },
    },),
  ],
},);

//endregion Mask container tags tests
