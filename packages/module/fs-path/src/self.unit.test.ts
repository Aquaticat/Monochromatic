/**
 * Self-test entry point for `@monochromatic-dev/module-fs-path`.
 *
 * Imports each per-category test file so they all execute in sequence when
 * the package's `mise run test` task fires.
 *
 * @module
 */

// oxlint-disable no-unassigned-import -- test files execute on import via top-level await

import './path-ops.unit.test.ts';
import './find-monorepo-root.unit.test.ts';
import './find-package-root.unit.test.ts';
