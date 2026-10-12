import {
  type CorpusPin,
  isMissingCorpusObject,
  listCorpusPeople,
  readCorpusFile,
} from '../corpus-source.ts';

import { allInInputOrder, } from '../all-in-input-order.ts';
import { reportingRefusals, } from './cli-refusal.ts';
import {
  type EntryCensus,
  summarise,
} from './repeat-census-summary.ts';
import { packageGroupsOfPage, } from './repeat-census-package.ts';
import { censusOfPage, } from './repeat-census-page.ts';
import { readRunCorpusPinSetting, } from './run-config.ts';

//region Repeat census
// The repeated-wording census as a command: the wiring and the printed summary
// only. The line reading is `repeat-census-lines.ts`, and the corpus pin is the
// one every corpus read resolves against. READ-ONLY and keyless: it reads git
// objects at the pin and calls no model.

/**
 Reads the page of every entry at the pin, leaving out an entry without one.

 @param pin - corpus clone and commit

 @returns Entry id and page text for each entry that has a page

 @example
 ```ts
 const pages = await readPages({ pin, },);
 ```
 */
async function readPages(
  {
    pin,
  }: {
    readonly pin: CorpusPin;
  },
): Promise<readonly {
  readonly id: string;
  readonly text: string
}[]> {
  /**
   Entry ids at the pin.
   */
  const ids = await listCorpusPeople({ pin, },);
  /**
   Entry pages that exist at the pin, in the listing's order.
   */
  const pages = await allInInputOrder({
    members: ids.map(async function readPage(id,): Promise<
    readonly {
      readonly id: string;
      readonly text: string
    }[]
  > {
    try {
      /**
       Page text at the pin, with CRLF folded.
       */
      const text = await readCorpusFile({
        pin,
        relPath: `people/${id}/page.md`,
      },);
      return [{
        id,
        text,
      },];
    } catch (error) {
      if (isMissingCorpusObject(error,))
        return [];
      throw error;
    }
  },),
  },);
  return pages.flat();
}

/**
 Reads the pinned corpus, runs the census over each page, and prints the summary.

 @param pin - corpus clone and commit

 @throws {@link Error} when a corpus read fails for a reason other than a missing page

 @example
 ```ts
 await runRepeatCensus({ pin, },);
 ```
 */
async function runRepeatCensus(
  {
    pin,
  }: {
    readonly pin: CorpusPin;
  },
): Promise<void> {
  /**
   Entry pages at the pin.
   */
  const pages = await readPages({ pin, },);

  /**
   Census of every page.
   */
  const entries: EntryCensus[] = pages.map(function censusOf(page,): EntryCensus {
    return {
      id: page.id,
      census: censusOfPage({ text: page.text, },),
      groups: packageGroupsOfPage({ text: page.text, },),
    };
  },);
  console.log(JSON.stringify(
    summarise({ entries, },),
    null,
    1,
  ),);
}

if (import.meta.main)
  await reportingRefusals({
    what: 'repeat-census',
    argv: process.argv,
    env: process.env,
    run: function runRepeatCensusAtPin(): Promise<void> {
      /**
       Corpus clone and commit this run reads, read inside the refusal boundary.
       */
      const { pin, } = readRunCorpusPinSetting({ env: process.env, },);
      return runRepeatCensus({ pin, },);
    },
  },);

//endregion Repeat census
