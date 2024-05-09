import br from './br.ts';
import caddy from './caddy.ts';
import css from './css.ts';
import html from './html.ts';
import js from './js.ts';
import type { State } from './state.ts';
import { getLogger } from '@logtape/logtape';
const l = getLogger(['build', 'staticAndCompress']);

export default async function staticAndCompress(): Promise<State> {
  l.debug`staticAndCompress`;

  const staticResult = await Promise.all([
    css(),
    js(),
    html(),
  ]);

  l.debug`staticResult ${staticResult}`;

  const compressResult = await Promise.all([
    br(),
    caddy(),
  ]);

  l.debug`compressResult ${compressResult}`;

  return ['staticAndCompress','SUCCESS', [staticResult, compressResult]];
}
