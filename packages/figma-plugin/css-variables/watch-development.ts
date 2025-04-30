import { $ } from 'bun';

await Promise.all([
  $`vite build --config vite.config.iframe.ts --watch --mode development`,
  $`vite build --config vite.config.frontend.ts --watch --mode development`,
  $`vite build --config vite.config.backend.ts --watch --mode development`,
]);
