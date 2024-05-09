import { getLogger } from '@logtape/logtape';
import { fs } from '@monochromatic.dev/module-fs-path';
import type { State } from './state';

const l = getLogger(['build', 'caddy']);

const caddyOptions = () => ({
  admin: {
    disabled: true,
    config: { persist: false },
  },
  storage: {
    module: 'file_system',
    root: './dist/temp/caddy',
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
                handler: 'file_server',
                root: './dist/final',
                browse: {},
                precompressed: { br: {} },
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

export default async function writeCaddyConf(): Promise<State> {
  const caddyConfFilePath = 'dist/temp/caddy/index.json';
  l.debug(`write caddy.json at ${caddyConfFilePath}`);

  await fs.outputFile(
    caddyConfFilePath,
    JSON.stringify(
      caddyOptions(),
      null,
      2,
    ),
  );

  return ['writeCaddyConf','SUCCESS', caddyConfFilePath];
}
