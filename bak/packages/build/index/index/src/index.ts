#!/usr/bin/env node

import {
  fs,
  path,
} from '@monochromatic-dev/module-fs-path';

import D from './dev.ts';

import {
  configure,
  getConsoleSink,
  getFileSink,
  getLevelFilter,
  getLogger,
  withFilter,
} from '@logtape/logtape';
import build from './build.ts';
import clean from './clean.ts';
import dependencies from './dependencies.ts';
import parsed from './parsed.ts';
import precommit from './precommit.ts';
import preparse from './preparse.ts';
import serve from './serve.ts';
import testing from './testing.ts';
import watch from './watch.ts';

await fs.writeFile('monochromatic.log', '');

// TODO: Replace this with module/util or if renamed, module/esnext
await configure({
  sinks: {
    console: getConsoleSink(),
    consoleInfoPlus: withFilter(getConsoleSink(), getLevelFilter('info')),
    consoleWarnPlus: withFilter(getConsoleSink(), getLevelFilter('warning')),
    file: getFileSink('monochromatic.log', {
      formatter(log: any) {
        return `${JSON.stringify(log, null, 2)}\n`;
      },
    }),
  },
  filters: {},
  loggers: [
    { category: ['a'], level: 'debug', sinks: ['file', 'consoleInfoPlus'] },
    { category: ['t'], level: 'debug', sinks: ['file', 'consoleInfoPlus'] },
    { category: ['m'], level: 'debug', sinks: ['file', 'consoleWarnPlus'] },
    { category: ['esbuild-plugin'], level: 'debug', sinks: ['file', 'consoleWarnPlus'] },
    { category: ['logtape', 'meta'], level: 'warning', sinks: ['console'] },
  ],
});

const l = getLogger(['a', 'index']);

l.info`development ${D}`;

try {
  import.meta.env.DEV = D;
  import.meta.env.PROD = !D;
  import.meta.env.MODE = D ? 'development' : 'production';
} catch {}

try {
  process.env.NODE_ENV = D ? 'development' : 'production';
} catch {}

l.info`cwd ${path.resolve()}`;

switch (parsed.command) {
  case 'build': {
    await build();
    break;
  }
  case 'serve': {
    await serve();
    break;
  }
  case 'watch': {
    await watch();
    break;
  }
  case 'clean': {
    await clean();
    break;
  }
  case 'preparse': {
    await preparse();
    break;
  }
  case 'dependencies': {
    await dependencies();
    break;
  }
  case 'precommit': {
    await precommit();
    break;
  }
  case 'test': {
    await testing();
    break;
  }
  default:
    throw new Error(`command ${parsed.command} is unknown`);
}
