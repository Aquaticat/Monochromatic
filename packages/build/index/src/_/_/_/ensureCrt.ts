import $c from '@/src/child.ts';
import type { State } from '@/src/state.ts';
import {
  fs,
  path,
} from '@monochromatic.dev/module-fs-path';

export default async (): Promise<State> => {
  if (!(await fs.existsFile(path.join('dist', 'temp', 'server', 'localhost.pem')))) {
    await fs.outputFile(path.join('dist', 'server', '.tmp'), '');

    const { stdoe: genedCert } = await $c(
      [
        'mkcert',
        '-cert-file',
        'dist/temp/server/localhost.pem',
        '-key-file',
        'dist/temp/server/localhost-key.pem',
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '::1',
      ]
        .join(' '),
    );

    return [
      'ensureCrt',
      'SUCCESS',
      genedCert,
    ];
  }
  return ['ensureCrt', 'SKIP', 'localhost.crt exists'];
};
