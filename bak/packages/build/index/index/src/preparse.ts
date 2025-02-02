import { fs } from '@monochromatic-dev/module-fs-path';
import { parse as jsoncParse } from '@std/jsonc';
import { pipedAsync } from 'rambdax';

export default async (): Promise<void> => {
  await pipedAsync(
    'package.jsonc',
    fs.readFileU,
    jsoncParse,
    async (pkg) => JSON.stringify(pkg, null, 2),
    async (pkgJson) => fs.writeFile('package.json', pkgJson),
  );
};
