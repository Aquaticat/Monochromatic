import { swagger } from '@elysiajs/swagger';
import {
  logtapeConfiguration,
  logtapeConfigure,
  logtapeGetLogger,
  mapIterableAsync,
  notNullishOrThrow,
  throws,
  unary,
} from '@monochromatic-dev/module-es';
import { Elysia } from 'elysia';
import {
  parseOpml,
  parseRssFeed,
} from 'feedsmith';
import { findUp } from 'find-up';
import { readFile } from 'node:fs/promises';
import {
  dirname,
  type parse,
  resolve,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod/v4-mini';

await logtapeConfigure(await logtapeConfiguration());

const l = logtapeGetLogger(['a', 'i']);

const DEFAULT_PORT = 4112;
const PORT = z.coerce.number().parse(process.env.RSS_PORT ?? DEFAULT_PORT);

const OPMLS = z.array(z.string()).parse(process.env.OPMLS?.split(',') ?? []);

const DOT_ENV_PATH = await findUp('.env');

const opmlContents = await mapIterableAsync(
  async function getText(url: string): Promise<string> {
    if (url.startsWith('file://')) {
      const filePath = (url.startsWith('file:///'))
        ? fileURLToPath(url)
        : DOT_ENV_PATH
        ? resolve(dirname(DOT_ENV_PATH), url.slice('file://'.length))
        : throws(new Error('Could not find .env file when a relative url is specified'));
      return await readFile(filePath, 'utf8');
    } else if (['https://', 'http://'].some(unary(url.startsWith.bind(url)))) {
      return (await fetch(url)).text();
    } else {
      throw new Error(`Unsupported URL scheme: ${url}`);
    }
  },
  OPMLS,
);

const parsedOpmls = opmlContents.map(unary(parseOpml));

const rssMetadatas = parsedOpmls
  .flatMap(function getOutlines(parsedOpmls) {
    return notNullishOrThrow(notNullishOrThrow(parsedOpmls.body).outlines);
  })
  .flatMap(function getInnerOutlines(outline) {
    return notNullishOrThrow(outline.outlines);
  });

l.info`${rssMetadatas}`;

const rsss: {
  rss: ReturnType<typeof parseRssFeed>;
  rssMetadata: typeof rssMetadatas[number];
}[] = await mapIterableAsync(
  async function fetchRss(rssMetadata: typeof rssMetadatas[number]) {
    const potentialiUrl = rssMetadata.xmlUrl;
    if (!potentialiUrl) {
      l.warn`xmlUrl missing for ${JSON.stringify(rssMetadata)}, silently ignored`;
    }
    const url = notNullishOrThrow(potentialiUrl);
    l.info`Fetching ${url}`;
    const rssText = await (await fetch(url)).text();
    const rss = parseRssFeed(rssText);
    return { rss, rssMetadata };
  },
  rssMetadatas,
);

l.info`${rsss}`;

const rssItems: {
  item: NonNullable<ReturnType<typeof parseRssFeed>['items']>[number];
  rssMetadata: typeof rssMetadatas[number];
  rss: Omit<ReturnType<typeof parseRssFeed>, 'items'>;
}[] = rsss.flatMap(function getItems({ rss, rssMetadata }) {
  return notNullishOrThrow(rss.items).map(function getItem(item) {
    const rssWoItems = { ...rss, items: undefined };
    return { item, rssMetadata, rss: rssWoItems };
  });
});

l.info`${rssItems}`;

const sortedRssItems = rssItems.toSorted(function byDate(a, b) {
  const aDate = a.item.pubDate ? new Date(a.item.pubDate) : new Date(0);
  const bDate = b.item.pubDate ? new Date(b.item.pubDate) : new Date(0);
  return bDate.getTime() - aDate.getTime();
});

l.info`${sortedRssItems}`;

const app = new Elysia()
  .use(swagger())
  .get('/', function display() {
    return JSON.stringify(OPMLS);
  })
  .listen(PORT);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
