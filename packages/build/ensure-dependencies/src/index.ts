import { cli } from '@kazupon/gunshi';
import {
  cp,
  mkdir,
} from 'node:fs/promises';
import {
  basename,
  join,
} from 'node:path';

await cli(process.argv.slice(2), async function withCtx(ctx): Promise<void> {
  if (ctx.positionals.length === 0) {
    throw new Error('No path provided');
  }
  const path = ctx.positionals[0]!;
  console.log(`Backing up ${path}`);
  const now = new Date().toISOString().replaceAll(':', '');
  await mkdir(join('bak', now));
  await cp(path, join('bak', now, basename(path)), {
    recursive: true,
    errorOnExist: true,
    preserveTimestamps: true,
  });
});
