/**
 Tests for reading an entry's `info.yml` at the pin.

 Every case asserts the whole observable value: the parsed record, the absence,
 the rethrown failure, or the one log line. Fixtures are cat-themed invention;
 no corpus content appears here.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  CorpusReadError,
  prepareDocumentPair,
  readEntryInfoRecord,
} from '../../dist/final/node/index.mjs';
import {
  capturingLogger,
  levelCapturingLogger,
} from '../capturing-logger.test-fixture.ts';

/**
 Pin the cases read at; the reader never touches the clone itself, since the test reader answers.

 @example
 ```ts
 const pin = { cloneDir: '/nonexistent', commitSha: 'deadbeef', };
 ```
 */
const PIN = {
  cloneDir: '/nonexistent',
  commitSha: 'deadbeef',
};

/**
 Reader of a pin whose commit has no `info.yml` for the entry.

 @returns Never; raises the corpus reader's refusal for a missing object

 @throws {@link CorpusReadError} always, the way the corpus reader refuses a path the commit lacks

 @example
 ```ts
 await missingInfoFixture();
 ```
 */
async function missingInfoFixture(): Promise<string> {
  throw new CorpusReadError({
    detail: 'people/tabby/info.yml',
    cause: { stderr: 'fatal: path \'people/tabby/info.yml\' does not exist in \'deadbeef\'', },
    commit: 'held',
  },);
}

//region Entry info record tests

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: readEntryInfoRecord.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'READS an entry info.yml at the pin and parses its nested info record',
          fn: async () => {
            /**
             Log lines the reader wrote, none on this path.
             */
            const messages: string[] = [];
            expect(await readEntryInfoRecord({
              pin: PIN,
              entryId: 'mittens',
              readFile: async function readFixture() {
                return 'info:\n  born: \'2019-05-02\'\n  died: \'2025-02-26\'\n';
              },
              l: capturingLogger({ messages, },),
            },),).toEqual({
              kind: 'read',
              info: {
                info: {
                  born: '2019-05-02',
                  died: '2025-02-26',
                },
              },
            },);
            expect(messages,).toEqual([],);
          },
        },),

        it({
          name: 'READS AN UNQUOTED DATE as the text it is written as, so a death written without quotes still sets lifeEnded on the prepared pair',
          fn: async () => {
            /**
             The record an info.yml with an unquoted date parses to.
             */
            const record = await readEntryInfoRecord({
              pin: PIN,
              entryId: 'mittens',
              readFile: async function readUnquoted() {
                return 'info:\n  born: 2019-05-02\n  died: 2025-02-26\n';
              },
              l: capturingLogger({ messages: [], },),
            },);
            expect(record,).toEqual({
              kind: 'read',
              info: {
                info: {
                  born: '2019-05-02',
                  died: '2025-02-26',
                },
              },
            },);
            if (record.kind !== 'read')
              throw new Error('the unquoted info.yml was recorded as absent',);
            expect(prepareDocumentPair({
              sourceText: '猫睡觉。\n',
              targetText: 'The cat naps.\n',
              sourceEntryInfo: record.info,
            },).lifeEnded,).toBe(true,);
          },
        },),

        it({
          name: 'READS A BARE YEAR as the number YAML makes of it, and a prepared pair built from it still records the death',
          fn: async () => {
            /**
             The record an info.yml with a bare year parses to.
             */
            const record = await readEntryInfoRecord({
              pin: PIN,
              entryId: 'mittens',
              readFile: async function readBareYear() {
                return 'info:\n  born: 2019\n  died: 2025\n';
              },
              l: capturingLogger({ messages: [], },),
            },);
            expect(record,).toEqual({
              kind: 'read',
              info: {
                info: {
                  born: 2_019,
                  died: 2_025,
                },
              },
            },);
            if (record.kind !== 'read')
              throw new Error('the bare-year info.yml was recorded as absent',);
            /**
             The pair prepared from that record.
             */
            const prepared = prepareDocumentPair({
              sourceText: '猫睡觉。\n',
              targetText: 'The cat naps.\n',
              sourceEntryInfo: record.info,
            },);
            expect(prepared.lifeEnded,).toBe(true,);
            expect(prepared.identityContext,).toBe('- died: the date this person died, as the corpus records it: "2025".',);
          },
        },),

        it({
          name: 'RECORDS an absence, and logs it, when the entry has no info.yml at the pin',
          fn: async () => {
            /**
             Log lines the reader wrote for the absence.
             */
            const messages: string[] = [];
            expect(await readEntryInfoRecord({
              pin: PIN,
              entryId: 'tabby',
              readFile: missingInfoFixture,
              l: capturingLogger({ messages, },),
            },),).toEqual({ kind: 'absent', },);
            expect(messages.map(function startsWithEntry(line,): boolean {
              return line.startsWith('ENTRY INFO entry=tabby: no info.yml at the pin',);
            },),).toEqual([true,],);
          },
        },),

        it({
          name: 'RECORDS an absence in silence when no logger is given, as a command with pinned terminal output reads it',
          fn: async () => {
            expect(await readEntryInfoRecord({
              pin: PIN,
              entryId: 'tabby',
              readFile: missingInfoFixture,
            },),).toEqual({ kind: 'absent', },);
          },
        },),

        it({
          name: 'REFUSES any other read failure by rethrowing the same error, which is no absence',
          fn: async () => {
            /**
             The failure the reader is given.
             */
            const failure = new CorpusReadError({
              detail: 'people/tabby/info.yml',
              cause: { stderr: 'fatal: unable to read tree', },
              commit: 'held',
            },);
            /**
             What the reader threw, if anything.
             */
            let caught: unknown = undefined;
            try {
              await readEntryInfoRecord({
                pin: PIN,
                entryId: 'tabby',
                readFile: async function brokenFixture() {
                  throw failure;
                },
                l: capturingLogger({ messages: [], },),
              },);
            }
            catch (error) {
              caught = error;
            }
            expect(caught === failure,).toBe(true,);
          },
        },),

        it({
          name: 'REFUSES an info.yml that is not YAML with an error naming the entry and where the parser stopped, '
            + 'quoting none of the file and carrying no parser error that does',
          fn: async () => {
            /**
             What the reader threw, if anything.
             */
            let caught: unknown = undefined;
            try {
              await readEntryInfoRecord({
                pin: PIN,
                entryId: 'mittens',
                readFile: async function unreadableFixture() {
                  return 'info: [\n';
                },
                l: capturingLogger({ messages: [], },),
              },);
            }
            catch (error) {
              caught = error;
            }
            expect(String(caught,),).toBe(
              'EntryInfoParseError: The info.yml of entry mittens at the pin refused to parse at line 2 column 1 (BAD_INDENT); '
                + 'corpus metadata parses upstream, so this signals corruption.',
            );
            expect(Error.isError(caught,) && (caught.cause === undefined),).toBe(true,);
            expect(Error.isError(caught,) && ('messageNamesOnly' in caught) && (caught.messageNamesOnly === true),).toBe(true,);
          },
        },),

        it({
          name: 'WARNS, naming the entry, the field and the kind, of a death YAML reads as a truth value, a list, a record or '
            + 'a number that is not finite, and still records the file as read',
          fn: async () => {
            await Promise.all([
              [
                'true',
                'a truth value',
              ],
              [
                '[2025, 2026]',
                'a list',
              ],
              [
                '{ year: 2025 }',
                'a record',
              ],
              [
                '.nan',
                'a number that is not finite',
              ],
              [
                '-.inf',
                'a number that is not finite',
              ],
            ].map(async function readUnreadableKind([written, kind,],): Promise<void> {
              /**
               Lines the reader wrote at their levels.
               */
              const lines: string[] = [];
              /**
               What the reader answered for this kind.
               */
              const record = await readEntryInfoRecord({
                pin: PIN,
                entryId: 'mittens',
                readFile: async function readKind() {
                  return `info:\n  died: ${written}\n`;
                },
                l: levelCapturingLogger({ lines, },),
              },);
              expect(record.kind,).toBe('read',);
              expect(lines,).toEqual([
                `warn ENTRY INFO entry=mittens: info.died is ${kind}, which is neither text nor a finite number, `
                + 'so no death is recorded for it',
              ],);
            },),);
          },
        },),

        it({
          name: 'SAYS NOTHING of a death that is text, a finite number, a blank value or absent, since each is a record or an '
            + 'absence and no unreadable kind',
          fn: async () => {
            await Promise.all([
              '\'2025-02-26\'',
              '2025',
              'null',
              '\'\'',
            ].map(async function readQuietKind(written,): Promise<void> {
              /**
               Lines the reader wrote at their levels.
               */
              const lines: string[] = [];
              await readEntryInfoRecord({
                pin: PIN,
                entryId: 'mittens',
                readFile: async function readKind() {
                  return `info:\n  died: ${written}\n`;
                },
                l: levelCapturingLogger({ lines, },),
              },);
              expect(lines,).toEqual([],);
            },),);
            /**
             Lines the reader wrote for an info record that holds no death at all.
             */
            const absentLines: string[] = [];
            await readEntryInfoRecord({
              pin: PIN,
              entryId: 'mittens',
              readFile: async function readNoDeath() {
                return 'info:\n  born: \'2019-05-02\'\n';
              },
              l: levelCapturingLogger({ lines: absentLines, },),
            },);
            expect(absentLines,).toEqual([],);
          },
        },),

        it({
          name: 'READS an unreadable death in silence when no logger is given, as a command with pinned terminal output reads it',
          fn: async () => {
            expect(await readEntryInfoRecord({
              pin: PIN,
              entryId: 'mittens',
              readFile: async function readTruthValue() {
                return 'info:\n  died: true\n';
              },
            },),).toEqual({
              kind: 'read',
              info: { info: { died: true, }, },
            },);
          },
        },),
      ],
    },),
  ],
},);

//endregion Entry info record tests
