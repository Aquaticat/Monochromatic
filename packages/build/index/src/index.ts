#!/usr/bin/env node

import {
  fs,
  path,
} from '@monochromatic.dev/module-fs-path';

import { z } from 'zod';
import { parser } from 'zod-opts';

import { pipedAsync } from 'rambdax';

import JSONC from 'jsonc-simple-parser';

import D from './dev.ts';
import dts from './dts.ts';
import staticAndCompress from './staticAndCompress.ts';

import $c from './child.ts';

import { $ } from 'zx';

import {
  getLevelFilter,
  getLogger,
  withFilter,
} from '@logtape/logtape';

import {
  configure,
  getConsoleSink,
  getFileSink,
} from '@logtape/logtape';

await fs.writeFile('build.log', '');

await configure({
  sinks: {
    console: getConsoleSink(),
    consoleInfoPlus: withFilter(getConsoleSink(), getLevelFilter('info')),
    consoleWarnPlus: withFilter(getConsoleSink(), getLevelFilter('warning')),
    file: getFileSink('build.log', {
      formatter(log) {
        return `${JSON.stringify(log, null, 2)}\n`;
      },
    }),
  },
  filters: {},
  loggers: [
    { category: ['build'], level: 'debug', sinks: ['file', 'consoleInfoPlus'] },
    { category: ['module'], level: 'debug', sinks: ['file', 'consoleWarnPlus'] },
    { category: ['logtape', 'meta'], level: 'warning', sinks: ['console'] },
  ],
});

const l = getLogger(['build']);

l.info`development ${D}`;

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
  l.info`build ${path.resolve()}`;

  const buildResult = await Promise.all(
    [
      staticAndCompress(),
      dts(),
    ],
  );

  l.info`built ${buildResult}`;
}

if (parsed.command === 'serve') {
  l.info`serve ${path.resolve()}`;

  l.warn`The serve command is feature-incomplete. For now, the recommended way to serve the dist files is to manually run
caddy run -c ./dist/temp/caddy/index.json
in your terminal. We'll start the process anyway.
`;

  /* MAYBE: Replace this with my own implementation?
  Need to figure out how to promisify child_process.exec while preserving its Event Emitter properties. */
  await $`caddy run -c ./dist/temp/caddy/index.json`
    .pipe(process.stdout);
}

if (parsed.command === 'watch') {
  // TODO: Implement this. priority:high
  throw new Error(`watch is not implemented`);
}

if (parsed.command === 'clean') {
  l.info`clean ${path.resolve()}`;
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
  await $c(`biome format --write package.jsonc`);
}
