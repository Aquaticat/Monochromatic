/**
 Guards ledger B28: a sheet whose text names the DECLARED NAMES block carries
 the page's declared names, and one naming CITED REFERENCES carries the cited
 pages, as the rendered-sheets fixtures render every sheet with the context
 production gives it.

 WHY THIS EXISTS. The house rules every writer and judge carries tell it to
 read a pronoun line and footnote vocabulary in a DECLARED NAMES block. The
 archive block review, coverage, the page title lexicon and the refine slates
 carried those rules and never got the block, and the fixture rendered them
 without it too, so no guard reading the rendered sheets could tell. A new
 sheet carrying the house rules now fails here until its caller threads the
 names and the fixture renders them, or it joins the exemptions with a reason.

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { renderedSheets, } from './rendered-sheets.test-fixture.ts';
import {
  IDENTITY,
  REFERENCES,
} from './rendered-sheets-texts.test-fixture.ts';

/**
 Heading every sheet's rules call the declared names by.
 */
const DECLARED_NAMES = 'DECLARED NAMES';

/**
 Heading every sheet's rules call the cited pages by.
 */
const CITED_REFERENCES = 'CITED REFERENCES';

/**
 Sheets that name the DECLARED NAMES block and rightly carry none, each with
 why.
 */
const WITHOUT_DECLARED_NAMES: Readonly<Record<string, string>> = {
  'house policy': 'the house rules themselves, rendered alone so a guard can read them; every sheet carrying them '
    + 'is checked here',
  'restoration judge': 'a measurement probe over seeded wordings, which asks about planted restorations rather '
    + 'than a page\'s own names, and whose builder takes no declared names',
};

/**
 Sheets that name CITED REFERENCES and rightly carry none, each with why.
 */
const WITHOUT_CITED_REFERENCES: Readonly<Record<string, string>> = {};

/**
 Whether a sheet carries a block's content as the model reads it: written out,
 or inside a JSON string, as the typed decision's state carries its evidence.

 @param text - rendered sheet

 @param content - block content

 @returns Whether either form is in the sheet

 @example
 ```ts
 carries({ text: sheet.text, content: REFERENCES, },);
 ```
 */
function carries({ text, content, }: { readonly text: string; readonly content: string; },): boolean {
  return text.includes(content,) || text.includes(JSON.stringify(content,).slice(1, -1,),);
}

/**
 Names of the rendered sheets that name a block and do not carry it, the
 exempt ones aside.

 @param heading - block heading the sheet's text names

 @param content - block content the fixture hands every sheet that gets it

 @param exempt - sheets that rightly carry none

 @returns Sheet names, in fixture order

 @example
 ```ts
 const missing = namingWithout({ heading: DECLARED_NAMES, content: IDENTITY, exempt: WITHOUT_DECLARED_NAMES, },);
 ```
 */
function namingWithout(
  {
    heading,
    content,
    exempt,
  }: {
    readonly heading: string;
    readonly content: string;
    readonly exempt: Readonly<Record<string, string>>;
  },
): readonly string[] {
  return renderedSheets()
    .filter(function namesButLacks(sheet,): boolean {
      return (sheet.text.includes(heading,))
        && (!carries({ text: sheet.text, content, },))
        && (!Object.hasOwn(exempt, sheet.name,));
    },)
    .map(function nameOf(sheet,): string {
      return sheet.name;
    },);
}

await describe({
  name: 'rendered sheets carry the blocks their rules name (ledger B28)',
  children: [
    it({
      name: 'CARRIES THE DECLARED NAMES on every sheet whose text names the block, the exempt ones aside',
      fn: async () => {
        /**
         Sheets that name the block at all, so an empty result means something.
         */
        const naming = renderedSheets().filter(function names(sheet,): boolean {
          return sheet.text.includes(DECLARED_NAMES,);
        },);
        expect(naming.length,).toBeGreaterThan(Object.keys(WITHOUT_DECLARED_NAMES,).length,);
        expect(namingWithout({ heading: DECLARED_NAMES, content: IDENTITY, exempt: WITHOUT_DECLARED_NAMES, },),)
          .toEqual([],);
      },
    },),
    it({
      name: 'CARRIES THE CITED REFERENCES on every sheet whose text names them, the exempt ones aside',
      fn: async () => {
        /**
         Sheets that name the references at all, so an empty result means something.
         */
        const naming = renderedSheets().filter(function names(sheet,): boolean {
          return sheet.text.includes(CITED_REFERENCES,);
        },);
        expect(naming.length,).toBeGreaterThan(Object.keys(WITHOUT_CITED_REFERENCES,).length,);
        expect(namingWithout({ heading: CITED_REFERENCES, content: REFERENCES, exempt: WITHOUT_CITED_REFERENCES, },),)
          .toEqual([],);
      },
    },),
    it({
      name: 'EXEMPTS ONLY SHEETS THAT EXIST AND NAME THE BLOCK, so a renamed or reworded sheet does not keep an '
        + 'exemption it no longer needs',
      fn: async () => {
        /**
         Every rendered sheet, by name.
         */
        const byName = new Map(renderedSheets().map(function entry(sheet,): readonly [string, string] {
          return [sheet.name, sheet.text,];
        },),);
        /**
         Exemptions naming no rendered sheet, or a sheet that does not name the block.
         */
        const stale = [
          ...Object.keys(WITHOUT_DECLARED_NAMES,).filter(function staleNames(name,): boolean {
            return !(byName.get(name,) ?? '').includes(DECLARED_NAMES,);
          },),
          ...Object.keys(WITHOUT_CITED_REFERENCES,).filter(function staleReferences(name,): boolean {
            return !(byName.get(name,) ?? '').includes(CITED_REFERENCES,);
          },),
        ];
        expect(stale,).toEqual([],);
      },
    },),
  ],
},);
