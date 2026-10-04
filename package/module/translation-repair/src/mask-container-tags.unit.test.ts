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
        expect(maskLoneContainerTags({ text: '<3>\n', },).tags,).toEqual([],);
        expect(maskLoneContainerTags({ text: '</p x>\n', },).tags,).toEqual([],);
      },
    },),
  ],
},);

//endregion Mask container tags tests
