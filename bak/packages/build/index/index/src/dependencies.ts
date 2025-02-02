import { fs } from '@monochromatic-dev/module-fs-path';
import {
  exec,
  packageInfo,
} from '@monochromatic-dev/module-node/ts';

export default async (): Promise<void> => {
  await fs.cpFile('package.json', 'package.jsonc');
  await exec`${packageInfo.pe} biome format --write package.jsonc`;
};
