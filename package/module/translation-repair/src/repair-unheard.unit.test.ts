/**
 * Tests for the repair lane's silence check.
 *
 * A slice nobody spoke about must carry the archive's own wording and claim no
 * change; anything else is a contradiction, and the two ways it can happen are
 * refused apart. Fixtures are cat-themed invention.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  assertUnheardKeptArchive,
  heardNobodyAbout,
  RepairUnheardError,
  type RepairVoiceRecord,
} from '../dist/final/node/index.mjs';

/**
 * Archive wording of the fixture slice.
 */
const ARCHIVE_TEXT = 'The tabby slept on the windowsill.';

/**
 * Slice nobody spoke about, carrying the archive wording.
 */
const SILENT: RepairVoiceRecord = {
  sliceIndex: 2,
  repairedText: ARCHIVE_TEXT,
  changed: false,
  heardCriticIds: [],
  refined: false,
};

await describe({
  name: heardNobodyAbout.name,
  children: [
    it({
      name: 'is true only when no critic answered and the naturalness lane did not rewrite',
      fn: async () => {
        expect(heardNobodyAbout({ outcome: SILENT, },),).toBe(true,);
        expect(heardNobodyAbout({
          outcome: {
            ...SILENT,
            heardCriticIds: ['hf:zai-org/GLM-5.2',],
          },
        },),).toBe(false,);
        expect(heardNobodyAbout({
          outcome: {
            ...SILENT,
            refined: true,
          },
        },),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: assertUnheardKeptArchive.name,
  children: [
    it({
      name: 'REFUSES a silent slice carrying a wording that is not the archive\'s, since something produced '
        + 'text no stage was recorded as having produced',
      fn: async () => {
        expect(function checksForeignWording(): void {
          assertUnheardKeptArchive({
            outcome: {
              ...SILENT,
              repairedText: 'The tabby napped on the windowsill.',
            },
            incumbentText: ARCHIVE_TEXT,
          },);
        },).toThrow(RepairUnheardError,);
      },
    },),

    it({
      name: 'REFUSES a silent slice that claims a change',
      fn: async () => {
        expect(function checksClaimedChange(): void {
          assertUnheardKeptArchive({
            outcome: {
              ...SILENT,
              changed: true,
            },
            incumbentText: ARCHIVE_TEXT,
          },);
        },).toThrow(RepairUnheardError,);
      },
    },),

    it({
      name: 'accepts a silent slice that kept the archive wording and claims nothing',
      fn: async () => {
        assertUnheardKeptArchive({
          outcome: SILENT,
          incumbentText: ARCHIVE_TEXT,
        },);
      },
    },),

    it({
      name: 'asks nothing of a slice somebody spoke about, whatever wording it carries',
      fn: async () => {
        assertUnheardKeptArchive({
          outcome: {
            ...SILENT,
            heardCriticIds: ['hf:zai-org/GLM-5.2',],
            repairedText: 'The tabby napped on the windowsill.',
            changed: true,
          },
          incumbentText: ARCHIVE_TEXT,
        },);
      },
    },),
  ],
},);
