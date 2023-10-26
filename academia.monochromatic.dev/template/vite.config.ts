import {
  defineConfig,
  mergeConfig,
} from 'vite';
import viteSfaConfig from '@monochromatic.dev/vite-sfa';

export default mergeConfig(
  viteSfaConfig,
  defineConfig({}),
);
