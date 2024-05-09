import {
  fs,
  path,
} from '@monochromatic.dev/module-fs-path';
import $c from './child.ts';
import { indexJsFilePaths } from './g.ts';
import type { State } from './state.ts';
import { getLogger } from '@logtape/logtape';
const l = getLogger(['build', 'dts']);

export default async function dts(): Promise<State> {
  if (indexJsFilePaths.length === 0) {
    return ['dts','SKIP', `skipping dts, none of index.js or index.ts exists.`];
  }

  try {
    await fs.access(path.join('tsconfig.json'));
  } catch {
    return ['dts','SKIP', `skipping dts, tsconfig.json doesn't exist.`];
  }

  l.debug`dts`;

  const { stdoe } = await $c(`vue-tsc`);

  return ['dts','SUCCESS', stdoe];
}
