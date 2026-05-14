/**
 * Self-test entry point for `@monochromatic-dev/module-test`.
 *
 * Imports each per-module test suite so they run in sequence.
 * Run directly with `bun`: no external test runner needed.
 *
 * @module
 */

// oxlint-disable no-unassigned-import -- test files execute on import via top-level await

import './expect.unit.test.ts';
import './sinon.unit.test.ts';
import './descriptor.unit.test.ts';
import './it.unit.test.ts';
import './describe.unit.test.ts';
