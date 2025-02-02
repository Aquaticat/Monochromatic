import { getLogger } from '@logtape/logtape';
import publicApi from './build.publicApi.ts';
import staticAndCompress from './build.staticAndCompress.ts';
import testing from './testing.ts';
const l = getLogger(['a', 'build']);

export default async (): Promise<void> => {
  const buildResult = await Promise.all(
    [
      staticAndCompress(),
      publicApi(),
    ],
  );

  l.info`built ${buildResult}`;

  testing();
};
