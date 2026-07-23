import {
  readdirSync,
  readFileSync,
} from 'node:fs';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

/** Effect-analysis production module directory. */
const EFFECT_SOURCE_DIRECTORY = new URL(
  'prefer-readonly-parameter-types/',
  import.meta.url,
);

/** Module-name fragments reserved for removed handwritten authorities. */
const FORBIDDEN_MODULE_NAME_FRAGMENTS = [
  'effect-catalog',
  'effect-authority',
  'evidence-table',
  'plain-data',
] as const;

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
        /** Forbidden handwritten authority module when present. */
        const forbiddenFileName = sourceFileNames.find(function hasForbiddenFragment(
          fileName,
        ): boolean {
          return FORBIDDEN_MODULE_NAME_FRAGMENTS.some(function includesFragment(
            fragment,
          ): boolean {
            return fileName.includes(fragment,);
          },);
        },);
        expect(forbiddenFileName,).toBe(undefined,);
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
