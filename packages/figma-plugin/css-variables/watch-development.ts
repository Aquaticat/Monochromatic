import spawn, { type Options } from 'nano-spawn';

const spawnOptions: Options = {
  preferLocal: true,
  stdio: 'inherit',
};

await Promise.all([
  spawn(`vite`, [
    'build',
    '--config',
    'vite.config.iframe.ts',
    '--watch',
    '--mode',
    'development',
  ], spawnOptions),
  spawn(`vite`, [
    'build',
    '--config',
    'vite.config.frontend.ts',
    '--watch',
    '--mode',
    'development',
  ], spawnOptions),
  spawn(`vite`, [
    'build',
    '--config',
    'vite.config.backend.ts',
    '--watch',
    '--mode',
    'development',
  ], spawnOptions),
]);
