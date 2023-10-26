# vite-sfa

For use in Vite built Single File Applications.

## Example usage

`vite.config.ts`

```ts
import {
  defineConfig,
  mergeConfig,
} from 'vite';
import viteSfaConfig from '@monochromatic.dev/vite-sfa';

export default mergeConfig(
  viteSfaConfig,
  defineConfig({}),
);
```
