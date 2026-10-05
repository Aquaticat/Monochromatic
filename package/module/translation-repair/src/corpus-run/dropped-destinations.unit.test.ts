/**
 Tests for the document-level destination check.

 WHAT THESE PIN: the bare-run scanner stops where prose and Markdown stop a
 link and sheds sentence punctuation; the tree reader finds link, image and
 definition destinations under the pipeline's own parse and names a downgrade,
 follows an explicit destination as written, cuts and sheds only an autolink
 literal the way the scanner does, and reads no destination where a link
 carries an empty one; the union dedupes across both readers with a trailing
 slash treated as no difference; the check names exactly the source
 destinations the page lacks while ignoring destinations the page adds; and
 the trace finds a dropped destination only in the slices that carry it as a
 destination of their own.

 Fixtures are invented addresses and sentences about a bookshop cat, so
 there is no corpus text here.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  collectDestinations,
  droppedDestinations,
  markdownDestinations,
  prepareDocumentPair,
  scanUrlRuns,
  traceDroppedDestinations,
} from '../../dist/final/node/index.mjs';

//region Fixtures

/**
 Address the source links to.
 */
const HOME = 'https://example.org/tabby';

/**
 Second address, so order and counts can be checked.
 */
const ALBUM = 'https://example.org/album';

/**
 Picture address, so the image reader is exercised.
 */
const PICTURE = 'https://example.org/tabby.jpg';

/**
 Address holding a balanced pair of parentheses, as an encyclopedia writes a title.
 */
const WIKI = 'https://cat.example/wiki/Tabby_(cat)';

/**
 How an archive rendered the home address another way.
 */
const MOVED = 'https://example.net/tabby';

/**
 Where each slice of a two-section pair carries a dropped destination, the
 second slice's row written as the given text and the first left as its
 archive span.

 @param dropped - destinations the page does not carry

 @param sourceText - original of two sections

 @param targetText - archive of the same two sections

 @param rowText - what the page writes over the second slice

 @returns One trace per dropped destination

 @example
 ```ts
 const traces = traceOverTwoSections({ dropped: ['.',], sourceText, targetText, rowText: 'The cat naps.', },);
 ```
 */
function traceOverTwoSections(
  {
    dropped,
    sourceText,
    targetText,
    rowText,
  }: {
    readonly dropped: readonly string[];
    readonly sourceText: string;
    readonly targetText: string;
    readonly rowText: string;
  },
): ReturnType<typeof traceDroppedDestinations> {
  return traceDroppedDestinations({
    dropped,
    slices: prepareDocumentPair({
      sourceText,
      targetText,
    },).slices,
    replacements: [{
      sliceIndex: 1,
      replacementText: rowText,
    },],
  },);
}

//endregion Fixtures

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: scanUrlRuns.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'ends a run at whitespace and at the Markdown delimiters around a destination',
          fn: async () => {
            expect(scanUrlRuns({ text: `see [her page](${HOME}) and ${ALBUM} too`, },),).toStrictEqual([
              HOME,
              ALBUM,
            ],);
          },
        },),

        it({
          name: 'sheds the sentence punctuation that follows a bare address',
          fn: async () => {
            expect(scanUrlRuns({ text: `Her page: ${HOME}.`, },),).toStrictEqual([HOME,],);
          },
        },),

        it({
          name: 'ends a run at the full-width punctuation Chinese prose sets a link off with',
          fn: async () => {
            expect(scanUrlRuns({ text: `她的主页：${HOME}，相册：${ALBUM}。`, },),).toStrictEqual([
              HOME,
              ALBUM,
            ],);
          },
        },),

        it({
          name: 'reads both schemes and nothing without one',
          fn: async () => {
            expect(scanUrlRuns({ text: 'http://example.org/a and https://example.org/b', },),).toStrictEqual([
              'http://example.org/a',
              'https://example.org/b',
            ],);
            expect(scanUrlRuns({ text: 'no address here, example.org is bare', },),).toStrictEqual([],);
          },
        },),

        it({
          name: 'READS the earlier scheme at every turn where the two schemes alternate',
          fn: async () => {
            expect(scanUrlRuns({
              text: 'see https://a.example and http://b.example then https://c.example and http://d.example too',
            },),).toStrictEqual([
              'https://a.example',
              'http://b.example',
              'https://c.example',
              'http://d.example',
            ],);
          },
        },),

        it({
          name: 'READS one run where a scheme directly follows a scheme, since no stopper parts them',
          fn: async () => {
            expect(scanUrlRuns({
              text: 'https://http://tabby.example/nap and http://https://tabby.example/purr',
            },),).toStrictEqual([
              'https://http://tabby.example/nap',
              'http://https://tabby.example/purr',
            ],);
          },
        },),

        it({
          name: 'PASSES OVER an http that opens no scheme and an https without both slashes, and reads the '
            + 'address after them',
          fn: async () => {
            expect(scanUrlRuns({
              text: 'the httpd log, then https tabby and https:/tabby, then http://tabby.example/nap',
            },),).toStrictEqual(['http://tabby.example/nap',],);
          },
        },),

        it({
          name: 'KEEPS the closing parenthesis that balances an opening one inside a bare address, as the parse '
            + 'does, and ends the run at one that balances none, and reads an unclosed pair to the next space',
          fn: async () => {
            expect(scanUrlRuns({
              text: `see ${WIKI} and (${WIKI}) and (see ${WIKI}.) and ${WIKI.slice(0, -1,)} here`,
            },),).toStrictEqual([
              WIKI,
              WIKI,
              WIKI,
              'https://cat.example/wiki/Tabby_(cat',
            ],);
          },
        },),

        it({
          name: 'ENDS a run at sentence punctuation that only closing parentheses follow, as the parse\'s trail '
            + 'rule does, and keeps punctuation an ordinary character follows',
          fn: async () => {
            expect(scanUrlRuns({
              text: 'see https://cat.example/a_(b.) and https://cat.example/c_(d.e) too',
            },),).toStrictEqual([
              'https://cat.example/a_(b',
              'https://cat.example/c_(d.e)',
            ],);
          },
        },),

        it({
          name: 'SHEDS the sentence punctuation before the stopper that ends a run',
          fn: async () => {
            expect(scanUrlRuns({
              text: 'see https://cat.example. and https://dog.example too',
            },),).toStrictEqual([
              'https://cat.example',
              'https://dog.example',
            ],);
          },
        },),
      ],
    },),

    describe({
      name: markdownDestinations.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'reads link, image and definition destinations in document order',
          fn: async () => {
            const read = markdownDestinations({
              text: `A [tabby](${HOME}) who kept ![the shop](${PICTURE}) company.\n\n[album]: ${ALBUM}\n`,
            },);

            expect(read,).toStrictEqual({
              urls: [
                HOME,
                PICTURE,
                ALBUM,
              ],
              findings: [],
            },);
          },
        },),

        it({
          name: 'DOWNGRADES a page the strict grammar refuses to plain markdown, as the pipeline does, '
            + 'and names the downgrade',
          fn: async () => {
            const read = markdownDestinations({ text: `A tabby <Unclosed who kept [her](${HOME})`, },);

            expect(read.urls,).toStrictEqual([HOME,],);
            expect(read.findings,).toStrictEqual(['destinations-mdx-downgraded',],);
          },
        },),

        it({
          name: 'reads a destination under the front matter and past an HTML comment, the way the page is parsed',
          fn: async () => {
            const read = markdownDestinations({
              text: `---\nname: tabby\n---\n\n<!-- a note -->\n\nA [tabby](${HOME}).\n`,
            },);

            expect(read,).toStrictEqual({
              urls: [HOME,],
              findings: [],
            },);
          },
        },),

        it({
          name: 'KEEPS a destination of sentence punctuation alone as written, the current directory, its '
            + 'parent and a bare query each apart',
          fn: async () => {
            expect(markdownDestinations({
              text: 'The [tabby](.) naps, the [kitten](..) plays and the [shop](?) opens.',
            },),).toStrictEqual({
              urls: [
                '.',
                '..',
                '?',
              ],
              findings: [],
            },);
          },
        },),

        it({
          name: 'KEEPS a destination that opens on a stopper as written',
          fn: async () => {
            expect(markdownDestinations({ text: 'The [tabby](《猫》) naps.', },),).toStrictEqual({
              urls: ['《猫》',],
              findings: [],
            },);
          },
        },),

        it({
          name: 'reads a destination of hyphens whole, which holds no stopper and no sentence punctuation',
          fn: async () => {
            expect(markdownDestinations({ text: 'see [cat](---) here', },),).toStrictEqual({
              urls: ['---',],
              findings: [],
            },);
          },
        },),

        it({
          name: 'FOLLOWS an explicit destination as written past a full-width comma and past trailing sentence '
            + 'punctuation, for a link, an image and a definition',
          fn: async () => {
            expect(markdownDestinations({
              text: 'The [first nap](./窗台，一) and the [second](./窗台，二) by ![the shop](./shop.).\n\n'
                + '[album]: ./相册，二\n',
            },),).toStrictEqual({
              urls: [
                './窗台，一',
                './窗台，二',
                './shop.',
                './相册，二',
              ],
              findings: [],
            },);
          },
        },),

        it({
          name: 'CUTS an autolink literal at its first stopper and sheds the punctuation before it, as the '
            + 'scanner reads the same run',
          fn: async () => {
            expect(markdownDestinations({ text: `她的主页：${HOME}，相册。\n\nHer page: ${ALBUM}.;，then\n`, },),)
              .toStrictEqual({
                urls: [
                  HOME,
                  ALBUM,
                ],
                findings: [],
              },);
          },
        },),

        it({
          name: 'KEEPS the balanced closing parenthesis of an autolink literal, a www literal included, '
            + 'as the parse reads its address',
          fn: async () => {
            expect(markdownDestinations({
              text: `见 ${WIKI}，然后。\n\nSee (${WIKI}) and www.cat.example/wiki/Tabby_(cat).\n`,
            },),).toStrictEqual({
              urls: [
                WIKI,
                WIKI,
                'http://www.cat.example/wiki/Tabby_(cat)',
              ],
              findings: [],
            },);
          },
        },),

        it({
          name: 'READS NO destination from a link, an image or a definition whose destination is empty',
          fn: async () => {
            expect(markdownDestinations({
              text: 'A [tabby]() who kept ![the shop]() company.\n\n[album]: <>\n',
            },),).toStrictEqual({
              urls: [],
              findings: [],
            },);
          },
        },),
      ],
    },),

    describe({
      name: collectDestinations.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'unions both readers and dedupes a destination the scanner sees again',
          fn: async () => {
            const { urls, findings, } = collectDestinations({
              text: `A [tabby](${HOME}) and later ${HOME}/ again, then ${ALBUM}.`,
              side: 'source',
            },);

            expect(urls,).toStrictEqual([
              HOME,
              ALBUM,
            ],);
            expect(findings,).toStrictEqual([],);
          },
        },),

        it({
          name: 'IGNORES a destination inside an HTML comment, which no reader can follow (class forty-six)',
          fn: async () => {
            const { urls, findings, } = collectDestinations({
              text: `A [tabby](${HOME}).\n\n<!-- [her keeper](${ALBUM}) -->\n\nThen ${PICTURE} again.`,
              side: 'source',
            },);

            expect(urls,).toStrictEqual([
              HOME,
              PICTURE,
            ],);
            expect(findings,).toStrictEqual([],);
          },
        },),

        it({
          name: 'still reads a bare run on a downgraded page and names the downgrade with its side',
          fn: async () => {
            const { urls, findings, } = collectDestinations({
              text: `A tabby <Unclosed who kept ${HOME}`,
              side: 'page',
            },);

            expect(urls,).toStrictEqual([HOME,],);
            expect(findings,).toStrictEqual(['destinations-mdx-downgraded (page)',],);
          },
        },),
      ],
    },),

    describe({
      name: droppedDestinations.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'names the source destination the page lacks, and nothing the page added',
          fn: async () => {
            const check = droppedDestinations({
              sourceText: `她的主页：${HOME}，相册：${ALBUM}。`,
              pageText: `Her album is at ${ALBUM}, and the shop's own site is https://example.org/shop.`,
            },);

            expect(check.source,).toStrictEqual([
              HOME,
              ALBUM,
            ],);
            expect(check.dropped,).toStrictEqual([HOME,],);
            expect(check.page,).toHaveLength(2,);
            expect(check.findings,).toStrictEqual([],);
          },
        },),

        it({
          name: 'ACCEPTS a page writing bare the address a source links explicitly, and the reverse, where the '
            + 'address holds a balanced pair of parentheses',
          fn: async () => {
            expect(droppedDestinations({
              sourceText: `See [the wiki](${WIKI}) now.`,
              pageText: `See ${WIKI} now.`,
            },).dropped,).toStrictEqual([],);
            expect(droppedDestinations({
              sourceText: `See ${WIKI} now.`,
              pageText: `See [the wiki](${WIKI}) now.`,
            },).dropped,).toStrictEqual([],);
          },
        },),

        it({
          name: 'ACCEPTS a page carrying every source destination, a trailing slash notwithstanding',
          fn: async () => {
            const check = droppedDestinations({
              sourceText: `[主页](${HOME})`,
              pageText: `[her page](${HOME}/)`,
            },);

            expect(check.dropped,).toStrictEqual([],);
          },
        },),

        it({
          name: 'ACCEPTS the archive rendering of a source destination and names it, REFUSES neither',
          fn: async () => {
            /**
             Source and archive, the archive linking the same reference elsewhere.
             */
            const sides = {
              sourceText: `她的主页：${HOME}。`,
              archiveText: `Her page is at ${MOVED}.`,
            };

            /**
             Page keeping the archive's rendering.
             */
            const kept = droppedDestinations({
              ...sides,
              pageText: `Her page is at ${MOVED}, still.`,
            },);

            expect(kept.dropped,).toStrictEqual([],);
            expect(kept.findings,).toStrictEqual(['destinations-archive-rendering',],);

            /**
             Page carrying neither rendering.
             */
            const lost = droppedDestinations({
              ...sides,
              pageText: 'Her page is gone.',
            },);

            expect(lost.dropped,).toStrictEqual([HOME,],);
            expect(lost.findings,).toStrictEqual([],);
          },
        },),

        it({
          name: 'names a downgraded archive with its side',
          fn: async () => {
            const check = droppedDestinations({
              sourceText: `[主页](${HOME})`,
              pageText: `[her page](${HOME})`,
              archiveText: `A tabby <Unclosed who kept ${HOME}`,
            },);

            expect(check.dropped,).toStrictEqual([],);
            expect(check.findings,).toStrictEqual(['destinations-mdx-downgraded (archive)',],);
          },
        },),

        it({
          name: 'OWES nothing for a source destination that sits inside an HTML comment (class forty-six, shi_Yumiaoya1)',
          fn: async () => {
            const check = droppedDestinations({
              sourceText: `她的主页：${HOME}。\n\n<!-- [饲主](${ALBUM}) -->\n`,
              pageText: `Her home page: ${HOME}.\n`,
            },);

            expect(check.source,).toStrictEqual([HOME,],);
            expect(check.dropped,).toStrictEqual([],);
          },
        },),

        it({
          name: 'reports nothing dropped and nothing found when neither side links anywhere',
          fn: async () => {
            const check = droppedDestinations({
              sourceText: '一只虎斑猫。',
              pageText: 'A tabby.',
            },);

            expect(check,).toStrictEqual({
              source: [],
              page: [],
              dropped: [],
              findings: [],
            },);
          },
        },),

        it({
          name: 'NAMES the parent directory a page dropped while it kept the current directory',
          fn: async () => {
            const check = droppedDestinations({
              sourceText: '猫在[窗台](..)上，狗在[垫子](.)上。',
              pageText: 'The cat is on the sill, the dog on the [mat](.).',
            },);

            expect(check,).toStrictEqual({
              source: [
                '..',
                '.',
              ],
              page: ['.',],
              dropped: ['..',],
              findings: [],
            },);
          },
        },),

        it({
          name: 'NAMES the second of two explicit links that differ only past a full-width comma, where the '
            + 'page keeps the first',
          fn: async () => {
            expect(droppedDestinations({
              sourceText: '猫在[一号窗台](./窗台，一)和[二号窗台](./窗台，二)上。',
              pageText: 'The cat is on [sill one](./窗台，一).',
            },),).toStrictEqual({
              source: [
                './窗台，一',
                './窗台，二',
              ],
              page: ['./窗台，一',],
              dropped: ['./窗台，二',],
              findings: [],
            },);
          },
        },),

        it({
          name: 'OWES nothing for a source link whose destination is empty, which names nowhere a reader '
            + 'could follow',
          fn: async () => {
            const check = droppedDestinations({
              sourceText: '猫在[窗台]()上。',
              pageText: 'The cat is on the sill.',
            },);

            expect(check,).toStrictEqual({
              source: [],
              page: [],
              dropped: [],
              findings: [],
            },);
          },
        },),
      ],
    },),

    describe({
      name: traceDroppedDestinations.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'TRACES a dropped address only to the slices where it stands whole, never to one holding a '
            + 'longer address it opens',
          fn: async () => {
            expect(traceOverTwoSections({
              dropped: [HOME,],
              sourceText: `## 一\n\n猫的相册在 ${HOME}-album 。\n\n## 二\n\n猫的[主页](${HOME})。\n`,
              targetText: `## One\n\nHer album is at ${HOME}-album .\n\n## Two\n\nHer [home page](${HOME}).\n`,
              rowText: '## Two\n\nHer home page is gone.\n',
            },),).toStrictEqual([{
              sourceSlices: [1,],
              archiveSlices: [1,],
              shippedSlices: [],
            },],);
          },
        },),

        it({
          name: 'TRACES a dropped destination as short as a full stop only to the slices that link it, not to '
            + 'every slice holding a sentence',
          fn: async () => {
            expect(traceOverTwoSections({
              dropped: ['.',],
              sourceText: '## 一\n\n猫睡了。\n\n## 二\n\n猫在[窗台](.)上。\n',
              targetText: '## One\n\nThe cat slept.\n\n## Two\n\nThe cat is on the [sill](.).\n',
              rowText: '## Two\n\nThe cat is on the sill.\n',
            },),).toStrictEqual([{
              sourceSlices: [1,],
              archiveSlices: [1,],
              shippedSlices: [],
            },],);
          },
        },),
      ],
    },),
  ],
},);
