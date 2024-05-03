#!/usr/bin/env node

import {
  fs,
  path,
} from '@monochromatic.dev/module-fs-path';

import { z } from 'zod';
import { parser } from 'zod-opts';
import { $ } from 'zx';

import { pipedAsync } from 'rambdax';

import JSONC from 'jsonc-simple-parser';

import c from '@monochromatic.dev/module-console';

import D from './dev.ts';
import dts from './dts.ts';
import staticAndCompress from './staticAndCompress.ts';

$.prefix += 'source ~/.bashrc && ';

c.assert(D, 'development');
c.assert(!D, 'production');

try {
  import.meta.env.DEV = D;
  import.meta.env.PROD = !D;
  import.meta.env.MODE = D ? 'development' : 'production';
} catch {}

try {
  process.env.NODE_ENV = D ? 'development' : 'production';
} catch {}

const parsed = parser()
  .args([{ name: 'command', type: z.enum(['build', 'serve', 'watch', 'clean', 'preparse', 'dependencies']) }])
  .options({})
  .parse();

if (parsed.command === 'build') {
  c.log('build', path.resolve());

  await pipedAsync(
    [
      staticAndCompress(),
      dts(),
    ],
    async (val) => Promise.allSettled(val),
    async (val) => {
      c.log(val);
      return val;
    },
  );
}

if (parsed.command === 'serve') {
  c.log(`serve`, path.resolve());

  await $`caddy run -c ./dist/temp/caddy/index.json`
    .pipe(process.stdout);
}

if (parsed.command === 'watch') {
  // TODO: Implement this. priority:high
  throw new Error(`watch is not implemented`);
}

if (parsed.command === 'clean') {
  c.log(`clean`, path.resolve());
  await fs.empty('dist');
}

if (parsed.command === 'preparse') {
  await pipedAsync(
    'package.jsonc',
    fs.readFileU,
    JSONC.parse,
    async (pkg) => JSON.stringify(pkg, null, 2),
    async (pkgJson) => fs.writeFile('package.json', pkgJson),
  );
}

if (parsed.command === 'dependencies') {
  await fs.cpFile('package.json', 'package.jsonc');
  await $`pnpm exec biome format --write package.jsonc`;
}
