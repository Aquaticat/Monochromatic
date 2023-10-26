import {
  defineConfig,
  mergeConfig,
} from 'vite';
import viteSfaConfig from '@monochromatic/vite-sfa';

export default mergeConfig(
  viteSfaConfig,
  defineConfig({}),
);
