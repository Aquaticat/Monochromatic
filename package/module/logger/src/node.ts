/**
 Node-only entry (`\@monochromatic-dev/module-logger/node`).

 Ships the file sink, whose static `node:fs/promises` and `node:path`
 imports must never reach the platform-neutral root entry. Built only by
 `rolldown.node.config.ts`, so the neutral artifact carries no `node:`
 specifier at all.

 @module
 */

export { createFileSink, } from './sink/file.ts';

//region Internal seams
// Underscore-prefixed re-exports let `file.unit.test.ts` exercise the ancestor
// search through the built artifact (the `require-eventual-artifact` rule)
// without widening the documented API; they are not part of the public
// contract.
export {
  findNodeModulesUp as _findNodeModulesUp,
  NO_NODE_MODULES_FOUND as _NO_NODE_MODULES_FOUND,
} from './sink/file.ts';
//endregion Internal seams
