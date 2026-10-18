# Dependency footprint

## Measurement scope

Package-directory size alone omits shared dependencies behind `node_modules` symlinks.
The 2026-10-18 inventory follows installed package metadata recursively,
records absent edges,
and counts regular files once per device and inode.
It excludes nested `node_modules` from each directory scan,
then visits resolved dependency directories separately.
It excludes development dependency edges.
Workspace source,
tests,
caches and retained builds inside each visited package still count.
Asset symlinks are recorded without following them.

The private receipt owner is
`${HOME}/temp/agent/pi-mimo-preparation-failure-20261018/dependency-directory-inventory.ts`.
Its scopes have deliberately different meanings:

- `all-installed` counts installed production dependencies,
  peers and optional packages for every installed platform:
  96 directories and 252,839,286 unique regular-file bytes.
- `host-required` excludes optional peers and native packages incompatible with the measured
  Linux,
  x64,
  glibc host:
  81 directories and 117,291,830 unique regular-file bytes.
- `dependencies-only` also excludes every peer:
  28 directories and 32,640,783 unique regular-file bytes.
  Required Pi peers are absent from this scope,
  so it is not a runnable deployment closure.

These are named installed-directory snapshots during active repair,
not final package sizes or an executed import graph.
The package itself contributes 80,566,621 apparent regular-file bytes in this snapshot,
including repeated immutable release paths.
That apparent count does not deduplicate shared inodes.
The earlier 22,933,936-byte cleanup snapshot predates subsequent builds.

## Platform variants and optional peers

`valibot` declares TypeScript as an optional peer.
Following every installed peer therefore reaches TypeScript `7.0.2`
and its installed Darwin/Linux,
x64/arm64 native binaries.
Those binaries contribute 110,976,970 regular-file bytes before counting the TypeScript wrapper.
They are excluded from the host-required scope because that scope excludes the optional peer itself.
This is a measurement distinction,
not deletion or a demonstrated runtime improvement.

The repository's `supportedArchitectures` selection intentionally retains these platform families
and both glibc and musl variants.
Its portability rationale is recorded in
the [architecture selection decision](../../../../doc/decision/pnpm-supported-architectures.md).
Changing that shared selection would affect unrelated packages and cross-platform installation.

## Retained parser responsibilities

The parsers have different callers and input grammars:

- Satteri `0.10.5` supplies Markdown trees and original source offsets to policy indexing.
  The installed wrapper contributes 370,691 regular-file bytes;
  the host-compatible GNU/Linux x64 binding contributes 4,146,762 bytes.
  `native/contract/native-index/native-parser.ts` qualifies manifest identity,
  resolver identity,
  supported Markdown options and returned node shape.
- Yuku `0.19.0` parses JavaScript and TypeScript used by the qualified SDK transformations
  and supported program preparation.
  Its host-compatible native binding contributes 692,567 regular-file bytes.
  [Build lifecycle](build-lifecycle.md) and [operation preparation](operation-preparation.md)
  identify the consumers and their execution invariants.
- Unbash `5.1.0` supplies shell parsing through
  `@monochromatic-dev/agent-harness-shared-shell-command-analyzer`.
  Its installed directory contributes 330,535 regular-file bytes.
  The shared analyzer owns that grammar;
  auto-mode retains the parsed operation projection used in actual provider requests.

These package-directory measurements include metadata and declarations,
not only loaded native code.
They do not establish that every internal parser feature is exercised.

## Pi and provider libraries

The host-required inventory includes Pi's installed package directories,
separately from this package's owned transformed SDK artifact.
The installed coding-agent directory contributes 23,199,269 regular-file bytes.
The OpenAI and Anthropic SDK directories contribute 18,477,473 and 13,297,508 bytes respectively.
Those counts include source,
declarations and other installed files;
they are not measured imported-code sizes.
Configured model execution and original host behavior remain required consumer checks.

The resolver inventory records absent declared Bedrock and Google SDK edges.
`pnpm-workspace.yaml` explicitly removes those edges.
The [existing SDK staging diagnosis](../../../../doc/troubleshooting/pi-sdk-staging.md)
explains why published declarations are not the effective workspace selection.
The [dependency audit](../../../../doc/troubleshooting/dependencies.md)
records the lazy-provider and optional-fallback rationale.
Their absence is not a newly demonstrated installation failure.
This inventory does not establish that the removed providers work.

## Remaining completion evidence

Final reporting still needs a fresh package inode/allocation measurement,
reviewed inactive-release cleanup,
source/runtime/build/verification inventories,
and a deployment-oriented import or packaging inventory.
The installed-directory scopes remain useful evidence,
but none substitutes for exercising the configured consumer.
