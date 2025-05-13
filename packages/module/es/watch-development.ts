import spawn, { type Options } from 'nano-spawn';

const spawnOptions: Options = {
  preferLocal: true,
  stdio: 'inherit',
};

await Promise.all([
  spawn(`vite`, [
    'build',
    '--config',
    'vite.config.ts',
    '--watch',
    '--mode',
    'development,node',
  ], spawnOptions),
  spawn(`vite`, [
    'build',
    '--config',
    'vite.config.ts',
    '--watch',
    '--mode',
    'development,browser',
  ], spawnOptions),
]);
