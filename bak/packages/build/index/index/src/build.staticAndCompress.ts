import { mdxFilePaths } from '@/src/consts.js';
import type { State } from '@/src/state.ts';
import { getLogger } from '@logtape/logtape';
import compress from './build.compress.ts';
import cssJs from './build.cssJs.ts';
import html from './build.html.ts';
import server from './build.server.ts';
const l = getLogger(['a', 'staticAndCompress']);

export default async function staticAndCompress(): Promise<State> {
  l.debug`staticAndCompress`;

  const staticResult = await Promise.all([
    cssJs(),
    html(),
  ]);

  l.debug`staticResult ${staticResult}`;

  const compressResult = mdxFilePaths.length !== 0 && await Promise.all([
    compress(),
    server(),
  ]);

  l.debug`compressResult ${compressResult}`;

  return ['staticAndCompress', 'SUCCESS', [staticResult, compressResult]];
}
