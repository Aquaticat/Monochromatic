import { swagger, } from '@elysiajs/swagger';
import {
  logtapeConfiguration,
  logtapeConfigure,
  logtapeGetLogger,
  mapIterableAsync,
  notNullishOrThrow,
  throws,
  unary,
} from '@monochromatic-dev/module-es';
import { Elysia, } from 'elysia';

import {
  parseOpml,
  parseRssFeed,
} from 'feedsmith';
import { findUp, } from 'find-up';
import { Window, } from 'happy-dom';
import { readFile, } from 'node:fs/promises';
import {
  dirname,
  join,
  resolve,
} from 'node:path';
import { fileURLToPath, } from 'node:url';
import { h, } from 'preact';
import { render, } from 'preact-render-to-string';
import { z, } from 'zod/v4-mini';

const window = new Window();
const document = window.document;

await logtapeConfigure(await logtapeConfiguration(),);

const l = logtapeGetLogger(['a', 'i',],);

const DEFAULT_PORT = 4112;
const PORT = z.coerce.number().parse(process.env.RSS_PORT ?? DEFAULT_PORT,);

const OPMLS = z.array(z.string(),).parse(process.env.OPMLS?.split(',',) ?? [],);

const DOT_ENV_PATH = await findUp('.env',);

// FIXME: Live update CSS and JS by using file watcher.
const INDEX_HTML_PATH = notNullishOrThrow(
  await findUp('index.html', { cwd: import.meta.dirname, },),
);

const INDEX_HTML_STRING = await readFile(INDEX_HTML_PATH, 'utf8',);

const STATIC_PATH = dirname(INDEX_HTML_PATH,);

document.write(INDEX_HTML_STRING,);
document.close();

const CSS_SUBPATH = notNullishOrThrow(document.querySelector('link',),).href;
const JS_SUBPATH = notNullishOrThrow(document.querySelector('script',),).src;

window
  .happyDOM
  .abort()
  .then(function logSuccess() {
    l.debug`success releasing happy dom`;
  },)
  // eslint-disable-next-line unicorn/prefer-top-level-await -- We don't really care.
  .catch(function logError() {
    l
      .debug`failed to release happy dom. This error has no effects other than taking up a bit more memory.`;
  },);

const CSS = await readFile(join(STATIC_PATH, CSS_SUBPATH,), 'utf8',);
const JS = await readFile(join(STATIC_PATH, JS_SUBPATH,), 'utf8',);

const opmlContents = await mapIterableAsync(
  async function getText(url: string,): Promise<string> {
    if (url.startsWith('file://',)) {
      const filePath = (url.startsWith('file:///',))
        ? fileURLToPath(url,)
        : DOT_ENV_PATH
        ? resolve(dirname(DOT_ENV_PATH,), url.slice('file://'.length,),)
        : throws(
          new Error('Could not find .env file when a relative url is specified',),
        );
      return await readFile(filePath, 'utf8',);
    }
    else if (['https://', 'http://',].some(unary(url.startsWith.bind(url,),),))
      return (await fetch(url,)).text();
    else
      throw new Error(`Unsupported URL scheme: ${url}`,);
  },
  OPMLS,
);

const parsedOpmls = opmlContents.map(unary(parseOpml,),);

const rssMetadatas = parsedOpmls
  .flatMap(function getOutlines(parsedOpmls,) {
    return notNullishOrThrow(notNullishOrThrow(parsedOpmls.body,).outlines,);
  },)
  .flatMap(function getInnerOutlines(outline,) {
    return notNullishOrThrow(outline.outlines,);
  },);

// l.info`${rssMetadatas}`;

const rsss: {
  rss: ReturnType<typeof parseRssFeed>;
  rssMetadata: typeof rssMetadatas[number];
}[] = await mapIterableAsync(
  async function fetchRss(rssMetadata: typeof rssMetadatas[number],) {
    const potentialiUrl = rssMetadata.xmlUrl;
    if (!potentialiUrl)
      l.warn`xmlUrl missing for ${JSON.stringify(rssMetadata,)}, silently ignored`;
    const url = notNullishOrThrow(potentialiUrl,);
    const rssText = await (await fetch(url,)).text();
    const rss = parseRssFeed(rssText,);
    return { rss, rssMetadata, };
  },
  rssMetadatas,
);

// l.info`${rsss}`;

const rssItems: {
  item: NonNullable<ReturnType<typeof parseRssFeed>['items']>[number];
  rssMetadata: typeof rssMetadatas[number];
  rss: Omit<ReturnType<typeof parseRssFeed>, 'items'>;
}[] = rsss.flatMap(function getItems({ rss, rssMetadata, },) {
  return notNullishOrThrow(rss.items,).map(function getItem(item,) {
    const rssWoItems = { ...rss, items: undefined, };
    return { item, rssMetadata, rss: rssWoItems, };
  },);
},);

// l.info`${rssItems}`;

const rssItemsWDate = rssItems.map(function useDate(rssItem,) {
  return {
    ...rssItem,
    item: {
      ...rssItem.item,
      pubDate: rssItem.item.pubDate
        ? new Date(rssItem.item.pubDate,)
        : new Date(0,),
    },
  };
},);

const rssItemsWLocaleDate = rssItemsWDate.map(function injectLocaleDate(rssItem,) {
  return {
    ...rssItem,
    item: { ...rssItem.item, pubLocaleDate: rssItem.item.pubDate.toLocaleString(), },
  };
},);

const sortedRssItems = rssItemsWLocaleDate.toSorted(function byDate(a, b,) {
  const aDate = a.item.pubDate;
  const bDate = b.item.pubDate;
  return bDate.getTime() - aDate.getTime();
},);

l.info`${sortedRssItems}`;

function rssItemToFeed({ item, rss, }: typeof sortedRssItems[number], index: number,) {
  return h(
    'li',
    { value: index, class: 'feed', },
    [
      h(
        'h2',
        { class: 'feed__title', },
        [
          h(
            'a',
            { class: 'feed__link', href: item.link || '#', },
            item
              .title || 'Untitled',
          ),
        ],
      ),

      h(
        'time',
        { class: 'feed__date', datetime: item.pubDate, },
        item
          .pubLocaleDate,
      ),
      h(
        'p',
        { class: 'feed__source', },
        [
          h(
            'span',
            { class: 'feed__rssTitle', },
            rss.title || 'Unknown',
          ),
          h(
            'span',
            { class: 'feed__rssDescription', },
            rss
              .description || 'Unknown',
          ),
        ],
      ),
      item.description
        ? h(
          'iframe',
          {
            class: 'feed__description',
            src: `data:text/html;charset=utf-8,${
              encodeURIComponent(
                `<style>${CSS}</style>${item.description}`,
              )
            }`,
            sandbox: '',
          },
        )
        : null,
    ],
  );
}

const app = new Elysia()
  .use(swagger(),)
  .get('/', new Response(
    `
    <!DOCTYPE html><html lang=en>
    <head>
    <meta charset=UTF-8>
    <meta name=viewport content='width=device-width,initial-scale=1.0'>
    <style>${CSS}</style>
    <script type=module>${JS.replaceAll(/<\/script>/gvi, '<\\/script>',)}</script>
    </head>
    <body>
    ${
      render(
        h('div', { id: 'app', }, [
          h(
            'h1',
            {},
            'RSS',
          ),
          h(
            'ul',
            { class: 'feeds', },
            sortedRssItems.map(unary(rssItemToFeed,),),
          ),
        ],),
      )
    }
    </body>
    </html>`,
    {
      headers: { 'Content-Type': 'text/html; charset=utf-8', },
    },
  ),)
  .listen(PORT,);

l.info`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`;
