import vitestExcludeCommonConfig from './vitest-exclude-common.json' with {
  type: 'json',
};

//region Constants -- Configuration values used throughout the file

// Browser versions
/** Latest ESR (as of Jun 25 2025) */
const FIREFOX_ESR_VERSION = 140;
/** Bit shift for Firefox version encoding in LightningCSS */
const FIREFOX_VERSION_SHIFT = 16;

// Ports
const VITEST_API_PORT = 3001;

// Timeouts
const DEFAULT_TEST_TIMEOUT = 2000;

// Other constants
const MAX_CONCURRENCY = 16;

//endregion Constants

const vitestExcludeCommon: string[] = vitestExcludeCommonConfig.patterns;

export {
  DEFAULT_TEST_TIMEOUT,
  FIREFOX_ESR_VERSION,
  FIREFOX_VERSION_SHIFT,
  MAX_CONCURRENCY,
  VITEST_API_PORT,
  vitestExcludeCommon,
};
