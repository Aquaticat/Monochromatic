import { staticWebServerConfFilePath } from '@/src/consts.ts';
import { getLogger } from '@logtape/logtape';
const l = getLogger(['app', 'serve']);
import $c from '@/src/child.ts';
import { $ } from 'zx';

export default async (): Promise<void> => {
  try {
    const existingProcesses = (await $c(`lsof -t -i:5173`)).stdout;
    if (existingProcesses) {
      l.warn`killing processes [${existingProcesses}] on port 5173`;
      await $c(`kill ${existingProcesses}`);
    }
  } catch (e) {
    l.debug`${e}`;
  }

  const runStaticWebServer = $`static-web-server -w ${staticWebServerConfFilePath}`.pipe(process.stdout);

  process.on('SIGINT', async () => {
    const forceQuit = setTimeout(() => {
      process.exit(1);
    }, 2000);
    l.warn`exiting in at most 2000ms`;
    await runStaticWebServer.kill();
    l.info`successfully exited child processes`;
    clearTimeout(forceQuit);
  });

  l.info`at https://localhost:5173`;
  await runStaticWebServer;
};
