import { staticWebServerConfFilePath } from '@/src/consts.ts';
import type { State } from '@/src/state.ts';
import { getLogger } from '@logtape/logtape';
import {
  fs,
  path,
} from '@monochromatic-dev/module-fs-path';
import { stringify } from '@std/toml';
import { pipedAsync } from 'rambdax';
import ensureCrt from './build.server.ensureCrt.ts';

const l = getLogger(['a', 'server']);

const getPost404SlugWIndexWExts = async (): Promise<string[]> => {
  try {
    return (await pipedAsync(
      path.join('dist', 'temp', 'html', 'post404Fms.json'),
      fs.readFileU,
      JSON.parse,
    ))
      .map((post404Fm: { slugWIndexWExt: string; }) => post404Fm.slugWIndexWExt);
  } catch (e) {
    l.warn`could not get post 404 slug w index w exts ${e}`;
  }
  return [];
};

// Static Web Server doesn't support declaring a status code for a route yet.
const staticWebServerOptions = () => ({
  general: {
    host: '127.0.0.1',
    port: 5173,
    root: path.join('dist', 'final'),
    'log-level': 'info',
    'directory-listing': true,
    'redirect-trailing-slash': false,
    'compression-static': true,
    http2: true,
    'http2-tls-cert': path.join('dist', 'temp', 'server', 'localhost.pem'),
    'http2-tls-key': path.join('dist', 'temp', 'server', 'localhost-key.pem'),
  },
  advanced: {
    rewrites: [
      /* 404 rewrites
      ${slashSiteBase}/{<lang codes>}/<every starting substring excluding paths that already exists>
        -> ${slashSiteBase}/$1/404.html */
      {
        source:
          '/subtle/{*}/{l,li,lin,link,[!l]*,l[!i]*,li[!n]*,lin[!k]*,link[!s]*,links?*}',
        destination: '/subtle/$1/404.html',
      },
    ],
  },
});

export default async (): Promise<State> => {
  const ensuredCrt = await ensureCrt();
  const wrote = await fs.outputFile(
    staticWebServerConfFilePath,
    stringify(staticWebServerOptions()),
  );

  return ['server', 'SUCCESS', [ensuredCrt, wrote]];
};
