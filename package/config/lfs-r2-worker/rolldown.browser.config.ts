import neutralConfig from '@monochromatic-dev/config-rolldown/.ts';

/**
 Neutral build with two entries: `index.ts`, the library surface the unit
 tests import, and `worker.ts`, the handler-only module wrangler deploys.
 workerd rejects a main module with non-handler named exports, which is why
 the two cannot be one file. The shared neutral config exposes no
 input-overriding factory, so its default export is spread and only `input`
 replaced.
 */
const config: typeof neutralConfig = {
  ...neutralConfig,
  input: [
    './src/index.ts',
    './src/worker.ts',
  ],
};

export default config;
