/**
 * Tests for how one settled artifact answers "which pipeline produced you".
 *
 * FOUR ANSWERS, NOT TWO, and the difference between them is what an operator
 * does next. A `placed` artifact belongs to a named generation. A `legacy` one
 * is a perfectly good result whose pipeline can no longer be named, and the
 * remedy is a fresh directory. An `untagged` one belongs nowhere and is
 * deleted. A `malformed` one belongs to the reader that reports malformed
 * files. Collapsing any pair of those tells an operator to delete good work or
 * to keep a file the pool would admit under a name its bytes never claimed.
 *
 * THE CENSUS IS THE ONLY CALLER, and it aggregates: it counts artifacts per
 * generation and reports totals. Every rule here reaches the suite as a count,
 * which is why a rule that placed a file in the wrong bucket could survive as
 * long as the total stayed right.
 *
 * THREE CASES PIN DOCUMENTED REGRESSIONS the module's own comments describe.
 * A tip of `HEAD` resolves against the READER's checkout rather than against
 * whatever produced the artifact. An artifact carrying no id at all used to
 * skip the identity check and be placed on its file name alone. A digest this
 * build cannot read is legacy rather than garbage, because the recorded value
 * names the scheme that produced it.
 *
 * DISPOSABLE FIXTURES ONLY: every case writes into its own `mkdtemp` directory
 * and nothing here reads a real run.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  mkdir,
  mkdtemp,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type Placement,
  readdirArtifacts,
  readPlacement,
} from '../../dist/final/node/index.mjs';

/**
 * Commit a fixture records, spelled the way git writes one.
 */
const FIXED_TIP = 'a'.repeat(40,);

/**
 * Same commit in the longer hash git also writes.
 */
const LONG_TIP = 'b'.repeat(64,);

/**
 * Built output a fixture records, in the scheme this build reads.
 */
const FIXED_DIGEST = `sha256-tree-v1:${'c'.repeat(64,)}`;

/**
 * Writes one disposable artifacts directory holding exactly these files.
 *
 * @param files - file name to raw contents, written verbatim so a case can
 * write something that is not JSON at all
 *
 * @returns Directory holding them
 *
 * @example
 * ```ts
 * const dir = await artifactsDirWith({ files: { 'Mittens.json': '{}', }, },);
 * ```
 */
async function artifactsDirWith(
  { files, }: { readonly files: Readonly<Record<string, string>>; },
): Promise<string> {
  /**
   * Disposable root for this case.
   */
  const dir = await mkdtemp(join(
    tmpdir(),
    'artifact-placement-',
  ),);

  await Promise.all(Object.entries(files,)
    .map(async function writeOne([
      name,
      text,
    ],): Promise<void> {
      await writeFile(
        join(
          dir,
          name,
        ),
        text,
        'utf8',
      );
    },),);
  return dir;
}

/**
 * Places one artifact written from a record, which is what a real one is.
 *
 * @param body - fields this artifact records
 *
 * @param name - file name to write it under, which the identity check reads
 *
 * @returns How it places
 *
 * @example
 * ```ts
 * const placement = await placementOf({ body: { id: 'Mittens', }, name: 'Mittens.json', },);
 * ```
 */
async function placementOf(
  {
    body,
    name = 'Mittens.json',
  }: {
    readonly body: unknown;
    readonly name?: string;
  },
): Promise<Placement> {
  return await readPlacement({
    artifactsDir: await artifactsDirWith({ files: { [name]: JSON.stringify(body,), }, },),
    name,
  },);
}

await describe({
  name: readPlacement.name,
  children: [
    it({
      name: 'PLACES an artifact recording its own name, a canonical commit '
        + 'and a digest this build reads, which is the control every other '
        + 'case departs from one field at a time',
      fn: async () => {
        expect(await placementOf({
          body: {
            id: 'Mittens',
            tip: FIXED_TIP,
            pipelineDigest: FIXED_DIGEST,
          },
        },),)
          .toEqual({
            kind: 'placed',
            tip: FIXED_TIP,
            digest: FIXED_DIGEST,
          },);
      },
    },),

    it({
      name: 'PLACES an artifact whose commit is the longer object id, since '
        + 'a repository hashing with SHA-256 writes identities of that length '
        + 'and they are no less canonical',
      fn: async () => {
        expect(await placementOf({
          body: {
            id: 'Mittens',
            tip: LONG_TIP,
            pipelineDigest: FIXED_DIGEST,
          },
        },),)
          .toEqual({
            kind: 'placed',
            tip: LONG_TIP,
            digest: FIXED_DIGEST,
          },);
      },
    },),

    it({
      name: 'reads an artifact recording no pipeline at all as LEGACY, not as '
        + 'unplaceable: it predates generation identity and is a sound result '
        + 'whose pipeline can no longer be named',
      fn: async () => {
        expect(await placementOf({
          body: {
            id: 'Mittens',
            tip: FIXED_TIP,
          },
        },),)
          .toEqual({
            kind: 'legacy',
            tip: FIXED_TIP,
          },);
      },
    },),

    it({
      name: 'reads a digest this build cannot parse as LEGACY, since the '
        + 'recorded value names the scheme that produced it and calling it '
        + 'unplaceable would tell an operator to delete good work',
      fn: async () => {
        expect(await placementOf({
          body: {
            id: 'Mittens',
            tip: FIXED_TIP,
            pipelineDigest: 'sha1-tree-v0:whiskers',
          },
        },),)
          .toEqual({
            kind: 'legacy',
            tip: FIXED_TIP,
          },);
      },
    },),

    it({
      name: 'REFUSES a commit spelled as a revision expression, because '
        + '`HEAD` resolves against the READER`s checkout at read time and so '
        + 'silently answers a different question than the one asked',
      fn: async () => {
        expect(await placementOf({
          body: {
            id: 'Mittens',
            tip: 'HEAD',
            pipelineDigest: FIXED_DIGEST,
          },
        },),)
          .toEqual({ kind: 'untagged', },);
      },
    },),

    it({
      name: 'REFUSES a commit in uppercase hex, since git writes lowercase '
        + 'and two spellings of one commit would count as two generations',
      fn: async () => {
        expect(await placementOf({
          body: {
            id: 'Mittens',
            tip: 'A'.repeat(40,),
            pipelineDigest: FIXED_DIGEST,
          },
        },),)
          .toEqual({ kind: 'untagged', },);
      },
    },),

    it({
      name: 'REFUSES a commit one character short of an object id, which is '
        + 'an abbreviation rather than an identity',
      fn: async () => {
        expect(await placementOf({
          body: {
            id: 'Mittens',
            tip: 'a'.repeat(39,),
            pipelineDigest: FIXED_DIGEST,
          },
        },),)
          .toEqual({ kind: 'untagged', },);
      },
    },),

    it({
      name: 'REFUSES a commit that is not a string at all',
      fn: async () => {
        expect(await placementOf({
          body: {
            id: 'Mittens',
            tip: 40,
            pipelineDigest: FIXED_DIGEST,
          },
        },),)
          .toEqual({ kind: 'untagged', },);
      },
    },),

    it({
      name: 'REFUSES an artifact recording no commit',
      fn: async () => {
        expect(await placementOf({
          body: {
            id: 'Mittens',
            pipelineDigest: FIXED_DIGEST,
          },
        },),)
          .toEqual({ kind: 'untagged', },);
      },
    },),

    it({
      name: 'REFUSES an artifact whose recorded id is not its file name, '
        + 'which is how `Mittens-copy.json` would otherwise become a second '
        + 'settled entry',
      fn: async () => {
        expect(await placementOf({
          body: {
            id: 'Mittens',
            tip: FIXED_TIP,
            pipelineDigest: FIXED_DIGEST,
          },
          name: 'Mittens-copy.json',
        },),)
          .toEqual({ kind: 'untagged', },);
      },
    },),

    it({
      name: 'REFUSES an artifact carrying NO id at all, rather than placing '
        + 'it on its file name. Guarding the comparison on the field being '
        + 'present let exactly this file skip the check, which is the one '
        + 'reading the check exists to refuse',
      fn: async () => {
        expect(await placementOf({
          body: {
            tip: FIXED_TIP,
            pipelineDigest: FIXED_DIGEST,
          },
        },),)
          .toEqual({ kind: 'untagged', },);
      },
    },),

    it({
      name: 'REFUSES a digest that is not a string, which no scheme could '
        + 'have written and so names nothing',
      fn: async () => {
        expect(await placementOf({
          body: {
            id: 'Mittens',
            tip: FIXED_TIP,
            pipelineDigest: 7,
          },
        },),)
          .toEqual({ kind: 'untagged', },);
      },
    },),

    it({
      name: 'REFUSES a file whose contents parse to something that is not an '
        + 'object, since a number carries no fields to read',
      fn: async () => {
        expect(await placementOf({ body: 42, },),)
          .toEqual({ kind: 'untagged', },);
      },
    },),

    it({
      name: 'REFUSES a file whose contents parse to null, which is an object '
        + 'by `typeof` and carries no fields either',
      fn: async () => {
        expect(await placementOf({ body: null, },),)
          .toEqual({ kind: 'untagged', },);
      },
    },),

    it({
      name: 'REFUSES a file whose name is nothing but the suffix, since the '
        + 'id it would be keyed by is the empty string',
      fn: async () => {
        expect(await readPlacement({
          artifactsDir: await artifactsDirWith({ files: { '.json': '{}', }, },),
          name: '.json',
        },),)
          .toEqual({ kind: 'untagged', },);
      },
    },),

    it({
      name: 'reports a file that is not JSON as MALFORMED, which is a '
        + 'different finding from unplaceable: it belongs to the reader that '
        + 'reports malformed files rather than to the operator who deletes',
      fn: async () => {
        expect(await readPlacement({
          artifactsDir: await artifactsDirWith({
            files: { 'Mittens.json': '{ "id": "Mittens", "tip"', },
          },),
          name: 'Mittens.json',
        },),)
          .toEqual({ kind: 'malformed', },);
      },
    },),

    it({
      name: 'reports a file that is not there as MALFORMED and does not '
        + 'throw. The read used to sit outside the guard, so a vanished file '
        + 'aborted the whole census, which now runs at pass startup',
      fn: async () => {
        expect(await readPlacement({
          artifactsDir: await artifactsDirWith({ files: {}, },),
          name: 'Vanished.json',
        },),)
          .toEqual({ kind: 'malformed', },);
      },
    },),

    it({
      name: 'reports a DIRECTORY named like an artifact as malformed rather '
        + 'than throwing EISDIR out of the census',
      fn: async () => {
        /**
         * Disposable root holding a directory where an artifact should be.
         */
        const dir = await artifactsDirWith({ files: {}, },);
        await mkdir(join(
          dir,
          'Mittens.json',
        ),);

        expect(await readPlacement({
          artifactsDir: dir,
          name: 'Mittens.json',
        },),)
          .toEqual({ kind: 'malformed', },);
      },
    },),
  ],
},);

await describe({
  name: readdirArtifacts.name,
  children: [
    it({
      name: 'lists every regular file, which is the control the skipping '
        + 'cases depart from',
      fn: async () => {
        expect([...await readdirArtifacts({
          artifactsDir: await artifactsDirWith({
            files: {
              'Mittens.json': '{}',
              'Tabby.json': '{}',
            },
          },),
        },),].toSorted(),)
          .toEqual([
            'Mittens.json',
            'Tabby.json',
          ],);
      },
    },),

    it({
      name: 'SKIPS a directory named like an artifact, which otherwise '
        + 'reached the read and threw EISDIR out of the whole census',
      fn: async () => {
        /**
         * Disposable root holding one artifact and one impostor directory.
         */
        const dir = await artifactsDirWith({ files: { 'Mittens.json': '{}', }, },);
        await mkdir(join(
          dir,
          'backup.json',
        ),);

        expect([...await readdirArtifacts({ artifactsDir: dir, },),],)
          .toEqual(['Mittens.json',],);
      },
    },),

    it({
      name: 'SKIPS a symbolic link, which was followed wherever it pointed '
        + 'and could duplicate another artifact under a second identity or '
        + 'leave the directory entirely',
      fn: async () => {
        /**
         * Disposable root holding one artifact and a link to it.
         */
        const dir = await artifactsDirWith({ files: { 'Mittens.json': '{}', }, },);
        await symlink(
          join(
            dir,
            'Mittens.json',
          ),
          join(
            dir,
            'Mittens-again.json',
          ),
        );

        expect([...await readdirArtifacts({ artifactsDir: dir, },),],)
          .toEqual(['Mittens.json',],);
      },
    },),

    it({
      name: 'lists nothing for a directory holding nothing, rather than '
        + 'refusing a run that has settled no entry yet',
      fn: async () => {
        expect([...await readdirArtifacts({
          artifactsDir: await artifactsDirWith({ files: {}, },),
        },),],)
          .toEqual([],);
      },
    },),
  ],
},);
