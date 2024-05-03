import c from '@monochromatic.dev/module-console';
import { pipedAsync } from 'rambdax';
import br from './br.ts';
import caddy from './caddy.ts';
import css from './css.ts';
import html from './html.ts';
import js from './js.ts';
import type {
  State,
} from './state.ts';

export default async function staticAndCompress(): Promise<State> {
  await pipedAsync(
    [
      css(),
      js(),
      html(),
    ],
    async (val) => await Promise.allSettled(val),
    async (val) => {
      c.log(val);
      return val;
    },
  );

  await Promise.all([
    br(),
    caddy(),
  ]);

  return 'SUCCESS';
}
