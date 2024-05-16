import { mdxFilePaths } from '@/src/consts.js';
import type { State } from '@/src/state.ts';
import { getLogger } from '@logtape/logtape';
import br from './_/compress.ts';
import cssJs from './_/cssJs.ts';
import html from './_/html.ts';
import caddy from './_/server.js';
const l = getLogger(['app', 'staticAndCompress']);

export default async function staticAndCompress(): Promise<State> {
  l.debug`staticAndCompress`;

  const staticResult = await Promise.all([
    cssJs(),
    html(),
  ]);

  l.debug`staticResult ${staticResult}`;

  const compressResult = mdxFilePaths.length !== 0 && await Promise.all([
    br(),
    caddy(),
  ]);

  l.debug`compressResult ${compressResult}`;

  return ['staticAndCompress', 'SUCCESS', [staticResult, compressResult]];
}
