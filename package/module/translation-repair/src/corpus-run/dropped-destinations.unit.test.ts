/**
 * Tests for the document-level destination check.
 *
 * WHAT THESE PIN: the bare-run scanner stops where prose and Markdown stop a
 * link and sheds sentence punctuation; the tree reader finds link, image and
 * definition destinations under the pipeline's own parse and names a downgrade; the union
 * dedupes across both readers with a trailing slash treated as no difference;
 * and the check names exactly the source destinations the page lacks while
 * ignoring destinations the page adds.
 *
 * Fixtures are invented addresses and two sentences about a bookshop cat, so
 * there is no corpus text here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  collectDestinations,
  droppedDestinations,
  markdownDestinations,
  scanUrlRuns,
} from '../../dist/final/node/index.mjs';

//region Fixtures

/**
 * Address the source links to.
 */
const HOME = 'https://example.org/tabby';

/**
 * Second address, so order and counts can be checked.
 */
const ALBUM = 'https://example.org/album';

/**
 * Picture address, so the image reader is exercised.
 */
const PICTURE = 'https://example.org/tabby.jpg';

/**
 * How an archive rendered the home address another way.
 */
const MOVED = 'https://example.net/tabby';

//endregion Fixtures

await describe({
  name: scanUrlRuns.name,
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
  ],
},);

await describe({
  name: markdownDestinations.name,
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
  ],
},);

await describe({
  name: collectDestinations.name,
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
},);

await describe({
  name: droppedDestinations.name,
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
         * Source and archive, the archive linking the same reference elsewhere.
         */
        const sides = {
          sourceText: `她的主页：${HOME}。`,
          archiveText: `Her page is at ${MOVED}.`,
        };

        /**
         * Page keeping the archive's rendering.
         */
        const kept = droppedDestinations({
          ...sides,
          pageText: `Her page is at ${MOVED}, still.`,
        },);

        expect(kept.dropped,).toStrictEqual([],);
        expect(kept.findings,).toStrictEqual(['destinations-archive-rendering',],);

        /**
         * Page carrying neither rendering.
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
  ],
},);
