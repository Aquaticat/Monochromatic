import { $ as tagged, } from '@monochromatic-dev/module-es/tagged';
import {
  appendFile,
  exists,
  mkdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { indexHtmlStart, } from './asset.ts';
import { INDEX_HTML_END, } from './html.ts';
import { l as parentLogger, } from './log.ts';
import { IGNORE_PATH, } from './path.ts';

/** Tagged logger for the handler module. */
const l = tagged({
  tag: 'handler',
  l: parentLogger,
},);

//region HTTP handlers -- Serve rendered HTML and persist ignored items

/**
 * Serves the full rendered HTML page with inlined assets and feed body.
 *
 * @param options - Contains the async function that returns the rendered HTML body
 *
 * @returns Response containing the complete HTML document
 */
export async function serveIndex(options: {
  getHtmlBody: () => Promise<string>;
},): Promise<Response> {
  const { getHtmlBody, } = options;
  const innerL = tagged({
    tag: serveIndex.name,
    l,
  },);
  innerL.debug('serving index',);
  const body = await getHtmlBody();
  return new Response(
    `${indexHtmlStart}${body}${INDEX_HTML_END}`,
    {
      status: 200,
      headers: { 'content-type': 'text/html', },
    },
  );
}

/**
 * Records an ignored feed item to the JSONL ignore file.
 * Creates the ignore directory and file if they do not exist.
 *
 * @param request - Incoming request with JSON body containing a `link` property
 *
 * @returns Response with file stats after appending
 */
export async function ignore(request: Request,): Promise<Response> {
  const innerL = tagged({
    tag: ignore.name,
    l,
  },);
  const body = await request.text();
  innerL.debug(`ignore ${body}`,);

  const filePath = join(
    IGNORE_PATH,
    'api.jsonl',
  );
  if (!await exists(filePath,)) {
    innerL.debug('creating api.jsonl',);
    await mkdir(
      IGNORE_PATH,
      { recursive: true, },
    );
    await writeFile(
      filePath,
      '',
      'utf8',
    );
  }
  await appendFile(
    filePath,
    `\n${body}`,
  );

  const stats = await stat(filePath,);
  return Response.json(stats,);
}

//endregion HTTP handlers
