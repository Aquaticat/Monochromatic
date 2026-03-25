/** @type {import('stylelint').Config} */
export default {
  extends: '@monochromatic-dev/config-stylelint',
  ignoreFiles: [
    'packages/test-fixture/**',
    'packages/audit/**',
  ],
};
