import { $ } from 'bun';

await Promise.all([
  $`vite build --config vite.config.iframe.ts --mode production && vite build --config vite.config.frontend.ts --mode production`,
  $`vite build --config vite.config.backend.ts --mode production`,
]);
