import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import { parse as parseYaml, } from 'yaml';

import {
  type CorpusPin,
  isMissingCorpusObject,
  type readCorpusFile,
} from '../corpus-source.ts';
import { refusalText, } from '../refusal-text.ts';

//region Entry info record
// THE ENTRY'S `info.yml` AT THE PIN, read where a preparation reads the entry's
// pages, because the date of death lives only there (`info.died`) and never in
// front matter. A missing file is a known state of the corpus (one entry has
// none), so it is named at info and recorded as no death, never thrown. The
// YAML is read with the same `yaml` parser the package reads front matter with.

/**
 What the pinned corpus holds for an entry's `info.yml`.

 @example
 ```ts
 const record: EntryInfoRecord = { kind: 'read', info: { info: { died: '2025-02-26', }, }, };
 ```
 */
export type EntryInfoRecord = {
  /**
   The entry has no `info.yml` at the pin, so it records no death.
   */
  readonly kind: 'absent';
} | {
  /**
   The entry's parsed `info.yml`, `unknown` because corpus metadata is hand-edited.
   */
  readonly kind: 'read';
  readonly info: unknown;
};

/**
 Reads one entry's `info.yml` at the pin and parses it.

 @param pin - corpus checkout and commit the entry is read at

 @param entryId - directory name of the entry

 @param readFile - document reader at the pin

 @param l - logger the absence is named on, left out by a command whose terminal
 output is pinned (the settled replays), which then records the absence in silence

 @returns The parsed record, or the absence when the entry has no `info.yml`

 @throws {@link Error} when the file exists but is not readable or not YAML

 @example
 ```ts
 const record = await readEntryInfoRecord({ pin, entryId: 'tabby', readFile: readCorpusFile, l, },);
 ```
 */
export async function readEntryInfoRecord(
  {
    pin,
    entryId,
    readFile,
    l,
  }: {
    readonly pin: CorpusPin;
    readonly entryId: string;
    readonly readFile: typeof readCorpusFile;
    readonly l?: Logger;
  },
): Promise<EntryInfoRecord> {
  try {
    /**
     Raw `info.yml` text at the pin.
     */
    const text = await readFile({
      pin,
      relPath: `people/${entryId}/info.yml`,
    },);
    return {
      kind: 'read',
      info: parseYaml(text,),
    };
  }
  catch (error) {
    if (!isMissingCorpusObject(error,))
      throw error;
    l?.info(`ENTRY INFO entry=${entryId}: no info.yml at the pin (${refusalText({ error, },)}), so no death is recorded for it`,);
    return { kind: 'absent', };
  }
}

//endregion Entry info record
