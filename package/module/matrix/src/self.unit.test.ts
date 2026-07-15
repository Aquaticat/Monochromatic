/**
 * Self-test entry point for `@monochromatic-dev/module-matrix`.
 *
 * Imports each per-module test suite so they run in sequence.
 * Run directly with `bun`: no external test runner needed.
 *
 * @module
 */

// oxlint-disable no-unassigned-import -- test files execute on import via top-level await

import './distro.unit.test.ts';
import './runtime.unit.test.ts';
import './container.unit.test.ts';
import './discover.unit.test.ts';
