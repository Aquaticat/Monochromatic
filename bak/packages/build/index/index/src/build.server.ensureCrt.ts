import type { State } from '@/src/state.ts';
import {
  fs,
  path,
} from '@monochromatic-dev/module-fs-path';
import { exec } from '@monochromatic-dev/module-node/ts';

export default async (): Promise<State> => {
  if (!(await fs.existsFile(path.join('dist', 'temp', 'server', 'localhost.pem')))) {
    await fs.mkdir(path.join('dist', 'temp', 'server'), { recursive: true });

    const { all: genedCert } = await exec`mkcert
      -cert-file
      dist/temp/server/localhost.pem
      -key-file
      dist/temp/server/localhost-key.pem
      localhost
      127.0.0.1
      0.0.0.0
      ::1`;

    return [
      'ensureCrt',
      'SUCCESS',
      genedCert,
    ];
  }
  return ['ensureCrt', 'SKIP', 'localhost.crt exists'];
};
