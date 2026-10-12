import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import { errorOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import { parse as parseYaml, } from 'yaml';

import {
  type CorpusPin,
  isMissingCorpusObject,
  type readCorpusFile,
} from '../corpus-source.ts';
import { yamlRefusalSite, } from '../front-matter.ts';
import { unreadableDeathKindOf, } from '../identity-context.ts';
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
 Signals an entry's `info.yml` that refuses to parse as YAML; corpus metadata
 parses upstream, so failure here indicates corruption.

 @example
 ```ts
 throw new EntryInfoParseError({ entryId: 'tabby', cause: error, },);
 ```
 */
export class EntryInfoParseError extends Error {
  /**
   Declares this message safe to forward: it names the entry and states where
   the parser stopped and what it called the fault, and repeats nothing the
   file says about the person.
   */
  readonly messageNamesOnly: true = true;

  /**
   Builds failure naming the entry and stating where YAML stopped, never what
   it read.

   DOES NOT CARRY THE PARSER ERROR AS `cause`, deliberately, for the reason
   `FrontMatterParseError` does not: a `YAMLParseError` message embeds a source
   code frame, and the file records a person's dates and handles.

   @param entryId - directory name of the entry, which the operator handed in

   @param cause - underlying YAML parser error, read for position and code

   @example
   ```ts
   new EntryInfoParseError({ entryId: 'tabby', cause: error, },);
   ```
   */
  public constructor(
    {
      entryId,
      cause,
    }: {
      readonly entryId: string;
      readonly cause: Readonly<Error>;
    },
  ) {
    super(
      `The info.yml of entry ${entryId} at the pin refused to parse ${
        yamlRefusalSite({ cause, },)
      }; corpus metadata parses upstream, so this signals corruption.`,
    );
    this.name = 'EntryInfoParseError';
  }
}

/**
 Parses an entry's `info.yml`, converting the parser's refusal into one that
 names the entry and quotes nothing.

 @param entryId - directory name of the entry

 @param text - raw `info.yml` text

 @returns The parsed value; corpus shapes vary, so no schema is imposed here

 @throws {@link EntryInfoParseError} when YAML refuses to parse

 @example
 ```ts
 const info = parseEntryInfoYaml({ entryId: 'tabby', text: 'info:\n  died: 2025-02-26\n', },);
 ```
 */
function parseEntryInfoYaml(
  {
    entryId,
    text,
  }: {
    readonly entryId: string;
    readonly text: string;
  },
): unknown {
  try {
    return parseYaml(text,);
  }
  catch (error) {
    // A REFUSAL IS AN ERROR: the parser throws a YAMLError, or a ReferenceError
    // or TypeError for an anchor fault, and nothing else, so a caught value that
    // is no Error is an unexpected state `errorOrThrow` fails on loudly.
    throw new EntryInfoParseError({
      entryId,
      cause: errorOrThrow(error,),
    },);
  }
}

/**
 Reads one entry's `info.yml` at the pin and parses it, saying so when its
 `died` holds a value the feature cannot read.

 @param pin - corpus checkout and commit the entry is read at

 @param entryId - directory name of the entry

 @param readFile - document reader at the pin

 @param l - logger the absence, and a `died` of an unreadable kind, are named on,
 left out by a command whose terminal output is pinned (the settled replays),
 which then reads both in silence

 @returns The parsed record, or the absence when the entry has no `info.yml`

 @throws {@link EntryInfoParseError} when the file exists and is not YAML

 @throws {@link Error} when the file exists but cannot be read

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
    /**
     The file as YAML parsed it.
     */
    const info = parseEntryInfoYaml({
      entryId,
      text,
    },);
    // A `died` OF A KIND THE FEATURE CANNOT READ is said here, once per entry,
    // where the entry and the logger are known: `recordedDeathOf` runs several
    // times per preparation and in replays with pinned output, and leaves the
    // value unrecorded either way.
    for (const kind of unreadableDeathKindOf({ entryInfo: info, },)) {
      l?.warn(
        `ENTRY INFO entry=${entryId}: info.died is ${kind}, which is neither text nor a finite number, `
          + 'so no death is recorded for it',
      );
    }
    return {
      kind: 'read',
      info,
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
