/**
 * Container test runner for ensurePackage.
 * Launches podman containers across the test matrix via `module-matrix`.
 *
 * Test matrix:
 * - OS: ubuntu (apt), fedora (dnf)
 * - User: root, non-root (uid 1000)
 * - Runtime: bun
 *
 * @example
 * ```bash
 * bun packages/dev-script/file-enforcer/src/package/mise.container-test.ts
 * ```
 */

import { matrix, } from '@monochromatic-dev/module-matrix';

await matrix({
  os: ['container:ubuntu', 'container:fedora',],
  user: ['root', 'user',],
},);
