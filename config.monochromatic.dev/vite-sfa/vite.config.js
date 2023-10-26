import {
  defineConfig,
  mergeConfig,
} from 'vite';
import viteConfig from '@monochromatic.dev/vite';
import {
  viteSingleFile,
} from 'vite-plugin-singlefile';

export default mergeConfig(
  viteConfig,
  defineConfig({ plugins: [viteSingleFile({ removeViteModuleLoader: true })] }),
);
