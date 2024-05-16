import { caddyConfFilePath } from '@/src/consts.ts';
import type { State } from '@/src/state.js';
import { getLogger } from '@logtape/logtape';
import {
  fs,
  path,
} from '@monochromatic.dev/module-fs-path';
import { pipedAsync } from 'rambdax';

const l = getLogger(['app', 'caddy']);

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

const staticWebServerOptions = () => ({
  general: {
    port: 5172,
    root: path.join('dist', 'final'),
    'log-level': 'debug',
    'directory-listing': true,
    'redirect-trailing-slash': false,
  },
  advanced: {
    rewrites: [
      {
        source: '',
        destination: '',
      },
    ],
  },
});

const caddyOptions = (post404SlugWIndexWExts: string[]) => ({
  admin: {
    disabled: true,
    config: { persist: false },
  },
  storage: {
    module: 'file_system',
    root: path.join('dist', 'temp', 'caddy'),
  },
  logging: {
    logs: {
      default: {
        level: 'DEBUG',
      },
    },
  },
  apps: {
    tls: {
      certificates: {
        automate: ['localhost', '127.0.0.1', '0.0.0.0'],
      },
      automation: {
        policies: [{
          issuers: [{
            module: 'internal',
          }],
        }],
      },
    },
    http: {
      https_port: 5173,
      servers: {
        dev: {
          logs: {},
          listen: [':5173'],
          routes: [{
            match: [{
              client_ip: {
                ranges: [
                  '127.0.0.0/8',
                  '192.168.0.0/16',
                  '172.16.0.0/12',
                  '10.0.0.0/8',
                  '::1/128',
                  'fc00::/7',
                ],
              },
            }],
            handle: [
              {
                handler: 'vars',
                root: path.join('dist', 'final'),
              },
              {
                handler: 'file_server',
                canonical_uris: false,
                browse: {},
                precompressed: { br: {} },
                hide: post404SlugWIndexWExts
                  .flatMap((
                    post404SlugWIndexWExt,
                  ) => [
                    `{http.vars.root}/${post404SlugWIndexWExt}`,
                    `{http.vars.root}/${post404SlugWIndexWExt.slice(0, -'.html'.length)}`,
                  ])
                  .concat(['{http.vars.root}/_', '*/404/index.html']),
                pass_thru: true,
              },
              {
                handler: 'file_server',
                canonical_uris: false,
                browse: {},
                precompressed: { br: {} },
                pass_thru: true,
                hide: ['*/404/index.html'],
                status_code: 404,
              },
              {
                handler: 'subroute',
                routes: [
                  {
                    match: [{ path: ['*/ca/*'] }],
                    handle: [
                      /*                  {
                        handler: 'rewrite',
                        path_regexp: [{ find: 'ca/.+^', replace: 'ca/404/' }],
                      }, */
                      {
                        handler: 'file_server',
                        root: '{http.vars.root}/ca',
                        pass_thru: true,
                        canonical_uris: false,
                        browse: {},
                        precompressed: { br: {} },
                      },
                      {
                        handler: 'file_server',
                        root: '{http.vars.root}/{http.request.uri.path.0}/ca',
                        canonical_uris: false,
                        browse: {},
                        precompressed: { br: {} },
                      },
                    ],
                  },
                  {
                    match: [{ path: ['*/fr/*'] }],
                    handle: [
                      /*                     {
                        handler: 'rewrite',
                        path_regexp: [{ find: 'fr/.+^', replace: 'fr/404.html' }],
                      }, */
                      {
                        handler: 'file_server',
                        root: '{http.vars.root}/fr',
                        pass_thru: true,
                        canonical_uris: false,
                        browse: {},
                        precompressed: { br: {} },
                      },
                      {
                        handler: 'file_server',
                        root: '{http.vars.root}/{http.request.uri.path.0}/fr',
                        canonical_uris: false,
                        browse: {},
                        precompressed: { br: {} },
                      },
                    ],
                  },
                  {
                    handle: [
                      {
                        handler: 'file_server',
                        pass_thru: true,
                        canonical_uris: false,
                        browse: {},
                        precompressed: { br: {} },
                      },
                      {
                        handler: 'file_server',
                        root: '{http.vars.root}/{http.request.uri.path.0}',
                        canonical_uris: false,
                        browse: {},
                        precompressed: { br: {} },
                      },
                    ],
                    terminal: true,
                  },
                ],
              },
            ],
          }],
          tls_connection_policies: [
            {
              protocol_min: 'tls1.3',
            },
          ],
          automatic_https: {
            disable_redirects: true,
          },
        },
      },
    },
  },
});

export default async (): Promise<State> => {
  l.debug(`write caddy.json at ${caddyConfFilePath}`);

  await fs.outputFile(
    caddyConfFilePath,
    JSON.stringify(
      caddyOptions(await getPost404SlugWIndexWExts()),
      null,
      2,
    ),
  );

  return ['writeCaddyConf', 'SUCCESS', caddyConfFilePath];
};
