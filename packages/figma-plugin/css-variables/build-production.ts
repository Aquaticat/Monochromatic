import spawn, { type Options } from 'nano-spawn';

const spawnOptions: Options = {
  preferLocal: true,
  stdio: 'inherit',
};

await Promise.all([
  async function buildFrontend() {
    await spawn(`vite`, [
      'build',
      '--config',
      'vite.config.iframe.ts',
      '--mode',
      'development',
    ], spawnOptions);
    await spawn(`vite`, [
      'build',
      '--config',
      'vite.config.frontend.ts',
      '--mode',
      'development',
    ], spawnOptions);
  },
  spawn(`vite`, [
    'build',
    '--config',
    'vite.config.backend.ts',
    '--mode',
    'development',
  ], spawnOptions),
]);
