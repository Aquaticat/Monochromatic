/**
 * Library API for the mvm ephemeral VM manager.
 *
 * VM lifecycle ({@link create}, {@link clone}, {@link destroy},
 * {@link destroyAll}, {@link list}, {@link update}), command execution
 * ({@link exec}, {@link run}), file transfer ({@link pushFile}, {@link pullFile}),
 * image registry, and per-VM metadata, plus the backend registry
 * ({@link selectBackend}, {@link resolveBackendKind}, {@link BACKENDS})
 * selecting the libvirt or Hetzner backend.
 * The `mvm` executable lives in `./cli.ts`.
 *
 * @module
 */

export * from './backend/registry.ts';
export type {
  Backend,
  BackendKind,
  BackendMeta,
} from './backend/types.ts';
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
