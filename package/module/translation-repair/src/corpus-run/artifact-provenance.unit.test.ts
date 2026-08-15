/**
 * Tests for proving loaded bytes are the artifact the pool admitted.
 *
 * The gap these close is structural rather than hypothetical: the pool is built
 * from one directory read and each artifact is loaded by a later one, while the
 * accumulation keeps writing. Every other outcome of that gap looks like
 * ordinary output, so the check refusing is the only way it is ever visible.
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
  abbreviate,
  assertArtifactProvenance,
} from '../../dist/final/node/index.mjs';

/**
 * One repo commit, as an object-id-shaped invention.
 */
const TIP = 'a41fc607ea5a70d8a7625cc67d5ed8c444f53379';

/**
 * One built pipeline, as a digest-shaped invention.
 */
const DIGEST = `sha256-tree-v1:${'c'.repeat(64,)}`;

await describe({
  name: abbreviate.name,
  children: [
    it({
      name: 'keeps an ordinary report short: ids differing early are shown at '
        + 'the floor of nine characters, so length is paid only when something '
        + 'actually collides',
      fn: async () => {
        const short = abbreviate({
          ids: [
            'a41fc607ea5a70d8a7625cc67d5ed8c444f53379',
            'b7d2e991400000000000000000000000000000000',
          ],
        },);

        expect(short({ id: 'a41fc607ea5a70d8a7625cc67d5ed8c444f53379', },),)
          .toBe('a41fc607e',);
      },
    },),

    it({
      name: 'GROWS past nine when two ids share a nine-character prefix, which '
        + 'is the whole reason this exists: a report whose two lines read alike '
        + 'is a report nobody can act on, and it is read precisely when a pool '
        + 'is suspected of spanning versions',
      fn: async () => {
        const short = abbreviate({
          ids: [
            `${'a'.repeat(9,)}0${'0'.repeat(30,)}`,
            `${'a'.repeat(9,)}1${'0'.repeat(30,)}`,
          ],
        },);

        expect(short({ id: `${'a'.repeat(9,)}0${'0'.repeat(30,)}`, },),)
          .toBe(`${'a'.repeat(9,)}0`,);
      },
    },),

    it({
      name: 'sizes commits and digests together, since both appear in one '
        + 'report and what has to stay distinguishable is whatever is printed '
        + 'side by side',
      fn: async () => {
        const short = abbreviate({
          ids: [
            TIP,
            DIGEST,
          ],
        },);

        expect(short({ id: DIGEST, },).length,).toBe(9,);
        expect(short({ id: TIP, },),).not
          .toBe(short({ id: DIGEST, },),);
      },
    },),

    it({
      name: 'stays at the floor when the same id was passed twice, rather than '
        + 'growing to full length chasing a difference that does not exist. Two '
        + 'lines reading alike is only a defect when they name different '
        + 'things, and a report listing one id twice is one report about one '
        + 'pipeline',
      fn: async () => {
        const short = abbreviate({
          ids: [
            TIP,
            TIP,
          ],
        },);

        expect(short({ id: TIP, },),).toBe('a41fc607e',);
      },
    },),

    it({
      name: 'grows for ids in a PREFIX relation, the one shape where the '
        + 'shorter id is indistinguishable from the start of the longer: this '
        + 'is what makes the search terminate on the full length rather than on '
        + 'a width that separates nothing',
      fn: async () => {
        const short = abbreviate({
          ids: [
            'a'.repeat(9,),
            'a'.repeat(10,),
          ],
        },);

        expect(short({ id: 'a'.repeat(10,), },),).toBe('a'.repeat(10,),);
      },
    },),
  ],
},);

await describe({
  name: assertArtifactProvenance.name,
  children: [
    it({
      name: 'passes when the bytes agree with the pool on all three, which is '
        + 'the ordinary path and must cost nothing',
      fn: async () => {
        assertArtifactProvenance({
          name: 'Mittens.json',
          observedId: 'Mittens',
          observedTip: TIP,
          observedDigest: DIGEST,
          expectedTip: TIP,
          expectedDigest: DIGEST,
        },);
      },
    },),

    it({
      name: 'REFUSES bytes whose recorded id is not the file name the pool '
        + 'keyed on, since the pool admits by file name while every reader '
        + 'downstream uses the id inside',
      fn: async () => {
        expect(function checks() {
          assertArtifactProvenance({
            name: 'Mittens.json',
            observedId: 'Pepper',
            observedTip: TIP,
            observedDigest: DIGEST,
            expectedTip: TIP,
            expectedDigest: DIGEST,
          },);
        },).toThrow('entry id',);
      },
    },),

    it({
      name: 'REFUSES bytes recording a different commit than the pool placed, '
        + 'which is what a file rewritten between the two reads looks like',
      fn: async () => {
        expect(function checks() {
          assertArtifactProvenance({
            name: 'Mittens.json',
            observedId: 'Mittens',
            observedTip: 'b'.repeat(40,),
            observedDigest: DIGEST,
            expectedTip: TIP,
            expectedDigest: DIGEST,
          },);
        },).toThrow('tip',);
      },
    },),

    it({
      name: 'REFUSES bytes recording a different PIPELINE even when the commit '
        + 'agrees, which the tip check alone cannot see: one commit covers any '
        + 'number of builds, so a file rewritten by another build passes a tip '
        + 'comparison exactly',
      fn: async () => {
        expect(function checks() {
          assertArtifactProvenance({
            name: 'Mittens.json',
            observedId: 'Mittens',
            observedTip: TIP,
            observedDigest: 'd'.repeat(64,),
            expectedTip: TIP,
            expectedDigest: DIGEST,
          },);
        },).toThrow('pipeline digest',);
      },
    },),

    it({
      name: 'accepts bytes the pool never placed while they are still '
        + 'unplaceable, because that is how a malformed artifact reaches the '
        + 'reader whose job is to report it',
      fn: async () => {
        assertArtifactProvenance({
          name: 'Mittens.json',
          observedId: 'Mittens',
          observedTip: '',
          observedDigest: '',
        },);
      },
    },),

    it({
      name: 'REFUSES bytes the pool called unplaceable that now read perfectly '
        + 'well. Absence is not "nothing to compare": the census said these '
        + 'bytes could not be placed, so bytes that place mean the file changed '
        + 'between the two reads, which is the race this check exists for. A '
        + 'half-written artifact is classified malformed and is valid moments '
        + 'later, and the reader would then count it having faced no generation '
        + 'check at all',
      fn: async () => {
        expect(function checks() {
          assertArtifactProvenance({
            name: 'Mittens.json',
            observedId: 'Mittens',
            observedTip: TIP,
            observedDigest: DIGEST,
          },);
        },).toThrow('admission',);
      },
    },),

    it({
      name: 'checks the tip alone when the pool carried no digest, so a caller '
        + 'holding only provenance still gets the check it can support rather '
        + 'than none at all',
      fn: async () => {
        expect(function checks() {
          assertArtifactProvenance({
            name: 'Mittens.json',
            observedId: 'Mittens',
            observedTip: 'b'.repeat(40,),
            observedDigest: DIGEST,
            expectedTip: TIP,
          },);
        },).toThrow('tip',);
      },
    },),
  ],
},);
