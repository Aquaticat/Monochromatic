# vite

For use in Vite built projects.

## Example usage

`vite.config.ts`

```ts
import {
  defineConfig,
  mergeConfig,
} from 'vite';
import viteConfig from '@monochromatic.dev/vite';

export default mergeConfig(
  viteConfig,
  defineConfig({}),
);
```
