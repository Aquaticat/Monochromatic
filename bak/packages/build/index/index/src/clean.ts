import { fs } from '@monochromatic-dev/module-fs-path';

export default async (): Promise<void> => {
  await fs.empty('dist');
};
