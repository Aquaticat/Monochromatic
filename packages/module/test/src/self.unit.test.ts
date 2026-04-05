/**
 * Self-test entry point for `@monochromatic-dev/module-test`.
 *
 * Imports each per-module test suite so they run in sequence.
 * Run directly with `bun` -- no external test runner needed.
 *
 * @module
 */

import './expect.unit.test.ts';
import './sinon.unit.test.ts';
import './it.unit.test.ts';
import './describe.unit.test.ts';
import './with-timeout.unit.test.ts';
