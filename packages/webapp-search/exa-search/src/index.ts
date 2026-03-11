import { H3, defineHandler, serve, } from 'h3';
import { indexHtml, } from './asset.ts';
import { l as parentLogger, } from './log.ts';
import { PORT, } from './port.ts';
import { $ as tagged, } from '@monochromatic-dev/module-es/tagged';

const l = tagged({ tag: 'server', l: parentLogger, },);

const app = new H3();

/**
 * Serves the single-page exa-search application HTML.
 */
app.get(
  '/',
  defineHandler(() => {
    return new Response(
      indexHtml,
      { status: 200, headers: { 'content-type': 'text/html', }, },
    );
  }),
);

const server = serve(app, { port: PORT, },);

l.info(`listening on ${server.url}`);
