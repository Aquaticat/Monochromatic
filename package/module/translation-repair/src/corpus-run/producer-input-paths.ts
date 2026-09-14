//region Fixed preparation input runner filesystem roles

/**
 The owning host and child agree on fixed mounts, never an arbitrary command or mount map.
 
 @example
 ```ts
 const artifactPath = `${PRODUCER_INPUT_PATHS.output}/unqualified-inputs.json`;
 ```
 */
export const PRODUCER_INPUT_PATHS = {
  /**
   Independently digest-bound launch snapshot, mounted read-only outside writable output.
   */
  launch: '/contract/launch.json',
  /**
   Separately packaged bootstrap, not a file inside the application being verified.
   */
  bootstrap: '/bootstrap/producer-prepare.mjs',
  /**
   Exact host-selected Node executable.
   */
  node: '/node',
  /**
   Frozen application inventory root.
   */
  runtime: '/runtime',
  /**
   Fixed inert application entry; callers cannot select another module.
   */
  application: '/runtime/producer-prepare-app.mjs',
  /**
   Exact runtime manifest whose identity is supplied by the launch.
   */
  manifest: '/runtime/sealed-runtime.json',
  /**
   Default-path library binding remains effective without an LD_LIBRARY_PATH override.
   */
  atomicLibrary: '/lib64/libatomic.so.1',
  /**
   Original task40 selection, mounted separately from supporting artifacts.
   */
  selection: '/input/selection.json',
  /**
   Read-only root for the exact selection reference inventory.
   */
  supporting: '/input/supporting',
  /**
   Read-only native corpus clone, including its immutable Git objects.
   */
  corpus: '/corpus',
  /**
   The input application can write only its owned output and bounded temporary storage.
   */
  output: '/output',
  /**
   Fresh private home prevents access to host credentials or global Git configuration.
   */
  home: '/output/home',
} as const;

//endregion Fixed preparation input runner filesystem roles
