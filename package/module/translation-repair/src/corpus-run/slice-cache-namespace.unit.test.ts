/**
 * Tests for how three lanes share one cache directory without deleting each
 * other's files.
 *
 * WHY THIS FILE EXISTS. The repair lane's namespace is defined by SUBTRACTION:
 * it owns every file whose name is not claimed by a listed prefix. So a new
 * lane that invents a prefix and forgets to register it is silently adopted by
 * the repair lane, whose discard then deletes files it does not own while
 * logging that it discarded its own. That error has now cost four times, most
 * recently `picture.`, which was added to the store on 2026-08-19 and not to
 * the list: opening the repair cache removed a picture reading and reported
 * "discarding 1 cached slices".
 *
 * THE FIRST TEST WALKS THE PACKAGE'S OWN LIST, `EVERY_SLICE_NAMESPACE`, rather
 * than a copy of it. It used to keep a copy, and the copy drifted exactly the
 * way the registration it guards had: `contest.` and `pairing.` were missing
 * from both, so a repair-lane generation change deleted an entry's contest
 * ballots and its whole block pairing while reporting that it discarded its own
 * slices. A guard maintained by hand fails the same way as the thing it guards,
 * so it now reads the same array the store derives its claims from. The rest
 * pin the containment in both directions, since a namespace that claims too
 * much is as wrong as one that claims too little.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  belongsToNamespace,
  EVERY_SLICE_NAMESPACE,
  PICTURE_READING_NAMESPACE,
  REPAIR_SLICE_NAMESPACE,
  type SliceNamespace,
  TRANSLATE_SLICE_NAMESPACE,
} from '../../dist/final/node/index.mjs';

/**
 * A file name in a namespace, built the way the store builds one.
 *
 * @param namespace - lane whose prefix it carries
 *
 * @param key - cache key standing in for a hash
 *
 * @returns Name as it would sit on disk
 *
 * @example
 * ```ts
 * const name = fileIn({ namespace: PICTURE_READING_NAMESPACE, key: 'abc', },);
 * ```
 */
function fileIn(
  {
    namespace,
    key,
  }: {
    readonly namespace: SliceNamespace;
    readonly key: string;
  },
): string {
  return `${namespace.prefix}${key}.json`;
}

await describe({
  name: belongsToNamespace.name,
  children: [
    it({
      name: 'CLAIMS EVERY PREFIXED NAMESPACE THIS PACKAGE DEFINES, so a lane added without '
        + 'registering its prefix fails here rather than silently in production. The repair lane '
        + 'is defined by subtraction, so an unregistered prefix is adopted by it and deleted on '
        + 'the next generation change, which is the error this list has cost four times',
      fn: async () => {
        for (const namespace of EVERY_SLICE_NAMESPACE) {
          if (namespace.prefix === '')
            continue;

          /**
           * A file of this lane's, offered to the lane defined by subtraction.
           */
          const name = fileIn({
            namespace,
            key: 'whatever-hash',
          },);

          expect(belongsToNamespace({
            name,
            namespace: REPAIR_SLICE_NAMESPACE,
          },),).toBe(false,);
          expect(belongsToNamespace({
            name,
            namespace,
          },),).toBe(true,);
        }
      },
    },),

    it({
      name: 'REFUSES A PICTURE READING TO THE REPAIR LANE, which is the exact file the repair '
        + 'lane deleted before its prefix was registered',
      fn: async () => {
        /**
         * Name a stored picture reading carries.
         */
        const name = fileIn({
          namespace: PICTURE_READING_NAMESPACE,
          key: 'picture-hash-aaa',
        },);

        expect(belongsToNamespace({
          name,
          namespace: REPAIR_SLICE_NAMESPACE,
        },),).toBe(false,);
        expect(belongsToNamespace({
          name,
          namespace: TRANSLATE_SLICE_NAMESPACE,
        },),).toBe(false,);
        expect(belongsToNamespace({
          name,
          namespace: PICTURE_READING_NAMESPACE,
        },),).toBe(true,);
      },
    },),

    it({
      name: 'GIVES THE REPAIR LANE AN UNPREFIXED FILE, since it owns the names already on disk '
        + 'from before any lane had a prefix. A namespace that claims too little would strand '
        + 'every slice settled before the split',
      fn: async () => {
        expect(belongsToNamespace({
          name: 'plain-hash.json',
          namespace: REPAIR_SLICE_NAMESPACE,
        },),).toBe(true,);
        expect(belongsToNamespace({
          name: 'plain-hash.json',
          namespace: PICTURE_READING_NAMESPACE,
        },),).toBe(false,);
      },
    },),

    it({
      name: 'REFUSES A GENERATION MARKER TO EVERY LANE, since a marker is not a cached slice and '
        + 'a discard that swept one would erase the stamp it is about to compare against',
      fn: async () => {
        for (const namespace of EVERY_SLICE_NAMESPACE)
          for (const marker of EVERY_SLICE_NAMESPACE.map(function toMarker(one,): string {
            return one.marker;
          },))
            expect(belongsToNamespace({
              name: marker,
              namespace,
            },),).toBe(false,);
      },
    },),

    it({
      name: 'GIVES EVERY LANE A DISTINCT MARKER FILE, so one lane restamping its generation '
        + 'cannot retire another lane whose work is still current',
      fn: async () => {
        /**
         * Marker file name per lane, which must be as distinct as the prefixes.
         */
        const markers = EVERY_SLICE_NAMESPACE.map(function toMarker(one,): string {
          return one.marker;
        },);

        expect(new Set(markers,).size,).toBe(markers.length,);
      },
    },),
  ],
},);
