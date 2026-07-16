/** @type {import('stylelint').Config} */
export default {
  extends: '@monochromatic-dev/config-stylelint',
  ignoreFiles: [
    'package/test-fixture/**',
    'package-paused/**',
    'package-deprecated/**',
  ],
};
