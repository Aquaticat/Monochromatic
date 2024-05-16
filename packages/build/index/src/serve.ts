import { caddyConfFilePath } from '@/src/consts.ts';
import { getLogger } from '@logtape/logtape';
const l = getLogger(['app', 'serve']);
import { $ } from 'zx';

export default async (): Promise<void> => {
  l.info`at https://localhost:5173`;

  const runCaddy = $`caddy run -c ${caddyConfFilePath}`
    .pipe(process.stdout);

  process.on('SIGINT', async () => {
    const forceQuit = setTimeout(() => {
      process.exit(1);
    }, 2000);
    l.warn`exiting in at most 2000ms`;
    await runCaddy.kill();
    l.info`successfully exited child processes`;
    clearTimeout(forceQuit);
  });

  await runCaddy;
};
