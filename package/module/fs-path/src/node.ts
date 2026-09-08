/**
 Node-only entry (`\@monochromatic-dev/module-fs-path/node`).

 Ships the helpers whose static `node:fs/promises` and `node:path` imports
 must never reach the platform-neutral root entry: the ensure and empty
 family. Built only by `rolldown.node.config.ts`, so the neutral artifact
 carries no `node:` specifier at all.

 @module
 */

export {
  emptyDir,
  emptyFile,
  emptyPath,
  removeEmptyFilesInDir,
} from './empty.ts';
export {
  ensureDir,
  ensureFile,
  ensurePath,
} from './ensure.ts';
