import { $ } from 'bun';

await Promise.all([
  $`bun run watch:frontend:development`,
  $`bun run watch:backend:development`,
]);

// TODO: Make this a general purpose package.
