# Image processing library vet

## Current user question

The user asked whether there is anything better than `sharp` after discussing `sharp` versus `jimp`.
They also explicitly required the `choosing-technology` skill and asked for this handover because context is filling up.

Do not recommend another image library until the context-fork questions are answered.
The skill requires asking first when target runtime, workload, and trust boundary can change the candidate set.

## Evidence gathered so far

- `sharp` current package metadata checked with `npm view sharp@latest version scripts optionalDependencies dependencies config --json`.
  Result at the time: `0.35.3`, `build: node install/build.js`, many platform optional dependencies under
  `@img/sharp-*` and `@img/sharp-libvips-*`, `config.libvips >=8.18.3`.
- `sharp@0.35.2` metadata checked with `npm view sharp@0.35.2 ... --json`.
  Result: same package shape, `build: node install/build.js`, optional prebuilt platform packages.
- `pnpm-workspace.yaml` read in repo. It contains:
  - `allowBuilds.sharp: true`
  - `allowBuilds.@vscode/ripgrep: false`
  - `allowBuilds.core-js: false`
  - `allowBuilds.protobufjs: false`
  - catalog entry `'sharp': '>=0.35.2'`
- `mise.toml` read around `prepare:pnpm:others:approve-builds`.
  It runs `pnpm approve-builds sharp`.
- `pnpm --version && pnpm ignored-builds` run in repo. Result: pnpm `11.9.0`; no `node_modules` found;
  explicitly ignored builds are `@vscode/ripgrep`, `core-js`, and `protobufjs`.
- Sharp install docs fetched from `https://sharp.pixelplumbing.com/install/`.
  Findings:
  - current runtime requirement is Node-API v9, for example Node.js `>=20.9.0`.
  - prebuilt binaries are provided for common OS and CPU platforms.
  - package managers select prebuilt binaries at install time.
  - prebuilt support includes JPEG, PNG, Ultra HDR, WebP, AVIF, TIFF, GIF, and SVG input.
  - source builds use a C++17 compiler, `node-addon-api`, and `node-gyp`.
- Sharp `install/build.js` fetched from GitHub raw for `v0.35.2`.
  It logs source build, checks `node-addon-api`, checks `node-gyp`, optionally detects global libvips,
  then calls `spawnRebuild()`.
- Scratch pnpm install tested in `/tmp/sharp-pnpm-build-test.skViF9` with:
  - `package.json`: `{"dependencies":{"sharp":"0.35.2"}}`
  - `pnpm-workspace.yaml`: `allowBuilds: sharp: false`
  - command: `pnpm --dir "$workdir" install --lockfile-only=false --reporter=append-only`
  It installed successfully on current Linux x64 using prebuilt optional deps.
- Integration check run from that scratch install:
  `pnpm --dir /tmp/sharp-pnpm-build-test.skViF9 exec node --input-type=module --eval "import sharp from 'sharp'; ..."`
  It read a 1x1 SVG buffer and printed `{"format":"svg","width":1,"height":1}`.
  Conclusion: on current platform, `sharp` can work without approving the source-build lifecycle script.
- Sharp performance docs fetched from `https://sharp.pixelplumbing.com/performance/`.
  Findings:
  - sharp benchmark uses `sharp v0.35.0 / libvips v8.18.2` and `jimp v1.6.1`.
  - JPEG AMD64 benchmark: Jimp buffer `3.44 ops/sec`, sharp buffer `89.63 ops/sec`, reported as `26.1x`.
  - PNG AMD64 benchmark: sharp buffer `47.74 ops/sec`; Jimp buffer `17.04 ops/sec`, about `2.8x`,
    while the page reports `4.6x` compared to the baseline contender in that task.
  - Page did not give an exact benchmark run date, but it references `sharp v0.35.0`, dated 2026-06-10.
- libvips homepage fetched from `https://www.libvips.org/`.
  Findings:
  - libvips describes itself as fast and low-memory.
  - It is demand-driven and horizontally threaded.
  - It has roughly three hundred operations and broad format support.
- Jimp evidence:
  - `npm view jimp version time dist-tags --json` showed latest `1.6.1`, published 2026-04-07.
  - Jimp README fetched from GitHub raw says it is entirely JavaScript with zero native dependencies.
  - `packages/jimp/README.md` fetched from GitHub raw lists default supported types:
    `@jimp/jpeg`, `@jimp/png`, `@jimp/bmp`, `@jimp/tiff`, and `@jimp/gif`.
  - Jimp package metadata fetched from GitHub raw shows browser export and `build:browser`.
- Sharp versioning evidence:
  - `lovell/sharp#1448` fetched. Maintainer said sharp places bug fixes and API additions in patch increments,
    and deprecations and breaking changes in minor increments. Maintainer promised `1.0.0` would happen in 2019.
  - `lovell/sharp#1754` fetched. Maintainer said `sharp v0.y.z` not only conforms to but exceeds semver.
  - `sharp v0.35.0` changelog fetched. It still includes explicit breaking changes:
    Node 18 dropped, install script removed, AVIF tuning changed, deprecated APIs removed,
    and `format.jp2k` renamed.

## Current interpretation

- `sharp` is mature despite being `0.x`.
- `sharp` uses `0.minor.patch` like `major.minor.patch` in practice.
- A normal npm range such as `^0.35.2` stays inside `0.35.x`, so caret ranges protect against `0.36.0`.
- The social cost is real: `0.x` miscommunicates maturity and makes breaking changes less visible to humans.
- The lifecycle build-script approval for `sharp` is mainly for the native source-build fallback, not for the normal
  prebuilt-binary path on common platforms.

## Required next step

Ask context-fork questions before recommending alternatives. Good questions:

- Target runtime: Node server only, Bun or Deno, browser or worker, serverless or edge.
- Primary workload: production thumbnails and optimization, small scripts and pixel manipulation, tests and fixtures,
  or user-facing upload pipeline.
- Required formats: AVIF or WebP, HEIC or TIFF, SVG or PDF input, animated GIF, raw pixels only.
- Trust and deployment tolerance: native binaries allowed, lifecycle scripts allowed, CI execution acceptable,
  or pure JS/Wasm required.

After the user answers, follow `choosing-technology` end to end:

- survey ready-to-use packages via npm and GitHub,
- clone finalists and serious alternatives under `/tmp/agent/`,
- inspect source, tests, CI, fuzzing or mutation-testing evidence,
- run full validation or disqualify tools that cannot be verified,
- compare human-auditability surfaces,
- name at least two rejected alternatives with concrete reasons,
- write the final choice to `docs/decisions/<project>.md` after the user picks.

## Cautions for future agent

- Do not answer "is there anything better" with a candidate from memory.
- Do not treat open issue count alone as maintenance evidence.
- Do not recommend a hand-rolled image wrapper before surveying existing packages.
- Do not skip validation because native or Wasm builds are heavy. Use a container or VM if needed.
- Keep this handover updated if the investigation continues.
