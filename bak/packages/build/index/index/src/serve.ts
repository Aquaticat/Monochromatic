import { staticWebServerConfFilePath } from '@/src/consts.ts';
import { getLogger } from '@logtape/logtape';
import { exec } from '@monochromatic-dev/module-node/ts';
const l = getLogger(['a', 'serve']);

export default async (): Promise<void> => {
  const runStaticWebServer = exec`static-web-server -w ${staticWebServerConfFilePath}`;

  l.info`at https://localhost:5173`;
  await runStaticWebServer;
};
