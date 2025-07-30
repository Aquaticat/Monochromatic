import { staticPlugin, } from '@elysiajs/static';
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
import { readFile, } from 'node:fs/promises';
import {
  dirname,
  join,
  resolve,
} from 'node:path';
import { fileURLToPath, } from 'node:url';
import {
  createSSRApp,
  h,
} from 'vue';
import { renderToString, } from 'vue/server-renderer';
import { z, } from 'zod/v4-mini';

await logtapeConfigure(await logtapeConfiguration(),);

const l = logtapeGetLogger(['a', 'i',],);

const DEFAULT_PORT = 4112;
const PORT = z.coerce.number().parse(process.env.RSS_PORT ?? DEFAULT_PORT,);

const OPMLS = z.array(z.string(),).parse(process.env.OPMLS?.split(',',) ?? [],);

const DOT_ENV_PATH = await findUp('.env',);

const PUBLIC_PATH = notNullishOrThrow(await findUp('public', { type: 'directory', },),);

const CSS = await readFile(join(PUBLIC_PATH, 'index.css',), 'utf8',);

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

function rssItemToFeed({ item, rss, }: typeof sortedRssItems[number],
  index: number,): ReturnType<typeof h>
{
  return h(
    'li',
    { key: index, class: 'feed', },
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
            src: `data:text/html;charset=utf-8,$$${
              encodeURIComponent(
                `<style>$${CSS}</style>$${item.description}`,
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
  .use(staticPlugin(),)
  .get('/', async function display() {
    // Create Vue SSR app
    const vueApp = createSSRApp({
      render() {
        return h('html', { lang: 'en', }, [
          h('head', [
            h('meta', { charset: 'UTF-8', },),
            h('meta', {
              name: 'viewport',
              content: 'width=device-width, initial-scale=1.0',
            },),
            h('title', 'RSS',),
            h('link', {
              rel: 'stylesheet',
              href: '/public/index.css',
              type: 'text/css',
            },),
          ],),
          h('body', [
            h(
              'h1',
              'RSS',
            ),
            h(
              'ul',
              { class: 'feeds', },
              sortedRssItems.map(unary(rssItemToFeed,),),
            ),
          ],),
        ],);
      },
    },);

    // Render to HTML string
    const html = await renderToString(vueApp,);

    return new Response(`<!DOCTYPE html>${html}`, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', },
    },);
  },)
  .listen(PORT,);

l.info`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`;
