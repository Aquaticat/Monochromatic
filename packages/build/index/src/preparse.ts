import { fs } from '@monochromatic.dev/module-fs-path';
import JSONC from 'jsonc-simple-parser';
import { pipedAsync } from 'rambdax';

export default async (): Promise<void> => {
  await pipedAsync(
    'package.jsonc',
    fs.readFileU,
    JSONC.parse,
    async (pkg) => JSON.stringify(pkg, null, 2),
    async (pkgJson) => fs.writeFile('package.json', pkgJson),
  );
};
