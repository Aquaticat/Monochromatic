import { fs } from "@monochromatic.dev/module-fs-path";
import $c from '@/src/child.ts';

export default async (): Promise<void> => {
  await fs.cpFile('package.json', 'package.jsonc');
  await $c(`biome format --write package.jsonc`);
}
