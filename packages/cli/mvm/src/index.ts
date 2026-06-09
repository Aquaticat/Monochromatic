/**
 * Library API for the mvm ephemeral VM manager.
 *
 * VM lifecycle (create, clone, destroy, list, update), command execution
 * (exec, run), file transfer (pushFile, pullFile), image registry, and
 * per-VM metadata, plus the backend registry (`selectBackend`,
 * `resolveBackendKind`, `BACKENDS`) selecting the libvirt or Hetzner backend.
 * The `mvm` executable lives in `./cli.ts`.
 *
 * @module
 */

export * from './backends/registry.ts';
export type {
  Backend,
  BackendKind,
  BackendMeta,
} from './backends/types.ts';
export * from './clone.ts';
export * from './create.ts';
export * from './destroy.ts';
export * from './exec.ts';
export * from './file-transfer.ts';
export * from './list.ts';
export * from './meta.ts';
export * from './registry.ts';
export * from './run.ts';
export * from './update.ts';
