import { $ } from 'bun';

await Promise.all([
  $`bun run build:frontend:production`,
  $`bun run build:backend:production`,
]);

// TODO: Make this a general purpose package.
