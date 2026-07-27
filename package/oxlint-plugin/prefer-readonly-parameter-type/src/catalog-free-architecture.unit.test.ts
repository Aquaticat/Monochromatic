import {
  readdirSync,
  readFileSync,
} from 'node:fs';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  MEMBER_CHANNELS_BY_INTERFACE,
  VERIFIED_MEMBER_CHANNEL_COUNT,
} from '../dist/final/node/index.mjs';

/** Effect-analysis production module directory. */
const EFFECT_SOURCE_DIRECTORY = new URL(
  'prefer-readonly-parameter-types/',
  import.meta.url,
);

/** Module-name fragments reserved for removed handwritten authorities. */
const FORBIDDEN_MODULE_NAME_FRAGMENTS = [
  'effect-catalog',
  'authority',
  'evidence-table',
  'plain-data',
] as const;

/**
 * Authority modules permitted by an accepted decision, with their pinned size.
 *
 * The audit forbade handwritten effect catalogs outright. One amendment reopened
 * that for a single table, so this guard's subject narrows from "no authority
 * module" to "no authority module outside this registry", and the fragment match
 * widened from `effect-authority` to `authority` because the permitted module was
 * passing the old match by accident of naming rather than by permission.
 *
 * The pinned count is what gives the registry teeth. Checking that some test file
 * exists beside an authority would be a rubber stamp, satisfiable by an empty test.
 *
 * That count is a literal here on purpose. An earlier version imported
 * `VERIFIED_MEMBER_CHANNEL_COUNT` for it, which pinned that constant against itself
 * and enforced nothing: editing the table and the constant in one commit passed the
 * guard untouched, while this comment claimed an author had to change a number here.
 * A literal makes the claim true, at the cost of one more place to edit deliberately.
 *
 * This cannot verify that the enforcement is any good, and no test in this
 * repository could. It converts a silent addition into a deliberate one.
 */
const PERMITTED_AUTHORITY_MODULES: ReadonlyMap<string, {
  readonly decision: string;
  readonly enforcedBy: string;
  readonly entryCount: number;
}> = new Map([
  [
    'effect-member-channel-authority.ts',
    {
      decision: 'doc/decision/prefer-readonly-member-channel-authority.md',
      enforcedBy: 'effect-member-channel-authority.unit.test.ts',
      entryCount: 33,
    },
  ],
],);

/** Removed identifiers that could discharge unresolved effects. */
const FORBIDDEN_AUTHORITY_IDENTIFIERS = [
  'directDocumentedUncertain',
  'documentedUncertainParameterIndexes',
  'projectableMutableOwner',
  'intrinsicEffectCatalog',
  'packageEffectCatalog',
  'hostEffectAuthority',
] as const;

await describe({
  name: 'catalog-free effect architecture',
  children: [
    it({
      name: 'contains no handwritten authority module or removed opacity discharge',
      fn: async () => {
        /** Production module names under effect implementation. */
        const sourceFileNames = readdirSync(EFFECT_SOURCE_DIRECTORY,)
          .filter(function isTypeScriptSource(fileName,): boolean {
            return fileName.endsWith('.ts',);
          },);
        /** Authority-named modules outside the permitted registry. */
        const unregistered = sourceFileNames
          .filter(function hasForbiddenFragment(fileName,): boolean {
            return FORBIDDEN_MODULE_NAME_FRAGMENTS.some(function includesFragment(
              fragment,
            ): boolean {
              return fileName.includes(fragment,);
            },);
          },)
          .filter(function outsideRegistry(fileName,): boolean {
            return !PERMITTED_AUTHORITY_MODULES.has(fileName,);
          },);
        expect(unregistered,).toEqual([],);
        /* Every registered authority must still be present, so deleting one along
         * with its enforcement cannot quietly leave the registry describing a module
         * that no longer exists. */
        for (const [fileName, { enforcedBy, },] of PERMITTED_AUTHORITY_MODULES) {
          expect(sourceFileNames.includes(fileName,),).toBe(true,);
          expect(
            readdirSync(new URL('./', import.meta.url,),)
              .includes(enforcedBy,),
          ).toBe(true,);
        }
        /** Registry entry for the one permitted authority. */
        const memberChannelRegistration = PERMITTED_AUTHORITY_MODULES.get(
          'effect-member-channel-authority.ts',
        );
        if (memberChannelRegistration === undefined)
          throw new Error(
            'Expected the member-channel authority to stay registered, since the registry is what permits it.',
          );
        /* Both the table and the constant the module exports must match the literal
         * above, so growth fails here even when a commit edits table and constant
         * together. */
        expect(
          [...MEMBER_CHANNELS_BY_INTERFACE.values(),]
            .reduce(function sumEntries(total, members,): number {
              return total + members.size;
            }, 0,),
        ).toBe(memberChannelRegistration.entryCount,);
        expect(VERIFIED_MEMBER_CHANNEL_COUNT,).toBe(
          memberChannelRegistration.entryCount,
        );
        /** Production effect source combined for removed identifier checks. */
        const sourceText = sourceFileNames
          .map(function readSource(fileName,): string {
            return readFileSync(
              new URL(fileName, EFFECT_SOURCE_DIRECTORY,),
              'utf8',
            );
          },)
          .join('\n',);
        /** Removed authority identifier when present. */
        const forbiddenIdentifier = FORBIDDEN_AUTHORITY_IDENTIFIERS.find(
          function includesIdentifier(identifier,): boolean {
            return sourceText.includes(identifier,);
          },
        );
        expect(forbiddenIdentifier,).toBe(undefined,);
      },
    },),
  ],
},);
